"""Ground identities before writes; journal attempts and verify the resulting track order."""

import hashlib
import json
from collections import Counter

from .catalog import AppleCatalog, song
from .models import AudioFeature, TrackRef
from .native import NativeMusic
from .storage import Plans, mutation_lock
from .vendor.catalog_matching import (
    best_song_match,
    has_unrequested_title_suffix,
    version_noise_hits,
)
from .vendor.playlist_core import check_pair, fold_tempo


def fingerprint(playlist):
    relevant = [
        playlist["id"],
        playlist["name"],
        [(t["source"], t["id"]) for t in playlist["tracks"]],
    ]
    return hashlib.sha256(json.dumps(relevant, sort_keys=True).encode()).hexdigest()


def audit_tracks(tracks: list[dict], features: list[AudioFeature] | None = None):
    counts = Counter((t["source"], t["id"]) for t in tracks)
    supplied = {f.id: f.model_dump() for f in (features or [])}
    pair_warnings = []
    covered = 0
    prepared = []
    for t in tracks:
        feature = supplied.get(t["id"])
        if feature and feature.get("bpm"):
            feature = dict(feature, bpm=fold_tempo(feature["bpm"]))
            covered += 1
        prepared.append(feature)
    for i in range(1, len(tracks)):
        issues = sorted(check_pair(prepared[i - 1], prepared[i]))
        if issues:
            pair_warnings.append({"from_position": i, "to_position": i + 1, "rules": issues})
    return {
        "track_count": len(tracks),
        "duration_minutes": round(sum(t.get("duration_ms", 0) for t in tracks) / 60000, 1),
        "duplicates": [{"source": s, "id": i, "count": c} for (s, i), c in counts.items() if c > 1],
        "repeated_artists": [
            {"artist": a, "count": c}
            for a, c in Counter(t["artist"] for t in tracks).items()
            if c > 2
        ],
        "version_qualifiers": [
            {"position": i + 1, "name": t["name"], "markers": version_noise_hits(t["name"])}
            for i, t in enumerate(tracks)
            if version_noise_hits(t["name"])
        ],
        "audio_feature_coverage": {
            "available": covered,
            "total": len(tracks),
            "source": "user-supplied estimates",
        },
        "adjacency_warnings": pair_warnings,
        "note": "Musical taste and listening flow remain the host agent's judgment. Audio features are optional estimates; missing features are not scored.",
    }


class MusicService:
    def __init__(self, native=None, catalog=None, plans=None):
        self.native = native or NativeMusic()
        self.catalog = catalog or AppleCatalog()
        self.plans = plans or Plans()

    def resolve(self, title, artist):
        if " - " in title or " - " in artist:
            # The upstream matcher uses a title/artist separator. Keep structured inputs unambiguous.
            query_title = title.replace(" - ", " – ")
            query_artist = artist.replace(" - ", " – ")
        else:
            query_title, query_artist = title, artist
        query = f"{query_title} - {query_artist}"
        candidates = self.catalog.search(f"{title} {artist}", 25)
        match = best_song_match(query, candidates)
        return {
            "query": {"title": title, "artist": artist},
            "match": song(match) if match else None,
            "needs_review": bool(
                match
                and (
                    has_unrequested_title_suffix(title, match.get("attributes", {}).get("name", ""))
                    or set(version_noise_hits(match.get("attributes", {}).get("name", "")))
                    - set(version_noise_hits(title))
                )
            ),
            "candidates": [song(c) for c in candidates[:10]],
        }

    def grounded(self, refs):
        if not refs or len(refs) > 200:
            raise ValueError("A playlist plan needs 1–200 tracks.")
        if len({r.source for r in refs}) != 1:
            raise ValueError(
                "Use one source per plan: native library tracks or Apple Music catalog songs."
            )
        return (self.native.tracks if refs[0].source == "native" else self.catalog.tracks)(
            [r.id for r in refs]
        )

    def get_playlist(self, source, playlist_id):
        return (self.native if source == "native" else self.catalog).playlist(playlist_id)

    def preview(self, name, refs: list[TrackRef], description="", playlist_id=None, features=None):
        tracks = self.grounded(refs)
        source = refs[0].source
        target = self.get_playlist(source, playlist_id) if playlist_id else None
        if target and (target.get("smart") or target.get("editable") is False):
            raise ValueError("Target playlist is not editable.")
        seen = {(t["source"], t["id"]) for t in target["tracks"]} if target else set()
        additions = []
        for t in tracks:
            key = (t["source"], t["id"])
            if key not in seen:
                additions.append(t)
                seen.add(key)
        if not additions:
            raise ValueError("No new tracks; every selected recording is already included.")
        payload = {
            "operation": "append" if target else "create",
            "source": source,
            "name": target["name"] if target else name,
            "description": description,
            "tracks": additions,
            "playlist_id": playlist_id,
            "before_fingerprint": fingerprint(target) if target else None,
            "expected_ids": [t["id"] for t in target["tracks"]] if target else [],
            "audit": audit_tracks((target["tracks"] if target else []) + additions, features),
            "duplicates_removed": len(tracks) - len(additions),
        }
        return self.plans.create(payload)

    def apply(self, plan_id):
        with mutation_lock():
            plan = self.plans.get(plan_id)
            if plan["state"] == "applied":
                return plan  # The durable result, never a repeated API call.
            if plan["state"] != "ready":
                raise ValueError(
                    f"Plan state is {plan['state']}; inspect the saved result before taking another action."
                )
            p = plan["payload"]
            backend = self.native if p["source"] == "native" else self.catalog
            if p["operation"] == "append":
                current = backend.playlist(p["playlist_id"])
                if fingerprint(current) != p["before_fingerprint"]:
                    raise ValueError("Playlist changed since preview; make a fresh plan.")
            # Auth/read validation happens before claiming the write.
            if p["source"] == "catalog":
                if not self.catalog.readiness()["user_authorized"]:
                    raise ValueError(
                        "Apple Music user authorization is required before applying catalog plans."
                    )
                self.catalog.developer_token()
            self.plans.claim(plan_id)
            try:
                ids = [t["id"] for t in p["tracks"]]
                if p["operation"] == "append":
                    result = backend.append(p["playlist_id"], ids)
                elif p["source"] == "native":
                    result = backend.create(p["name"], ids)
                else:
                    result = backend.create(p["name"], p["description"], ids)
                expected = p["expected_ids"] + ids
                actual = [t["id"] for t in result["tracks"]]
                if actual != expected:
                    self.plans.finish(
                        plan_id,
                        "needs_review",
                        {
                            "playlist": result,
                            "expected_ids": expected,
                            "message": "Write completed but track order/count did not match. Do not retry.",
                        },
                    )
                else:
                    self.plans.finish(plan_id, "applied", {"playlist": result, "verified": True})
            except Exception as exc:
                self.plans.finish(plan_id, "unknown", {"message": str(exc), "retry_safe": False})
                raise RuntimeError(
                    "Write outcome needs inspection. This plan is blocked from automatic retry."
                ) from exc
            return self.plans.get(plan_id)

    def delete_created(self, plan_id, confirmation):
        with mutation_lock():
            plan = self.plans.get(plan_id)
            p = plan["payload"]
            if plan["state"] != "applied" or p["operation"] != "create" or p["source"] != "native":
                raise ValueError(
                    "Only a native playlist created by an applied plan can be removed here."
                )
            item = plan["result"]["playlist"]
            if confirmation != item["name"]:
                raise ValueError("Confirmation must exactly match the created playlist name.")
            if fingerprint(self.native.playlist(item["id"])) != fingerprint(item):
                raise ValueError("Playlist changed after creation; refusing deletion.")
            self.plans.finish(plan_id, "deleting", {"playlist": item})
            try:
                self.native.delete_owned(item["id"], item["name"])
                remaining = self.native.playlists()["playlists"]
                if any(p["id"] == item["id"] for p in remaining):
                    raise RuntimeError("Playlist still exists after deletion.")
                self.plans.finish(plan_id, "deleted", {"playlist_id": item["id"], "verified": True})
            except Exception as exc:
                self.plans.finish(plan_id, "unknown", {"message": str(exc), "retry_safe": False})
                raise
            return self.plans.get(plan_id)
