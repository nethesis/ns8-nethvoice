#!/usr/bin/env bash
# Restore only synthetic databases into a new loopback-bound disposable server.
set -euo pipefail
freepbx_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
restore_container="voice-agent-restore-${BASHPID}"
cleanup() { docker rm -f "$restore_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --rm --name "$restore_container" -e MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1 -p 127.0.0.1::3306 mariadb:10.11.19 >/dev/null
ready=false
for attempt in {1..30}; do
    if docker exec "$restore_container" mariadb-admin --host=127.0.0.1 --protocol=tcp ping --silent >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
done
[[ "$ready" == true ]]
docker exec "$VOICE_AGENT_TEST_DB_CONTAINER" mariadb-dump --single-transaction --routines --triggers --databases asterisk asteriskcdrdb | docker exec -i "$restore_container" mariadb
export VOICE_AGENT_RESTORE_PORT
VOICE_AGENT_RESTORE_PORT=$(docker port "$restore_container" 3306/tcp | sed 's/.*://')
php -d zend.assertions=1 -d assert.exception=1 "$freepbx_dir/tests/agents/restored.php"
