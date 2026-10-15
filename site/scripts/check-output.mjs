import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, join, relative, sep } from "node:path";
import assert from "node:assert/strict";

// Inspect the artifact that will be deployed, including links copied from root docs.
const root = resolve("dist");
const base = (process.env.SITE_BASE || "/").replace(/\/$/, "") + "/";
let pages = 0,
	links = 0;
const failures = [];
function visit(folder) {
	for (const entry of readdirSync(folder, { withFileTypes: true })) {
		const file = join(folder, entry.name);
		if (entry.isDirectory()) {
			visit(file);
			continue;
		}
		if (!entry.name.endsWith(".html")) continue;
		pages++;
		const pagePath = relative(root, file)
			.split(sep)
			.join("/")
			.replace(/index\.html$/, "");
		const origin = "https://artifact.invalid";
		const current = new URL(base + pagePath, origin);
		const html = readFileSync(file, "utf8");
		const references = [...html.matchAll(/\b(?:href|src)="([^"<>]+)"/g)].map(
			(m) => m[1],
		);
		for (const reference of references) {
			if (/^(?:data:|mailto:|tel:|javascript:)/.test(reference)) continue;
			const url = new URL(reference.replaceAll("&amp;", "&"), current);
			if (url.origin !== origin) continue;
			links++;
			if (!url.pathname.startsWith(base)) {
				failures.push(`${pagePath}: outside base: ${reference}`);
				continue;
			}
			const path = resolve(
				root,
				decodeURIComponent(url.pathname.slice(base.length)),
			);
			if (path !== root && !path.startsWith(root + sep)) {
				failures.push(`${pagePath}: escapes output: ${reference}`);
				continue;
			}
			const target = [path, join(path, "index.html"), path + ".html"].find(
				(p) => existsSync(p) && statSync(p).isFile(),
			);
			if (!target) {
				failures.push(`${pagePath}: missing ${reference}`);
				continue;
			}
			if (url.hash && target.endsWith(".html")) {
				const id = decodeURIComponent(url.hash.slice(1));
				if (!readFileSync(target, "utf8").includes(`id="${id}"`))
					failures.push(`${pagePath}: missing anchor ${reference}`);
			}
		}
	}
}
visit(root);
assert.equal(failures.length, 0, failures.join("\n"));
assert.ok(pages > 1, "Expected generated documentation pages.");
assert.ok(
	existsSync(join(root, "pagefind/pagefind.js")),
	"Expected search index.",
);
assert.ok(existsSync(join(root, "404.html")), "Expected a real 404 page.");
console.log(
	`Verified ${pages} pages and ${links} local links/assets under ${base}.`,
);
