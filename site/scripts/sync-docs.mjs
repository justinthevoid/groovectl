import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const site = dirname(dirname(fileURLToPath(import.meta.url)));
const project = dirname(site);
const base = (process.env.SITE_BASE || "/").replace(/\/$/, "");
const names = [
	"musickit",
	"platforms",
	"playlist-studio",
	"artwork",
	"apple-music-capabilities",
	"architecture",
];
const target = join(site, "src/content/docs/docs/reference");
mkdirSync(target, { recursive: true });
for (const name of names) {
	const source = readFileSync(join(project, "docs", name + ".md"), "utf8");
	const title = source.match(/^# (.+)$/m)?.[1] || name;
	const body = source
		.replace(/^# .+\n/, "")
		.replace(
			/\]\((?:\.\/)?([a-z-]+)\.md(#[^)]+)?\)/g,
			(all, slug, hash = "") =>
				names.includes(slug)
					? "](" + base + "/docs/reference/" + slug + "/" + hash + ")"
					: all,
		);
	writeFileSync(
		join(target, name + ".md"),
		"---\ntitle: " + JSON.stringify(title) + "\n---\n" + body,
	);
}
mkdirSync(join(site, "src/assets"), { recursive: true });
mkdirSync(join(site, "public"), { recursive: true });
copyFileSync(
	join(project, "assets/brand/mark.svg"),
	join(site, "src/assets/mark.svg"),
);
copyFileSync(
	join(project, "assets/brand/mark.svg"),
	join(site, "public/favicon.svg"),
);
copyFileSync(join(project, "LICENSE"), join(site, "public/LICENSE.txt"));
console.log(
	"Synced " +
		names.length +
		" maintained documentation pages and brand assets.",
);
