import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import svelte from "@astrojs/svelte";

export default defineConfig({
 output: "static",
 site: process.env.SITE_URL || undefined,
 base: process.env.SITE_BASE || "/",
 trailingSlash: "always",
 integrations: [
  svelte(),
  starlight({
   title: "Groovectl",
   description: "Apple Music for agents: playlist craft, useful library tools and honest player control.",
   logo: { src: "./src/assets/mark.svg" },
   customCss: ["./src/styles/docs.css"],
   sidebar: [
    { label: "Start here", items: [
     { label: "Overview", slug: "docs/overview" },
     { label: "Install and connect", slug: "docs/install" },
     { label: "MusicKit setup", slug: "docs/reference/musickit" },
     { label: "Players and platforms", slug: "docs/reference/platforms" },
    ] },
    { label: "Make something", items: [
     { label: "Playlist studio", slug: "docs/reference/playlist-studio" },
     { label: "Cover artwork", slug: "docs/reference/artwork" },
     { label: "Capabilities and limits", slug: "docs/reference/apple-music-capabilities" },
    ] },
    { label: "Build and operate", items: [
     { label: "Architecture", slug: "docs/reference/architecture" },
     { label: "Deployment", slug: "docs/deployment" },
     { label: "Security and privacy", slug: "docs/security" },
     { label: "Contribute", slug: "docs/contribute" },
    ] },
   ],
  }),
 ],
 vite: { server: { fs: { allow: [".."] } } },
});
