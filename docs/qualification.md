# Qualification ledger

Evidence belongs to a specific source checkpoint. Passing contract tests does not establish live account or desktop behavior.

## 0.5.1 response-size checkpoint — October 15, 2026

Workspace and studio refreshes now project compact plan/draft summaries. Selected plan recordings/receipts and saved brief constraints/suggestions remain available through existing inspectors; no journal rewrite or music mutation is involved. Linux type/UI checks and build passed with all 106 tests. A 20-plan × 200-recording regression checks a response below 20 KB and at least a 50-fold reduction relative to the full history, while complete receipts round-trip unchanged. A separate 20-draft case checks that unselected intents, exclusions, cover directions and suggestions are absent from list responses and preserved in the selected draft.

The dashboard loads selected details on demand. Final portable package checks, installed-plugin readback, live host rendering and interactive Windows/Cider receipts remain pending for this source checkpoint. The published 0.5.0 artifacts and successful merged-main CI are recorded in its [GitHub release](https://github.com/justinthevoid/groovectl/releases/tag/v0.5.0).

## First public CI qualification — October 15, 2026

The [public repository](https://github.com/justinthevoid/groovectl) is available. [PR #7's full CI run](https://github.com/justinthevoid/groovectl/actions/runs/38728497948), for head de78360, passed all seven jobs: TypeScript on Linux/macOS/Windows, retained Python regressions, native Swift packaging, website, and hardened headless sessions. The first failures were corrected rather than waived: uv now selects the declared dev group, license aggregation is deterministic across dependency layouts, and the Python fingerprint oracle reads its Unicode fixture as UTF-8 on Windows. The runtime fingerprint format did not change.

- Linux/macOS: 104 TypeScript tests passed. Windows: 103 passed and one POSIX-only symlink test skipped. All three passed checks, build, clean-tree preflight and isolated npm/plugin smoke checks.
- Python: all 14 historical regressions passed with the frozen uv lockfile.
- Swift: four hostless tests passed; the release helper built, app packaging completed and strict ad hoc signature verification passed on GitHub's macOS runner. This closes the newer packaging compile gate. It does not establish desktop Automation permission, runtime behavior, notarization or a signed public binary.
- Website: Astro checks/build, generated links and Cloudflare dry run passed. Headless: two isolated container sessions passed protocol/persistence smoke checks.
- Read-only Windows readiness found Apple Music and Cider installed but neither running. Interactive playback and authenticated Cider remain pending. No listening preferences or playlists were changed for these checks.

npm and the public plugin directory remain unpublished. The installed private plugin and plain MCP tools retain their own earlier runtime receipts. A synthetic MCP App harness does not qualify the actual ChatGPT/Codex extension host; its expanded UI still needs that host check.

## Public website motion checkpoint

The website now uses independent alpha vinyl, paper sleeve and tape images plus two original cover layers. Its GSAP scene assembles, separates in depth with ordinary scrolling, and reassembles; SplitText supplies heading motion, with pointer and control feedback. The source retains static, paused, reduced-motion and no-JavaScript paths. No music/account service is called by the site.

- Astro check/build passed with no errors/warnings. Root output verified 13 pages and 467 local references; the private subdirectory build verified 479. Cloudflare dry run passed without publication.
- Actual live viewport frames were inspected at 1280 × 720, 900 × 900 and 390 × 844, including separated and reassembled phone states. Static full-page reduced-motion/no-JavaScript views supplement those frames. Continuous frame pacing was not measured from still images.
- Real browser actions verified field locks, changed suggestions, preserved exclusions, polite announcements and clipboard success. Without JavaScript, every dependent choice/control and Copy are disabled while the sample remains selectable. Hydration enables the real composer.
- A fresh independent review requested two fixes: honest static controls and synchronized design documentation. Both were implemented and scored resolved with disposition ship at that fix-list scope. The prior direction/seed process limitation remains disclosed; no new comp or whole-surface approval is claimed.
- All 12 source rasters have provenance; the three new components have real alpha. The public README retains the original sculpture image. The website's pinned GSAP dependency has its own upstream license notice, distinct from the project's MIT code.

## Retained-reference dependency qualification

The first GitHub dependency scan reported vulnerable PyJWT and pytest pins in server/uv.lock, including [the PyJWT asymmetric-key guard advisory](https://github.com/jpadilla/pyjwt/security/advisories/GHSA-ffc3-869f-jxw9). The reference pins and lockfile were updated to PyJWT 2.15.0 and pytest 9.0.3 without changing the 14 migration tests. Only those two package versions changed. The retained Python implementation signs developer tokens; it is not included in the active TypeScript CLI or portable plugin runtime. Patched frozen-regression CI and GitHub's refreshed alert status must be checked before release; an advisory's severity alone is not an assertion that this application's signing path was exploitable.

## Unreleased API/control checkpoint — October 15, 2026

Implemented mixed catalog/API-library song references, Apple-provided alias-aware deduplication and ordered readback, optional parent placement for new API playlists, folder browsing/creation through reviewed plans, and explicit API-only/headless player capability reporting. Legacy journal payloads and fingerprint encoding remain supported.

- macOS: TypeScript and UI checks passed; bundled CLI/MCP App built; all 85 TypeScript tests passed, including SDK 1/2 stdio clients. Eighteen new tests cover mixed identities, imports, video substitutions, stale parents, folder pagination, accepted IDs, blocked replay and headless capabilities.
- Live Apple read: the root-folder endpoint returned an empty data array and empty root identity mapping for this account. The implementation reports root_not_returned and does not invent a root ID or a complete folder inventory. No folder or playlist was created for this qualification.
- Folder creation/placement and mixed-reference writes are contract-tested. Live write qualification remains pending, separately from previously verified catalog-only playlist creation.
- No native source changed. Prior Swift compile/tests and compatibility-bridge receipts remain historical evidence for that source; no new native build was attempted under current storage pressure.
- Source a8dc267: Windows passed checks/build and 84 tests with one POSIX-only skip; Linux on Node 24.22.0 and Bun 1.3.10 passed checks/build and all 85 tests. These are portable/source checks, not live Windows/Cider player qualification. Final package scans, isolated installs and later dashboard checks remain separate.
- All four pinned CI action commit SHAs were resolved successfully through GitHub's API. No GitHub Actions run is claimed before a repository/run exists.

Test logs are private development receipts; release artifacts must not include listening history, authentication files, personal account identifiers or these host-specific paths.

## Unreleased curation/headless checkpoint — October 15, 2026

Implemented listening-story chapters, within-chapter pinned recordings, preserved album runs, runtime reporting, six reusable recipe guides and local story retention across verified writes/snapshots/JSON export/import. External changes mark metadata stale. Local story-storage failure preserves a verified music-write receipt and blocks duplicate application. The studio shows structure and artist-spacing actions. Headless authorization now accepts a validated fixed unprivileged port and no-open browser option while retaining loopback/nonce/Host/Origin/token verification.

- macOS: checks/build and all 98 TypeScript tests passed, including SDK 1/2 stdio recipe discovery. Callback tests used synthetic credentials and a real loopback listener; no new Apple sign-in or account write was performed.
- Focused cases cover constraints, chapter coverage/order, anchors, duplicate aliases, missing runtime, restart retention, stale annotations, snapshots/import/export and post-write local-storage failure.
- Source c52a2f8: Windows passed checks/build and 97 tests with one POSIX-only skip; Linux on the pinned Node 24 image passed checks/build and all 98 tests. Browser qualification of the new studio controls remains pending. Installed private plugin remains 0.4.0 until the final package/update gate.
- The documentation website separately passed Astro check/build, generated-link checks (13 pages, 465 internal references), Cloudflare deployment dry run, responsive landing inspection and actual private HTTP 200/404/security-header checks. Documentation search returned MusicKit results and the dark-theme setup route rendered. This is a private static deployment, not public publication or a native MCP host receipt.
- Independent website verdict pass resolved the growing brief output and focus contrast defects. Direction provenance remains partial: the design roll was retrospective, without a public seed reference or user-approved comp. Design documentation describes the observed source; no whole-surface ship verdict is claimed.
- VPS server image built from c52a2f8's validated bundle, using the pinned Node 24 base. A real SDK 2 client connected through SSH stdio to two consecutive hardened container processes: each discovered 47 headless tools and the bundled MCP App, and the second read the first process's synthetic private draft from the same protected bind mount. No account credentials were copied and no Apple API/write was performed. Both containers exited; this is protocol/persistence evidence, not live VPS MusicKit authorization.

## 0.5.0 candidate: profile/artwork hardening

All 101 TypeScript tests and 14 retained Python regressions passed on macOS after type/UI checks and bundle build. New checks cover profile-limited player suppression and tool-set reporting, resource IDs that could otherwise normalize a path, and credential-free overrides for every configured Codex MCP server. Runtime, CLI, authorization page and MCP App now share a checked version constant. Helper packaging reads the release version and accepts a numeric build serial; it was syntax-checked, not compiled or notarized under current native resource constraints.

A live Codex worker run in isolated private storage produced a validated 1024 × 1024 PNG using the existing ChatGPT login. Connected apps, plugins, web search and configured MCP servers were disabled in that child. The CLI configuration probe independently confirmed all four configured servers disabled. No BYOK key, paid API fallback or Apple Music write was used. The original output is preserved; the public Between Stations example has truthful source/provenance. The private CLI/plugin installation is still 0.4.0 until final artifact/install checks.

The Mac encountered ENOSPC while copying artwork and later writing documentation. The original image remained intact; a metadata-free source copy matched its SHA-256. Current source was streamed to a private VPS backup. After confirming no active use and completing 101 TypeScript/14 Python checks, only this project's rebuildable node_modules and historical server/.venv were removed. Lockfiles, tests, source, credentials, native-build state and unrelated data were preserved. Headroom later recovered during concurrent system activity; the full free-space change is not attributed to those caches. Further builds run on Windows/VPS.

Linux passed checks/build and all 104 tests on the pinned Node 24 image. Windows passed checks/build and 103 tests with one POSIX-only symlink test skipped; checks/build and a standalone smoke were repeated after the UI-only review fixes. The final bundled CLI passed a standalone macOS stdio smoke (Node 26); a Node 24 archive smoke is part of the install gate. The three additional cases preserve unknown energy estimates, flag fuzzy artist/title matches and reject unsafe M3U links while counting all omitted tracks.

Unpacked npm/plugin bundles passed Linux standalone version, protocol, recipe and embedded-app checks. The Windows plugin bundle passed the same smoke. Two hardened VPS container processes exposed 47 headless tools and shared an isolated synthetic draft. These checks do not qualify live account writes. The first archive privacy pass found no private host paths, MusicKit values or key payloads; final source/history/archive scans and installation remain separate gates.

The current studio was inspected at 1280-pixel desktop and 390-pixel phone widths in light/dark synthetic MCP Apps hosts. Sequencing and previews retained the story, keyboard focus was visible, no horizontal overflow was observed, catalog-only actions were disabled/hidden, and headless playback stayed unavailable. Search failures preserved the query and brief; a later search recovered. An independent review requested four corrections: show runtime/preserved order in saved previews, require explicit clearing before adding a recording changes the story, name runtime in that action, and reset the stale footer when restoring a sequence. These were fixed as one batch. The reviewer scored all four resolved with disposition ship at that fix-list scope. The original whole-surface review and that verdict are not interchangeable. The harness does not qualify the installed ChatGPT host or real music mutations.

The website separately passed its final root-base checks/build, 463 internal link/asset checks and Cloudflare dry run. Its custom 404 is excluded from normal slug generation while consumed by Starlight's static 404 route; the only root-build warning is the absent canonical site URL, intentionally unresolved before a public hostname is selected.

## Historical installed 0.4.0 baseline

67 TypeScript tests on macOS; 66 passed plus one POSIX-only skip on Windows; 14 historical Python regressions. SDK 1/2 tool/resource interoperability and PNG/JPEG transport were checked. Codex has real cover-generation evidence. agy produced no image in the bounded trial and remains experimental. BYOK providers have contract tests but no charged live qualification. Interactive Windows media sessions, authenticated Cider and automatic custom-cover application remain pending. See the capability map for precise platform limits.
