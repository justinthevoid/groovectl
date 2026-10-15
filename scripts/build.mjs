import { build } from "esbuild";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
const cli = await build({
	entryPoints: ["src/cli.ts"],
	outfile: "dist/cli.js",
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node24",
	metafile: true,
	banner: {
		js: 'import { createRequire as __groovectlCreateRequire } from "node:module"; const require = __groovectlCreateRequire(import.meta.url);',
	},
});
const result = await build({
	entryPoints: ["ui/workspace.ts"],
	// Ignore retained legacy ui/node_modules; use the release's locked dependencies.
	alias: {
		zod: path.resolve("node_modules/zod"),
		"@modelcontextprotocol/ext-apps": path.resolve(
			"node_modules/@modelcontextprotocol/ext-apps/dist/src/app.js",
		),
		"@openai/mcp-extensions/app": path.resolve(
			"node_modules/@openai/mcp-extensions/dist/app/index.js",
		),
	},
	bundle: true,
	write: false,
	format: "esm",
	target: "es2022",
	minify: true,
	metafile: true,
});
const script = result.outputFiles[0].text.replaceAll("</script", "<\\/script");
const html = (await readFile("ui/template.html", "utf8"))
	.replaceAll("Apple Music Hybrid", "Groovectl")
	.replace("__SCRIPT__", () => script);
await writeFile("dist/workspace.html", html);
async function licenses(metafile) {
	const roots = new Set();
	for (const input of Object.keys(metafile.inputs)) {
		const marker = input.lastIndexOf("node_modules/");
		if (marker < 0) continue;
		const parts = input.slice(marker + 13).split("/"),
			name = parts[0].startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
		roots.add(path.resolve(input.slice(0, marker) + "node_modules/" + name));
	}
	const notices = [];
	for (const dir of [...roots].sort()) {
		const pkg = JSON.parse(
			await readFile(path.join(dir, "package.json"), "utf8"),
		);
		const files = (await readdir(dir)).filter((n) =>
			/^(license|copying|notice)(?:$|[._-])/i.test(n),
		);
		if (!files.length) {
			if (pkg.name === "@cfworker/json-schema") {
				notices.push(
					`${pkg.name}@${pkg.version} — upstream MIT license (npm package omits its license file)\n\n${await readFile("licenses/cfworker-json-schema-LICENSE", "utf8")}`,
				);
				continue;
			}
			throw new Error(`Bundled package has no license file: ${pkg.name}`);
		}
		for (const name of files)
			notices.push(
				`${pkg.name}@${pkg.version} — ${name}\n\n${await readFile(path.join(dir, name), "utf8")}`,
			);
	}
	return notices.join("\n\n" + "=".repeat(72) + "\n\n");
}
await writeFile("UI_THIRD_PARTY_LICENSES.txt", await licenses(result.metafile));
await writeFile(
	"SERVER_THIRD_PARTY_LICENSES.txt",
	await licenses(cli.metafile),
);
console.log(`Built Groovectl MCP App (${html.length} bytes).`);
