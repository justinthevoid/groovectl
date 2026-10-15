"""Compatibility entry point for the TypeScript plugin packager."""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
if __name__ == "__main__":
    raise SystemExit(subprocess.call(["node", str(ROOT / "scripts/package-plugin.mjs"), *sys.argv[1:]], cwd=ROOT))
