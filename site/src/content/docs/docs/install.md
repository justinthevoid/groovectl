---
title: Install and connect
description: Install the CLI and connect a local MCP client.
---

## Requirements

Use Node 24 or newer. Development uses Bun 1.3.10. Native Music.app access requires macOS; the optional helper also needs Apple's Swift toolchain. MusicKit requires your own Apple developer credentials and an Apple Music account with the relevant access.

## Install from source

From a trusted Groovectl checkout:

    git clone https://github.com/justinthevoid/groovectl.git
    cd groovectl
    bun install --frozen-lockfile
    bun run build
    npm install --global . --ignore-scripts
    groovectl doctor

An already-built release tarball can be installed with npm's global install command and its local filename. Verify its published checksum before installing. There is no hidden postinstall helper build or key setup.

The website has an independent package and lockfile in site/. You do not need its dependencies to run the server.

## Choose your player

    groovectl select-player native
    groovectl select-player windows
    groovectl select-player cider
    groovectl select-player none

Choose one, not all four. Linux defaults to API-only (none). Native Mac playback does not need a MusicKit key. Cider requires its application token through setup-cider. Run doctor --probe to contact the selected player; an SSH connection alone does not qualify Windows interactive media sessions.

## Connect an MCP client

After installing the CLI, configure a local stdio server:

    {
      "mcpServers": {
        "groovectl": {
          "command": "groovectl",
          "args": ["serve"]
        }
      }
    }

If your graphical client cannot find the command, use an absolute Node path and the absolute path to dist/cli.js, followed by serve. Restart or reconnect the MCP client. Do not place MusicKit keys, tokens or BYOK values in a config shared with your agent.

Profiles full, curator, catalog and player reduce tool exposure. Catalog includes catalog and personal-library reads/account tools; it is not a read-only policy. Review individual tool annotations and your client's approvals.

## Connect MusicKit

Run setup, then authorize:

    groovectl setup
    groovectl authorize

Keep the .p8 key in a private operator directory. Never send it in chat or commit it. The MusicKit guide covers Media ID/key creation, sign-in, permissions and troubleshooting.

## Use the extension

A portable plugin ZIP includes the server, skill and studio for compatible local ChatGPT/Codex hosts. The host needs a local executor for local player access. The MCP App/OpenAI Extensions UI is optional; plain MCP clients receive structured tool results.

Try: “Make a 60-minute mix for a rainy drive. No live versions; show me the recordings and order before creating it.”
