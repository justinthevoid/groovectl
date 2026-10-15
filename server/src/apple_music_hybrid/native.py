"""Music.app automation: fixed JXA reads and escaped, ID-addressed AppleScript writes."""

import json
from pathlib import Path
import re
import subprocess
import sys

from .vendor import applescript as upstream


def persistent_id(value: str) -> str:
    if not re.fullmatch(r"[0-9A-Fa-f]{16}", value):
        raise ValueError("A Music.app persistent ID (16 hex digits) is required.")
    return value.upper()


class NativeMusic:
    def request(self, op: str, **args) -> dict:
        if sys.platform != "darwin":
            raise RuntimeError("Native playback requires macOS and Music.app.")
        try:
            proc = subprocess.run(
                [
                    "/usr/bin/osascript",
                    "-l",
                    "JavaScript",
                    str(Path(__file__).with_name("music.js")),
                    json.dumps(dict(op=op, **args), ensure_ascii=False),
                ],
                capture_output=True,
                text=True,
                timeout=40,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("Music.app did not respond within 40 seconds.") from exc
        if proc.returncode:
            raise RuntimeError(
                "Music.app automation failed. Allow this host to control Music in "
                "System Settings > Privacy & Security > Automation. " + proc.stderr[-500:]
            )
        result = json.loads(proc.stdout)
        if "error" in result:
            raise ValueError(result["error"])
        return result

    def status(self):
        return self.request("status")

    def playlists(self):
        return self.request("playlists")

    def playlist(self, playlist_id: str):
        return self.request("playlist", id=persistent_id(playlist_id))

    def tracks(self, ids: list[str]):
        return self.request("tracks", ids=[persistent_id(value) for value in ids])["tracks"]

    def search(self, query: str, limit: int = 30, offset: int = 0):
        return self.request("search", query=query, limit=limit, offset=offset)

    def _run(self, script: str) -> str:
        ok, result = upstream.run_applescript(script)
        if not ok:
            raise RuntimeError(str(result))
        return result.strip()

    def create(self, name: str, track_ids: list[str]) -> dict:
        # Resolve every input before creating anything. The journal blocks retries after errors.
        ids = [persistent_id(value) for value in track_ids]
        escaped = upstream._escape_for_applescript(name)
        resolutions = "\n".join(
            f'set t{i} to first track of library playlist 1 whose persistent ID is "{value}"'
            for i, value in enumerate(ids)
        )
        adds = "\n".join(f"duplicate t{i} to p" for i in range(len(ids)))
        result = self._run(f'''tell application "Music"
{resolutions}
set p to make new user playlist with properties {{name:"{escaped}"}}
{adds}
return persistent ID of p
end tell''')
        return self.playlist(result)

    def append(self, playlist_id: str, track_ids: list[str]) -> dict:
        pid = persistent_id(playlist_id)
        ids = [persistent_id(value) for value in track_ids]
        resolves = "\n".join(
            f'set t{i} to first track of library playlist 1 whose persistent ID is "{value}"'
            for i, value in enumerate(ids)
        )
        adds = "\n".join(f"duplicate t{i} to p" for i in range(len(ids)))
        self._run(f'''tell application "Music"
set p to first user playlist whose persistent ID is "{pid}"
{resolves}
{adds}
end tell''')
        return self.playlist(pid)

    def playback(
        self, action: str, value=None, playlist_id: str | None = None, track_id: str | None = None
    ) -> dict:
        if action == "play" and (playlist_id or track_id):
            kind = "user playlist" if playlist_id else "track of library playlist 1"
            pid = persistent_id(playlist_id or track_id)
            self._run(
                f'tell application "Music" to play (first {kind} whose persistent ID is "{pid}")'
            )
        else:
            actions = {
                "play": upstream.play,
                "pause": upstream.pause,
                "stop": upstream.stop,
                "next": upstream.next_track,
                "previous": upstream.previous_track,
            }
            if action in actions:
                ok, result = actions[action]()
            elif action == "volume":
                if not isinstance(value, int) or not 0 <= value <= 100:
                    raise ValueError("Volume must be an integer from 0 to 100.")
                ok, result = upstream.set_volume(value)
            elif action == "seek":
                if not isinstance(value, (int, float)) or not 0 <= value <= 86400:
                    raise ValueError("Seek position must be between 0 and 86400 seconds.")
                ok, result = upstream.seek(value)
            else:
                raise ValueError("Unsupported playback action.")
            if not ok:
                raise RuntimeError(str(result))
        return self.status()

    def delete_owned(self, playlist_id: str, expected_name: str):
        # Called only by the service for a playlist created by a recorded successful plan.
        pid = persistent_id(playlist_id)
        name = upstream._escape_for_applescript(expected_name)
        return self._run(f'''tell application "Music"
set p to first user playlist whose persistent ID is "{pid}"
if name of p is not "{name}" then error "Playlist name changed; refusing deletion"
delete p
end tell''')
