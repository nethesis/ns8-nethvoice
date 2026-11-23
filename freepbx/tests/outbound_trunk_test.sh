#!/bin/bash
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later

# Run in a disposable FreePBX image with --network=none. SIP stays on loopback.
set -Eeuo pipefail
test_dir=$(mktemp -d)
asterisk_pid=
cleanup() {
    if [[ -n "$asterisk_pid" ]]; then
        kill "$asterisk_pid" 2>/dev/null || true
        wait "$asterisk_pid" 2>/dev/null || true
    fi
    rm -rf "$test_dir"
}
trap cleanup EXIT
touch "$test_dir/asterisk.log"
trap 'tail -n 150 "$test_dir/asterisk.log" >&2' ERR

mkdir -p "$test_dir"/{etc,data,run,log,spool}
ln -s /var/lib/asterisk/documentation "$test_dir/data/documentation"
cat > "$test_dir/etc/asterisk.conf" <<EOF
[directories]
astetcdir => $test_dir/etc
astmoddir => /usr/lib/asterisk/modules
astvarlibdir => $test_dir/data
astdbdir => $test_dir/data
astdatadir => /var/lib/asterisk
astagidir => $test_dir/data
astspooldir => $test_dir/spool
astrundir => $test_dir/run
astlogdir => $test_dir/log
[options]
runuser = asterisk
rungroup = asterisk
EOF
cat > "$test_dir/etc/modules.conf" <<'EOF'
[modules]
autoload=yes
EOF
cat > "$test_dir/etc/pjsip.conf" <<'EOF'
[loopback]
type=transport
protocol=udp
bind=127.0.0.1:5070

[test-peer]
type=endpoint
transport=loopback
context=test-receiver
disallow=all
allow=ulaw
identify_by=ip
aors=test-peer
direct_media=no

[test-peer]
type=aor
contact=sip:127.0.0.1:5070

[test-peer-ip]
type=identify
endpoint=test-peer
match=127.0.0.1

[unreachable]
type=endpoint
transport=loopback
disallow=all
allow=ulaw
aors=unreachable

[unreachable]
type=aor
max_contacts=1
EOF
cat > "$test_dir/etc/extensions.conf" <<'EOF'
[general]
autofallthrough=yes
#include extensions_additional.conf

[macro-user-callerid]
exten => s,1,Set(AMPUSER=201)
 same => n,Set(CALLERID(num)=201)
 same => n,Set(DIALSTATUS=SKIP_TEST)
 same => n,Return()

[macro-dialout-trunk-predial-hook]
exten => s,1,Return()

[func-apply-sipheaders]
exten => s,1,Return()

[macro-hangupcall]
exten => s,1,Hangup()

[test-receiver]
exten => _[67]XXX,1,Busy()
exten => _XXXX,1,NoOp(TEST peer ${EXTEN} CID ${CALLERID(num)})
 same => n,Answer()
 same => n,Wait(0.2)
 same => n,Hangup()

[test-failure]
exten => s,1,NoOp(TEST route ${ROUTEID} exhausted, CID ${CALLERID(num)}, status ${DIALSTATUS})
 same => n,Hangup(34)
EOF
touch "$test_dir/etc/globals_custom.conf"
generate() {
    local pbx=/var/www/html/freepbx/admin
    php "$(dirname "$0")/outbound_trunk_dialplan.php" \
        "$pbx/modules/core" "$pbx/libraries" > "$test_dir/etc/extensions_additional.conf"
}
generate
chown -R asterisk:asterisk "$test_dir"
asterisk -fnvvvv -C "$test_dir/etc/asterisk.conf" > "$test_dir/asterisk.log" 2>&1 &
asterisk_pid=$!
ast() { asterisk -C "$test_dir/etc/asterisk.conf" -rx "$1"; }
timeout 15 bash -c '
    until asterisk -C "$1" -rx "core waitfullybooted" 2>/dev/null | grep -q "fully booted"; do sleep 0.1; done
' bash "$test_dir/etc/asterisk.conf"
ast 'pjsip set logger on' | grep -q 'PJSIP Logging enabled'
no_active_channels() { ast 'core show channels' | grep -Fx '0 active channels' >/dev/null; }

check_call() {
    local number=$1 invites=$2 outcome=$3 first_line log expected
    shift 3
    first_line=$(( $(wc -l < "$test_dir/asterisk.log") + 1 ))
    ast "channel originate Local/$number@outrt-$number application Wait 2"
    for ((attempt=0; attempt<60; attempt++)); do
        log=$(tail -n "+$first_line" "$test_dir/asterisk.log")
        if [[ "$log" == *"$outcome"* ]] && no_active_channels; then break; fi
        sleep 0.1
    done
    [[ "$log" == *"$outcome"* && "$log" != *'Auto fallthrough'* && "$log" != *'unexpected.agi'* ]]
    no_active_channels
    for expected; do
        [[ "$log" == *"$expected"* ]]
    done
    # Loopback records each SIP request twice, once sent and once received.
    [[ $(sed -nE 's/^INVITE sip:([0-9]+)@.*/\1/p' <<< "$log" | uniq | paste -sd ' ') == "$invites" ]]
    echo "PASS: route $number sends INVITEs to [${invites}] and reaches $outcome"
}

check_answered() {
    local number=$1 invites=$2 trunk=$3
    shift 3
    check_call "$number" "$invites" "TEST peer $trunk$number CID 555010$trunk" \
        "answered Local/$number@outrt-$number-" "$@"
}

check_answered 101 '4101' 4
check_answered 102 '3102' 3
check_call 103 '' 'TEST route 103 exhausted, CID 201, status SKIP_TEST'
check_answered 104 '4104' 4
check_answered 105 '4105' 4 'DIALSTATUS = CHANUNAVAIL'
check_call 106 '6106' 'Dial failed due to trunk reporting BUSY - giving up'
check_answered 107 '7107 4107' 4
check_answered 108 '4108' 4 'macro-dialout-dundi,s,1(8,108,,off)'
generate
ast 'dialplan reload'
check_answered 101 '4101' 4
