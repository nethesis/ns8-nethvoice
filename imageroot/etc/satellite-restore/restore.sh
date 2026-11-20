# shellcheck shell=bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Sourced by docker-enforce-initdb.sh with errexit and pipefail enabled.
# pg_dumpall creates the role that initdb just created. Skip only that
# statement so its saved password, settings and any matching COPY data survive.
bootstrap_role=$(docker_process_sql -Atc "SELECT format('CREATE ROLE %I;', current_user)")
export bootstrap_role
gzip -cd /tmp/satellite_postgresql.pg_dump.gz |
    awk '!skipped && $0 == ENVIRON["bootstrap_role"] { skipped = 1; next } { print }' |
    docker_process_sql
