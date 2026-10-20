#!/bin/bash
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later

# Run in a disposable FreePBX image container with --network=none and no volumes.
# This starts a separate Asterisk with no SIP/channel drivers or customer data.
set -euo pipefail
ulimit -c 0

env -i PATH=/usr/bin:/bin /usr/bin/env php -r 'exit(PHP_MAJOR_VERSION === 8 ? 0 : 1);'
/usr/bin/php -r 'exit(PHP_MAJOR_VERSION === 8 ? 0 : 1);'
echo 'PHP works with the user-cron PATH and the legacy absolute path'

test_dir=$(mktemp -d)
asterisk_pid=
cleanup() {
    if [[ -n "$asterisk_pid" ]]; then
        kill "$asterisk_pid" 2>/dev/null || true
        for ((attempt=0; attempt<50; attempt++)); do
            if ! kill -0 "$asterisk_pid" 2>/dev/null; then break; fi
            sleep 0.1
        done
        kill -KILL "$asterisk_pid" 2>/dev/null || true
        wait "$asterisk_pid" 2>/dev/null || true
    fi
    rm -rf "$test_dir"
}
trap cleanup EXIT
mkdir -p "$test_dir"/{etc,data,run,log,spool,cache}
ln -s /var/lib/asterisk/documentation "$test_dir/data/documentation"
cat > "$test_dir/etc/asterisk.conf" <<EOF
[directories]
astetcdir => $test_dir/etc
astmoddir => /usr/lib/asterisk/modules
astvarlibdir => $test_dir/data
astdbdir => $test_dir/data
astkeydir => $test_dir/data
astdatadir => /var/lib/asterisk
astagidir => $test_dir/data
astspooldir => $test_dir/spool
astrundir => $test_dir/run
astlogdir => $test_dir/log
astcachedir => $test_dir/cache
[options]
runuser = asterisk
rungroup = asterisk
EOF
cat > "$test_dir/etc/modules.conf" <<'EOF'
[modules]
autoload=no
load=codec_g729.so
load=format_g729.so
load=format_sln.so
load=res_convert.so
EOF
dd if=/dev/zero of="$test_dir/input.sln" bs=160 count=20 status=none
chown -R asterisk:asterisk "$test_dir"
asterisk -f -q -C "$test_dir/etc/asterisk.conf" > "$test_dir/startup.log" 2>&1 &
asterisk_pid=$!
ast() { asterisk -C "$test_dir/etc/asterisk.conf" -rx "$1"; }
codec_running() {
    ast 'module show like codec_g729.so' 2>/dev/null |
        grep -E '^codec_g729\.so[[:space:]].*[[:space:]][0-9]+[[:space:]]+Running[[:space:]]' >/dev/null
}
for ((attempt=0; attempt<100; attempt++)); do
    if codec_running; then break; fi
    if ! kill -0 "$asterisk_pid" 2>/dev/null; then break; fi
    sleep 0.1
done
if ! codec_running; then
    ast 'module show' >&2 || true
    cat "$test_dir/startup.log" >&2
    if ! kill -0 "$asterisk_pid" 2>/dev/null; then
        status=0
        wait "$asterisk_pid" || status=$?
        echo "Asterisk exited with status $status" >&2
    fi
    echo 'G.729 failed to load' >&2
    exit 1
fi
ast 'core waitfullybooted' >/dev/null
ast "file convert $test_dir/input.sln $test_dir/encoded.g729"
test -s "$test_dir/encoded.g729"
ast "file convert $test_dir/encoded.g729 $test_dir/decoded.sln"
test -s "$test_dir/decoded.sln"
echo 'G.729 loads and encodes/decodes synthetic audio with a non-executable stack'
