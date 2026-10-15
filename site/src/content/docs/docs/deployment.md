---
title: Deploy the site or a headless server
---

The public documentation website and a private music-control server are separate deployments. The website is static: it contains no account credentials or writable MusicKit endpoint.

## Build the website

From site/:

    bun install --frozen-lockfile
    bun run check
    bun run build

Astro 7 builds the landing page, Svelte 5 brief composer and Starlight documentation into dist/. Maintained server documentation is copied at build time by a fixed allowlist. Set SITE_BASE when building for a subdirectory, and SITE_URL for the verified canonical origin. Do not put secrets in public build variables.

## Cloudflare

The site includes a project-local Wrangler configuration for Workers Static Assets. It needs no SSR adapter or account-data service. Validate the built output with deploy:check. Select the intended Cloudflare account and review its access and cost settings before deployment. The deploy script publishes the site; a dry run does not.

Keep a copy of the previous static artifact and its checksum for rollback. Do not add music credentials, image API keys or personal listening examples to the static asset directory.

## VPS

The same static dist/ output can be served by a dedicated unprivileged web container or your existing reverse proxy. Only expose that output directory. A private preview should use your existing private network/access controls and a distinct route; preserve other services.

The server's supported transport is stdio. A private VPS process can serve catalog/library and curation tools through an authenticated SSH stdio connection to a Node 24+ runtime. Persist its private data directory, protect MusicKit keys, and select the none player. This does not provide remote desktop playback or a public multi-user service.

The source includes digest-pinned deploy/site.Dockerfile and deploy/server.Dockerfile, a loopback-only static-site Compose configuration, and the full operator runbook in deploy/README.md. The runbook covers private routing, SSH stdio, persistent private volumes, health checks, upgrades, rollback and encrypted backup. The headless callback supports authorize --port 8788 --no-open with a matching SSH tunnel; it stays bound to 127.0.0.1 and still requires Apple sign-in.

No public remotely writable music endpoint is provided. Container checks and a real account authorization are separate qualification steps.
