# Groovectl website

Astro 7, Svelte 5 and Starlight, with self-hosted fonts and original project artwork. Requires Node 24+ and Bun 1.3.10. This package is independent from the MCP server; no website dependency is needed to run Groovectl.

Build from a full source checkout. Installed npm/plugin packages include this guide for reference, not the website source or build dependencies. Start at the repository root:

```sh
cd site
bun install --frozen-lockfile
bun run check
bun run build
bun run deploy:check
```

The build syncs six maintained root docs, generates dependency notices/inventory, builds responsive images and Pagefind search, and checks local page/asset/anchor links. The copied reference pages, logo, notices and favicon are generated/ignored; edit their root sources. Handwritten pages live in src/content/docs/docs/.

`SITE_URL` sets the verified canonical origin; `SITE_BASE` defaults to `/` and can target a subdirectory. Never put secrets in build variables. The listening-brief composer is browser-only and does not contact MusicKit, an agent, or an image provider.

The landing page uses pinned GSAP, ScrollTrigger and SplitText for a layered record sculpture that separates/reassembles during ordinary scrolling, word-level headline motion, pointer depth and control feedback. Pause motion settles readable content and disables the scroll animation. The complete static scene is visible without JavaScript; reduced motion also removes the sticky scene's extra scroll distance. No autoplay audio, idle loop or wheel interception is used. GSAP has its own standard no-charge license, preserved through its upstream source header in the generated notices; it is not covered by the project's MIT license.

See [deployment](../deploy/README.md) for Workers Static Assets and the unprivileged VPS container. `deploy` publishes; `deploy:check` only validates configuration/output. The private development preview is not a public website release.
