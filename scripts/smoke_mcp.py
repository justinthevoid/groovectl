"""Exercise the installed stdio server using both protocol generations."""

import asyncio
import argparse
import json
from pathlib import Path

from mcp import Client
from mcp.client.stdio import StdioServerParameters


async def main(plugin_root=None):
    project = Path(__file__).resolve().parents[1]
    target = StdioServerParameters(
        command=str(project / "server/.venv/bin/python"),
        args=["-m", "apple_music_hybrid.cli", "serve"],
    )
    if plugin_root:
        config = json.loads((plugin_root / ".mcp.json").read_text())["mcpServers"]["apple-music-hybrid"]
        target = StdioServerParameters(command=config["command"], args=config["args"], cwd=str(plugin_root))
    for mode in ("2026-07-28", "legacy"):
        async with Client(target, mode=mode, read_timeout_seconds=60) as client:
            tools = await client.list_tools()
            assert len(tools.tools) == 15
            opening = next(t for t in tools.tools if t.name == "open_music")
            assert opening.meta["ui"]["resourceUri"].startswith("ui://")
            assert len(opening.meta["openai/ui"]["entrypoints"]) == 2
            resource = await client.read_resource(opening.meta["ui"]["resourceUri"])
            assert resource.contents[0].mime_type == "text/html;profile=mcp-app"
            assert "callServerTool" in resource.contents[0].text
            call = await client.call_tool(
                "search_catalog", {"query": "Fleetwood Mac Dreams", "limit": 2}
            )
            assert not call.is_error, call.content
            assert len(call.structured_content["songs"]) > 0
            invalid = await client.call_tool(
                "control_playback", {"action": "volume", "value": 1000}
            )
            assert invalid.is_error
            print(
                f"{mode}: {len(tools.tools)} tools, app resource, live catalog call, invalid input rejection passed.",
                flush=True,
            )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--plugin-root", type=Path)
    asyncio.run(main(parser.parse_args().plugin_root))
