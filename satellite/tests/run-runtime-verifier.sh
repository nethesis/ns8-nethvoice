#!/usr/bin/env bash
# Exercise the module-only verifier at /tmp, outside the runtime import directory.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
image=${PHASE5_RUNTIME_IMAGE:-nethvoice-satellite:phase5-local}
patch_sha=$(awk '{print $1}' "$root/satellite/phase5-runtime.sha256")
source_ref=$(cat "$root/satellite/runtime-ref")
docker run --rm --workdir=/tmp --entrypoint=env \
  --volume="$root/satellite/verify-runtime.py:/tmp/verify-phase5-runtime.py:ro" \
  "$image" PYTHONPATH=/app python /tmp/verify-phase5-runtime.py "$patch_sha" "$source_ref"
