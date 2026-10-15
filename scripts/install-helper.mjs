import { cpSync, mkdirSync, existsSync, renameSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (process.platform !== "darwin")
	throw new Error("Groovectl Helper requires macOS.");
const build =
	process.env.GROOVECTL_BUILD_ROOT ??
	join(homedir(), "Library/Caches/Groovectl/build");
const source = join(build, "GroovectlHelper.app");
const applications = join(homedir(), "Applications"),
	target = join(applications, "Groovectl Helper.app");
mkdirSync(applications, { recursive: true });
// Updates require a stopped host; never interrupt an in-flight native write.
const running = spawnSync(
	"/usr/bin/pgrep",
	["-f", join(target, "Contents/MacOS/GroovectlHelper")],
	{ encoding: "utf8" },
);
if (running.status === 0)
	throw new Error(
		"Groovectl Helper is running. Finish pending operations and quit the helper before updating it.",
	);
// Always build/test the current sources; never reuse a stale app from an older
// npm/plugin release. All products stay in the user's cache, including when the
// installed package itself is read-only.
const result = spawnSync(
	process.execPath,
	[join(root, "scripts/build-helper.mjs")],
	{ stdio: "inherit", env: process.env },
);
if (result.status !== 0) process.exit(result.status ?? 1);
const stage = join(applications, `.Groovectl-Helper-${process.pid}.app`);
cpSync(source, stage, { recursive: true });
if (existsSync(target)) {
	const backup = join(applications, "Groovectl Helper.previous.app");
	if (existsSync(backup)) rmSync(backup, { recursive: true });
	renameSync(target, backup);
}
renameSync(stage, target);
console.log(
	`Installed ${target}. macOS may ask you to allow this app to control Music on its first native operation.`,
);
