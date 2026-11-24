"""Recover this run's orphaned SIP clients inside their original NS8 module."""
from contextlib import ExitStack
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time


ROLES = ("caller", "colleague", "alternate", "denied")
MARKER = ".nv-agent-phone-owner"


class RecoveryError(RuntimeError):
    pass


def cli(*args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=15)
    if result.returncode:
        raise RecoveryError("phone_inventory_failed")
    return result.stdout


def containers(label):
    names = cli("podman", "ps", "-a", "--filter", "label=org.nethvoice.test=" + label,
                "--format", "{{.Names}}").splitlines()
    for name in names:
        if not re.fullmatch("nvtest-" + re.escape(label) + "-[0-9a-f]{8}", name):
            raise RecoveryError("phone_name_does_not_match_label")
    return names


def locked_directories(stack, tmp, label, expected):
    result = []
    for path in tmp.glob("nv-agent-phone-" + label + "-*"):
        if not re.fullmatch("nv-agent-phone-" + re.escape(label) + r"-[a-z0-9_]{8}", path.name):
            continue
        meta = path.lstat()
        if not stat.S_ISDIR(meta.st_mode) or meta.st_uid != os.getuid() or meta.st_mode & 0o077:
            raise RecoveryError("invalid_phone_directory")
        fd = os.open(path / MARKER, os.O_RDONLY | os.O_NOFOLLOW)
        marker = stack.enter_context(os.fdopen(fd))
        meta = os.fstat(fd)
        if not stat.S_ISREG(meta.st_mode) or meta.st_uid != os.getuid() or meta.st_mode & 0o077 or meta.st_size > 2048:
            raise RecoveryError("invalid_phone_stamp")
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RecoveryError("phone_driver_is_still_active") from None
        if json.load(marker) != dict(expected, label=label):
            raise RecoveryError("phone_stamp_mismatch")
        result.append(path)
    return result


def registered(ext):
    detail = cli("podman", "exec", "freepbx", "asterisk", "-rx", "pjsip show aor " + ext)
    if re.search(r"(?m)^\s*Contact:\s+[^<\s]", detail):
        return True
    if re.search(r"(?m)^\s*Aor:\s+" + re.escape(ext) + r"(?:\s|$)", detail) or "Unable to find object " in detail:
        return False
    raise RecoveryError("phone_contact_inventory_unknown")


def recover(request, remove_owned_container, *, tmp=None):
    owner = request["owner"]
    exts = request["extensions"]
    target = {k: request[k] for k in ("module", "domain")}
    if (not re.fullmatch(r"nvtest-[a-f0-9]{12}", owner)
            or set(exts) != set(ROLES)
            or any(not re.fullmatch(r"8[0-9]{6}", value) for value in exts.values())
            or len(set(exts.values())) != len(ROLES)
            or target != {"module": os.environ.get("MODULE_ID"), "domain": os.environ.get("NETHVOICE_HOST")}):
        raise RecoveryError("phone_recovery_wrong_target")
    if not shutil.rmtree.avoids_symlink_attacks:
        raise RecoveryError("safe_phone_directory_cleanup_unavailable")
    tmp = Path(tempfile.gettempdir()) if tmp is None else tmp
    dirs, pending, roles = [], [], []
    with ExitStack() as stack:
        for role in (*ROLES, "carrier"):
            label = owner + "-" + role
            owned_dirs = locked_directories(stack, tmp, label, target)
            owned_containers = containers(label)
            dirs.extend(owned_dirs)
            pending.extend((name, label) for name in owned_containers)
            if (owned_dirs or owned_containers) and role in exts:
                roles.append(role)

        for name, label in pending:
            remove_owned_container(name, label)
        for role in (*ROLES, "carrier"):
            if containers(owner + "-" + role):
                raise RecoveryError("owned_phone_container_remains")

        # PJSUA requests a 120 s registration. Forced removal cannot unregister.
        deadline = time.monotonic() + 135
        while any(registered(exts[role]) for role in roles):
            if time.monotonic() >= deadline:
                raise RecoveryError("owned_phone_contact_remains")
            time.sleep(2)
        for path in dirs:
            shutil.rmtree(path)
    return {"containers": len(pending), "directories": len(dirs)}


def recover_phones(lab, sip_helper):
    request = {key: lab.state[key] for key in ("owner", "extensions", "domain", "module")}
    if (lab.host, lab.module, lab.domain) != (lab.state["host"], request["module"], request["domain"]):
        raise RecoveryError("phone_manifest_target_mismatch")
    request["sip_helper"] = Path(sip_helper).read_text()
    return json.loads(lab._ssh(["python3", "-c", Path(__file__).read_text()],
                               data=json.dumps(request), timeout=240))


if __name__ == "__main__":
    try:
        request = json.load(sys.stdin)
        namespace = {"__name__": "sip_endpoint"}
        exec(compile(request.pop("sip_helper"), "sip_endpoint.py", "exec"), namespace)
        print(json.dumps(recover(request, namespace["remove_owned_container"])))
    except Exception as error:
        print(str(error) if isinstance(error, RecoveryError) else "orphan_phone_cleanup_failed", file=sys.stderr)
        sys.exit(1)
