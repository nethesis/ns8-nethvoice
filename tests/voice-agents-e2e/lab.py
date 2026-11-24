"""Private SSH/FreePBX control plane for owned voice-agent test fixtures."""
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import subprocess
import tempfile
import time


class LabError(RuntimeError):
    pass


class Lab:
    def __init__(self, host="root@makako.sf.nethserver.net", module="nethvoice70", *,
                 domain="voice2.makako.sf.nethserver.net", workdir):
        if not re.fullmatch(r"(?:[\w.-]+@)?[\w][\w.-]*", host) or not re.fullmatch(r"nethvoice\d+", module):
            raise LabError("invalid SSH destination or NS8 module")
        self.host, self.module, self.domain = host, module, domain
        self.workdir = Path(workdir)
        self.manifest = self.workdir / "pbx-ownership.json"
        self.state = {}
        self.metadata = {}
        self.versions = {}
        self._configured = {}
        self.cti = None
        self._cti_ready = False
        self._helper = Path(__file__).with_name("fixture.php").read_text().removeprefix("<?php")
        start = 8_000_000 + secrets.randbelow(900_000)
        roles = ["caller", "colleague", "alternate", "denied"]
        self.state = dict(host=host, module=module, domain=domain, owner="nvtest-" + secrets.token_hex(6),
                          extensions={role: str(start + i) for i, role in enumerate(roles)},
                          queue=str(start + 4), denied_queue=str(start + 5),
                          routes={"realtime": str(start + 6), "live": str(start + 7)})

    def _ssh(self, args, *, data=None, timeout=45):
        return self._root(["runagent", "-m", self.module, *args], data=data, timeout=timeout)

    def _root(self, args, *, data=None, timeout=45):
        command = ["ssh", "-oBatchMode=yes", "-oStrictHostKeyChecking=yes", "-oConnectTimeout=7",
                   "--", self.host, shlex.join(args)]
        try:
            p = subprocess.run(command, input=data or "", text=True, capture_output=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            raise LabError(f"timeout during {args[0]} on {self.module}") from None
        if p.returncode:
            tail = p.stderr.rstrip().splitlines()[-1:] or [""]
            reason = tail[0] if re.fullmatch(r"[a-z][a-z0-9_]{1,72}", tail[0]) else f"exit {p.returncode}"
            raise LabError(f"{self.module} {args[0]} failed ({reason})")
        return p.stdout

    def _php(self, op, **params):
        payload = dict(self.state, **params, operation=op)
        try:
            return json.loads(self._ssh(["podman", "exec", "-i", "freepbx", "php", "-r", self._helper],
                                        data=json.dumps(payload), timeout=120))
        except LabError as exc:
            raise LabError(f"FreePBX {op}: {exc}") from exc
        except json.JSONDecodeError:
            raise LabError(f"invalid FreePBX response for {op}") from None

    def _cli(self, cmd):
        return self._ssh(["podman","exec","freepbx","asterisk","-rx",cmd]).strip()

    def _reload(self):
        # Agent publication and deletion queue a background PBX-wide reload.
        # Wait for that helper to release its lock before loading our misc route.
        self._ssh(["podman","exec","freepbx","sh","-ec",
                   "for i in $(seq 1 100); do test -d /var/run/nethvoice/retrieve-lock || exec fwconsole reload; sleep 1; done; exit 1"],
                  timeout=180)

    def preflight(self):
        self.metadata = self._php("preflight")
        self.metadata["asterisk"] = self._cli("core show version")
        flag = self._ssh(["sh", "-c", 'printf "%s" "${CHAT_ENABLED:-false}"']).strip()
        self.metadata["chat_enabled"] = flag.lower() == "true"
        self.metadata["images"] = self._ssh(["podman","inspect","--format","{{.Name}} {{.Image}}",
                                             "freepbx","satellite"]).splitlines()
        calls = self._cli("core show calls")
        if not re.search(r"(?m)^0 active calls?\b", calls):
            raise LabError("PBX has active calls or unknown call state")
        if not self.metadata["client_proxy"] or not self.metadata["endpoint_proxy"] or not self.metadata["proxy_port"]:
            raise LabError("configured NethVoice proxy topology unavailable")
        self.wait_ready()
        return dict(self.metadata)

    def provision(self):
        if not self.metadata:
            self.preflight()
        self.workdir.mkdir(mode=0o700, parents=True, exist_ok=True)
        # Journal before the first remote write; secrets never enter this file.
        fd = os.open(self.manifest, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as file:
            json.dump(self.state, file)
            file.flush()
            os.fsync(file.fileno())
        self._sync_ownership_directory()
        port = self.metadata["proxy_port"]
        accounts = self._php("create", endpoint_proxy=f"sip:{self.metadata['endpoint_proxy']}:{port};lr")
        self._reload()
        self._php("verify_links")
        # Dynamic members are confined to these dedicated queues. Verify the exact
        # interface after adding it, since CLI reports some failures with exit zero.
        for q, role in [(self.state["queue"], "colleague"), (self.state["denied_queue"], "denied")]:
            ext = self.state["extensions"][role]
            self._cli(f"queue add member PJSIP/{ext} to {q}")
            if f"PJSIP/{ext}" not in self._cli(f"queue show {q}"):
                raise LabError("queue fixture member absent")
        allowed = [*self.state["extensions"].values(), self.state["queue"], self.state["denied_queue"],
                   *self.state["routes"].values()]
        base = 16000 + secrets.randbelow(3000)
        rtp = 35000 + secrets.randbelow(750) * 16
        self.cti = accounts.pop("cti", None)
        endpoints = {}
        for i, (role, account) in enumerate(accounts.items()):
            endpoints[role] = dict(account, domain=self.domain, registrar="sip:" + self.domain,
                                   proxy=f"sip:{self.metadata['client_proxy']}:{port};lr",
                                   sip_port=base+i, rtp_port=rtp+i*10, duration=300, allowed_destinations=allowed)
        return dict(endpoints=endpoints, routes=self.state["routes"], queue=self.state["queue"],
                    denied_queue=self.state["denied_queue"], cti=self.cti)

    def configure(self, transport, *, language="it", greeting="Benvenuti al laboratorio Corallo.",
                  instructions="", hangup=True, duration=180, attended=False, chat=False,
                  fallback=False, callbacks=True, exclude_callback=False, direct=True, queues=False):
        if not self.manifest.exists() or transport not in self.state["routes"]:
            raise LabError("missing run-owned fixture or unknown transport")
        key=(language, greeting, instructions, hangup, duration, attended, chat, fallback, callbacks, exclude_callback, direct, queues)
        if self._configured.get(transport)==key:
            self._php("verify_links")
            return self.state["routes"][transport]
        if chat and not self.metadata["chat_enabled"]:
            raise LabError("NethVoice chat is disabled on this module; the XMPP route is unavailable")
        if attended and not self._cti_ready:
            if "cti_profile_id" not in self.state:
                self.state.update(self._php("cti_prerequisite"))
            self._save_ownership()  # retries must durably journal the same receipt before writes
            self._php("cti")
            self._reload()
            self._reload_cti_profiles(present=True)
            self._cti_ready = True
        if chat:
            self.ensure_cti_login()
        agent = self._php("configure", transport=transport, binding=self.metadata["binding"], language=language,
                          greeting=greeting, instructions=instructions, hangup=hangup, duration=duration,
                          attended=attended, chat=chat, fallback=fallback, callbacks=callbacks,
                          exclude_callback=exclude_callback, direct=direct, queues=queues)
        self.versions[transport] = agent["workflow_version"]
        route = self.state["routes"][transport]
        if agent["new_route"] or fallback:
            self._reload()
        if "voice-agent-" + agent["agent_id"] not in self._cli(f"dialplan show {route}@app-miscapps"):
            raise LabError("published test route missing from loaded dialplan")
        # The native publisher schedules retrieveHelper asynchronously. Let its
        # primary and queued reloads settle before declaring a changed route usable.
        self._ssh(["podman", "exec", "freepbx", "sh", "-ec",
                   "for i in $(seq 1 90); do if test ! -d /var/run/nethvoice/retrieve-lock "
                   "&& test ! -d /var/run/nethvoice/retrieve-lock-2; then exit 0; fi; sleep 1; done; exit 1"],
                  timeout=100)
        self.wait_ready()
        self._php("verify_links")
        self._configured[transport] = key
        return route

    def queue_inventory(self):
        return set(self._php("queue_inventory"))

    def activity(self, transport):
        return self._php("runs", transport=transport)

    def trace(self, run_id, transport):
        return self._php("trace", run_id=run_id, transport=transport)

    def child_runs(self, run_id, transport):
        return self._php("children", run_id=run_id, transport=transport)

    def mailbox_count(self):
        return self._php("mailbox_count")["count"]

    def ensure_cti_login(self):
        if self.state.get("directory_provider") and self._php("directory_owner")["owned"]:
            return
        self._add_directory_identity()

    def _add_directory_identity(self):
        if not self.cti:
            raise LabError("CTI fixture credentials unavailable")
        domain=self._ssh(["printenv","USER_DOMAIN"]).strip()
        # Filter out bind credentials on the node before returning the directory map.
        script='set -o pipefail; api-cli run list-user-domains | jq -er --arg d "$1" \'[.domains[] | select(.name==$d) | .providers[].id | select(test("^openldap[0-9]+$"))] | if length==1 then .[0] else error("directory unavailable") end\''
        provider=self._root(["bash","-c",script,"_",domain]).strip()
        if not re.fullmatch(r"openldap[0-9]+",provider):
            raise LabError("chat fixture requires a writable internal OpenLDAP provider for this module domain")
        recorded = self.state.get("directory_provider")
        if recorded and recorded != provider:
            raise LabError("directory provider changed since the fixture was journaled")
        if self._php("directory_owner")["owned"]:
            if recorded == provider:
                return
            raise LabError("directory identity already present")
        # Record intent before submission, allowing recovery after loss of the reply.
        self.state["directory_provider"]=provider
        self._save_ownership()
        self._root(["api-cli","run","module/"+provider+"/add-user","--data","-"],
                   data=json.dumps(dict(user=self.cti["username"],display_name=self.state["owner"],
                                        password=self.cti["password"],locked=False)))
        if not self._php("directory_owner")["owned"]:
            raise LabError("directory did not confirm owned colleague")
        self._reload_cti_profiles(present=True)

    def _reload_cti_profiles(self, *, present):
        self._php("cti_config", present=present)
        self._ssh(["systemctl", "--user", "reload", "nethcti-middleware.service"])

    def _save_ownership(self):
        with tempfile.NamedTemporaryFile(mode="w", dir=self.workdir, delete=False) as temp:
            json.dump(self.state, temp)
            temp.flush()
            os.fsync(temp.fileno())
        try:
            os.replace(temp.name, self.manifest)
            self._sync_ownership_directory()
        finally:
            Path(temp.name).unlink(missing_ok=True)

    def _sync_ownership_directory(self):
        handle = os.open(self.workdir, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(handle)
        finally:
            os.close(handle)

    def queue_cursor(self):
        return self._php("queue_cursor")["cursor"]

    def queue_connected(self, recipient_digits, cursor):
        return self._php("queue_connected", recipient=recipient_digits, cursor=int(cursor))["connected"]

    def bridge(self, caller_digits, recipient_digits):
        owned = set(self.state["extensions"].values())
        carrier = "nvhist" + self.state["owner"].removeprefix("nvtest-")
        if caller_digits not in owned | {carrier} or recipient_digits not in owned:
            raise LabError("unowned bridge leg")
        rows = self._cli("bridge show all").splitlines()
        for row in rows:
            fields = row.split()
            if not fields or not re.fullmatch(r"[a-f0-9-]{36}", fields[0]) or "basic" not in fields:
                continue
            bridge_id = fields[0]
            info = self._cli("bridge show " + bridge_id)
            if all(re.search(r"\bPJSIP/"+n+r"-[a-fA-F0-9]+\b", info) for n in (caller_digits, recipient_digits)):
                return bridge_id
        return None

    def restart_satellite(self):
        if not self.manifest.exists():
            raise LabError("missing owned recovery fixture")
        channels = [line.split("!", 1)[0] for line in self._cli("core show channels concise").splitlines() if line]
        caller = self.state["extensions"]["caller"]
        owned = []
        linked = set()
        for channel in channels:
            if not re.fullmatch(r"[A-Za-z0-9._;/@:+-]+",channel):
                raise LabError("unknown active channel during recovery")
            info = self._cli("core show channel "+channel)
            match = re.search(r"(?im)^\s*LinkedID:\s*(\S+)\s*$",info)
            if not match:
                raise LabError("unverified active channel ownership during recovery")
            linked.add(match[1])
            if re.fullmatch(r"PJSIP/"+caller+r"-[a-fA-F0-9]+",channel):
                owned.append(match[1])
        if len(owned)!=1 or linked!={owned[0]}:
            raise LabError("recovery requires one run-owned call and no unrelated channels")
        self._ssh(["systemctl","--user","restart","satellite.service"], timeout=90)
        self._ssh(["systemctl","--user","is-active","satellite.service"])
        self.wait_ready()

    def wait_ready(self):
        ready = """import json, os, time, urllib.request
port = int(os.environ.get("VOICE_AGENT_HTTP_PORT", "8001"))
req = urllib.request.Request(f"http://127.0.0.1:{port}/internal/ready",
            headers={"Authorization": "Bearer "+os.environ["VOICE_AGENT_RUNTIME_TOKEN"]})
deadline = time.monotonic() + 45
while time.monotonic() < deadline:
    try:
        with urllib.request.urlopen(req, timeout=2) as response:
            if json.load(response).get("voice_calls_enabled") is True:
                break
    except (OSError, ValueError):
        pass
    time.sleep(0.5)
else:
    raise SystemExit("runtime_not_ready")
"""
        self._ssh(["podman","exec","satellite","python3","-c",ready],timeout=55)

    def cleanup(self, *, keep_manifest=False):
        if not self.manifest.exists():
            return
        saved = json.loads(self.manifest.read_text())
        if (saved["host"], saved["module"], saved["domain"]) != (self.host, self.module, self.domain):
            raise LabError("fixture manifest target mismatch")
        roles = {"caller", "colleague", "alternate", "denied"}
        numbers = [*saved["extensions"].values(), *saved["routes"].values(), saved["queue"], saved["denied_queue"]]
        if (not re.fullmatch(r"nvtest-[0-9a-f]{12}", saved["owner"])
                or set(saved["extensions"]) != roles or set(saved["routes"]) != {"live", "realtime"}
                or len(set(numbers)) != 8 or any(not re.fullmatch(r"8[0-9]{6}", n) for n in numbers)):
            raise LabError("invalid PBX fixture ownership manifest")
        self.state = saved
        channels = self._cli("core show channels concise")
        for ext in self.state["extensions"].values():
            if re.search(r"\b(?:Local|PJSIP)/"+ext+r"[-@/]", channels):
                raise LabError("fixture channels remain; disconnect test endpoints before cleanup")
            if re.search(r"(?m)^\s*Contact:\s+(?!<)\S", self._cli("pjsip show aor "+ext)):
                raise LabError("fixture still registered; stop test endpoints or wait for expiry")
        provider = self.state.get("directory_provider")
        if provider:
            if not re.fullmatch(r"openldap[0-9]+", provider):
                raise LabError("invalid recovery directory provider")
            self._php("directory_owner")  # Reject a replaced authentication identity before CTI cleanup.
        if self.state.get("cti_profile_id"):
            self._php("retire_cti")
            self._reload()  # Regenerate users.json while the owned Userman identity still exists.
            self._reload_cti_profiles(present=False)
            self._ssh(["systemctl", "--user", "reload", "nethcti-server.service"])
            self._php("retire_cti_settings")
        if provider:
            if self._php("directory_owner")["owned"]:
                self._root(["api-cli","run","module/"+provider+"/remove-user","--data","-"],
                           data=json.dumps(dict(user=self.state["owner"]+"-colleague")))
                if self._php("directory_owner")["owned"]:
                    raise LabError("directory fixture still present")
        self._php("delete")
        self._reload()
        if self.state.get("cti_profile_id"):
            self._php("retire_cti_settings")
        self._php("verify")
        if not keep_manifest:
            self.manifest.unlink()
