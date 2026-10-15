// Use the root's pinned toolchain; ui/node_modules belongs to the retained legacy UI.
import { build } from "../node_modules/esbuild/lib/main.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const folder = process.argv[2];
if (!folder) throw new Error("Pass the isolated preview directory.");
await mkdir(folder, { recursive: true });
const result = await build({
	entryPoints: ["harness.js"],
	alias: {
		"@modelcontextprotocol/ext-apps/app-bridge": fileURLToPath(
			new URL(
				"../node_modules/@modelcontextprotocol/ext-apps/dist/src/app-bridge.js",
				import.meta.url,
			),
		),
	},
	absWorkingDir: dirname(fileURLToPath(import.meta.url)),
	bundle: true,
	write: false,
	format: "esm",
	target: "es2022",
	minify: true,
});
const script = result.outputFiles[0].text.replaceAll("</script", "<\\/script");
const template =
	'<!doctype html><html lang="en"><meta charset="utf-8"><title>Groovectl MCP Apps test host</title><style>body{margin:0;font:14px system-ui;background:#eee}header{padding:12px;height:116px;box-sizing:border-box;overflow:auto;overflow-wrap:anywhere}iframe{display:block;width:100%;height:calc(100dvh - 116px);min-height:420px;border:0}</style><header><strong>Development host · synthetic data only</strong><p id="connection">Waiting for handshake</p><p id="calls" role="status">No calls</p></header><iframe title="Groovectl test view" sandbox="allow-scripts allow-same-origin"></iframe><script type="module">__SCRIPT__</script></html>';
await writeFile(
	folder + "/harness.html",
	template
		.replace(
			'<meta charset="utf-8">',
			'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
		)
		.replace("__SCRIPT__", () => script),
);
await writeFile(
	folder + "/index.html",
	await readFile(new URL("../dist/workspace.html", import.meta.url)),
);
