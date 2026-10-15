#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "${1:-}" != package || $# != 1 ]]; then
  echo 'Usage: scripts/native/gate.sh package' >&2
  exit 2
fi
CORE="${NATIVE_RESOURCE_CORE:-$HOME/.local/share/native-resource-core/.agent-tools/native_resource.py}"
if [[ -f "$CORE" ]]; then
  REVISION="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo source)"
  exec python3 "$CORE" run --profile "$ROOT/.native-resource.json" --operation package \
    --task "${NATIVE_RESOURCE_TASK:-groovectl-helper}" --job groovectl-helper --revision "$REVISION" \
    -- /bin/bash "$ROOT/scripts/native/helper-job.sh"
fi
# Public source installs do not require our development resource broker or Python.
# Local installations with the broker always take the managed path above.
exec /usr/bin/lockf -t 0 /tmp/groovectl-helper-build.lock /bin/bash "$ROOT/scripts/native/helper-job.sh"
