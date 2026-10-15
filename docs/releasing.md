# Release procedure

Groovectl is a local open-source MCP server. GitHub source publication, an npm package, a private ChatGPT plugin update, and public OpenAI plugin-directory submission are separate actions.

## Validate a source release

```sh
bun install --frozen-lockfile
bun run check
bun run build
bun run test
bun run test:legacy
```

The legacy test command uses uv and the frozen server/ lockfile, creating its own environment when needed. Python/uv are needed only for this historical regression suite, not the release CLI. Run it on a host with headroom; avoid recreating development caches on a storage-constrained Mac.

On a Mac with sufficient disk/memory and no conflicting native job:

```sh
bun run build:helper
```

The package gate runs hostless helper tests, a two-job Swift release build, app packaging and signature verification. On machines using the native-resource broker it reserves the shared slot and checks headroom; public source installs without that developer broker use a local build lock. There is no iOS build or simulator step.

Check real Music.app reads and guarded create/append/delete, a live Apple API read and catalog playlist create/readback where authorized, and the actual installed Cider/Windows player before claiming live support. Unit tests and a successful SSH connection do not qualify an interactive Windows media session.

## Package

```sh
bun run package:plugin -- --archive /private/output/groovectl-plugin-0.5.0.zip
npm pack --ignore-scripts --pack-destination /private/output
bun run preflight
```

Build first when using `--ignore-scripts`. The portable plugin includes the bundled CLI, UI, helper sources, notices and setup documentation. Node 24+ must be available to the host. The internal plugin slug remains `apple-music-hybrid` to preserve existing installations; the display name and CLI are Groovectl. Existing default prompts retain their historical names for compatibility.

Inspect both archives and the full Git history for keys, tokens, private paths, account IDs, databases, environments, caches and generated personal receipts. Never package real MusicKit configuration, a private `.p8`, `user.json` or a live journal. Retain all bundled license notices. Test an unpacked package outside the checkout so local `node_modules` cannot hide missing files/dependencies.

The preflight checks synchronized versions, installed plugin identity/prompts, policy and license files, source paths and bundled CLI/UI contents. It requires a clean worktree. `--allow-dirty` is a development scan only. It does not scan old history or compare real private configuration values: perform those separately before first publication. Use a clean, reviewed public source branch; private development ancestry and receipts are not release inputs.

Unpack both archives into separate temporary directories and run `node scripts/smoke-package.mjs /unpacked/package/dist/cli.js` and `node scripts/smoke-package.mjs /unpacked/apple-music-hybrid/runtime/dist/cli.js`. These assert the release version, stdio handshake, input validation, recipes and bundled app without using checkout dependencies. CI repeats them on each operating system. The headless CI job checks two container processes sharing isolated synthetic data with `scripts/smoke-headless.mjs`; it does not authorize Apple Music.

Record SHA-256 checksums, the exact public source commit, checks actually completed and known gaps in a release packet. Build the website with its intended `SITE_URL` and `SITE_BASE`, check local links and the deployed 404/security headers, and run `bun run deploy:check` in `site/`. The dry run does not publish. Refresh a private preview from that same source for review.

## Publish

1. Review the source diff, validation receipts, platform limits and MIT notices.
2. Confirm the repository owner/name and intended public visibility before first publication. Run the supplied CI on the published source; GitHub-hosted standard runners are free for public repositories under GitHub’s applicable plan terms. Do not enable paid private runner usage without a verified allowance.
3. Make a tagged GitHub release only after required checks pass. Attach the plugin ZIP, npm tarball, checksums and clear platform qualification notes.
4. If distributing a prebuilt Mac helper, Developer ID sign, notarize, staple and validate it. Local ad hoc signatures are not notarized distribution artifacts. Set signing/notarization credentials through CI secrets, never repository files.
5. Publish to npm under an available name, preferably with trusted publishing/provenance. Until the first npm publication, users install from a source checkout or release tarball; documentation must not imply that an unpublished package is already available.
6. Update the existing private account plugin through Plugin Creator with a guarded release ID and exact deletion list for retired Python files. Verify the resulting inventory and effective MCP command. Keep its existing audience.

Public OpenAI directory submission additionally requires its current submission workflow and listing/reviewer information; a GitHub release does not submit the plugin to that directory. For this local MCP package, [desktop-only submission](https://developers.openai.com/plugins/deploy/desktop-only) currently requires approved-partner eligibility and an allowlisted submitting organization. Establish that access before planning a directory launch. GitHub source/tarball installation and existing private distribution remain separate routes.
