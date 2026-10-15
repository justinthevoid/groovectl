# Deploy Groovectl

The static website and private Apple Music server are separate. The website needs no secrets. The music server uses **stdio**, one operator's private storage and an authenticated execution host. It is not a multi-user HTTP service.

These build/container recipes require the full source checkout and its reviewed build outputs. The plugin includes this guide as reference; it does not include the website source or deployment build context. An installed CLI can still serve directly over private SSH stdio without building a container.

## Static website

Build from the repository root with Node 24+ and Bun 1.3.10:

```sh
cd site
bun install --frozen-lockfile
bun run check
bun run build
bun run deploy:check
```

`dist/` is the complete website. Set `SITE_URL=https://your-verified-domain.example` when building canonical URLs. `SITE_BASE=/groovectl/` supports a subdirectory; build again for `/` when deploying at a domain root. Never use credentials in a `PUBLIC_*`, `SITE_*` or other website build variable.

### Cloudflare Workers Static Assets

`site/wrangler.jsonc` deploys only `site/dist` with HTML handling and a real 404 page. No SSR adapter, database, MusicKit proxy or image endpoint is required. Review the selected account, project name, route and free-plan limits, then run `bun run deploy` from `site/`. That command publishes; `deploy:check` does not. Domain registration and any paid plan are separate operator choices.

Keep the previous known-good build and its source revision. Cloudflare retains deployment versions; choose the intended prior version in its deployment history for rollback. Rebuilding older source is a fallback, and requires its frozen lockfile and build settings.

### VPS static container

From the root after building the site:

```sh
docker compose -f deploy/compose.site.yml build
docker compose -f deploy/compose.site.yml up -d
curl --fail http://127.0.0.1:57784/
docker compose -f deploy/compose.site.yml ps
```

The container uses an unprivileged, digest-pinned Nginx image; a read-only filesystem; no Linux capabilities; 128 MiB RAM; and a loopback-only port. Put a private network or your existing HTTPS reverse proxy in front of that **specific port**. Preserve existing routes and do not expose the source checkout. The included Nginx configuration serves root builds and the documented `/groovectl/` private preview prefix. Use a distinct route/port for another base path.

For a private Tailscale preview, build with the actual tailnet HTTPS origin and `/groovectl/` base, then add only that path to an existing Tailscale Serve listener. Check `tailscale serve status` before and after. Do not use Funnel unless you intend public exposure. Tailscale Serve supplies TLS; the container remains local. No account data belongs in this container or static output.

Tag immutable images with the source revision and save the previous image before upgrading. To roll back, select the previous image tag and recreate only the docs service. Verify the landing page, a documentation page, an optimized image, search assets and a nonexistent URL returning 404. A healthy container alone does not verify the external route.

## Headless Apple Music MCP

Linux defaults to `GROOVECTL_PLAYER=none`. Catalog/library reads, curation and reviewed API writes use MusicKit. A VPS cannot control Music.app on another computer. Image CLI providers need their own supported installation and sign-in on the execution host; the minimal server image includes no CLI provider or API keys.

### Native Node installation

Install a reviewed release tarball with Node 24+. Use an operator-owned private data directory and an absolute executable path. Run configuration on the execution host, using its local path to the `.p8` key:

```sh
GROOVECTL_DATA=/private/operator/groovectl groovectl configure \
  --key-path /private/operator/keys/MusicKit.p8 --key-id YOURKEYID0 --team-id YOURTEAM00
GROOVECTL_DATA=/private/operator/groovectl groovectl authorize --port 8788 --no-open
```

The IDs are placeholders. Keep the key mode 0600 and its directories private. The command prints a short-lived local authorization URL. Treat it as a credential-bearing setup link and keep it out of tickets, screenshots and public logs.

Before opening that link on your own computer, establish the matching SSH tunnel in another terminal:

```sh
ssh -N -L 127.0.0.1:8788:127.0.0.1:8788 your-music-host
```

Open the printed **127.0.0.1** URL unchanged in the browser on your computer. The callback stays on execution-host loopback, requires its random path, exact Host/Origin and bounded JSON, and verifies the token with Apple before saving. A setup session expires after ten minutes. Port 0 chooses a random port; use a fixed unprivileged port for a tunnel. No wildcard callback binding is provided. Close the tunnel after setup.

Configure an MCP client to start the remote process through SSH (replace placeholders with your paths):

```json
{
  "mcpServers": {
    "groovectl-remote": {
      "command": "ssh",
      "args": ["-T", "your-music-host", "env", "GROOVECTL_DATA=/private/operator/groovectl", "GROOVECTL_PLAYER=none", "/absolute/path/to/groovectl", "serve", "--profile", "curator"]
    }
  }
}
```

Use verified SSH host keys and existing authenticated access. Do not disable host-key checking or put keys/tokens into this JSON. A profile reduces tool exposure, not the account's privileges; inspect tool annotations and retain your client's approvals.

### Minimal server container

Build the bundle first (`bun run build`), then:

```sh
docker build -f deploy/server.Dockerfile -t groovectl-server:local .
docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,noexec,nosuid,size=32m --memory 256m --cpus 1 \
  groovectl-server:local --version
```

The image runs as UID/GID 1000. Prepare a private bind mount writable by that UID/GID, with protected keys and `musickit.json` pointing to the key's **container** path. Keep that volume outside the checkout and build context. Docker-daemon privileges are broader than the music process; review access before granting them.

A configured stdio run uses `-i`, **no TTY**, no published ports, and only the private volume:

```sh
docker run --rm -i --read-only --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,noexec,nosuid,size=32m --memory 256m --cpus 1 \
  --mount type=bind,src=/private/operator/groovectl,dst=/data \
  groovectl-server:local serve --profile curator
```

The default data path is `/data`, the player is `none`, and protocol messages occupy stdout. No detached music daemon or open port is needed. Start this command through the SSH stdio pattern when the client is remote.

For authorization **only**, a Linux container's loopback callback cannot be reached through ordinary Docker port publishing. Run the reviewed setup image with `--network=host`, retain the private volume, use `authorize --port 8788 --no-open`, and forward that loopback port over SSH. Host networking is unnecessary for stdio operation. Never solve this by binding the callback to 0.0.0.0. Setup requires the operator's Apple sign-in; a synthetic callback test is not a live authorization receipt.

## Health, upgrades and recovery

- `groovectl doctor` reports configuration, provider and player readiness. `doctor --probe` also contacts the configured service/player. Keep diagnostic output private.
- An MCP client should initialize, list tools and call `get_capabilities`; check API authorization independently. An SSH handshake or image build does not qualify Apple account access.
- Stop music processes before taking a consistent encrypted backup of the **entire** private directory and external key. Preserve file permissions, SQLite journals and ownership. Do not selectively restore only a key or plans database. Backups contain listening data, tokens and image-provider secrets.
- Keep the previous package/image and a pre-upgrade backup. Review schema compatibility before rollback; restoring an old database over later writes can erase receipts. Never blindly replay an `applying`, `accepted`, `needs_review` or `unknown` plan after recovery.
- Plan state and artwork request IDs prevent automatic repeats; they cannot prove an external write's outcome after a disaster. Inspect Apple Music and retain accepted IDs.
- Revoke compromised keys/tokens with their issuer, stop relevant processes, then reconfigure. Never publish logs or backups to request support.

Checks and remaining live qualification are recorded in [qualification](../docs/qualification.md). Preparation and private previews do not imply public deployment or release.
