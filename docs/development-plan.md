# Groovectl public-release development cycle

This is an active implementation plan, not a release claim. The 0.5.0 public preview is released; 0.5.1 is working through response-size, extension-host and player qualification. Installation receipts are kept separately from the distributable source. Work proceeds in reviewable checkpoints. Feature work is frozen while browser, archive, installation, platform and publication checks finish. Add further features only when a qualification failure or concrete release requirement justifies them.

## Product outcome

Make Apple Music useful to agents: discover exact recordings, build thoughtful playlists, preserve a listening story, explore a collection, and control a supported player. Offer creative help without forcing interviews or multiplying tools for each option. Keep the MCP tools useful without the dashboard. Ship a public project another person can understand, install, operate, audit and contribute to.

## Confirmed constraints

- Groovectl is the selected name. Preserve the installed plugin identity and existing private data.
- TypeScript owns the portable server; a narrow Swift helper supports macOS. Windows Apple Music and Cider have different capabilities.
- The host agent supplies musical judgment. Do not invent BPM, energy, release history or recording identity.
- Original briefs and hard constraints outrank random inspiration. Interviews are optional.
- Music writes use an immutable preview, a durable claim, accepted IDs/progress, and verification or an honest accepted/unknown result. Never replay uncertain writes.
- Image generation uses explicitly selected CLI allowances or configured BYOK. No automatic paid fallback, hidden retries or new charges.
- The website uses Astro 7, Svelte 5 and Starlight, with Cloudflare and VPS deployment paths. Prefer one static build where no server state is necessary.
- Public readiness includes security, privacy, contribution/support guidance, licenses, CI, release artifacts, install verification and honest platform limits.
- Prepare public code and deployment artifacts before the final publication review. Do not silently publish credentials, private development history or a remotely writable music endpoint.
- Honor host storage/build policies. Do not interfere with other projects, caches or services. Build/test on the Windows or Linux host where appropriate; native macOS compilation must pass the shared resource gate.

## Checkpoints

### A. Recording identity and useful API control

- [x] Accept catalog and API-library song references together, preserving imported/library-only recordings.
- [x] Resolve exact IDs and aliases; deduplicate across Apple mappings without treating ISRC similarity as equality.
- [x] Preserve legacy journal fingerprints and verify create/append order across namespace normalization.
- [x] Browse library folders and preview folder creation/playlist placement through typed operations.
- [x] Expand capability reporting so headless Linux/VPS use does not advertise desktop playback.
- [x] Test unavailable IDs, changed targets, partial acceptance, restart reuse and unknown outcomes.

### B. Distinctive curation workflows

- [x] Add a chapter-aware mixtape workflow: purposeful sections, runtime budget, pinned anchors and inspectable sequencing.
- [x] Offer useful recipe starting points such as Side A/Side B, taste bridges, album flights, rediscovery and time capsules through shared schemas/skills.
- [x] Preserve chapter membership in previews, snapshots and exports; keep original recordings intact.
- [x] Improve version inspection and user-facing reasons where real metadata supports them.
- [x] Extend the optional interview and examples without imposing a long questionnaire.

### C. MCP extension and installation

- [x] Reflect backend capabilities and setup state in the studio; handle unsupported, disconnected, empty and uncertain states.
- [x] Show chapters, recording provenance, provider limits and reviewed writes clearly in the app.
- [x] Check current MCP Apps/OpenAI Extensions guidance and retain SDK 1/2 client compatibility.
- [x] Exercise keyboard, narrow phone, desktop, light/dark and error recovery in the intended host/synthetic harness.
- [x] Verify portable packages outside the development checkout.
- [x] Keep agy experimental until an actual image is produced through normal permissions; do not bypass them.

### D. Public repository and release engineering

- [x] Add portable agent/contributor guidance, security/private reporting, privacy, support and community policies.
- [x] Build issue/PR templates and verify all pinned CI actions exist.
- [x] Add archive/install/preflight checks, dependency/license inventory and an explicit release process.
- [x] Test Linux, macOS and Windows at their actual qualification scope; keep native/device gaps visible.
- [x] Prepare clean public source history and scan source, packages, artwork metadata and examples for private data.
- [x] Prepare a release packet with checksums, changelog, known limits and submission materials.

### E. Identity, README and documentation website

- [x] Create a coherent logo/icon system, original README hero and supporting visual assets with provenance.
- [x] Write a useful, distinctive README with real examples, installation, capability matrix, architecture and deployment links.
- [x] Build an Astro 7/Svelte 5 landing page and Starlight docs covering getting started, MusicKit, clients, workflows, tools, players, artwork, security and troubleshooting.
- [x] Include an account-free interactive example that makes no fake personalization or real-write claims.
- [x] Self-host fonts/assets where practical; preserve accessibility and reduced motion.
- [x] Validate site build, navigation, links and mobile/desktop rendering; complete a bounded independent design review.

### F. Cloudflare and VPS operation

- [x] Package the static site for Workers Static Assets and a VPS container/reverse proxy.
- [x] Provide a real headless MCP deployment path with private persistent data and explicit authentication/transport limits.
- [x] Demonstrate private deployment/health checks without changing unrelated services or exposing account credentials.
- [x] Document environment variables, volumes, upgrades, rollback, backup/restore, limits and cost controls.
- [x] Publish a clean public GitHub repository and correct/complete its first CI gates.
- [ ] Publish registry/plugin-directory packages and select a public website hostname after their distribution-specific review.

## Evidence and completion

Each checkpoint records its source revision, checks actually run, live-service scope and remaining gaps. Unit tests do not qualify a desktop session; HTTP acceptance does not establish a completed library mutation; a site preview is not a published release. New personal taste changes are not performed just to test an endpoint.

0.4.0 baseline: 67 TypeScript tests passed on macOS; 66 passed and one POSIX-only test was skipped on Windows; 14 historical Python regressions passed. SDK 1/2 clients, PNG/JPEG results and the optional interview were checked. Codex had real image evidence. agy and charged BYOK calls, interactive Windows playback, authenticated Cider and custom-cover application remained unqualified. This baseline does not qualify later source changes.

Continue with the first unfinished checkpoint that can make meaningful progress. A blocked native build or unanswered publication decision does not prevent independent API, source, docs, asset, packaging or private-preview work. Do not mark the overall goal complete while required work remains.

## Next focused cycle

1. Bound workspace responses as journals grow. Return concise plan summaries for the dashboard and load a selected plan's full recordings/receipt through the existing inspector, preserving schemas and write safety. Avoid duplicating large plan histories into model-facing output.
2. Qualify actual expanded MCP App hosts and interactive Windows/Cider sessions, including unsupported controls and recovery. Installed apps and synthetic hosts are separate evidence.
3. Exercise mixed catalog/library and folder writes when a suitable requested playlist exists. Keep preferences and uncertain writes out of incidental testing.
4. Improve first-run setup and distribution: inspectable installer paths, an available npm package, signed/notarized helper distribution and a public docs hostname. Preserve source/release-tarball installation until each route is actually published.

Checkpoint A source checks: 85 TypeScript tests passed on macOS, including SDK 1/2 clients; build and type/UI checks passed. Read-only Apple folder discovery returned no root identity for this account. Contract coverage and remaining live/platform checks are recorded in [qualification.md](qualification.md). Original hero artwork is saved with provenance in assets/brand/.

## Final candidate boundary

The 0.5 source candidate includes a scoped independent studio verdict (four material fixes resolved), separate website design documentation, release/preflight and isolated-package checks, portable qualification and a real Codex artwork-worker example. The user subsequently authorized GitHub publication: clean public history is now available at https://github.com/justinthevoid/groovectl, with all first-run CI jobs passing after recorded repairs. GitHub's macOS runner also built/tested/packaged the helper with an ad hoc signature. Desktop runtime and notarization remain separate. Final archive hashes and private deployment URLs belong in the private release packet. npm/directory publication and a public site hostname remain pending; no paid service or live personal preference change is implied.
