#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD_ROOT="${GROOVECTL_BUILD_ROOT:-$HOME/Library/Caches/Groovectl/build}"
mkdir -p "$BUILD_ROOT/tmp"
export TMPDIR="$BUILD_ROOT/tmp"
swift test --package-path "$ROOT/native" --scratch-path "$BUILD_ROOT/swift" --jobs 2
swift build --package-path "$ROOT/native" --scratch-path "$BUILD_ROOT/swift" -c release --jobs 2
GROOVECTL_BUILD_ROOT="$BUILD_ROOT" node "$ROOT/scripts/package-helper.mjs"
