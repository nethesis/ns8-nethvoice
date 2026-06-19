---
name: nethserver8
description: Use when shell or SSH access to a NethServer 8 node is available and the agent must inspect, install, configure, update, remove, or troubleshoot NS8 modules, actions, containers, routes, logs, volumes, firewall, or service discovery.
version: 1.2.0
author: Kabutojira
license: MIT
metadata:
  hermes:
    tags: [ns8, nethserver8, ssh, api-cli, runagent, podman, systemd, journalctl, logcli, traefik, modules, diagnostics]
---

# NethServer 8 shell operations

## Scope

Use this skill only after a target NS8 node is known and direct shell/SSH access is allowed. Prefer the NS8 operational surface (`api-cli`, `add-module`, `remove-module`, `runagent`, module actions, module-owned systemd units) over ad-hoc file edits.

Primary references:

- Dev manual: `https://nethserver.github.io/ns8-core/`
- Admin manual: `https://docs.nethserver.org/projects/ns8/en/latest/`
- Module actions: `https://nethserver.github.io/ns8-core/modules/agent/`
- Rootless/rootfull: `https://nethserver.github.io/ns8-core/modules/rootless_rootfull/`
- Logs: `https://nethserver.github.io/ns8-core/core/logs/`
- Updates: `https://nethserver.github.io/ns8-core/modules/updates/`
- Traefik routes: `https://github.com/NethServer/ns8-traefik`
- NS8 diagnostic patterns: `https://github.com/Stell0/sysanal3`

## Safety rules

1. Verify host, user, OS, and cluster role before changes.
2. Inspect first; change only through the most specific supported action that addresses the task. Prefer a targeted action such as `set-route` or `set-certificate` over a broad action such as `configure-module` when both are available and the targeted action covers the required change.
3. Do not invent action names or JSON fields. Run `list-actions`, then inspect current config or module source.
4. Treat `remove-module --no-preserve`, manual volume deletion, Redis writes, and direct file edits as destructive.
5. For rootless modules, do not use `su`/SSH into the module user. Since Core 3.20 rootless users may have `/sbin/nologin`; use `runagent -m <module_id>`.
6. After every change, run the Post-change verification sequence.
7. When editing action/event scripts, keep structured stdout clean. Send diagnostics to stderr: `echo "message" >&2`.

## API and action conventions

`api-cli` executes actions through the API server, or talks directly to Redis when no JWT cache is available locally. To authenticate remotely or as a user:

```bash
api-cli login
api-cli logout
```

Documented command forms:

```bash
api-cli run list-actions                              # default cluster agent
api-cli run <cluster_action> --data '{...}'           # e.g. update-module
api-cli run module/<module_id>/<action> --data '{...}'
api-cli run --agent module/<module_id> <action> --data '{...}'
api-cli run <action> --agent module/<module_id> --data '{...}'
```

Prefer bare cluster actions (`list-actions`, `get-cluster-status`, `list-installed-modules`, `update-module`). Use an API action name containing `/` only if the exact action name appears in `api-cli run list-actions` output; do not synthesize `cluster/<action>` forms. Add `--verbose` only if the literal string `--verbose` appears in `api-cli --help` output on that host.

If any `api-cli run` command returns an authentication error or HTTP 401, run `api-cli login` before retrying. If `api-cli login` fails because no local API server is reachable, verify `systemctl status api-server --no-pager`; do not fall back to direct Redis writes solely because authentication failed.

Run cluster-scoped actions (`add-module`, `remove-module`, `update-module`, `get-cluster-status`) from the cluster leader node. Before issuing a cluster-scoped action from a worker node, verify leader status with `api-cli run get-cluster-status | jq .leader` and connect to the leader when required by the host.

For multiline JSON, prefer stdin:

```bash
api-cli run module/<module_id>/<action> --data - <<'JSON'
{"key":"value"}
JSON
```

## Multi-node operations

If `list-installed-modules` shows the target module on a node different from the current shell, SSH to that node before using `runagent` or inspecting module-owned systemd and Podman state. Cluster-level actions such as `add-module`, `remove-module`, and `update-module` may be initiated only from a node where `api-cli` can reach the cluster leader. Never run `runagent -m <module_id>` from a node that does not host that module.

## Host preflight

Local:

```bash
hostnamectl --static
id
cat /etc/os-release | sed -n '1,8p'
uptime
api-cli --help
api-cli run list-actions | jq .
api-cli run get-cluster-status | jq .
api-cli run list-installed-modules | jq .
```

Remote one-shot:

```bash
ssh <target> 'hostnamectl --static; id; cat /etc/os-release | sed -n "1,8p"; uptime; api-cli --help | head -40'
```

Initial health triage:

```bash
systemctl --no-pager --type=service --state=failed
journalctl -p err -b --no-pager -n 100
api-cli run get-cluster-status | jq .
api-cli run list-installed-modules | jq .
podman ps --format '{{.Names}}\t{{.Status}}' || true
```

## Post-change verification

After every install, update, configure, restart, remove, route, certificate, or firewall change, verify the changed scope with this sequence:

1. Confirm the action or command exit code and stdout.
2. Check `get-configuration` when the module exposes it.
3. Check `get-status` for rootless modules, or the correct systemd unit status for rootfull modules.
4. Read `api-server-logs` or a short journal tail for the module.
5. Check the correct Podman context with `podman ps -a`.
6. For web apps, check route and certificate state.
7. Check the last API audit row when an API action changed state.

## Find modules and actions

List installed instances:

```bash
api-cli run list-installed-modules | jq .
api-cli run list-installed-modules | jq -r 'to_entries[] as $m | $m.value[]? | [.id, $m.key, (.node // .node_id // "?")] | @tsv'
```

Inspect one module:

```bash
mid=<module_id>
api-cli run module/$mid/list-actions | jq .
api-cli run module/$mid/get-configuration | jq . || true
api-cli run module/$mid/get-status | jq . || true        # base action is reliable mainly for rootless modules
runagent -m $mid sh -lc 'id; printenv | sort | egrep "^(MODULE_ID|MODULE_UUID|NODE_ID|AGENT_|IMAGE_|TCP_|UDP_)"'
runagent -m $mid sh -lc 'printf "install=%s\nstate=%s\n" "$AGENT_INSTALL_DIR" "$AGENT_STATE_DIR"; sed -n "1,220p" "$AGENT_STATE_DIR/environment" 2>/dev/null || true'
```

If `runagent -m <module_id>` exits non-zero or prints `module not found`, verify the module ID with `api-cli run list-installed-modules` and confirm the module is hosted on the current node. If the module exists on the current node but `runagent` still fails, check the module agent service before retrying: for rootfull modules use `systemctl status agent@<module_id> --no-pager`; for rootless modules use `runagent -m <module_id> systemctl --user status --no-pager` only after `runagent` succeeds.

Do not hardcode module paths. Resolve them from `AGENT_INSTALL_DIR` and `AGENT_STATE_DIR`. Typical paths are:

- rootless install: `/home/<module_id>/.config`
- rootless state: `/home/<module_id>/.config/state`
- rootfull install/state: `/var/lib/nethserver/<module_id>` and `/var/lib/nethserver/<module_id>/state`

## Install, remove, update

Install from enabled repository or explicit image URL:

```bash
add-module <module_name> <node_id>
add-module ghcr.io/<namespace>/<image>:<tag> <node_id>
```

For mutable development tags such as `latest`, `main`, or branch-named tags, `add-module` may reuse an image that already exists locally. Remove it on the target node first only when a fresh pull of a mutable tag is required. For versioned production tags such as `1.2.3`, do not run `podman rmi` before `add-module`.

```bash
podman rmi ghcr.io/<namespace>/<image>:<tag>
```

Remove:

```bash
remove-module <module_id>                 # preserve data
remove-module --no-preserve <module_id>   # erase module data; destructive
```

Update one or more instances:

```bash
api-cli run update-module --data '{"module_url":"ghcr.io/<namespace>/<image>:<tag>","instances":["<module_id>"]}'
api-cli run update-module --data '{"module_url":"ghcr.io/<namespace>/<image>:<tag>","instances":["<module_id>"],"force":true}'
```

Verify after install/update/remove:

Run the Post-change verification sequence. Useful commands include:

```bash
api-cli run list-installed-modules | jq .
api-cli run module/<module_id>/list-actions | jq . || true
api-cli run module/<module_id>/get-status | jq . || true
api-server-logs logs -e module -n <module_id> || true
```

## Configure a module

If the module is also exhibiting errors, complete steps 1-4 of the Troubleshooting sequence before beginning this workflow. The Troubleshooting sequence governs fault investigation; this workflow governs intentional reconfiguration.

Workflow:

1. `list-actions`
2. `get-configuration` if present
3. inspect current env and action files
4. build the smallest valid payload
5. run `configure-module`
6. run the Post-change verification sequence

Commands:

```bash
mid=<module_id>
api-cli run module/$mid/list-actions | jq .
api-cli run module/$mid/get-configuration | jq . || true
runagent -m $mid sh -lc 'find "$AGENT_INSTALL_DIR/actions" -maxdepth 2 -type f | sort | sed -n "1,200p"'
runagent -m $mid sh -lc 'find "$AGENT_INSTALL_DIR/actions/configure-module" -maxdepth 1 -type f -printf "%m %p\n" 2>/dev/null | sort'
```

Run configuration:

```bash
api-cli run module/$mid/configure-module --data - <<'JSON'
{
  "host": "app.example.org"
}
JSON
```

If validation fails, inspect:

```bash
runagent -m $mid sh -lc 'sed -n "1,240p" "$AGENT_INSTALL_DIR/actions/configure-module/validate-input.json" 2>/dev/null || true'
runagent -m $mid sh -lc 'test -s "$AGENT_INSTALL_DIR/actions/configure-module/validate-input.json" || cat "$AGENT_INSTALL_DIR/actions/configure-module/"* 2>/dev/null | head -300'
api-server-logs logs -e module -n $mid
```

Map validation error field names from `api-cli` output to the corresponding key in `validate-input.json` or the action script. Do not guess payload structure; if the schema or script cannot be resolved, report the raw validation error to the user and stop.

Preserve all fields returned by `get-configuration` in a `configure-module` payload unless `validate-input.json` explicitly omits the field from the `required` array and documents a default value for that field.

## Rootless vs rootfull operations

Detect runtime type:

```bash
runagent -m <module_id> sh -lc 'test "$(id -u)" = 0 && echo ROOTFULL || echo ROOTLESS; echo "$AGENT_INSTALL_DIR"; echo "$AGENT_STATE_DIR"'
```

Rootless modules run as their own Unix user, have private Podman storage, use user systemd units, and should be inspected through `runagent`:

```bash
runagent -m <module_id> systemctl --user list-units --all --no-pager
runagent -m <module_id> systemctl --user status <unit> --no-pager
runagent -m <module_id> journalctl --user -u <unit> --no-pager -n 200
runagent -m <module_id> podman ps -a
runagent -m <module_id> podman logs --tail 200 <container>
```

Rootfull modules run as root, share system Podman storage, use system units under `/etc/systemd/system`, and unit/volume names must be prefixed with `<module_id>`:

```bash
systemctl list-units --all '<module_id>*' --no-pager
systemctl status <module_id>.service --no-pager || systemctl status '<module_id>*' --no-pager
journalctl -u <module_id>.service --no-pager -n 200 || journalctl --no-pager -n 200 | grep -F '<module_id>'
podman ps -a
podman logs --tail 200 <container>
```

## Logs

NS8 logs are primarily in systemd journal; Loki/logcli and `api-server-logs` provide cluster/module views.

Cluster/module log tools:

```bash
api-server-logs logs -e module -n <module_id>          # follows like tail -f
api-server-logs logs -e node -n <node_id>
logcli labels module_id -q
logcli query -q --no-labels '{module_id="<module_id>"} | json | line_format "{{.MESSAGE}}"'
```

Journal patterns:

```bash
journalctl -b --no-pager -n 200
journalctl -p err -b --no-pager -n 200
journalctl -f _UID=$(id -u <rootless_module_id>)
runagent -m <rootless_module_id> journalctl --user --no-pager -n 200
```

API audit log:

```bash
sqlite3 /var/lib/nethserver/api-server/audit.db 'SELECT ID,User,Action,Timestamp FROM audit ORDER BY ID DESC LIMIT 20;'
```

## Containers, volumes, and mounts

Rootless:

```bash
runagent -m <module_id> podman ps -a
runagent -m <module_id> podman inspect <container>
runagent -m <module_id> podman system info --format='{{.Store.VolumePath}}'
runagent -m <module_id> podman volume ls
runagent -m <module_id> podman inspect <container> --format '{{json .Mounts}}' | jq .
```

Rootfull:

```bash
podman ps -a
podman inspect <container>
podman system info --format='{{.Store.VolumePath}}'
podman volume ls | grep '^local[[:space:]]\+<module_id>-' || true
podman inspect <container> --format '{{json .Mounts}}' | jq .
```

Rules:

- Persistent app data should be in Podman volumes.
- Rootfull volumes share one namespace and must use `<module_id>-` prefixes.
- Rootless volumes are private to the module user.
- On SELinux hosts, check labels; `:z` is normally used for shared container bind mounts.
- Use `volumectl` and `/etc/nethserver/volumes.conf` for node volume assignment, not manual symlink hacks.

## Traefik HTTP routes and certificates

Find Traefik instance:

```bash
api-cli run list-installed-modules | jq -r '."ghcr.io/nethserver/traefik"[]?.id'
redis-cli --raw get cluster/default_instance/traefik 2>/dev/null || true
```

Inspect routes:

```bash
tr=<traefik_id>
api-cli run list-routes --agent module/$tr | jq .
api-cli run list-routes --agent module/$tr --data '{"expand_list":true}' | jq .
api-cli run get-route --agent module/$tr --data '{"instance":"<module_id>"}' | jq .
```

Create/update route only when the module action does not already manage it:

```bash
api-cli run set-route --agent module/$tr --data - <<'JSON'
{
  "instance": "<module_id>",
  "url": "http://127.0.0.1:<port>",
  "host": "app.example.org",
  "path": "/optional-prefix",
  "lets_encrypt": true,
  "http2https": true,
  "skip_cert_verify": false
}
JSON
```

Inspect certificates:

```bash
api-cli run get-certificate --agent module/$tr --data '{"fqdn":"app.example.org"}' | jq .
api-cli run list-certificates --agent module/$tr | jq .
```

## Service discovery, users, events, firewall

Service providers:

```bash
api-cli run module/<consumer_module>/list-service-providers --data '{"service":"imap","transport":"tcp"}' | jq .
redis-cli --scan --pattern 'module/*/srv/*/*'
redis-cli hgetall module/<provider_module>/srv/tcp/<service>
```

LDAP/user-domain discovery from a module context:

```bash
runagent -m <module_id> python3 -magent.ldapproxy | jq .
```

Events:

```bash
runagent -m <module_id> sh -lc 'find "$AGENT_INSTALL_DIR/events" -maxdepth 3 -type f -printf "%m %p\n" 2>/dev/null | sort'
# Publish only when official docs or module source require event injection for this task and the user explicitly asks for that test:
redis-cli PUBLISH module/<module_id>/event/<event_name> '{"field":"value"}'
```

Firewall inspection:

```bash
firewall-cmd --get-active-zones
firewall-cmd --list-all-zones
```

Firewall changes for modules should normally be implemented by module code with `agent.add_public_service()` / `agent.remove_public_service()` and require the image authorization label `org.nethserver.authorizations=node:fwadm`. Avoid manual firewall changes unless the task explicitly asks for an emergency host-level workaround.

## Redis inspection

Use Redis inspection only when `api-cli` returns a non-zero exit code, `api-cli` is not installed on the host, or successful `api-cli` output does not contain the specific field required for the task. Do not use Redis to cross-check or supplement successful `api-cli` output. Prefer read-only commands:

```bash
redis-cli --scan --pattern 'module/<module_id>/*'
redis-cli hgetall module/<module_id>/environment
redis-cli get module/<module_id>/ui_name
redis-cli hget node/<node_id>/vpn endpoint
```

Do not write Redis keys or publish Redis messages unless official docs or module code explicitly require that operation for the task and the user explicitly asks for that test.


## NS8 support diagnostics

Use these only after the normal NS8 action/log workflow. They encode NS8-specific support knowledge; they are not a generic Linux checklist.

### Node identity and pressure

`/home` is important because rootless module homes and private Podman storage commonly live there.

```bash
# node id and cluster metadata, read-only
cat /var/lib/nethserver/node/state/environment 2>/dev/null | grep -E '^(NODE_ID|IMAGE_URL)=' || true
grep -oP '^AGENT_ID=node/\K[0-9]+' /var/lib/nethserver/node/state/agent.env 2>/dev/null || true
redis-cli --raw get cluster/uuid 2>/dev/null || true
redis-cli --raw hget cluster/subscription system_id 2>/dev/null || true
redis-cli --raw hget node/1/vpn endpoint 2>/dev/null || true
redis-cli --raw KEYS 'node/*/vpn' 2>/dev/null | wc -l

# pressure points that often break NS8 modules
cat /proc/sys/fs/file-nr
findmnt -n -o TARGET --target /home 2>/dev/null; df -h /home 2>/dev/null
pgrep -x sngrep | while read p; do ps -o pid,etimes,cmd -p "$p"; done
```

### Module inventory from Redis, read-only fallback

Use when `api-cli run list-installed-modules` is unavailable or too coarse.

```bash
redis-cli --raw HGETALL cluster/module_node
mid=<module_id>
redis-cli --raw HGET "module/$mid/environment" IMAGE_URL
redis-cli --scan --pattern 'module/*/environment' | while read k; do
  mid=${k#module/}; mid=${mid%/environment}
  img=$(redis-cli --raw HGET "$k" IMAGE_URL 2>/dev/null)
  test -n "$img" && printf '%s\t%s\n' "$mid" "$img"
done | sort
```

### Compact container and unit health

This is higher signal than plain `podman ps` because it exposes restarts and non-failed dead units.

```bash
mid=<module_id>
runagent -m $mid podman ps -a --format '{{.Names}} [Status:{{.Status}}] [Restarts:{{.Restarts}}]'
runagent -m $mid systemctl --user --failed --no-legend --no-pager || true
runagent -m $mid systemctl --user list-units --type=service --no-legend --no-pager \
  | awk '$3 == "inactive" || $4 == "dead" {print}'
```

For all modules on the local node:

```bash
api-cli run list-installed-modules | jq -r '..|objects|select(has("id"))|.id' | sort -u | while read mid; do
  echo "== $mid =="
  runagent -m "$mid" podman ps -a --format '{{.Names}} [Status:{{.Status}}] [Restarts:{{.Restarts}}]' 2>/dev/null || true
  runagent -m "$mid" systemctl --user --failed --no-legend --no-pager 2>/dev/null || true
done
```

### TLS endpoint certificate check

Use for Traefik routes, NethVoice HTTPS, and SIP/TLS endpoints.

```bash
host=<fqdn>; port=443
cert=$(mktemp)
timeout 8 openssl s_client -connect "$host:$port" -servername "$host" -showcerts </dev/null 2>&1 \
  | awk '/-----BEGIN CERTIFICATE-----/{c=1} c{print} /-----END CERTIFICATE-----/{exit}' > "$cert"
openssl x509 -in "$cert" -noout
openssl x509 -in "$cert" -noout -checkhost "$host"
openssl x509 -in "$cert" -noout -checkend 0
rm -f "$cert"
```

### Severe host log patterns

Use as a quick high-signal scan before deep module debugging.

```bash
grep -E -i -m 20 'kernel panic|panic not syncing|BUG:|Oops:|general protection fault|segfault|core dumped|Out of memory:|oom-kill|soft lockup|hard LOCKUP|rcu.*stall|blocked for more than|I/O error|EXT4-fs error|Remounting filesystem read-only|XFS .*shutdown|NETDEV WATCHDOG|emergency mode|FATAL:' /var/log/messages 2>/dev/null || true
```

## NethVoice diagnostics

Use only when a local `nethvoice`, `nethvoice-proxy`, `nethcti`, `phonebook`, or `satellite` module is involved.

Find related modules:

```bash
api-cli run list-installed-modules | jq -r '..|objects|select(.id? and (.id|test("nethvoice|nethcti|phonebook|satellite")))|.id' | sort -u
redis-cli --scan --pattern 'module/*/environment' | while read k; do
  mid=${k#module/}; mid=${mid%/environment}
  img=$(redis-cli --raw HGET "$k" IMAGE_URL 2>/dev/null)
  echo "$mid $img"
done | grep -E 'nethvoice|nethcti|phonebook|satellite'
```

### FreePBX/container checks

```bash
nv=<nethvoice_module_id>
runagent -m $nv podman exec freepbx getent hosts ibm.com
runagent -m $nv podman exec freepbx cat /etc/resolv.conf
runagent -m $nv podman exec mariadb sh -c 'mysqlcheck -uroot -p${MARIADB_ROOT_PASSWORD} -A'
runagent -m $nv podman exec mariadb sh -c 'mysql -uroot -p${MARIADB_ROOT_PASSWORD} -N -B asterisk -e "SELECT `key`, val, type, id FROM kvstore_Sipsettings WHERE `key` = '\''localnets'\'';"'
runagent -m $nv podman exec freepbx sh -c 'printenv SMTP_FROM_ADDRESS; grep -E "^[[:space:]]*mailcmd[[:space:]]*=" /etc/asterisk/voicemail.conf 2>/dev/null | grep -F -- "send_email -f " || true'
```

### Asterisk state

```bash
nv=<nethvoice_module_id>
runagent -m $nv podman exec freepbx pgrep asterisk
runagent -m $nv podman exec freepbx asterisk -rx 'pjsip show contacts'
runagent -m $nv podman exec freepbx asterisk -rx 'pjsip show transports'
runagent -m $nv podman exec freepbx asterisk -rx 'database show AMPUSER' | grep -F '/AMPUSER//cidname' || true
runagent -m $nv podman exec freepbx asterisk -rx 'database show CF'
runagent -m $nv podman exec freepbx asterisk -rx 'queue show'
```

Interpretation hints:

- `/AMPUSER//cidname` is a bad empty-extension AstDB entry; remove from Asterisk CLI only when confirmed: `database del AMPUSER/ cidname`.
- `database show CF` exposes call forwards; check for loops such as `200 -> 201 -> 200`.
- Many `ringall` queues, or a `ringall` queue with many agents, can amplify call load.
- Asterisk should normally not listen directly on public `5060`/`5061`; Kamailio/proxy owns those ports.

### Asterisk full log high-signal scan

```bash
nv=<nethvoice_module_id>
runagent -m $nv podman exec freepbx sh -lc '
patterns="Too many open files|Cannot create socket|Channel allocation failed|Unable to create channel of type|we couldn'"'"'t allocate a port for RTP instance|No RTP engine was found|failed to setup RTP instance|RTP no remote address on instance|Unable to allocate RTP socket|Couldn'"'"'t negotiate stream|No translator path exists|Failed to create srtp session|SRTP (protect|unprotect)|Is endpoint registered and reachable"
grep -E -i -m 20 "$patterns" /var/log/asterisk/full 2>/dev/null || true
for f in /var/log/asterisk/full.*.gz; do test -e "$f" && gzip -cd "$f" | grep -E -i -m 20 "$patterns"; done
'
```

### NethVoice proxy route consistency

A local `nethvoice-proxy` should route each `NETHVOICE_HOST` to `sip:<wg0 IPv4>:<ASTERISK_SIP_PORT>`.

```bash
proxy=<nethvoice_proxy_module_id>
runagent -m $proxy podman exec -i postgres sh -lc '
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

nv=<nethvoice_module_id>
runagent -m $nv sh -lc 'grep -E "^(NETHVOICE_HOST|ASTERISK_SIP_PORT)=" "$AGENT_STATE_DIR/environment"'
ip -o -4 addr show dev wg0 | awk '{print $4}' | cut -d/ -f1 | head -1
```

### Hairpin NAT probes for SIP/NethVoice

Use only when public-IP SIP reachability from inside the LAN matters.

```bash
public_ip=$(curl -4 -fsS --max-time 5 https://api64.ipify.org || curl -4 -fsS --max-time 5 https://ipv4.icanhazip.com)
ip route get "$public_ip"
timeout 6 openssl s_client -connect "$public_ip:5061" -brief </dev/null
```

For UDP/TCP SIP hairpin, send a minimal `OPTIONS` request to `$public_ip:5060`; ensure `ss` first shows port `5060` owned by `kamailio`.

## CrowdSec diagnostics

Use when local/cluster clients cannot reach services and a CrowdSec module exists.

```bash
cs=<crowdsec_module_id>
container=$(runagent -m $cs podman ps --format '{{.Names}}' | grep -i crowdsec | head -1)
ip -o addr show | awk '{print $4}' | cut -d/ -f1 | grep -Ev '^(127\.|::1$)' | sort -u | while read ip; do
  echo "== $ip =="
  runagent -m $cs podman exec "$container" cscli decisions list -i "$ip" -o raw 2>/dev/null || true
done
```

## Troubleshooting sequence

1. Verify target: host, user, OS, cluster status.
2. Identify module ID and node: `list-installed-modules`.
3. List actions; check `get-configuration` and `get-status`.
4. Resolve `AGENT_INSTALL_DIR` and `AGENT_STATE_DIR` with `runagent`.
5. Detect rootless/rootfull; inspect the correct systemd and Podman context.
6. Read module logs with `api-server-logs`, `logcli`, then journal/container logs.
7. Inspect routes/certs for web apps.
8. Inspect service providers, user-domain binding, events, or firewall only when relevant.
9. Change via supported action or helper command.
10. Verify state, logs, containers, routes, and audit record.

Minimal incident bundle:

```bash
mid=<module_id>
hostnamectl --static; id; cat /etc/os-release | sed -n '1,8p'
api-cli run get-cluster-status | jq .
api-cli run list-installed-modules | jq .
api-cli run module/$mid/list-actions | jq . || true
api-cli run module/$mid/get-configuration | jq . || true
api-cli run module/$mid/get-status | jq . || true
runagent -m $mid sh -lc 'id; echo "$AGENT_INSTALL_DIR"; echo "$AGENT_STATE_DIR"; if [ "$(id -u)" = 0 ]; then systemctl list-units --all "${MODULE_ID:-$mid}*" --no-pager 2>/dev/null || true; podman ps -a 2>/dev/null || true; else systemctl --user list-units --all --no-pager 2>/dev/null || true; podman ps -a 2>/dev/null || true; fi'
api-server-logs logs -e module -n $mid || true
```

## Report format

- Target: host, user, local/SSH, node ID, module ID.
- Findings: confirmed facts only.
- Actions run: exact commands/actions and payloads.
- Changes made: install/update/config/restart/remove, or none.
- Verification: command output proving result.
- Remaining risk: unknowns, degraded components, destructive actions avoided.

## Common errors to avoid

- Synthesizing undocumented `cluster/<action>` API action names instead of using the exact action names printed by `api-cli run list-actions`.
- Running root `systemctl --user` or root Podman against rootless modules.
- Hardcoding `/home/<module_id>`; custom home base paths and rootfull modules exist.
- Trusting `get-status` for rootfull modules; inspect system units/logs directly.
- Reconfiguring from memory instead of `get-configuration` output and action schema.
- Editing Redis or module files before reading logs and supported actions.
- Declaring success after an action returns without checking runtime state.
