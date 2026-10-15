import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
if (process.platform !== "darwin")
	throw new Error(
		"The Swift helper is for macOS. Windows uses its media-session adapter or Cider.",
	);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(
	"/bin/bash",
	[join(root, "scripts/native/gate.sh"), "package"],
	{ stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
