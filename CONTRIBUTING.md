# Contributing

Groovectl helps agents do useful things with music. Favor recording correctness, thoughtful curation and understandable controls over tool count.

## Development

Use Node 24+ and Bun 1.3.10. Run bun install --frozen-lockfile, bun run check, bun run build and bun run test from the root. The test script uses Node's SQLite runtime; bun test is not interchangeable. The original Python regression suite lives in server/ and is checked separately in CI.

The website is an independent Astro 7/Svelte 5/Starlight package in site/. Install its frozen lockfile and run its check/build commands. Build-time documentation sync reads a fixed allowlist of maintained root docs. Keep source docs authoritative.

Read [AGENTS.md](AGENTS.md), [architecture](docs/architecture.md), [platform details](docs/platforms.md) and the [release procedure](docs/releasing.md). Native helper work needs macOS and Swift 6+, and uses scripts/native/gate.sh with at most two compiler jobs; respect host resource policies and existing locks. A Mac build does not qualify Windows or Cider playback.

## Implementation expectations

- Preserve tool compatibility, recording namespaces, journal payloads and legacy fingerprints.
- Ground recordings in the requested backend. Only direct Apple aliases establish cross-namespace identity; similar titles or ISRC matches are candidates.
- Save and claim reviewed plans before account writes. Persist accepted identities/progress before readback. Do not retry an uncertain write.
- Extend shared workflows and schemas before adding tools. Keep the tools usable without the app UI.
- Preserve user intent, exclusions and locked interview fields during inspiration/rerolls.
- Keep image routing explicit, secrets private and cost/quota limitations visible.
- Support keyboard use, readable contrast, small screens and reduced motion.

Add focused tests for meaningful behavior and failure cases. Use synthetic fixtures, never private tokens/listening dumps. Do not change real taste preferences or create permanent account clutter just for testing. Report mock/contract, live API, native compilation and interactive qualification separately.

## Pull requests

Use a focused branch and conventional commit messages. Explain the problem, resulting behavior, validation and material gaps. Include a screenshot or recording for a UI change when useful, after checking it contains no private information. Retain upstream license notices. Review dependency and artifact changes as executable code.

The maintainer reviews public release, signing, registry publication and deployment. Do not commit generated runtime bundles or operator credentials. Follow the code of conduct and use private reporting for security issues.
