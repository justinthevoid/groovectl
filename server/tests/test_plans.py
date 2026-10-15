import copy
import time

import pytest
from pydantic import ValidationError

from apple_music_hybrid.models import TrackRef, AudioFeature
from apple_music_hybrid.service import MusicService, audit_tracks
from apple_music_hybrid.storage import Plans, save_private


class Native:
    def __init__(self):
        self.calls = 0
        self.items = {}
        self.fail = False

    def tracks(self, ids):
        return [
            {
                "source": "native",
                "id": i,
                "name": f"Song {i}",
                "artist": "Artist",
                "duration_ms": 180000,
            }
            for i in ids
        ]

    def create(self, name, ids):
        self.calls += 1
        item = dict(source="native", id="F" * 16, name=name, tracks=self.tracks(ids))
        self.items[item["id"]] = item
        if self.fail:
            raise TimeoutError("The operation may have completed.")
        return copy.deepcopy(item)

    def playlist(self, pid):
        return copy.deepcopy(self.items[pid])

    def append(self, pid, ids):
        self.calls += 1
        self.items[pid]["tracks"].extend(self.tracks(ids))
        return self.playlist(pid)

    def delete_owned(self, pid, name):
        del self.items[pid]

    def playlists(self):
        return {"playlists": list(self.items.values())}


@pytest.fixture
def service(tmp_path, monkeypatch):
    monkeypatch.setenv("APPLE_MUSIC_HYBRID_DATA", str(tmp_path))
    return MusicService(native=Native(), plans=Plans(tmp_path))


def refs(*ids):
    return [TrackRef(source="native", id=i * 16) for i in ids]


def test_restart_retry_does_not_create_another_playlist(service):
    plan = service.preview('Quotes " and 🦉', refs("A", "B"))
    result = service.apply(plan["plan_id"])
    restarted = MusicService(native=service.native, plans=Plans(service.plans.path.parent))
    assert restarted.apply(plan["plan_id"]) == result
    assert service.native.calls == 1
    assert result["result"]["verified"] is True


def test_timeout_after_creation_is_not_retried(service):
    service.native.fail = True
    plan = service.preview("Timeout", refs("A"))
    with pytest.raises(RuntimeError, match="inspection"):
        service.apply(plan["plan_id"])
    with pytest.raises(ValueError, match="unknown"):
        service.apply(plan["plan_id"])
    assert service.native.calls == 1
    assert len(service.native.items) == 1


def test_changed_playlist_is_rejected_before_append(service):
    first = service.apply(service.preview("Original", refs("A"))["plan_id"])
    pid = first["result"]["playlist"]["id"]
    additions = service.preview("", refs("B"), playlist_id=pid)
    service.native.items[pid]["name"] = "Renamed in Music"
    with pytest.raises(ValueError, match="changed since preview"):
        service.apply(additions["plan_id"])
    assert service.native.calls == 1
    assert len(service.native.items[pid]["tracks"]) == 1


def test_duplicates_are_removed_in_preview(service):
    plan = service.preview("Dedup", refs("A", "A", "B"))
    assert plan["payload"]["duplicates_removed"] == 1
    assert len(plan["payload"]["tracks"]) == 2


def test_existing_tracks_are_omitted_from_additions(service):
    first = service.apply(service.preview("Original", refs("A"))["plan_id"])
    pid = first["result"]["playlist"]["id"]
    plan = service.preview("", refs("A", "B"), playlist_id=pid)
    result = service.apply(plan["plan_id"])
    assert [t["id"] for t in result["result"]["playlist"]["tracks"]] == ["A" * 16, "B" * 16]


def test_cancelled_and_expired_plans_do_not_write(service):
    plan = service.preview("Cancelled", refs("A"))
    service.plans.cancel(plan["plan_id"])
    with pytest.raises(ValueError, match="cancelled"):
        service.apply(plan["plan_id"])
    plan = service.preview("Expired", refs("A"))
    with service.plans.db() as db:
        db.execute("UPDATE plans SET expires=? WHERE id=?", (time.time() - 1, plan["plan_id"]))
    with pytest.raises(ValueError, match="expired"):
        service.apply(plan["plan_id"])
    assert service.native.calls == 0


def test_invalid_ids_and_mixed_sources_cannot_reach_writes(service):
    with pytest.raises(ValidationError):
        TrackRef(source="native", id='" & do shell script "touch bad')
    with pytest.raises(ValueError, match="one source"):
        service.preview("Mixed", refs("A") + [TrackRef(source="catalog", id="123")])
    assert service.native.calls == 0


def test_deletion_requires_owned_unchanged_playlist_and_exact_name(service):
    first = service.apply(service.preview("Disposable", refs("A"))["plan_id"])
    pid = first["result"]["playlist"]["id"]
    with pytest.raises(ValueError, match="exactly"):
        service.delete_created(first["plan_id"], "wrong")
    service.native.items[pid]["tracks"].extend(service.native.tracks(["B" * 16]))
    with pytest.raises(ValueError, match="changed"):
        service.delete_created(first["plan_id"], "Disposable")
    assert pid in service.native.items


def test_audit_reports_missing_features_without_inventing_values():
    tracks = Native().tracks(["A" * 16, "B" * 16])
    result = audit_tracks(tracks)
    assert result["audio_feature_coverage"]["available"] == 0
    assert result["adjacency_warnings"] == []
    result = audit_tracks(
        tracks, [AudioFeature(id="A" * 16, bpm=80), AudioFeature(id="B" * 16, bpm=90)]
    )
    assert "two_slow" in result["adjacency_warnings"][0]["rules"]


def test_private_files_are_never_created_world_readable(tmp_path):
    path = tmp_path / "config.json"
    save_private(path, {"secret": "test-only"})
    assert path.stat().st_mode & 0o777 == 0o600
