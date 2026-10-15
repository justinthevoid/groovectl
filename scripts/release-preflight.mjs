import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, lstatSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) =>
	execFileSync("git", args, {
		cwd: root,
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
	});
const read = (name) => readFileSync(join(root, name), "utf8");
const pkg = JSON.parse(read("package.json"));
const plugin = JSON.parse(read("plugins/apple-music-hybrid/plugin.json"));
const compat = JSON.parse(
	read("plugins/apple-music-hybrid/.codex-plugin/plugin.json"),
);
assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/);
assert.equal(plugin.version, pkg.version, "Plugin release version differs.");
assert.equal(
	compat.version,
	pkg.version,
	"Run package:plugin to regenerate compatibility metadata.",
);
assert.ok(
	read("src/version.ts").includes(`export const VERSION = "${pkg.version}"`),
	"Runtime version differs.",
);
assert.equal(
	plugin.name,
	"apple-music-hybrid",
	"Preserve installed plugin identity.",
);
assert.deepEqual(plugin.extensions["com.openai"].interface.defaultPrompt, [
	"@Apple Music Hybrid make a playlist from my listening brief.",
	"@Apple Music Hybrid open the player.",
]);

const paths = [
	...new Set(
		git("ls-files", "--cached", "--others", "--exclude-standard", "-z")
			.split("\0")
			.filter(Boolean),
	),
];
const findings = [];
const contentPaths = [
	...new Set([...paths, "dist/cli.js", "dist/workspace.html"]),
];
for (const name of contentPaths) {
	let entry;
	try {
		entry = lstatSync(join(root, name));
	} catch (error) {
		if (error.code === "ENOENT") continue; // A staged removal has no shipping payload.
		throw error;
	}
	if (entry.isSymbolicLink()) {
		findings.push(`${name}: source symlink requires explicit release review`);
		continue;
	}
	if (
		/(?:^|\/)(?:node_modules|\.venv|\.build|\.env(?:\..*)?|user\.json|musickit\.json|player\.json|artwork-provider\.json)(?:\/|$)|\.(?:p8|pem|key|sqlite\w*|log)$/i.test(
			name,
		)
	)
		findings.push(`${name}: sensitive/runtime path`);
	const text = readFileSync(join(root, name)).toString("utf8");
	if (
		/-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=\r\n]{64,}-----END/.test(
			text,
		)
	)
		findings.push(`${name}: private key material`);
	if (
		/\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{16,}\b/.test(
			text,
		)
	)
		findings.push(`${name}: credential-shaped JWT`);
	// Match actual private host identifiers without printing matched values.
	if (
		/\/Users\/justin(?:\/|\b)|C:[/\\]Users[/\\]Justin(?:[/\\]|\b)|rainbow-beaver\.ts\.net|awildjoltik@gmail\.com/.test(
			text,
		)
	)
		findings.push(`${name}: development host/account identifier`);
}
for (const name of [
	"LICENSE",
	"SECURITY.md",
	"PRIVACY.md",
	"SUPPORT.md",
	"CONTRIBUTING.md",
	"CODE_OF_CONDUCT.md",
	"CHANGELOG.md",
	"docs/releasing.md",
	"SERVER_THIRD_PARTY_LICENSES.txt",
	"UI_THIRD_PARTY_LICENSES.txt",
	"dist/cli.js",
	"dist/workspace.html",
	"assets/brand/mixtape-hero.webp",
])
	assert.ok(
		existsSync(join(root, name)),
		`Required release material missing: ${name}`,
	);
assert.equal(findings.length, 0, findings.join("\n"));
const dirty = git("status", "--porcelain");
if (dirty && !process.argv.includes("--allow-dirty"))
	throw new Error(
		`Source worktree is not clean. Commit reviewed changes before the final preflight; --allow-dirty is a development scan only.\n${dirty}`,
	);
console.log(
	JSON.stringify(
		{
			version: pkg.version,
			files_scanned: contentPaths.length,
			source_revision: git("rev-parse", "HEAD").trim(),
			clean_source: !dirty,
			scope:
				"Working source and bundled CLI/UI contents; does not scan unpublished history, archives, actual private values or qualify account/player behavior.",
		},
		null,
		2,
	),
);
