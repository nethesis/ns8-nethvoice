#!/usr/bin/env bash
# Disposable M0 migration and cross-repository checks; no PBX database access.
set -euo pipefail
freepbx_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
satellite_dir=${M0_SATELLITE_DIR:-"${freepbx_dir}/../../satellite"}
test_python=${M0_PYTHON:-python3}
test_tmp=$(mktemp -d /tmp/voice-agent-m0.XXXXXX)
db_container="voice-agent-m0-db-${BASHPID}"
cleanup() {
    docker rm -f "$db_container" >/dev/null 2>&1 || true
    rm -rf "$test_tmp"
}
trap cleanup EXIT
docker run -d --rm --name "$db_container" \
    -e MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1 -p 127.0.0.1::3306 \
    mariadb:10.11.19 >/dev/null
ready=false
for attempt in {1..30}; do
    if docker exec "$db_container" mariadb-admin --host=127.0.0.1 --protocol=tcp ping --silent >/dev/null 2>&1; then
        ready=true
        break
    fi
    sleep 1
done
if [[ "$ready" != true ]]; then echo 'disposable_db_unavailable' >&2; exit 1; fi
export M0_TEST_PORT
M0_TEST_PORT=$(docker port "$db_container" 3306/tcp | sed 's/.*://')
export M0_TEST_DSN="mysql:host=127.0.0.1;port=${M0_TEST_PORT}"
php -d zend.assertions=1 -d assert.exception=1 "$freepbx_dir/tests/agents/mariadb.php"
php -d session.save_path="$test_tmp" -d zend.assertions=1 -d assert.exception=1 "$freepbx_dir/tests/agents/access.php"
if [[ -n "${M0_REST_AUTOLOAD:-}" ]]; then
    M0_TEST_DSN="${M0_TEST_DSN};dbname=asterisk" php -d zend.assertions=1 -d assert.exception=1 "$freepbx_dir/tests/agents/authentication.php"
else
    echo "SKIP: optional Wizard authentication harness requires M0_REST_AUTOLOAD"
fi
PYTHONPATH="$satellite_dir" "$test_python" -m pytest -o addopts='' "$satellite_dir/tests/foundation" -q
