from apple_music_hybrid.vendor.catalog_matching import best_song_match, version_noise_hits
from apple_music_hybrid.service import MusicService


def item(id, name, artist):
    return {"id": id, "attributes": {"name": name, "artistName": artist}}


def test_cover_by_another_artist_is_never_silently_selected():
    assert best_song_match("Song - Wanted Artist", [item("1", "Song", "Another Artist")]) is None


def test_alive_is_not_a_live_recording_marker():
    assert version_noise_hits("Alive") == []
    assert version_noise_hits("Alive (Live)") == ["live"]


def test_exact_version_beats_popular_live_version():
    matches = [item("1", "Song (Live)", "Artist"), item("2", "Song", "Artist")]
    assert best_song_match("Song - Artist", matches)["id"] == "2"


def test_only_alternate_recording_is_flagged(tmp_path, monkeypatch):
    monkeypatch.setenv("APPLE_MUSIC_HYBRID_DATA", str(tmp_path))

    class Catalog:
        def search(self, *_):
            return [item("1", "Song (Live)", "Artist")]

    result = MusicService(catalog=Catalog()).resolve("Song", "Artist")
    assert result["match"]["id"] == "1"
    assert result["needs_review"] is True
