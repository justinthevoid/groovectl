import {
	readFileSync,
	writeFileSync,
	mkdirSync,
	cpSync,
	rmSync,
	existsSync,
	readdirSync,
	lstatSync,
} from "node:fs";
import { resolve, join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { zipSync } from "fflate";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "plugins/apple-music-hybrid");
const { values } = parseArgs({ options: { archive: { type: "string" } } });
if (!existsSync(join(root, "dist/cli.js")))
	throw new Error("Run bun run build first.");
const runtime = join(plugin, "runtime");
if (existsSync(runtime)) rmSync(runtime, { recursive: true });
mkdirSync(join(runtime, "dist"), { recursive: true });
for (const file of ["cli.js", "workspace.html"])
	cpSync(join(root, "dist", file), join(runtime, "dist", file));
for (const file of [
	"build-helper.mjs",
	"install-helper.mjs",
	"package-helper.mjs",
]) {
	mkdirSync(join(runtime, "scripts"), { recursive: true });
	cpSync(join(root, "scripts", file), join(runtime, "scripts", file));
}
cpSync(join(root, "scripts/native"), join(runtime, "scripts/native"), {
	recursive: true,
});
cpSync(
	join(root, ".native-resource.json"),
	join(runtime, ".native-resource.json"),
);
cpSync(join(root, "native"), join(runtime, "native"), {
	recursive: true,
	filter: (path) =>
		!/(?:^|\/)(?:\.build|GroovectlHelper\.app)(?:\/|$)/.test(
			path.replaceAll("\\", "/"),
		),
});
writeFileSync(
	join(runtime, "package.json"),
	JSON.stringify(
		{
			name: "groovectl-runtime",
			version: JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
				.version,
			private: true,
			type: "module",
			engines: { node: ">=24" },
		},
		null,
		2,
	) + "\n",
);
for (const file of [
	"LICENSE",
	"README.md",
	"THIRD_PARTY_NOTICES.md",
	"UI_THIRD_PARTY_LICENSES.txt",
	"SERVER_THIRD_PARTY_LICENSES.txt",
	"CONTRIBUTING.md",
	"SECURITY.md",
	"PRIVACY.md",
	"SUPPORT.md",
	"CODE_OF_CONDUCT.md",
	"AGENTS.md",
])
	cpSync(join(root, file), join(plugin, file));
for (const dir of ["docs", "licenses"])
	cpSync(join(root, dir), join(plugin, dir), { recursive: true });
for (const file of [
	"assets/brand/mark.svg",
	"assets/brand/mixtape-hero.webp",
	"assets/brand/mixtape-hero.webp.json",
	"assets/brand/PROVENANCE.md",
	"assets/examples/between-stations.png",
	"assets/examples/between-stations.prompt.txt",
	"assets/examples/PROVENANCE.md",
	"site/README.md",
	"deploy/README.md",
]) {
	const destination = join(plugin, file);
	mkdirSync(dirname(destination), { recursive: true });
	cpSync(join(root, file), destination);
}
// Retire only the generated Python payload, preserving the original source/tests in server/.
if (existsSync(join(plugin, "server")))
	rmSync(join(plugin, "server"), { recursive: true });
const manifest = JSON.parse(readFileSync(join(plugin, "plugin.json"), "utf8"));
if (manifest.name !== "apple-music-hybrid")
	throw new Error("Existing plugin identity must be preserved.");
if (
	manifest.version !==
	JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version
)
	throw new Error("Plugin and npm release versions must match.");
if (manifest.extensions["com.openai"].interface.shortDescription.length > 30)
	throw new Error("Plugin subtitle exceeds 30 characters.");
const portable = {
	$schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
	mcpServers: {
		"apple-music-hybrid": {
			type: "stdio",
			command: "node",
			args: ["${PLUGIN_ROOT}/runtime/dist/cli.js", "serve"],
			cwd: "${PLUGIN_ROOT}",
		},
	},
};
writeFileSync(
	join(plugin, "mcp.json"),
	JSON.stringify(portable, null, 2) + "\n",
);
const compat = {
	...Object.fromEntries(
		["name", "version", "description", "author", "license"].map((k) => [
			k,
			manifest[k],
		]),
	),
	skills: "./skills/",
	mcpServers: "./.mcp.json",
	interface: manifest.extensions["com.openai"].interface,
	requires_local_executor: true,
};
mkdirSync(join(plugin, ".codex-plugin"), { recursive: true });
writeFileSync(
	join(plugin, ".codex-plugin/plugin.json"),
	JSON.stringify(compat, null, 2) + "\n",
);
writeFileSync(
	join(plugin, ".mcp.json"),
	JSON.stringify(
		{
			mcpServers: {
				"apple-music-hybrid": {
					command: "node",
					args: ["./runtime/dist/cli.js", "serve"],
					cwd: ".",
					startup_timeout_sec: 60,
					tool_timeout_sec: 60,
				},
			},
		},
		null,
		2,
	) + "\n",
);
const files = {};
function collect(folder) {
	for (const entry of readdirSync(folder, { withFileTypes: true })) {
		const file = join(folder, entry.name),
			name = relative(plugin, file).replaceAll("\\", "/");
		if (entry.name === ".DS_Store" || entry.name.startsWith("._")) continue;
		if (lstatSync(file).isSymbolicLink())
			throw new Error(`Refusing symlink in plugin: ${name}`);
		if (entry.isDirectory()) {
			collect(file);
			continue;
		}
		if (
			/\.(?:p8|pem|sqlite\w*|pyc|log)$/.test(name) ||
			/(?:^|\/)(?:user|musickit|player)\.json$/.test(name)
		)
			throw new Error(`Sensitive/runtime file in plugin: ${name}`);
		const content = readFileSync(file);
		if (
			/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=\r\n]{64,}-----END/.test(
				content.toString("utf8"),
			)
		)
			throw new Error(`Private key block in ${name}`);
		files[`${manifest.name}/${name}`] = new Uint8Array(content);
	}
}
collect(plugin);
if (values.archive) {
	const file = resolve(values.archive);
	if (file.startsWith(plugin + "/"))
		throw new Error("Write archives outside the plugin directory.");
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, zipSync(files, { level: 9 }));
	console.log(file);
}
console.log(
	`Packaged ${manifest.extensions["com.openai"].interface.displayName} ${manifest.version}: ${Object.keys(files).length} files, no Python runtime.`,
);
