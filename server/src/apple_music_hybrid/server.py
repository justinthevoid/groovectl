from pathlib import Path
from functools import wraps
from typing import Annotated, Any, Literal

from mcp.server.apps import Apps, APP_MIME_TYPE
from mcp.server import MCPServer
from mcp.server.mcpserver.resources import TextResource
from mcp.server.mcpserver.exceptions import ToolError
from mcp_types import ToolAnnotations
from openai_mcp_extensions import (
    OpenAIExtensions,
    OpenAIGlobalEntrypoint,
    OpenAIThreadEntrypoint,
    OpenAIUiResourceMetadata,
    OpenAIUiToolMetadata,
)
from pydantic import Field

from .catalog import song
from .models import AudioFeature, TrackRef
from .service import MusicService
from .storage import mutation_lock

READ = ToolAnnotations(
    read_only_hint=True, destructive_hint=False, idempotent_hint=True, open_world_hint=False
)
WRITE = ToolAnnotations(
    read_only_hint=False, destructive_hint=False, idempotent_hint=False, open_world_hint=False
)
REMOTE_READ = ToolAnnotations(
    read_only_hint=True, destructive_hint=False, idempotent_hint=True, open_world_hint=True
)
REMOTE_WRITE = ToolAnnotations(
    read_only_hint=False, destructive_hint=False, idempotent_hint=False, open_world_hint=True
)
URI = "ui://apple-music-hybrid/workspace"


def expected_errors(fn):
    @wraps(fn)
    def call(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except (ValueError, RuntimeError) as exc:
            raise ToolError(str(exc)) from None

    return call


def build_server(service=None):
    music = service or MusicService()
    apps, extensions = Apps(), OpenAIExtensions()
    ui_path = Path(__file__).with_name("workspace.html")
    apps.add_resource(
        TextResource(
            uri=URI,
            name="Apple Music",
            mime_type=APP_MIME_TYPE,
            text=ui_path.read_text(),
            meta={
                "ui": {"csp": {"connectDomains": [], "resourceDomains": []}},
                "openai/ui": OpenAIUiResourceMetadata(
                    preferred_display_mode="fullscreen",
                    available_display_modes=["inline", "fullscreen"],
                ).model_dump(by_alias=True, exclude_none=True),
            },
        )
    )

    def workspace():
        return {
            "player": music.native.status(),
            "auth": music.catalog.readiness(),
            "plans": [
                p for p in music.plans.recent() if p["state"] not in ("deleted", "cancelled")
            ],
        }

    @apps.tool(
        resource_uri=URI,
        annotations=READ,
        title="Apple Music",
        meta={
            "openai/ui": OpenAIUiToolMetadata(
                entrypoints=[OpenAIGlobalEntrypoint(), OpenAIThreadEntrypoint()]
            ).model_dump(by_alias=True, exclude_none=True)
        },
    )
    @expected_errors
    def open_music() -> dict[str, Any]:
        """Open the Apple Music player and playlist previews. Native status does not launch Music.app."""
        return workspace()

    server = MCPServer(
        "Apple Music Hybrid",
        extensions=[apps, extensions],
        instructions="Curate from the user's brief using your musical judgment. Search and resolve exact recordings, "
        "preview their order, then apply only the requested creation/addition. Native and catalog IDs are different "
        "namespaces. Never invent catalog IDs, audio features, or authorization. No raw script execution is exposed. "
        "A plan with unknown or needs_review state must be inspected, never blindly retried.",
    )

    @server.tool(annotations=READ)
    @expected_errors
    def get_music_workspace() -> dict[str, Any]:
        """Refresh playback, MusicKit readiness, and the last 20 persisted playlist plans."""
        return workspace()

    @server.tool(annotations=READ)
    @expected_errors
    def get_playback_state() -> dict[str, Any]:
        """Read Music.app's current song, position, and volume; does not launch the app."""
        return music.native.status()

    @server.tool(annotations=READ)
    @expected_errors
    def search_library(
        query: Annotated[str, Field(max_length=200)] = "",
        limit: Annotated[int, Field(ge=1, le=100)] = 30,
        offset: Annotated[int, Field(ge=0, le=100000)] = 0,
    ) -> dict[str, Any]:
        """Search the native Music.app library. Returns stable persistent IDs, with bounded pagination."""
        return music.native.search(query, limit, offset)

    @server.tool(annotations=REMOTE_READ)
    @expected_errors
    def search_catalog(
        query: Annotated[str, Field(min_length=1, max_length=200)],
        limit: Annotated[int, Field(ge=1, le=25)] = 20,
    ) -> dict[str, Any]:
        """Search the official Apple Music catalog in your configured storefront. Requires a MusicKit key."""
        return {
            "storefront": music.catalog.storefront(),
            "songs": [song(t) for t in music.catalog.search(query, limit)],
        }

    @server.tool(annotations=REMOTE_READ)
    @expected_errors
    def resolve_recording(
        title: Annotated[str, Field(min_length=1, max_length=200)],
        artist: Annotated[str, Field(min_length=1, max_length=200)],
    ) -> dict[str, Any]:
        """Ground a title and artist against Apple Music; reject unrelated hits and flag alternate/live/remastered versions."""
        return music.resolve(title, artist)

    @server.tool(annotations=REMOTE_READ)
    @expected_errors
    def list_playlists(
        source: Literal["native", "catalog"] = "native",
        offset: Annotated[int, Field(ge=0, le=100000)] = 0,
    ) -> dict[str, Any]:
        """List native playlists by persistent ID, or your official API library playlists by their API IDs."""
        return music.native.playlists() if source == "native" else music.catalog.playlists(offset)

    @server.tool(annotations=REMOTE_READ)
    @expected_errors
    def get_playlist(source: Literal["native", "catalog"], playlist_id: str) -> dict[str, Any]:
        """Read the playlist and ordered tracks from the specified ID namespace. Safety limit: 2000 tracks."""
        return music.get_playlist(source, playlist_id)

    @server.tool(annotations=REMOTE_READ)
    @expected_errors
    def preview_playlist(
        name: Annotated[str, Field(min_length=1, max_length=120)],
        tracks: Annotated[list[TrackRef], Field(min_length=1, max_length=200)],
        description: Annotated[str, Field(max_length=2000)] = "",
        features: list[AudioFeature] | None = None,
    ) -> dict[str, Any]:
        """Ground recordings and save a create plan with listening-flow audit. Does not alter Apple Music. Use native library OR catalog tracks per plan."""
        return music.preview(name, tracks, description, features=features)

    @server.tool(annotations=REMOTE_READ)
    @expected_errors
    def preview_playlist_additions(
        playlist_id: str, tracks: Annotated[list[TrackRef], Field(min_length=1, max_length=200)]
    ) -> dict[str, Any]:
        """Preview additions, omit existing/duplicate recordings, and fingerprint the target to detect later edits."""
        return music.preview("", tracks, playlist_id=playlist_id)

    @server.tool(annotations=REMOTE_WRITE)
    @expected_errors
    def apply_playlist_plan(plan_id: str) -> dict[str, Any]:
        """Apply a requested preview once and verify track order/count. Retries return the durable successful result; uncertain writes are blocked."""
        return music.apply(plan_id)

    @server.tool(annotations=READ)
    @expected_errors
    def inspect_playlist_plan(plan_id: str) -> dict[str, Any]:
        """Read a plan's tracks, audit, state and saved write result."""
        return music.plans.get(plan_id)

    @server.tool(annotations=WRITE)
    @expected_errors
    def cancel_playlist_plan(plan_id: str) -> dict[str, Any]:
        """Cancel a ready preview. Does not remove a playlist or change the music library."""
        return music.plans.cancel(plan_id)

    @server.tool(annotations=WRITE)
    @expected_errors
    def control_playback(
        action: Literal["play", "pause", "stop", "next", "previous", "volume", "seek"],
        value: float | None = None,
        playlist_id: str | None = None,
        track_id: str | None = None,
    ) -> dict[str, Any]:
        """Control Music.app. Play can target one native persistent playlist/track ID. Volume is 0–100; seek is seconds. Never plays audio unless requested."""
        if playlist_id and track_id:
            raise ValueError("Select a playlist or a track, not both.")
        if action != "play" and (playlist_id or track_id):
            raise ValueError("Track and playlist IDs are only valid for play.")
        if action == "volume":
            if value is None or not value.is_integer():
                raise ValueError("Volume must be an integer from 0 to 100.")
            value = int(value)
        with mutation_lock():
            return music.native.playback(action, value, playlist_id, track_id)

    @server.tool(
        annotations=ToolAnnotations(
            read_only_hint=False,
            destructive_hint=True,
            idempotent_hint=False,
            open_world_hint=False,
        )
    )
    @expected_errors
    def delete_created_playlist(plan_id: str, confirmation: str) -> dict[str, Any]:
        """Remove ONLY an unchanged native playlist created by this server's successful plan. Requires its exact name and a user deletion request. Existing playlists and library tracks cannot be deleted."""
        return music.delete_created(plan_id, confirmation)

    @server.prompt()
    def curate_playlist(brief: str, count: str = "20") -> str:
        """Guide the host agent from a natural-language brief to a verified Apple Music playlist."""
        return (
            f"Curate {count} tracks for: {brief}\nUse the user's listening context, era, genre, mood, and exclusions. "
            "Explain choices and listening order briefly. Search_catalog and resolve_recording verify recordings; "
            "use search_library when native tracks suffice. Review ambiguous alternate versions. Keep intentional "
            "narrative sections and vary artists. Preview_playlist gives a stable plan and audit, then apply that "
            "plan when creation was requested. Do not invent BPM/key/energy; optional supplied features are estimates. "
            "Do not change playback unless requested. Inspect any uncertain write outcome before acting."
        )

    return server
