#!/usr/bin/env bash
# Isolated acceptance of the published runtime and the repository restore hook.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
runtime_image=${SATELLITE_ACCEPTANCE_IMAGE:-ghcr.io/nethesis/nethvoice-satellite@sha256:ab37eb3be709684611c881f3de0dcc1b770b4fe926fdb2e4bbc84beb71d32de6}
database_image=pgvector/pgvector@sha256:2fd905ba95f99a51be207d0ff0b8d5b8538cbce7e9083b3ccfa65b93bb28b938
[[ "$runtime_image" =~ @sha256:[0-9a-f]{64}$ ]] || { echo 'Use an immutable runtime image' >&2; exit 2; }
temporary=$(mktemp -d)
test_id="nv-phase3-$$"
network="$test_id-network"
database="$test_id-db"
restored="$test_id-restored"
export PHASE3_RESTORE_VOLUME="$test_id-volume"
export PHASE3_RESTORE_CONTAINER="$test_id-restore"
cleanup() {
    docker rm -fv "$database" "$restored" "$PHASE3_RESTORE_CONTAINER" >/dev/null 2>&1 || true
    docker volume rm "$PHASE3_RESTORE_VOLUME" >/dev/null 2>&1 || true
    docker network rm "$network" >/dev/null 2>&1 || true
    rm -rf "$temporary"
}
trap cleanup EXIT
docker pull "$runtime_image" >/dev/null
docker pull "$database_image" >/dev/null
docker network create "$network" >/dev/null
docker run -d --name "$database" --network "$network" --network-alias nv-phase3-db \
    -e POSTGRES_USER=satellite -e POSTGRES_DB=satellite -e POSTGRES_PASSWORD=phase3-isolated \
    "$database_image" >/dev/null
for ((attempt=0; attempt<60; attempt++)); do
    if docker exec "$database" pg_isready -U satellite >/dev/null 2>&1; then break; fi
    sleep 0.5
done
docker exec "$database" pg_isready -U satellite >/dev/null
docker run --rm --network "$network" --entrypoint python -e PYTHONPATH=/app \
    -e SATELLITE_MONITORING_ACCEPTANCE=isolated -e PGVECTOR_HOST=nv-phase3-db \
    -e PGVECTOR_USER=satellite -e PGVECTOR_DATABASE=satellite -e PGVECTOR_PASSWORD=phase3-isolated \
    -v "$root/satellite/tests:/acceptance:ro" "$runtime_image" /acceptance/test_monitoring_acceptance.py

docker exec "$database" pg_dumpall -U satellite | gzip > "$temporary/satellite_postgresql.pg_dump.gz"
printf 'SATELLITE_PGSQL_PASSWORD=phase3-isolated\n' > "$temporary/passwords.env"
mkdir "$temporary/bin"
cat > "$temporary/bin/podman" <<'SH'
#!/usr/bin/env bash
args=()
for value in "$@"; do
    [[ "$value" == '--replace' ]] && continue
    value="${value/--volume=satellite_pgdata:/--volume=${PHASE3_RESTORE_VOLUME}:}"
    value="${value/--name=restore_db/--name=${PHASE3_RESTORE_CONTAINER}}"
    args+=("$value")
done
exec docker "${args[@]}"
SH
chmod +x "$temporary/bin/podman"
(
    cd "$temporary"
    PATH="$temporary/bin:$PATH" PGVECTOR_IMAGE="$database_image" \
        timeout 30s bash "$root/imageroot/actions/restore-module/23satellite_pg" > restore.log 2>&1
    test ! -e satellite_postgresql.pg_dump.gz
    test ! -e restore
)
docker run -d --name "$restored" --network "$network" --network-alias nv-phase3-restored-db \
    -e POSTGRES_USER=satellite -e POSTGRES_DB=satellite -e POSTGRES_PASSWORD=phase3-isolated \
    -v "$PHASE3_RESTORE_VOLUME:/var/lib/postgresql/18/docker" "$database_image" >/dev/null
for ((attempt=0; attempt<60; attempt++)); do
    if docker exec "$restored" pg_isready -U satellite >/dev/null 2>&1; then break; fi
    sleep 0.5
done
test "$(docker exec "$restored" psql -U satellite -d satellite -A -t \
    -c 'SELECT (NOT rolcanlogin) AND (rolpassword IS NULL) FROM pg_authid WHERE oid=10')" = t
docker run --rm -i --network "$network" --entrypoint python -e PYTHONPATH=/app \
    -e PGVECTOR_HOST=nv-phase3-restored-db -e PGVECTOR_PASSWORD=phase3-isolated \
    -e SATELLITE_MONITORING_CONTENT_KEY=eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHg= "$runtime_image" - <<'PY'
import asyncio
from agent.monitoring import Monitoring
m=Monitoring()
m._initialized=m._configured=True
m._error=None
conversation=asyncio.run(m.conversation('phase3-run-1'))
assert conversation['state']=='truncated'
assert len(conversation['items'])==2
print('Restore hook: PASS; encrypted segments decrypt; bootstrap login disabled')
PY
