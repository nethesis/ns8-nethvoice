---
name: nethvoice-testing
description: Use when an agent must test a NethVoice instance through SSH, SIP, CTI API, Wizard REST API, MariaDB, Satellite PostgreSQL, or browser/web access.
version: 0.1.0
author: Stefano Fancello
license: GPLv3
metadata:
    tags: [nethvoice, ns8, voip, sip, pjsua, pjsip, asterisk, freepbx, nethcti, cti-api, wizard-api, mariadb, satellite, postgres, testing]
---

# NethVoice testing operations

## Scope

Use this skill to test a NethVoice instance when at least one of these access modes is available:

- SSH/shell access to the NethServer 8 node hosting NethVoice.
- SIP access to the PBX or NethVoice Proxy.
- HTTPS access to NethVoice CTI, Wizard, FreePBX, or middleware APIs.
- Database access to NethVoice MariaDB (`asterisk`, `asteriskcdrdb`) or Satellite PostgreSQL.
- Browser automation access to CTI/Phone Island.

Primary test capabilities:

- Register SIP user agents from controlled extensions.
- Launch SIP calls from different extensions.
- Play an audio file into a call and record received audio.
- Use NethCTI APIs for call, answer, hangup, blind transfer, attended transfer, DTMF, park, pickup, queue operations, and state inspection.
- Query Asterisk/FreePBX state from CLI and MariaDB.
- Query CDR/CEL, Satellite transcripts, summaries, and call metadata.
- Call Wizard REST APIs for provisioning/configuration checks.
- Produce an evidence-based test report with commands, call IDs, API results, database rows, and log snippets.

## Source priority

Use sources in this order:

1. Local live system state: module environment, containers, API schemas, logs, databases, Asterisk CLI.
2. Current repository code:
   - `nethesis/ns8-nethvoice`
   - `nethesis/ns8-nethvoice-proxy`
   - `nethesis/nethcti-middleware`
   - `nethesis/nethcti-server`
   - `nethesis/nethvoice-wizard-restapi`
   - `nethesis/phone-island`
3. Published docs:
   - `https://docs.nethvoice.com/docs/tutorial/api/cti`
   - `https://docs.nethvoice.com/docs/administrator-manual`
   - `https://docs.nethserver.org/projects/ns8/en/latest/`
4. Community/issues only for recent regressions or undocumented behavior.

Do not invent API paths or JSON fields. Discover them from OpenAPI, source, `ctictl --list`, browser network traces, or the installed code before using them.

## Safety rules

1. Testing can create real calls, ring real extensions, trigger trunks, generate CDRs, and start recordings. Use only test extensions/trunks unless explicitly authorized.
2. Do not run destructive module actions, database writes, Redis writes, or FreePBX edits unless the test explicitly requires them.
3. Prefer read-only commands for diagnostics: `SELECT`, `SHOW`, `asterisk -rx`, `curl GET`, and log reads.
4. Mask secrets in output: SIP passwords, JWTs, persistent tokens, MariaDB root password, API server tokens, and Wizard secret keys.
5. Do not leave packet tracing, SIP logging, or debug logging enabled. If enabled, disable it before finishing.
6. Stop all test calls and `pjsua` containers before the report.
7. For SSH access, use `runagent -m <nethvoice_module_id>` for module operations. Do not hardcode module home paths.
8. If testing production, add a clear test prefix in caller ID, call notes, audio prompt, and report.

## Required input variables

Use these variable names in commands and scripts:

```bash
PBX_HOST="pbx.example.com"              # SIP domain/FQDN. Often NETHVOICE_HOST.
CTI_HOST="pbx.example.com"              # HTTPS CTI host, without scheme.
WIZARD_HOST="pbx.example.com"           # HTTPS Wizard/FreePBX host, without scheme.
NV_MODULE="nethvoice1"                  # NS8 module id.
PROXY_MODULE="nethvoice-proxy1"         # Optional NS8 proxy module id.
SIP_IMAGE="ghcr.io/stell0/pjsua:latest"
AUDIO_DIR="$PWD/audio"
```

Per test endpoint:

```bash
EXT_A="201"; USER_A="201"; PASS_A="secret"
EXT_B="202"; USER_B="202"; PASS_B="secret"
EXT_C="203"; USER_C="203"; PASS_C="secret"
DEST="1234"
```

## Access mode decision

### SSH available

Use SSH for full-stack tests:

1. Discover module IDs.
2. Extract runtime environment.
3. Verify containers, Asterisk, proxy routes, and DBs.
4. Launch SIP calls from the harness host or the NethVoice node.
5. Validate via Asterisk CLI, CTI API, CDR/CEL, logs, and Satellite.

### SIP/HTTPS only

Use external black-box tests:

1. Register `pjsua` clients against `PBX_HOST`.
2. Use CTI login and `/api` endpoints when credentials are available.
3. Validate only through SIP result, recorded audio, CTI state, and public API responses.
4. Do not assume access to Asterisk CLI or databases.

### Browser/Phone Island only

Use browser automation:

1. Generate or consume a Phone Island config token.
2. Dispatch Phone Island `CustomEvent` commands.
3. Listen to Phone Island events.
4. Cross-check with CTI API if available.

## SSH preflight

```bash
hostnamectl --static
id
cat /etc/os-release | sed -n '1,8p'
api-cli run get-cluster-status | jq .
api-cli run list-installed-modules | jq .
podman ps --format '{{.Names}}\t{{.Status}}' || true
```

Find NethVoice-related modules:

```bash
api-cli run list-installed-modules | jq -r '..|objects|select(.id? and (.id|test("nethvoice|nethcti|phonebook|satellite")))|.id' | sort -u

redis-cli --scan --pattern 'module/*/environment' | while read k; do
  mid=${k#module/}; mid=${mid%/environment}
  img=$(redis-cli --raw HGET "$k" IMAGE_URL 2>/dev/null)
  echo "$mid $img"
done | grep -E 'nethvoice|nethcti|phonebook|satellite'
```

Inspect NethVoice module runtime:

```bash
NV_MODULE=<nethvoice_module_id>

runagent -m "$NV_MODULE" sh -lc '
id
printf "install=%s\nstate=%s\n" "$AGENT_INSTALL_DIR" "$AGENT_STATE_DIR"
grep -E "^(NETHVOICE_HOST|NETHVOICE_MARIADB_PORT|ASTERISK_SIP_PORT|PROXY_IP|PROXY_PORT|NETHVOICE_MIDDLEWARE|SATELLITE|PUBLIC_IP|MODULE_ID|NODE_ID)=" "$AGENT_STATE_DIR/environment" 2>/dev/null || true
find "$AGENT_INSTALL_DIR/actions" -maxdepth 2 -type f 2>/dev/null | sort | sed -n "1,120p"
'
```

Do not `source` the full module `environment` file in diagnostics or harness scripts. Some values can contain spaces or shell metacharacters. Parse only the variables you need:

```bash
NV_MODULE=<nethvoice_module_id>

nv_env() {
  local key="$1"
  runagent -m "$NV_MODULE" sh -lc '
    key="$1"
    sed -n "s/^${key}=//p" "$AGENT_STATE_DIR/environment" | tail -1
  ' sh "$key"
}

nv_secret() {
  local key="$1"
  runagent -m "$NV_MODULE" sh -lc '
    key="$1"
    sed -n "s/^${key}=//p" "$AGENT_STATE_DIR/passwords.env" | tail -1
  ' sh "$key"
}

PBX_HOST=$(nv_env NETHVOICE_HOST)
CTI_HOST=${CTI_HOST:-$PBX_HOST}
WIZARD_HOST=${WIZARD_HOST:-$PBX_HOST}
ASTERISK_SIP_PORT=$(nv_env ASTERISK_SIP_PORT)
NETHVOICE_MARIADB_PORT=$(nv_env NETHVOICE_MARIADB_PORT)
PROXY_IP=$(nv_env PROXY_IP)
PROXY_PORT=$(nv_env PROXY_PORT)

printf 'PBX_HOST=%s\nCTI_HOST=%s\nWIZARD_HOST=%s\nASTERISK_SIP_PORT=%s\nNETHVOICE_MARIADB_PORT=%s\nPROXY=%s:%s\n' \
  "$PBX_HOST" "$CTI_HOST" "$WIZARD_HOST" "$ASTERISK_SIP_PORT" "$NETHVOICE_MARIADB_PORT" "$PROXY_IP" "$PROXY_PORT"

# Print only names, never values, when auditing available secrets.
runagent -m "$NV_MODULE" sh -lc 'test -f "$AGENT_STATE_DIR/passwords.env" && cut -d= -f1 "$AGENT_STATE_DIR/passwords.env" | sort'
```

Common secret names on NS8 NethVoice:

| Need | Source |
|---|---|
| MariaDB root password | `MARIADB_ROOT_PASSWORD` in `passwords.env` |
| Wizard REST shared secret | `NETHVOICESECRETKEY` in `passwords.env` |
| CTI super-admin token | `NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN` in `passwords.env` |
| FreePBX/AMP DB password | `AMPDBPASS` in `passwords.env` |

When `NETHVOICE_HOST` is the only public virtualhost variable, use it for `PBX_HOST`, `CTI_HOST`, and `WIZARD_HOST`. Confirm with HTTP probes before using it in a test:

```bash
curl -skI "https://${CTI_HOST}/api/user/me" | sed -n '1,5p'
curl -skI "https://${WIZARD_HOST}/freepbx/rest/login" | sed -n '1,5p'
curl -skI "https://${WIZARD_HOST}/freepbx/admin" | sed -n '1,5p'
```

Container health:

```bash
runagent -m "$NV_MODULE" podman ps -a
runagent -m "$NV_MODULE" systemctl --user list-units --all --no-pager | grep -E 'freepbx|mariadb|nethcti|satellite|janus|tancredi' || true
runagent -m "$NV_MODULE" journalctl --user --no-pager -n 200
```

## Asterisk CLI checks

```bash
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'core show version'
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'core show channels concise'
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'pjsip show transports'
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'pjsip show endpoints'
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'pjsip show contacts'
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'queue show'
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'database show CF'
```

Inspect one endpoint:

```bash
EXT=201
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx "pjsip show endpoint $EXT"
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx "pjsip show aor $EXT"
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx "pjsip show auth $EXT"
```

Short live watch during call tests:

```bash
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'core show channels concise'
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'bridge show all'
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'core show calls'
```

Enable SIP logger only for a short controlled window:

```bash
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'pjsip set logger on'
# run one call
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'pjsip set logger off'
```

## Asterisk logs

Follow the full log:

```bash
runagent -m "$NV_MODULE" podman exec freepbx sh -lc 'tail -F /var/log/asterisk/full'
```

High-signal scan:

```bash
runagent -m "$NV_MODULE" podman exec freepbx sh -lc '
patterns="NOTICE|WARNING|ERROR|Failed|Rejected|No matching endpoint|Unable to create channel|Is endpoint registered|No route to destination|CHANUNAVAIL|CONGESTION|SRTP|RTP|transfer|REFER|Replaces|hangupcause|No translator path"
grep -E -i -m 80 "$patterns" /var/log/asterisk/full 2>/dev/null || true
'
```

Search by call identifiers after a test:

```bash
LINKEDID=<linkedid_or_uniqueid>
runagent -m "$NV_MODULE" podman exec freepbx sh -lc "grep -F '$LINKEDID' /var/log/asterisk/full | tail -80"
```

## SIP call generation with pjsua container

Use `ghcr.io/stell0/pjsua:latest` when it provides a runnable `pjsua` binary. 

With `--network host`, every endpoint must use a unique pjsua SIP bind port. Otherwise pjsua instances collide on the default local SIP port and fail with `bind() error: Address in use`.

Prepare audio:

```bash
mkdir -p "$AUDIO_DIR"
# Use 8 kHz mono WAV when possible for deterministic telephony tests.
ffmpeg -y -f lavfi -i "sine=frequency=1000:duration=3" -ar 8000 -ac 1 "$AUDIO_DIR/tone.wav"
```

One-shot outgoing call with play and record:

```bash
podman run --rm -it \
  --network host \
  -v "$AUDIO_DIR:/audio" \
  ghcr.io/stell0/pjsua:latest \
  --id "sip:${USER_A}@${PBX_HOST}" \
  --registrar "sip:${PBX_HOST}" \
  --proxy "sip:${PROXY_IP}"';lr' \
  --realm '*' \
  --username "$USER_A" \
  --password "$PASS_A" \
  --null-audio \
  --play-file /audio/tone.wav \
  --rec-file /audio/recording-${EXT_A}.wav \
  --auto-rec \
  "sip:${DEST}@${PBX_HOST}"
```

Interactive controlled endpoint with telnet CLI:

```bash
PJSUA_PORT=2323

podman run --rm -it --name "pjsua-${EXT_A}" \
  --network host \
  -v "$AUDIO_DIR:/audio" \
  "$SIP_IMAGE" \
  --id "sip:${USER_A}@${PBX_HOST}" \
  --registrar "sip:${PBX_HOST}" \
  --realm '*' \
  --username "$USER_A" \
  --password "$PASS_A" \
  --null-audio \
  --play-file /audio/tone.wav \
  --rec-file /audio/recording-${EXT_A}.wav \
  --auto-rec \
  --use-cli \
  --cli-telnet-port "$PJSUA_PORT"
```

Connect from host or harness:

```bash
nc 127.0.0.1 "$PJSUA_PORT"
```

Typical pjsua CLI commands:

```text
call new sip:1234@pbx.example.com
audio list
audio conf_connect 1 2
call answer 200
call hangup
shutdown
```

For multiple extensions, run one container per extension and use different telnet ports:

```bash
# A on 2323, B on 2324, C on 2325
# Keep one terminal/session per endpoint or run detached and attach through nc.
```

Example detached launch function:

```bash
start_pjsua() {
  local ext="$1" user="$2" pass="$3" cli_port="$4" local_port="$5"
  local entrypoint_args=()
  test -n "${PJSUA_ENTRYPOINT:-}" && entrypoint_args=(--entrypoint "$PJSUA_ENTRYPOINT")

  podman rm -f "pjsua-$ext" >/dev/null 2>&1 || true
  podman run -d --name "pjsua-$ext" \
    --network host \
    "${entrypoint_args[@]}" \
    -v "$AUDIO_DIR:/audio" \
    "$SIP_IMAGE" \
    --id "sip:${user}@${PBX_HOST}" \
    --registrar "sip:${PBX_HOST}" \
    --realm '*' \
    --username "$user" \
    --password "$pass" \
    --local-port "$local_port" \
    --no-tcp \
    --null-audio \
    --auto-answer=200 \
    --auto-conf \
    --play-file /audio/tone.wav \
    --rec-file "/audio/recording-${ext}.wav" \
    --auto-rec \
    --use-cli \
    --cli-telnet-port "$cli_port" \
    --no-cli-console
}

start_pjsua "$EXT_A" "$USER_A" "$PASS_A" 2323 15101
start_pjsua "$EXT_B" "$USER_B" "$PASS_B" 2324 15102
start_pjsua "$EXT_C" "$USER_C" "$PASS_C" 2325 15103
```

Send commands non-interactively. Use `nc` when available; otherwise Bash `/dev/tcp` works on minimal NS8 hosts:

```bash
printf 'call new sip:%s@%s\n' "$EXT_B" "$PBX_HOST" | nc -w 2 127.0.0.1 2323
printf 'call answer 200\n' | nc -w 2 127.0.0.1 2324
printf 'call hangup\n' | nc -w 2 127.0.0.1 2323

pjsua_cmd() {
  local port="$1" cmd="$2"
  if command -v nc >/dev/null 2>&1; then
    printf '%s\r\n' "$cmd" | nc -w 2 127.0.0.1 "$port"
  else
    bash -lc 'port="$1" cmd="$2"; exec 3<>/dev/tcp/127.0.0.1/"$port"; printf "%s\r\n" "$cmd" >&3; timeout 3 cat <&3 || true' sh "$port" "$cmd"
  fi
}

pjsua_cmd 2323 "call new sip:${EXT_B}@127.0.0.1:${ASTERISK_SIP_PORT}"
pjsua_cmd 2323 'call list'
```

Stop all test endpoints:

```bash
for p in 2323 2324 2325; do pjsua_cmd "$p" 'call hangup' || true; pjsua_cmd "$p" 'shutdown' || true; done
podman rm -f pjsua-"$EXT_A" pjsua-"$EXT_B" pjsua-"$EXT_C" >/dev/null 2>&1 || true
```

Choose pjsua test endpoints whose Asterisk endpoint has a reachable contact path. On NS8, custom physical extensions created by Wizard REST can inherit `outbound_proxy=sip:${PROXY_IP}:${PROXY_PORT}`, `rewrite_contact=false`, `force_rport=false`, and `rtp_symmetric=false`. Direct host-network pjsua registration can then show healthy OPTIONS contacts but fail calls with `480 Temporarily Unavailable` because INVITEs are routed through the proxy path. Inspect before testing:

```bash
for ext in "$EXT_A" "$EXT_B" "$EXT_C"; do
  runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx "pjsip show endpoint $ext" \
    | grep -E 'Endpoint:|outbound_proxy|rewrite_contact|force_rport|rtp_symmetric|transport|context'
done
```

For pjsua-only functional tests, prefer direct-register PJSIP endpoints with empty `outbound_proxy` and `rewrite_contact/force_rport/rtp_symmetric` enabled, or run the pjsua harness from a network location that the configured proxy route can reach.

## SIP black-box test cases

### Registration test

Expected result: endpoint appears as reachable/contacted in Asterisk or SIP call succeeds.

```bash
start_pjsua "$EXT_A" "$USER_A" "$PASS_A" 2323 15101
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx "pjsip show contacts" | grep -F "$EXT_A" || true
```

### Extension-to-extension call

```bash
start_pjsua "$EXT_A" "$USER_A" "$PASS_A" 2323 15101
start_pjsua "$EXT_B" "$USER_B" "$PASS_B" 2324 15102

pjsua_cmd 2323 "call new sip:${EXT_B}@127.0.0.1:${ASTERISK_SIP_PORT}"
pjsua_cmd 2323 'call list'
pjsua_cmd 2323 'audio list'
pjsua_cmd 2323 'call hangup'
```

Validate:

```bash
test -s "$AUDIO_DIR/recording-${EXT_A}.wav" && file "$AUDIO_DIR/recording-${EXT_A}.wav"
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'core show channels concise'
```

### External destination or trunk call

Use only an authorized test route or provider test number.

```bash
DEST="0<external_test_number>"
printf 'call new sip:%s@%s\n' "$DEST" "$PBX_HOST" | nc -w 2 127.0.0.1 2323
```

Validate CDR, CEL, trunk selection, SIP headers, RTP flow, and final hangup cause.

### Transfer test using pjsua + CTI

1. Register A, B, C.
2. A calls B.
3. B answers.
4. Use CTI API to discover B conversation ID.
5. Blind-transfer B side to C or to an external test destination.
6. Validate A is connected to C/destination and B is no longer bridged.
7. Validate CDR/CEL and Asterisk transfer events.

Concrete CTI blind-transfer sequence after pjsua A-B is connected:

```bash
CTI_USER_B="foo2"
CTI_PASS_B="Test,1234"

JWT_B=$(
  curl -sk -X POST "https://${CTI_HOST}/api/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${CTI_USER_B}\",\"password\":\"${CTI_PASS_B}\"}" \
  | jq -r '.token // .jwt // .access_token // .data.token // empty'
)

test -n "$JWT_B" || { echo "CTI login failed for $CTI_USER_B" >&2; exit 1; }

cti_get_as_b() {
  curl -sk "https://${CTI_HOST}/api/${1}" \
    -H "Authorization: Bearer ${JWT_B}" \
    -H 'Accept: application/json'
}

cti_post_as_b() {
  curl -sk -X POST "https://${CTI_HOST}/api/${1}" \
    -H "Authorization: Bearer ${JWT_B}" \
    -H 'Content-Type: application/json' \
    -d "$2"
}

cti_get_as_b "astproxy/extension/${EXT_B}" | jq .
CONVID=$(cti_get_as_b "astproxy/extension/${EXT_B}" | jq -r '.conversations | keys[0] // empty')
test -n "$CONVID" || { echo "No active conversation found for $EXT_B" >&2; exit 1; }

cti_post_as_b "astproxy/blindtransfer" \
  "{\"convid\":\"${CONVID}\",\"endpointId\":\"${EXT_B}\",\"to\":\"${EXT_C}\"}"

runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'core show channels concise'
cti_get_as_b "astproxy/extension/${EXT_B}" | jq '{exten,status,conversations}'
```

Expected result: B returns to `online` with no conversations, while A and C show connected conversations with the same linkedid. CEL should include `BLINDTRANSFER` and bridge transitions from A-B to A-C.

## NethCTI API authentication

Prefer current `/api` endpoints.

Login:

```bash
CTI_USER="user"
CTI_PASS="password"

JWT=$(
  curl -sk -X POST "https://${CTI_HOST}/api/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${CTI_USER}\",\"password\":\"${CTI_PASS}\"}" \
  | jq -r '.token // .jwt // .access_token // .data.token // empty'
)

test -n "$JWT" || { echo "CTI login failed" >&2; exit 1; }
```

2FA, when required:

```bash
OTP="123456"
JWT=$(
  curl -sk -X POST "https://${CTI_HOST}/api/2fa/verify-otp" \
    -H "Authorization: Bearer ${JWT}" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${CTI_USER}\",\"otp\":\"${OTP}\"}" \
  | jq -r '.token // .jwt // .access_token // .data.token // empty'
)
```

Smoke test:

```bash
curl -sk "https://${CTI_HOST}/api/user/me" \
  -H "Authorization: Bearer ${JWT}" | jq .
```

Discover current endpoints before writing a new test:

```bash
curl -sk "https://${CTI_HOST}/api/openapi.yaml" -H "Authorization: Bearer ${JWT}" | sed -n '1,200p' || true
curl -sk "https://${CTI_HOST}/api/swagger.json" -H "Authorization: Bearer ${JWT}" | jq .paths 2>/dev/null || true
```

From SSH, inspect middleware code/schema:

```bash
runagent -m "$NV_MODULE" podman exec nethcti-middleware sh -lc 'find / -iname openapi.yaml -o -iname "*swagger*" 2>/dev/null'
runagent -m "$NV_MODULE" podman exec nethcti-middleware sh -lc 'printenv | grep -E "^(NETHVOICE_MIDDLEWARE|SATELLITE_PGSQL|MARIADB)"'
```

Administrative middleware endpoints through `ctictl`:

```bash
runagent -m "$NV_MODULE" podman exec freepbx ctictl --list
runagent -m "$NV_MODULE" podman exec freepbx ctictl /admin/reload/profiles
runagent -m "$NV_MODULE" podman exec freepbx ctictl -v /admin/reload/profiles
```

## NethCTI call-control API patterns

Current middleware may expose equivalent `/api` endpoints directly or proxy legacy V1 endpoints. Discover first. If the installed OpenAPI does not list a path, inspect `nethcti-server` legacy `astproxy` routes and try the path only with valid authentication.

Common legacy astproxy paths:

| Operation | Path | Minimal payload |
|---|---|---|
| Call | `POST astproxy/call` | `{ "number": "202", "endpointType": "extension", "endpointId": "201" }` |
| Answer | `POST astproxy/answer` | `{ "endpointId": "202" }` |
| Hangup | `POST astproxy/hangup` | `{ "convid": "...", "endpointId": "201" }` |
| Hangup main extension | `POST astproxy/hangup_mainexten` | `{ "exten": "201" }` |
| Blind transfer | `POST astproxy/blindtransfer` | `{ "convid": "...", "endpointId": "202", "to": "203" }` |
| Attended transfer | `POST astproxy/atxfer` | `{ "convid": "...", "endpointId": "202", "to": "203" }` |
| DTMF | `POST astproxy/dtmf` | `{ "endpointId": "201", "tone": "5" }` |
| Park | `POST astproxy/park` | `{ "convid": "...", "endpointId": "202", "applicantId": "202" }` |
| Pickup parked call | `POST astproxy/pickup_parking` | `{ "parking": "70", "destId": "203" }` |
| Pickup ringing conversation | `POST astproxy/pickup_conv` | `{ "endpointId": "202", "destId": "203" }` |
| Queue login/logout toggle | `POST astproxy/inout_dyn_queues` | `{ "endpointId": "201" }` |
| Queue pause | `POST astproxy/queuemember_pause` | `{ "endpointId": "201", "queueId": "401", "reason": "test" }` |
| Queue unpause | `POST astproxy/queuemember_unpause` | `{ "endpointId": "201", "queueId": "401" }` |

Common state reads:

| Need | Path |
|---|---|
| Extension state and conversations | `GET astproxy/extension/{id}` |
| All extensions | `GET astproxy/extensions` |
| Queues | `GET astproxy/queues` |
| Operator data | `GET astproxy/opdata` |
| Parkings | `GET astproxy/parkings` |
| Trunks | `GET astproxy/trunks` |

Reusable request helper for current `/api` paths:

```bash
cti_get() {
  local path="$1"
  curl -sk "https://${CTI_HOST}/api/${path}" \
    -H "Authorization: Bearer ${JWT}" \
    -H 'Accept: application/json'
}

cti_post() {
  local path="$1" body="$2"
  curl -sk -X POST "https://${CTI_HOST}/api/${path}" \
    -H "Authorization: Bearer ${JWT}" \
    -H 'Content-Type: application/json' \
    -d "$body"
}
```

If the path is only legacy `/webrest`, use the documented legacy `Authorization: username:token` flow instead of `Bearer`. Do not mix formats unless the installed middleware explicitly supports it.

Discover a conversation ID:

```bash
ENDPOINT="$EXT_B"

cti_get "astproxy/extension/${ENDPOINT}" | jq .
# Look for conversations keys/values containing channel pair strings such as:
# PJSIP/201-00000001>PJSIP/202-00000002
```

Blind transfer through CTI:

```bash
CONVID='PJSIP/201-00000001>PJSIP/202-00000002'
cti_post "astproxy/blindtransfer" \
  "{\"convid\":\"${CONVID}\",\"endpointId\":\"${EXT_B}\",\"to\":\"${EXT_C}\"}" | jq .
```

Attended transfer through CTI:

```bash
cti_post "astproxy/atxfer" \
  "{\"convid\":\"${CONVID}\",\"endpointId\":\"${EXT_B}\",\"to\":\"${EXT_C}\"}" | jq .
```

Hangup cleanup:

```bash
cti_post "astproxy/hangup_mainexten" "{\"exten\":\"${EXT_A}\"}" | jq .
cti_post "astproxy/hangup_mainexten" "{\"exten\":\"${EXT_B}\"}" | jq .
cti_post "astproxy/hangup_mainexten" "{\"exten\":\"${EXT_C}\"}" | jq .
```

## Phone Island browser-event fallback

Use this when the test is specifically about Phone Island UI behavior or CTI API access is not sufficient.

Dispatch helper:

```js
function phoneIslandDispatch(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }))
}
```

Call commands:

```js
phoneIslandDispatch('phone-island-call-start', { number: '202' })
phoneIslandDispatch('phone-island-call-answer', {})
phoneIslandDispatch('phone-island-call-transfer', { number: '203' })
phoneIslandDispatch('phone-island-call-keypad-send', { key: '5' })
phoneIslandDispatch('phone-island-call-end', {})
```

Events to capture:

```js
[
  'phone-island-socket-connected',
  'phone-island-socket-authorized',
  'phone-island-call-ringing',
  'phone-island-outgoing-call-started',
  'phone-island-call-answered',
  'phone-island-call-ended',
  'phone-island-call-transfered',
  'phone-island-call-transfer-failed',
  'phone-island-summary-ready',
  'phone-island-conversation-transcription'
].forEach(name => window.addEventListener(name, e => console.log(name, e.detail)))
```

## MariaDB access

NethVoice MariaDB contains at least `asterisk` and `asteriskcdrdb`.

### From the host using exported port

```bash
cd <nethvoice_state_or_test_directory>

MARIADB_ROOT_PASSWORD=$(grep '^MARIADB_ROOT_PASSWORD=' ./passwords.env) && export "${MARIADB_ROOT_PASSWORD?}"

mysql -uroot -p"${MARIADB_ROOT_PASSWORD#MARIADB_ROOT_PASSWORD=}" \
  -h 127.0.0.1 \
  -P "${NETHVOICE_MARIADB_PORT}" \
  -e 'SHOW DATABASES;'
```

If the variable was exported directly as `MARIADB_ROOT_PASSWORD=value`, use:

```bash
mysql -uroot -p"${MARIADB_ROOT_PASSWORD}" -h 127.0.0.1 -P "${NETHVOICE_MARIADB_PORT}"
```

### From inside the module/container

```bash
runagent -m "$NV_MODULE" podman exec mariadb sh -lc '
mysql -uroot -p"$MARIADB_ROOT_PASSWORD" -e "SHOW DATABASES;"
'
```

Useful read-only queries:

```bash
runagent -m "$NV_MODULE" podman exec mariadb sh -lc '
mysql -uroot -p"$MARIADB_ROOT_PASSWORD" -N -B asterisk <<SQL
SELECT extension, name, outboundcid FROM users ORDER BY extension LIMIT 50;
SELECT id, tech, dial, devicetype, user FROM devices ORDER BY id LIMIT 50;
SELECT id, keyword, data FROM pjsip WHERE id IN ("201","202","203") ORDER BY id, keyword;
SELECT id, keyword, data FROM sip WHERE id IN ("201","202","203") ORDER BY id, keyword;
SQL
'
```

Find SIP credentials and Wizard-created device records without printing secrets:

```bash
EXT_LIST='"201","202","203"'

runagent -m "$NV_MODULE" podman exec mariadb sh -lc "
mysql -uroot -p\"\$MARIADB_ROOT_PASSWORD\" -N -B asterisk <<SQL
SELECT extension, name, outboundcid FROM users WHERE extension IN (${EXT_LIST}) ORDER BY extension;
SELECT id, keyword, IF(keyword='secret','<secret-present>',data) AS data
FROM sip
WHERE id IN (${EXT_LIST}) AND keyword IN ('secret','dial','accountcode','context')
ORDER BY id, keyword;
SELECT extension, type, IF(secret IS NULL OR secret='', 'no-secret', 'secret-present') AS secret_state
FROM rest_devices_phones
WHERE extension IN (${EXT_LIST})
ORDER BY extension;
SQL
"
```

Export actual SIP passwords only inside the short-lived harness process:

```bash
get_sip_secret() {
  local ext="$1"
  runagent -m "$NV_MODULE" podman exec mariadb sh -lc '
    ext="$1"
    mysql -uroot -p"$MARIADB_ROOT_PASSWORD" -N -B asterisk \
      -e "SELECT data FROM sip WHERE id='${ext}' AND keyword='secret' LIMIT 1;"
  ' sh "$ext"
}

PASS_A=$(get_sip_secret "$EXT_A")
PASS_B=$(get_sip_secret "$EXT_B")
PASS_C=$(get_sip_secret "$EXT_C")
```

CDR/CEL validation:

```bash
runagent -m "$NV_MODULE" podman exec mariadb sh -lc '
mysql -uroot -p"$MARIADB_ROOT_PASSWORD" -N -B asteriskcdrdb <<SQL
SELECT calldate, src, dst, dcontext, channel, dstchannel, disposition, duration, billsec, uniqueid, linkedid
FROM cdr
ORDER BY calldate DESC
LIMIT 20;

SELECT eventtime, eventtype, cid_num, exten, context, channame, peer, uniqueid, linkedid
FROM cel
ORDER BY eventtime DESC
LIMIT 50;
SQL
'
```

Find a test call by extension or linkedid:

```bash
EXT="$EXT_A"
runagent -m "$NV_MODULE" podman exec mariadb sh -lc "
mysql -uroot -p\"\$MARIADB_ROOT_PASSWORD\" -N -B asteriskcdrdb \
  -e \"SELECT calldate,src,dst,disposition,uniqueid,linkedid FROM cdr WHERE src='$EXT' OR dst='$EXT' ORDER BY calldate DESC LIMIT 20;\"
"
```

## Satellite PostgreSQL access

Use only when Satellite/STT/transcript features are installed or enabled.

Direct host/container form:

```bash
podman exec -ti satellite-pgsql psql -U satellite
```

NS8/module form:

```bash
runagent -m "$NV_MODULE" podman exec satellite-pgsql psql -U satellite -d satellite -c '\dt'
```

High-value read-only queries:

```bash
runagent -m "$NV_MODULE" podman exec satellite-pgsql psql -U satellite -d satellite <<'SQL'
SELECT id, uniqueid, linkedid, state, summary, sentiment, created_at, updated_at, src_number, dst_number
FROM transcripts
ORDER BY updated_at DESC NULLS LAST, created_at DESC
LIMIT 20;
SQL
```

Find by call ID:

```bash
LINKEDID=<linkedid>
runagent -m "$NV_MODULE" podman exec satellite-pgsql psql -U satellite -d satellite <<SQL
SELECT id, uniqueid, linkedid, state, created_at, updated_at, src_number, dst_number,
       left(coalesce(summary, ''), 240) AS summary_prefix
FROM transcripts
WHERE linkedid = '$LINKEDID' OR uniqueid = '$LINKEDID'
ORDER BY updated_at DESC NULLS LAST;
SQL
```

If the `transcripts` table does not exist, first list tables and then inspect current schema:

```bash
runagent -m "$NV_MODULE" podman exec satellite-pgsql psql -U satellite -d satellite -c '\dt *.*'
```

## Wizard REST API

The historical Wizard REST API is installed under `/var/www/html/freepbx/rest` and uses two headers:

- `User`: FreePBX administrator username.
- `Secretkey`: SHA1 of `user + sha1(password) + shared_secret`.

Do not assume the shared secret path. On the installed system, inspect `config.inc.php` or generated config first.

Find local Wizard REST files:

```bash
runagent -m "$NV_MODULE" podman exec freepbx sh -lc '
find /var/www/html/freepbx/rest -maxdepth 3 -type f | sort | sed -n "1,200p"
sed -n "1,160p" /var/www/html/freepbx/rest/config.inc.php 2>/dev/null || true
'
```

Build auth header when the admin password and shared secret are known:

```bash
WIZARD_USER="admin"
WIZARD_PASS="password"
WIZARD_SECRET="1234"

PASS_SHA1=$(printf '%s' "$WIZARD_PASS" | sha1sum | awk '{print $1}')
SECRETKEY=$(printf '%s' "${WIZARD_USER}${PASS_SHA1}${WIZARD_SECRET}" | sha1sum | awk '{print $1}')
```

With SSH/module access, derive the Wizard virtualhost and shared secret from the module state without printing the secret:

```bash
NV_MODULE=<nethvoice_module_id>
WIZARD_USER="admin"
WIZARD_PASS="Test,1234"  # common test password; replace for real systems

WIZARD_HOST=$(runagent -m "$NV_MODULE" sh -lc 'sed -n "s/^NETHVOICE_HOST=//p" "$AGENT_STATE_DIR/environment" | tail -1')
WIZARD_SECRET=$(runagent -m "$NV_MODULE" sh -lc 'sed -n "s/^NETHVOICESECRETKEY=//p" "$AGENT_STATE_DIR/passwords.env" | tail -1')
PASS_SHA1=$(printf '%s' "$WIZARD_PASS" | sha1sum | cut -d' ' -f1)
SECRETKEY=$(printf '%s' "${WIZARD_USER}${PASS_SHA1}${WIZARD_SECRET}" | sha1sum | cut -d' ' -f1)
unset WIZARD_SECRET PASS_SHA1

wizard_get() {
  curl -sk "https://${WIZARD_HOST}/freepbx/rest/${1}" \
    -H "User: ${WIZARD_USER}" \
    -H "Secretkey: ${SECRETKEY}" \
    -H 'Accept: application/json'
}

wizard_post() {
  curl -sk -X POST "https://${WIZARD_HOST}/freepbx/rest/${1}" \
    -H "User: ${WIZARD_USER}" \
    -H "Secretkey: ${SECRETKEY}" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json' \
    -d "$2"
}
```

Call an endpoint:

```bash
curl -sk "https://${WIZARD_HOST}/freepbx/rest/users" \
  -H "User: ${WIZARD_USER}" \
  -H "Secretkey: ${SECRETKEY}" \
  -H 'Accept: application/json' | jq .
```

Create custom PJSIP physical extensions for existing users. The endpoint chooses the first free child number in the `91<main>` through `98<main>` range when the main extension already has a device record:

```bash
for main in 201 202 203; do
  wizard_post physicalextensions \
    "{\"mainextension\":\"${main}\",\"mac\":\"\",\"model\":\"\",\"web_user\":\"\",\"web_password\":\"\",\"line\":\"\",\"clear_temporary\":null}" \
    | jq -r --arg main "$main" '"main=\($main) extension=\(.extension // .status // empty)"'
done

runagent -m "$NV_MODULE" podman exec mariadb sh -lc '
mysql -uroot -p"$MARIADB_ROOT_PASSWORD" -N -B asterisk <<SQL
SELECT extension, name FROM users WHERE extension REGEXP "^(91|92|93|94|95|96|97|98)(201|202|203)$" ORDER BY extension;
SELECT extension, type, IF(secret IS NULL OR secret="", "no-secret", "secret-present") AS secret_state
FROM rest_devices_phones
WHERE extension REGEXP "^(91|92|93|94|95|96|97|98)(201|202|203)$"
ORDER BY extension;
SQL
'
```

Physical custom extensions are suitable for provisioning tests. Before using them with pjsua, inspect their endpoint route; if `outbound_proxy` is set, the pjsua harness must be reachable through that proxy or the call can fail even when registration OPTIONS are green.

Common Wizard endpoints to test:

| Need | Method/path |
|---|---|
| Login/auth smoke | `GET /login` |
| Users | `GET /users`, `GET /users/count`, `GET /users/{id}`, `POST /users`, `POST /users/sync` |
| Main extensions | `GET /mainextensions`, `GET /mainextensions/{ext}`, `POST /mainextensions` |
| Physical extensions | `GET /physicalextensions`, `GET /physicalextensions/{ext}`, `POST /physicalextensions`, `DELETE /physicalextensions/{ext_or_mac}` |
| Mobile app extensions | `POST /mobileapp`, `GET /mobileapp/{mainextension}`, `DELETE /mobileapp/{extension}` |
| Voicemail | `GET /voicemails`, `GET /voicemails/{extension}`, `POST /voicemails` |
| Devices scan | `POST /devices/scan`, `GET /devices/phones/list`, `GET /devices/gateways/list` |
| Phone SIP credentials | `GET /phones/account/{mac}` |
| Outbound routes | `GET /outboundroutes`, `POST /outboundroutes`, `DELETE /outboundroutes/{id}` |
| Trunks | `GET /trunks`, `GET /trunks/{tech}`, `POST /trunks` |
| Providers | `GET /providers` |
| Codecs | `GET /codecs/voip` |
| SRTP | `GET /extensions/{extension}/srtp`, `POST /extensions/{extension}/srtp/(true|false)` |
| Provisioning connectivity | `POST /provisioning/connectivitycheck` |

For current NS8 guided-install wizard APIs, inspect the active UI network calls or module action list. Do not reuse old `/freepbx/rest` endpoints for NS8 cluster setup unless the installed system exposes them.

## NethVoice Proxy checks

Use when SIP registration/calls traverse NethVoice Proxy/Kamailio.

Find proxy module:

```bash
api-cli run list-installed-modules | jq -r '..|objects|select(.id? and (.id|test("proxy")))|.id'
```

Route consistency:

```bash
PROXY_MODULE=<nethvoice_proxy_module_id>

runagent -m "$PROXY_MODULE" podman ps -a

runagent -m "$PROXY_MODULE" podman exec -i postgres sh -lc '
psql -U "$POSTGRES_USER" "$POSTGRES_DB" <<SQL
COPY (
  SELECT r.target AS domain, d.destination AS uri
  FROM nethvoice_proxy_routes r
  JOIN dispatcher d ON d.setid = r.setid
  WHERE r.route_type = '\''domain'\''
  ORDER BY r.target, d.destination
) TO STDOUT WITH CSV HEADER;
SQL
'
```

Confirm NethVoice SIP target:

```bash
runagent -m "$NV_MODULE" sh -lc 'grep -E "^(NETHVOICE_HOST|ASTERISK_SIP_PORT)=" "$AGENT_STATE_DIR/environment"'
ip -o -4 addr show dev wg0 | awk '{print $4}' | cut -d/ -f1 | head -1
```

Kamailio/rtpengine logs:

```bash
runagent -m "$PROXY_MODULE" journalctl --user --no-pager -n 200 | grep -Ei 'kamailio|rtpengine|error|warning|fail|tls|dispatcher|route' || true
runagent -m "$PROXY_MODULE" podman logs --tail 200 kamailio 2>/dev/null || true
runagent -m "$PROXY_MODULE" podman logs --tail 200 rtpengine 2>/dev/null || true
```

## HTTP/TLS checks

```bash
curl -kI "https://${CTI_HOST}/"
curl -kI "https://${CTI_HOST}/api/user/me"
curl -kI "https://${WIZARD_HOST}/freepbx/admin"
curl -kI "https://${WIZARD_HOST}/freepbx/rest/login"
```

Certificate check:

```bash
host="$CTI_HOST"; port=443
cert=$(mktemp)
timeout 8 openssl s_client -connect "$host:$port" -servername "$host" -showcerts </dev/null 2>&1 \
  | awk '/-----BEGIN CERTIFICATE-----/{c=1} c{print} /-----END CERTIFICATE-----/{exit}' > "$cert"
openssl x509 -in "$cert" -noout -subject -issuer -dates
openssl x509 -in "$cert" -noout -checkhost "$host"
rm -f "$cert"
```

## Test evidence collection

Before each call test:

```bash
TEST_ID="nvtest-$(date +%Y%m%d-%H%M%S)"
echo "$TEST_ID"
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'core show channels concise' > "${TEST_ID}-channels-before.txt"
```

After each call test:

```bash
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'core show channels concise' > "${TEST_ID}-channels-after.txt"

runagent -m "$NV_MODULE" podman exec mariadb sh -lc '
mysql -uroot -p"$MARIADB_ROOT_PASSWORD" -N -B asteriskcdrdb \
  -e "SELECT calldate,src,dst,disposition,duration,billsec,uniqueid,linkedid FROM cdr ORDER BY calldate DESC LIMIT 10;"
' > "${TEST_ID}-cdr.tsv"

runagent -m "$NV_MODULE" podman exec mariadb sh -lc '
mysql -uroot -p"$MARIADB_ROOT_PASSWORD" -N -B asteriskcdrdb \
  -e "SELECT eventtime,eventtype,cid_num,exten,channame,peer,uniqueid,linkedid FROM cel ORDER BY eventtime DESC LIMIT 30;"
' > "${TEST_ID}-cel.tsv"
```

Record pjsua artifacts:

```bash
ls -lh "$AUDIO_DIR"/recording-*.wav 2>/dev/null || true
for f in "$AUDIO_DIR"/recording-*.wav; do test -e "$f" && ffprobe -hide_banner "$f"; done
```

## Standard acceptance tests

### AT-001 SIP registration

- Start one `pjsua` endpoint.
- Verify Asterisk contact or successful outgoing INVITE.
- Expected: endpoint can register or call; no authentication failure in Asterisk full log.

### AT-002 Extension-to-extension audio

- A calls B.
- B answers.
- Play tone/prompt from A.
- Record on B.
- Expected: answered call, audio file non-empty, CDR disposition `ANSWERED`.

### AT-003 CTI state visibility

- During AT-002, call `astproxy/extension/{A}` and `{B}`.
- Expected: both show active conversation with a `convid` suitable for control operations.

### AT-004 CTI blind transfer

- A calls B; B answers.
- Use `astproxy/blindtransfer` from B to C.
- Expected: A reaches C, B leg ends, CDR/CEL contains transfer-related events, no orphan channels.

### AT-005 CTI attended transfer

- A calls B; B answers.
- Use `astproxy/atxfer` from B to C.
- Complete according to UI/API behavior supported by the installed version.
- Expected: final bridge is A-C or documented attended-transfer state; no orphan channels.

### AT-006 Hangup cleanup

- Create an active call.
- Hang up by pjsua and by CTI `astproxy/hangup`/`hangup_mainexten`.
- Expected: `core show channels concise` returns no test channels.

### AT-007 Outbound route/trunk

- Call an authorized external test number.
- Expected: correct trunk selected, expected caller ID, CDR row present, no proxy/Asterisk SIP errors.

### AT-008 Queue call

- A calls queue.
- B is dynamic/static agent.
- Use CTI queue state APIs.
- Expected: waiting/answered state transitions visible; queue log/CDR consistent.

### AT-009 Satellite transcript

- Place a call long enough for STT.
- Query Satellite PostgreSQL by `linkedid`/`uniqueid`.
- Expected: transcript row reaches expected state; summary/transcript API behavior matches entitlement and profile permissions.

### AT-010 Wizard API smoke

- Authenticate to `/freepbx/rest`.
- Read users/extensions/trunks/SRTP state.
- Expected: JSON response, no HTTP 401/500, no PHP fatal errors in logs.

## Failure triage

### SIP registration fails

Check:

```bash
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx "pjsip show endpoint $EXT_A"
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'pjsip show contacts'
runagent -m "$NV_MODULE" podman exec freepbx sh -lc 'grep -Ei "No matching endpoint|Failed to authenticate|401|403|registration|contact" /var/log/asterisk/full | tail -80'
```

Likely causes:

- Wrong SIP username/password.
- Wrong SIP domain/realm.
- Endpoint disabled or not generated by FreePBX.
- NAT/proxy route mismatch.
- TLS/WSS/SRTP mismatch.

### Call setup fails

Check:

```bash
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'core show channels concise'
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'dialplan show from-internal'
runagent -m "$NV_MODULE" podman exec freepbx sh -lc 'grep -Ei "No route|CHANUNAVAIL|CONGESTION|hangupcause|Unable to create channel|not found|rejected" /var/log/asterisk/full | tail -100'
```

### No audio / one-way audio

Check:

```bash
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'rtp set debug on'
# one short call only
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'rtp set debug off'
```

Also validate:

- pjsua uses host network.
- RTP ports open.
- Proxy `local_networks` and advertised addresses.
- Codec negotiation.
- SRTP/DTLS settings if WebRTC/WSS involved.

### CTI API cannot control call

Check:

```bash
curl -sk "https://${CTI_HOST}/api/user/me" -H "Authorization: Bearer ${JWT}" | jq .
cti_get "astproxy/extension/${EXT_A}" | jq .
runagent -m "$NV_MODULE" podman exec freepbx ctictl --list || true
runagent -m "$NV_MODULE" journalctl --user --no-pager -n 200 | grep -Ei 'nethcti|middleware|jwt|auth|forbidden|astproxy|error' || true
```

Likely causes:

- User does not own endpoint or lacks operator permissions.
- Wrong `endpointId`.
- `convid` stale or for the opposite leg.
- Current middleware path differs from legacy `/webrest`.
- Token expired or not authorized for requested operation.

### Wizard API fails

Check:

```bash
runagent -m "$NV_MODULE" podman exec freepbx sh -lc 'tail -80 /var/log/httpd/* 2>/dev/null || true'
runagent -m "$NV_MODULE" podman exec freepbx sh -lc 'tail -80 /var/log/asterisk/freepbx.log 2>/dev/null || true'
```

Likely causes:

- Wrong `Secretkey` hash.
- Wrong admin password.
- Endpoint not present in the installed version.
- Old Wizard REST API not exposed through the current route.

## Cleanup

Always end with:

```bash
# stop pjsua endpoints
for p in 2323 2324 2325 2326 2327; do printf 'call hangup\nshutdown\n' | nc -w 2 127.0.0.1 "$p" || true; done
podman ps --format '{{.Names}}' | grep '^pjsua-' | xargs -r podman rm -f

# disable Asterisk debug
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'pjsip set logger off' || true
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'rtp set debug off' || true

# confirm no orphan test channels
runagent -m "$NV_MODULE" podman exec freepbx asterisk -rx 'core show channels concise'
```

## Report format

Return a compact report:

```markdown
# NethVoice test report

## Target
- Host:
- Module:
- Access mode:
- Test ID:

## Summary
| Test | Result | Evidence |
|---|---:|---|
| SIP registration | PASS/FAIL | contact/call/log |
| Extension call | PASS/FAIL | CDR uniqueid, recording |
| CTI transfer | PASS/FAIL | convid, API response, CEL |
| DB validation | PASS/FAIL | CDR/CEL rows |
| Satellite | PASS/FAIL/NA | transcript row |

## Key evidence
- Asterisk uniqueid:
- Linkedid:
- CTI convid:
- CDR row:
- CEL transfer events:
- Recording file:
- Transcript row:

## Failures
- Symptom:
- Most likely cause:
- Supporting logs:
- Next action:
```

## Common mistakes

- Testing with a real trunk number instead of a controlled test destination.
- Forgetting to run `pjsip set logger off` or `rtp set debug off`.
- Assuming `/api` and `/webrest` use the same authentication header.
- Using a stale `convid` after transfer or hangup.
- Using the caller leg when the API requires the endpoint leg owned by the CTI user.
- Hardcoding rootless module paths instead of using `runagent`.
- Reading only CDR when transfer behavior requires CEL and Asterisk full log.
- Assuming the Wizard REST API is the same as the current NS8 guided-install wizard.
- Trusting pjsua slot numbers without running `audio list` first.
