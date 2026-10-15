"""Documented Apple Music API only; no web-token scraping or automatic write retries."""

import time
import re
from pathlib import Path

import httpx
import jwt

from .storage import data_dir, load_private


def song(item: dict) -> dict:
    a = item.get("attributes", {})
    return {
        "source": "catalog",
        "id": item["id"],
        "name": a.get("name", ""),
        "artist": a.get("artistName", ""),
        "album": a.get("albumName", ""),
        "duration_ms": a.get("durationInMillis", 0),
        "isrc": a.get("isrc"),
        "explicit": a.get("contentRating") == "explicit",
        "url": a.get("url"),
        "genres": a.get("genreNames", []),
        "release_date": a.get("releaseDate"),
        "playable": bool(a.get("playParams")),
    }


class AppleCatalog:
    base_url = "https://api.music.apple.com"

    def __init__(self):
        self.client = httpx.Client(timeout=25, follow_redirects=False)
        self._token = None
        self._expiry = 0

    def config(self):
        return load_private(data_dir() / "musickit.json")

    def readiness(self):
        config = self.config()
        return {
            "developer_key_configured": all(
                config.get(k) for k in ("key_id", "team_id", "key_path")
            ),
            "user_authorized": bool(load_private(data_dir() / "user.json").get("music_user_token")),
            "storefront": config.get("storefront", "us"),
        }

    def developer_token(self):
        if self._token and self._expiry > time.time() + 60:
            return self._token
        c = self.config()
        if not all(c.get(k) for k in ("key_id", "team_id", "key_path")):
            raise ValueError(
                "MusicKit key setup is pending. Native library and playback remain available."
            )
        key_path = Path(c["key_path"]).expanduser()
        if key_path.stat().st_mode & 0o077:
            raise ValueError("MusicKit private key must have file permissions 0600.")
        now = int(time.time())
        # Short-lived tokens; never place private-key contents in logs or tool results.
        self._expiry = now + 3600
        self._token = jwt.encode(
            {"iss": c["team_id"], "iat": now, "exp": self._expiry},
            key_path.read_text(),
            algorithm="ES256",
            headers={"kid": c["key_id"]},
        )
        return self._token

    def storefront(self):
        value = self.config().get("storefront", "us")
        if not re.fullmatch(r"[a-z]{2}", value):
            raise ValueError("Storefront must be a two-letter lowercase country code.")
        return value

    def request(self, method: str, path: str, *, personal=False, params=None, body=None):
        if not path.startswith("/v1/") or ".." in path or "?" in path or "#" in path:
            raise ValueError("Invalid Apple API path.")
        headers = {"Authorization": "Bearer " + self.developer_token()}
        if personal:
            user = load_private(data_dir() / "user.json").get("music_user_token")
            if not user:
                raise ValueError("Authorize Apple Music once with `apple-music-hybrid authorize`.")
            headers["Music-User-Token"] = user
        response = self.client.request(
            method, self.base_url + path, headers=headers, params=params, json=body
        )
        if response.status_code >= 400:
            # Do not echo response bodies, request headers, token-bearing URLs, or private configuration.
            raise RuntimeError(
                f"Apple Music API returned HTTP {response.status_code} for {method} {path}. "
                "Writes are not retried automatically."
            )
        return response.json() if response.content else {}

    def search(self, query: str, limit=20):
        data = self.request(
            "GET",
            f"/v1/catalog/{self.storefront()}/search",
            params={"term": query, "types": "songs", "limit": limit},
        )
        return data.get("results", {}).get("songs", {}).get("data", [])

    def tracks(self, ids: list[str]):
        if not ids:
            return []
        if any(not re.fullmatch(r"[0-9]{1,20}", value) for value in ids):
            raise ValueError("Invalid catalog song ID.")
        found = []
        for start in range(0, len(ids), 100):
            found.extend(
                self.request(
                    "GET",
                    f"/v1/catalog/{self.storefront()}/songs",
                    params={"ids": ",".join(ids[start : start + 100])},
                ).get("data", [])
            )
        mapping = {item["id"]: song(item) for item in found}
        missing = [value for value in ids if value not in mapping]
        if missing:
            raise ValueError(
                "Catalog recordings unavailable in this storefront: " + ", ".join(missing)
            )
        return [mapping[value] for value in ids]

    @staticmethod
    def playlist_id(value):
        if not re.fullmatch(r"[A-Za-z0-9.\-]{1,100}", value):
            raise ValueError("Invalid Apple Music library playlist ID.")
        return value

    def playlists(self, offset=0, limit=50):
        return self.request(
            "GET",
            "/v1/me/library/playlists",
            personal=True,
            params={"limit": limit, "offset": offset},
        )

    def playlist(self, playlist_id):
        pid = self.playlist_id(playlist_id)
        data = self.request(
            "GET", f"/v1/me/library/playlists/{pid}", personal=True, params={"include": "tracks"}
        ).get("data", [])
        if len(data) != 1:
            raise ValueError("Playlist not found.")
        item = data[0]
        rel = item.get("relationships", {}).get("tracks", {})
        tracks = list(rel.get("data", []))
        next_path = rel.get("next")
        while next_path:
            if len(tracks) >= 2000:
                raise ValueError("Playlist exceeds the 2000-track safety limit.")
            # Only Apple API relative pagination URLs; never forward tokens to another host.
            url = httpx.URL(next_path)
            if url.host or not url.path.startswith(f"/v1/me/library/playlists/{pid}/tracks"):
                raise ValueError("Unexpected Apple pagination URL.")
            page = self.request("GET", url.path, personal=True, params=dict(url.params))
            tracks.extend(page.get("data", []))
            next_path = page.get("next")
        out = []
        for t in tracks:
            a = t.get("attributes", {})
            catalog_id = a.get("playParams", {}).get("catalogId")
            out.append(
                {
                    "source": "catalog" if catalog_id else "library-api",
                    "id": catalog_id or t["id"],
                    "library_id": t["id"],
                    "name": a.get("name", ""),
                    "artist": a.get("artistName", ""),
                    "album": a.get("albumName", ""),
                    "duration_ms": a.get("durationInMillis", 0),
                }
            )
        return {
            "source": "catalog",
            "id": pid,
            "name": item.get("attributes", {}).get("name", ""),
            "editable": item.get("attributes", {}).get("canEdit", False),
            "tracks": out,
        }

    def create(self, name, description, ids):
        data = self.request(
            "POST",
            "/v1/me/library/playlists",
            personal=True,
            body={
                "attributes": {"name": name, "description": description},
                "relationships": {"tracks": {"data": [{"id": i, "type": "songs"} for i in ids]}},
            },
        )
        if not data.get("data"):
            raise RuntimeError(
                "Apple accepted the write without returning a playlist ID. Inspect your library."
            )
        return self.playlist(data["data"][0]["id"])

    def append(self, playlist_id, ids):
        pid = self.playlist_id(playlist_id)
        self.request(
            "POST",
            f"/v1/me/library/playlists/{pid}/tracks",
            personal=True,
            body={"data": [{"id": i, "type": "songs"} for i in ids]},
        )
        return self.playlist(pid)
