#!/usr/bin/env bash
# Exercise the Satellite agent source against disposable local services.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
source_dir=${SATELLITE_SOURCE_DIR:-$root/.worktrees/satellite-agent-transfer}
runtime_image=${SATELLITE_ACCEPTANCE_IMAGE:-ghcr.io/nethesis/satellite:agent}
database_image=pgvector/pgvector@sha256:2fd905ba95f99a51be207d0ff0b8d5b8538cbce7e9083b3ccfa65b93bb28b938
temporary=$(mktemp -d)
test_id="nv-phase4-$$"
cleanup() {
    docker rm -fv "$test_id-db" >/dev/null 2>&1 || true
    docker network rm "$test_id" >/dev/null 2>&1 || true
    rm -rf "$temporary"
}
trap cleanup EXIT
git -C "$source_dir" archive --format=tar "${SATELLITE_ACCEPTANCE_REF:-HEAD}" > "$temporary/source.tar"
tar -xf "$temporary/source.tar" -C "$temporary"
rm "$temporary/source.tar"
docker network create "$test_id" >/dev/null
docker run -d --name "$test_id-db" --network "$test_id" --network-alias nv-phase4-db \
    -e POSTGRES_USER=satellite -e POSTGRES_DB=satellite -e POSTGRES_PASSWORD=phase4-isolated \
    "$database_image" >/dev/null
for ((attempt=0; attempt<60; attempt++)); do
    if docker exec "$test_id-db" pg_isready -h 127.0.0.1 -U satellite >/dev/null 2>&1; then break; fi
    sleep 0.5
done
docker exec "$test_id-db" pg_isready -h 127.0.0.1 -U satellite >/dev/null
docker run --rm --network "$test_id" --entrypoint python -e PYTHONPATH=/app \
    -e SATELLITE_APPLICATION_ACCEPTANCE=isolated -e PGVECTOR_HOST=nv-phase4-db \
    -e PGVECTOR_USER=satellite -e PGVECTOR_DATABASE=satellite -e PGVECTOR_PASSWORD=phase4-isolated \
    -v "$temporary:/app:ro" -v "$root/satellite/tests:/acceptance:ro" \
    "$runtime_image" /acceptance/test_application_acceptance.py
