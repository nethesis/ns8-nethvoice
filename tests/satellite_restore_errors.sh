#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Exercise the shipped step in a fresh, unconfigured module.
set -euo pipefail
export LC_ALL=C

step="${AGENT_INSTALL_DIR:?}/actions/restore-module/23satellite_pg"
fixture=$(mktemp -d "${AGENT_STATE_DIR:?}/satellite-restore.XXXXXXXX")
trap 'rm -r -- "$fixture"' EXIT
cd "$fixture"
dump=satellite_postgresql.pg_dump.gz

expect_failure() {
    local expected=$1 message=$2 status=0
    shift 2
    cp "$dump" original
    timeout --kill-after=5s 90s "$@" "$step" >restore.log 2>&1 || status=$?
    if [[ $status != "$expected" ]] || ! grep -Fq -- "$message" restore.log; then
        echo "Expected '$message' (exit $expected), got exit $status" >&2
        return 1
    fi
    cmp "$dump" original
}

# The optional dump can be absent even when the credentials and image are missing.
env -u PGVECTOR_IMAGE -u SATELLITE_PGSQL_USER "$step"
ln -s "$AGENT_STATE_DIR/passwords.env" passwords.env
: >"$dump"
expect_failure 1 'unexpected end of file'

gzip -c </dev/null >"$dump"
expect_failure 1 'dump is empty'

printf '%s\n' 'CREATE ROLE satellite;' 'SELECT 1 / 0;' | gzip >sql-error.gz
cp sql-error.gz "$dump"
expect_failure 1 'PGVECTOR_IMAGE' env -u PGVECTOR_IMAGE
truncate -s -4 "$dump"
expect_failure 1 'unexpected end of file'
if podman volume exists satellite_pgdata; then
    echo 'Invalid input started PostgreSQL' >&2
    exit 1
fi

cp sql-error.gz "$dump"
expect_failure 3 'division by zero'
# A retry on the partially initialized volume must terminate and keep the dump.
expect_failure 1 'database found'
