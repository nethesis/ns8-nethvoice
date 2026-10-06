#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
test_name="nv-phase5-db-$$"
runtime_source=${SATELLITE_SOURCE_DIR:?Set SATELLITE_SOURCE_DIR to a Satellite agent checkout}
temporary=$(mktemp -d)
cleanup() { rm -rf "$temporary"; docker rm -fv "$test_name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$test_name" -p 127.0.0.1::5432 \
  -e POSTGRES_USER=satellite -e POSTGRES_DB=satellite -e POSTGRES_PASSWORD=phase5-isolated \
  pgvector/pgvector:0.8.1-pg18-trixie >/dev/null
for ((attempt=0; attempt<60; attempt++)); do
  if docker exec "$test_name" pg_isready -h 127.0.0.1 -U satellite >/dev/null 2>&1; then break; fi
  sleep 0.25
done
test_port=$(docker port "$test_name" 5432/tcp | sed -n 's/^127\.0\.0\.1://p')
PGVECTOR_HOST=127.0.0.1 PGVECTOR_PORT="$test_port" PGVECTOR_DATABASE=satellite \
PGVECTOR_USER=satellite PGVECTOR_PASSWORD=phase5-isolated \
PYTHONPATH="$runtime_source" \
  "${PHASE5_PYTHON:-/tmp/nv-phase5-venv/bin/python}" "$root/satellite/tests/test_workflows_database.py"

# Restore the same complete application dump used by module backup into an isolated database.
docker exec "$test_name" pg_dump -U satellite -d satellite -Fc > "$temporary/application.dump"
docker exec "$test_name" createdb -U satellite phase5_restored
docker exec -i "$test_name" pg_restore -U satellite -d phase5_restored --no-owner --exit-on-error < "$temporary/application.dump"
PGVECTOR_HOST=127.0.0.1 PGVECTOR_PORT="$test_port" PGVECTOR_DATABASE=phase5_restored \
PGVECTOR_USER=satellite PGVECTOR_PASSWORD=phase5-isolated PYTHONPATH="$runtime_source" \
  "${PHASE5_PYTHON:-/tmp/nv-phase5-venv/bin/python}" "$root/satellite/tests/test_workflows_restore.py"
