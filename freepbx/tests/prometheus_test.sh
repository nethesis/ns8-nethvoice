#!/bin/bash
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later

# Run in a disposable FreePBX container with --network=none and no data volumes.
set -euo pipefail
ulimit -c 0

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

# Exercise startup against an existing config, as on an upgrade or restore.
printf '[general]\nenabled=yes\n' > /etc/asterisk/prometheus.conf
env -u AMPDBUSER -u AMPDBPASS -u ASTERISK_PROMETHEUS_PASSWORD /entrypoint true > "$test_dir/entrypoint.log" 2>&1
grep -qx 'enabled = no' /etc/asterisk/prometheus.conf
if env -u AMPDBUSER -u AMPDBPASS ASTERISK_PROMETHEUS_PASSWORD=$'invalid-secret\nenabled=no' \
    /entrypoint true >> "$test_dir/entrypoint.log" 2>&1; then
    echo 'Startup accepted a password containing a configuration directive' >&2
    exit 1
fi
if grep -q 'invalid-secret' "$test_dir/entrypoint.log"; then
    echo 'Startup logged the invalid password' >&2
    exit 1
fi
env -u AMPDBUSER -u AMPDBPASS ASTERISK_PROMETHEUS_PASSWORD=metrics-test-password /entrypoint true >> "$test_dir/entrypoint.log" 2>&1
test "$(stat -c '%a:%U:%G' /etc/asterisk/prometheus.conf)" = '640:asterisk:asterisk'

mkdir -p "$test_dir"/{etc,data,run,log,spool,cache}
ln -s /var/lib/asterisk/documentation "$test_dir/data/documentation"
cp /etc/asterisk/prometheus.conf "$test_dir/etc/"
cat > "$test_dir/etc/asterisk.conf" <<EOF
[directories]
astetcdir => $test_dir/etc
astmoddir => /usr/lib/asterisk/modules
astvarlibdir => $test_dir/data
astdbdir => $test_dir/data
astkeydir => $test_dir/data
astdatadir => /var/lib/asterisk
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
load=res_pjproject.so
load=res_sorcery_config.so
load=res_sorcery_memory.so
load=res_sorcery_astdb.so
load=res_pjsip.so
load=res_pjsip_outbound_registration.so
load=res_prometheus.so
EOF
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$test_dir/key.pem" \
    -out "$test_dir/cert.pem" -days 1 -subj /CN=localhost > /dev/null 2>&1
cat > "$test_dir/etc/http.conf" <<EOF
[general]
enabled=yes
bindaddr=127.0.0.1
bindport=18088
tlsenable=yes
tlsbindaddr=127.0.0.1:18089
tlscertfile=$test_dir/cert.pem
tlsprivatekey=$test_dir/key.pem
EOF
chown -R asterisk:asterisk "$test_dir"
asterisk -f -q -C "$test_dir/etc/asterisk.conf" > "$test_dir/startup.log" 2>&1 &
asterisk_pid=$!
for ((attempt=0; attempt<100; attempt++)); do
    if curl --noproxy '*' -fsS -u prometheus:metrics-test-password \
        http://127.0.0.1:18088/metrics > "$test_dir/metrics" 2>/dev/null; then break; fi
    if ! kill -0 "$asterisk_pid" 2>/dev/null; then break; fi
    sleep 0.1
done
if ! grep -q '^asterisk_core_properties{' "$test_dir/metrics"; then
    cat "$test_dir/startup.log" >&2
    echo 'Asterisk Prometheus metrics failed to start' >&2
    exit 1
fi
for url in http://127.0.0.1:18088/metrics https://127.0.0.1:18089/metrics; do
    test "$(curl --noproxy '*' -ksS -o /dev/null -w '%{http_code}' "$url")" = 401
    test "$(curl --noproxy '*' -ksS -u prometheus:wrong -o /dev/null -w '%{http_code}' "$url")" = 401
    curl --noproxy '*' -kfsS -u prometheus:metrics-test-password "$url" > "$test_dir/metrics"
    grep -q '^asterisk_core_properties{' "$test_dir/metrics"
    grep -q '^asterisk_channels_count{' "$test_dir/metrics"
done
echo 'Prometheus serves Asterisk metrics and enforces authentication on HTTP and HTTPS'
