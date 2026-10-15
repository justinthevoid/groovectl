import {
	readdirSync,
	readFileSync,
	existsSync,
	writeFileSync,
	realpathSync,
	statSync,
} from "node:fs";
import { join } from "node:path";

// An inclusive build-dependency inventory, not a claim that every package ships in the browser.
const seen = new Set(),
	packages = new Map(),
	notices = [];
function licenseFiles(directory, prefix = "") {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		return statSync(path).isDirectory()
			? licenseFiles(path, prefix + name + "/")
			: [prefix + name];
	});
}
function inspect(directory) {
	const file = join(directory, "package.json");
	if (!existsSync(file)) return;
	const real = realpathSync(directory);
	if (seen.has(real)) return;
	seen.add(real);
	const pkg = JSON.parse(readFileSync(file, "utf8"));
	if (!pkg.name || !pkg.version) return;
	const identity = `${pkg.name}@${pkg.version}`;
	if (!packages.has(identity)) {
		const files = readdirSync(directory)
			.filter((n) => /^(?:licenses?|copying|notices?)(?:$|[._-])/i.test(n))
			.flatMap((name) =>
				statSync(join(directory, name)).isDirectory()
					? licenseFiles(join(directory, name), name + "/")
					: [name],
			);
		packages.set(identity, {
			name: pkg.name,
			version: pkg.version,
			license: pkg.license ?? "UNDECLARED",
			license_files: files,
		});
		for (const name of files)
			notices.push(
				`${identity} — ${name}\n\n${readFileSync(join(directory, name), "utf8")}`,
			);
	}
	scan(join(directory, "node_modules"));
}
function scan(directory) {
	if (!existsSync(directory)) return;
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) continue;
		const path = join(directory, entry.name);
		if (entry.name.startsWith("@"))
			for (const scoped of readdirSync(path)) inspect(join(path, scoped));
		else inspect(path);
	}
}
scan("node_modules");
if (!packages.size)
	throw new Error(
		"Install the frozen site dependencies before generating notices.",
	);
for (const name of [
	"@fontsource-variable/fraunces",
	"@fontsource-variable/dm-sans",
	"svelte",
	"astro",
	"@astrojs/starlight",
]) {
	if (
		![...packages.values()].some(
			(p) => p.name === name && p.license_files.length,
		)
	)
		throw new Error(`Required license file missing: ${name}`);
}
writeFileSync(
	"public/THIRD_PARTY_LICENSES.txt",
	"Groovectl website — inclusive installed build dependency notices.\nIncludes build-only and platform packages; not all are shipped to a browser.\nProject code: MIT. Fonts retain their included SIL Open Font Licenses.\n\n" +
		notices.join("\n\n" + "=".repeat(72) + "\n\n"),
);
writeFileSync(
	"public/dependency-inventory.json",
	JSON.stringify(
		{
			scope:
				"Installed website build dependency tree; includes build-only/platform packages. Not a browser bundle manifest.",
			packages: [...packages.values()].sort(
				(a, b) =>
					a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
			),
		},
		null,
		2,
	) + "\n",
);
console.log(
	`Recorded ${packages.size} installed website packages and ${notices.length} notice files.`,
);
