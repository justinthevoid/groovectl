import {
	cpSync,
	mkdirSync,
	writeFileSync,
	existsSync,
	rmSync,
	readFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(
	readFileSync(join(root, "package.json"), "utf8"),
).version.split("-")[0];
if (!/^\d+\.\d+\.\d+$/.test(version))
	throw new Error("Invalid helper release version.");
const buildNumber = process.env.GROOVECTL_BUILD_NUMBER ?? "3";
if (!/^[1-9]\d{0,8}$/.test(buildNumber))
	throw new Error("Use a positive numeric GROOVECTL_BUILD_NUMBER.");
const build =
	process.env.GROOVECTL_BUILD_ROOT ??
	join(homedir(), "Library/Caches/Groovectl/build");
const app = join(build, "GroovectlHelper.app");
if (existsSync(app)) rmSync(app, { recursive: true });
mkdirSync(join(app, "Contents/MacOS"), { recursive: true });
mkdirSync(join(app, "Contents/Resources"), { recursive: true });
cpSync(
	join(build, "swift/release/GroovectlHelper"),
	join(app, "Contents/MacOS/GroovectlHelper"),
);
// The app loads its resource from Bundle.main; source/SwiftPM tests use Bundle.module.
const resourceBundle = join(
	build,
	"swift/release/GroovectlHelper_MusicBridge.bundle",
);
const resource = join(resourceBundle, "Contents/Resources/music.js");
// Darwin SwiftPM emits a standard bundle; older toolchains may emit a flat one.
cpSync(
	existsSync(resource) ? resource : join(resourceBundle, "music.js"),
	join(app, "Contents/Resources/music.js"),
);
writeFileSync(
	join(app, "Contents/Info.plist"),
	`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>GroovectlHelper</string>
<key>CFBundleIdentifier</key><string>com.groovectl.helper</string>
<key>CFBundleName</key><string>Groovectl Helper</string>
<key>CFBundleDisplayName</key><string>Groovectl Helper</string>
<key>CFBundleVersion</key><string>${buildNumber}</string>
<key>CFBundleShortVersionString</key><string>${version}</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>LSUIElement</key><true/>
<key>NSAppleEventsUsageDescription</key><string>Groovectl controls playback and reads or creates playlists in Music when you ask your agent.</string>
</dict></plist>`,
);
const identity = process.env.GROOVECTL_SIGN_IDENTITY ?? "-";
const result = spawnSync(
	"/usr/bin/codesign",
	[
		"--force",
		"--sign",
		identity,
		"--options",
		"runtime",
		"--entitlements",
		join(root, "native/entitlements.plist"),
		...(identity === "-" ? [] : ["--timestamp"]),
		app,
	],
	{ stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
const verify = spawnSync(
	"/usr/bin/codesign",
	["--verify", "--deep", "--strict", app],
	{ stdio: "inherit" },
);
if (verify.status !== 0) process.exit(verify.status ?? 1);
console.log(
	`Built ${app} (${identity === "-" ? "local ad hoc signature; not notarized" : "signed; notarization is a separate release step"}).`,
);
