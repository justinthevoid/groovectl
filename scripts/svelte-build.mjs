import { readFile } from "node:fs/promises";
import path from "node:path";
import { compile } from "svelte/compiler";

// Both entry points use the same compiler, browser runtime and component sources.
export const sveltePlugin = {
	name: "groovectl-svelte",
	setup(build) {
		build.onResolve({ filter: /^svelte(?:\/.*)?$/ }, args => {
			if (args.pluginData?.rootSvelte) return;
			return build.resolve(args.path, { kind: args.kind, resolveDir: process.cwd(), pluginData: { rootSvelte: true } });
		});
		build.onLoad({ filter: /\.svelte$/ }, async ({ path: filename }) => {
			const result = compile(await readFile(filename, "utf8"), { filename, generate: "client", css: "injected", dev: false, runes: true });
			return { contents: result.js.code, loader: "js", resolveDir: path.dirname(filename),
				warnings: result.warnings.map(w => ({ text: w.message, location: w.start ? { file: filename, line: w.start.line, column: w.start.column } : undefined })) };
		});
	},
};
