#!/usr/bin/env bash
# Disposable M0 migration and cross-repository checks; no PBX database access.
set -euo pipefail
freepbx_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
satellite_dir=${M0_SATELLITE_DIR:-"${freepbx_dir}/../../satellite"}
test_python=${M0_PYTHON:-python3}
agent_php() { php -d zend.assertions=1 -d assert.exception=1 -d session.save_path="$test_tmp" "$@"; }
python3 "$freepbx_dir/tests/agents/ns8.py"
python3 "$freepbx_dir/tests/agents/reset-driver.py"
test_tmp=$(mktemp -d /tmp/voice-agent-m0.XXXXXX)
db_container="voice-agent-m0-db-${test_tmp##*.}"
cleanup() {
    docker rm -f "$db_container" >/dev/null 2>&1 || true
    rm -rf "$test_tmp"
}
trap cleanup EXIT
# Match NS8's loopback database identities instead of Docker's bridge gateway.
export M0_TEST_PORT
M0_TEST_PORT=$(python3 - <<'PY'
import socket
with socket.socket() as listener:
    listener.bind(('127.0.0.1', 0))
    print(listener.getsockname()[1])
PY
)
docker run -d --rm --name "$db_container" \
    --network=host -e MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1 \
    mariadb:10.11.19 --port="$M0_TEST_PORT" --bind-address=127.0.0.1 >/dev/null
ready=false
for attempt in {1..30}; do
    if docker exec "$db_container" mariadb-admin --host=127.0.0.1 --protocol=tcp --port="$M0_TEST_PORT" ping --silent >/dev/null 2>&1; then
        ready=true
        break
    fi
    sleep 1
done
if [[ "$ready" != true ]]; then echo 'disposable_db_unavailable' >&2; exit 1; fi
export M0_TEST_DSN="mysql:host=127.0.0.1;port=${M0_TEST_PORT}"
agent_php "$freepbx_dir/tests/agents/mariadb.php"
agent_php "$freepbx_dir/tests/agents/services.php"
agent_php "$freepbx_dir/tests/agents/provider-models.php"
agent_php "$freepbx_dir/tests/agents/model-settings.php"
agent_php "$freepbx_dir/tests/agents/routing.php"
agent_php "$freepbx_dir/tests/agents/transcripts.php"
agent_php "$freepbx_dir/tests/agents/visualplan.php"
agent_php "$freepbx_dir/tests/agents/trunks.php"
agent_php "$freepbx_dir/tests/agents/native-bootstrap.php"
agent_php "$freepbx_dir/tests/agents/recent-callers.php"
agent_php -d session.save_path="$test_tmp" "$freepbx_dir/tests/agents/access.php"
if [[ -n "${M0_REST_AUTOLOAD:-}" ]]; then
    M0_TEST_DSN="${M0_TEST_DSN};dbname=asterisk" agent_php "$freepbx_dir/tests/agents/authentication.php"
    agent_php "$freepbx_dir/tests/agents/http.php"
    agent_php "$freepbx_dir/tests/agents/trunk-routes.php"
else
    echo "SKIP: optional Wizard authentication harness requires M0_REST_AUTOLOAD"
fi
if [[ -n "${VOICE_AGENT_EXTENSIONS_FILE:-}" ]]; then
    agent_php "$freepbx_dir/tests/agents/dialplan.php"
fi
if [[ -n "${VOICE_AGENT_TEST_PHP_IMAGE:-}" ]]; then
    docker run --rm --network=host --entrypoint=php \
        -e M0_TEST_DSN="$M0_TEST_DSN;dbname=asterisk" \
        -e M0_REST_AUTOLOAD=/var/www/html/freepbx/rest/vendor/autoload.php \
        -v "$freepbx_dir:/workspace/freepbx:ro" "$VOICE_AGENT_TEST_PHP_IMAGE" \
        -d zend.assertions=1 -d assert.exception=1 /workspace/freepbx/tests/agents/authentication.php
    docker run --rm --network=host --entrypoint=php \
        -e M0_TEST_DSN="$M0_TEST_DSN" -v "$freepbx_dir:/workspace/freepbx:ro" \
        "$VOICE_AGENT_TEST_PHP_IMAGE" -d zend.assertions=1 -d assert.exception=1 \
        /workspace/freepbx/tests/agents/http.php
    docker run --rm --network=none --entrypoint=php -v "$freepbx_dir:/workspace/freepbx:ro" \
        "$VOICE_AGENT_TEST_PHP_IMAGE" -d zend.assertions=1 -d assert.exception=1 \
        /workspace/freepbx/tests/agents/dialplan.php
fi
PYTHONPATH="$satellite_dir" "$test_python" -m pytest -o addopts='' "$satellite_dir/tests/foundation" -q
PYTHONPATH="$satellite_dir" "$test_python" "$freepbx_dir/tests/agents/runner-contract.py"
agent_php "$freepbx_dir/tests/agents/retention.php"
VOICE_AGENT_TEST_DB_CONTAINER="$db_container" "$freepbx_dir/tests/agents/restore.sh"
php -d zend.assertions=1 -d assert.exception=1 "$freepbx_dir/tests/agents/development-reset.php"

if [[ -n "${VOICE_AGENT_TEST_PHP_IMAGE:-}" ]]; then
    docker run --rm --network=host --entrypoint=php \
        -e M0_TEST_DSN="$M0_TEST_DSN" -e M0_TEST_PORT="$M0_TEST_PORT" \
        -v "$freepbx_dir:/workspace/freepbx:ro" "$VOICE_AGENT_TEST_PHP_IMAGE" \
        -d zend.assertions=1 -d assert.exception=1 /workspace/freepbx/tests/agents/runtime-accounts.php
fi
if [[ -z "${VOICE_AGENT_TEST_PHP_IMAGE:-}" ]]; then
    agent_php "$freepbx_dir/tests/agents/runtime-accounts.php"
fi
