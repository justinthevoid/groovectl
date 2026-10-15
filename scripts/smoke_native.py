"""Disposable native playlist and silent playback test. Restore settings in finally."""

import json
from pathlib import Path
import argparse
import time

from apple_music_hybrid.service import MusicService
from apple_music_hybrid.models import TrackRef


def main(receipt):
    service = MusicService()
    initial = service.native.status()
    if initial["state"] == "playing":
        raise SystemExit(
            "Music is playing; do not interrupt a listening session for this test."
        )
    tracks = service.native.search("", 3)["tracks"]
    assert len(tracks) == 3
    name = f"Apple Music Hybrid — disposable test {int(time.time())}"
    preview = service.preview(
        name, [TrackRef(source="native", id=t["id"]) for t in tracks[:2]]
    )
    result = service.apply(preview["plan_id"])
    assert result["state"] == "applied", result
    assert service.apply(preview["plan_id"]) == result
    playlist = result["result"]["playlist"]
    additions = service.preview(
        "",
        [TrackRef(source="native", id=t["id"]) for t in tracks],
        playlist_id=playlist["id"],
    )
    assert additions["payload"]["duplicates_removed"] == 2
    appended = service.apply(additions["plan_id"])
    assert appended["state"] == "applied", appended
    playback = {}
    try:
        service.native.playback("volume", 0)
        playback["play"] = service.native.playback("play", playlist_id=playlist["id"])[
            "state"
        ]
        playback["pause"] = service.native.playback("pause")["state"]
        assert playback["play"] == "playing" and playback["pause"] == "paused"
    finally:
        service.native.playback("stop")
        service.native.playback("volume", initial["volume"])
        if initial.get("track") and initial["state"] == "paused":
            service.native.playback("play", track_id=initial["track"]["id"])
            service.native.playback("pause")
            if initial.get("position") is not None:
                service.native.playback("seek", initial["position"])
    # Its tracks changed through the append plan, so the original creation snapshot is stale.
    # Clean up only after comparing the exact known result, using the native backend explicitly.
    current = service.native.playlist(playlist["id"])
    assert [t["id"] for t in current["tracks"]] == [t["id"] for t in tracks]
    service.native.delete_owned(playlist["id"], name)
    assert all(
        p["id"] != playlist["id"] for p in service.native.playlists()["playlists"]
    )
    service.plans.finish(
        preview["plan_id"], "deleted", {"playlist_id": playlist["id"], "verified": True}
    )
    report = {
        "native_playlist_create": True,
        "append_deduplicated": True,
        "retry_idempotent": True,
        "track_order_verified": True,
        "playback": playback,
        "volume_restored": service.native.status()["volume"] == initial["volume"],
        "disposable_playlist_removed": True,
    }
    receipt.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("receipt", type=Path)
    main(parser.parse_args().receipt)
