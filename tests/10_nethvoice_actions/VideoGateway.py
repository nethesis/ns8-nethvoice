#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""HTTP helpers for the video gateway suite (NethServer/dev#7535).

The requests run on the node, inside the module agent environment
(runagent), like UsersAdminAgentCredentials.py: the FreePBX REST API listens
on the loopback APACHE_PORT and the gateway (MediaMTX) listeners are loopback
only, except the ICE ports.
"""

import base64
import json
import shlex

from robot.libraries.BuiltIn import BuiltIn


REMOTE_REQUEST = r'''
import base64
import hashlib
import json
import os
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

import agent


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def admin_secret_key():
    """Headers of the FreePBX REST API: admin user and its secret key,
    sha1(username + password_sha1 + NETHVOICESECRETKEY), see
    rest/lib/AuthMiddleware.php."""
    passwords = agent.read_envfile(os.path.join(os.environ["AGENT_STATE_DIR"], "passwords.env"))
    result = subprocess.run(
        [
            "podman", "exec", "mariadb", "sh", "-c",
            'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot asterisk --batch --skip-column-names -e "$1"',
            "sh", "SELECT password_sha1 FROM ampusers WHERE username = 'admin'",
        ],
        text=True,
        capture_output=True,
        timeout=30,
    )
    require(result.returncode == 0, "cannot read the FreePBX admin user")
    password_sha1 = result.stdout.strip()
    require(password_sha1, "the FreePBX admin user is missing")
    secret = passwords.get("NETHVOICESECRETKEY", "")
    require(secret, "NETHVOICESECRETKEY is missing")
    return hashlib.sha1(("admin" + password_sha1 + secret).encode()).hexdigest()


def http_request(method, url, body, headers):
    context = ssl.create_default_context()
    # traefik on the loopback presents a certificate for the module host
    # names: the address is fixed, the certificate is not what is tested
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({}),
        urllib.request.HTTPSHandler(context=context),
    )
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with opener.open(request, timeout=60) as response:
            status = response.status
            raw = response.read()
    except urllib.error.HTTPError as error:
        status = error.code
        raw = error.read()
    text = raw.decode("utf-8", "replace")
    try:
        decoded = json.loads(text) if text.strip() else None
    except ValueError:
        decoded = text
    return {"ok": True, "status": status, "body": decoded, "text": text}


try:
    mode, method, target = sys.argv[1], sys.argv[2], sys.argv[3]
    payload = base64.b64decode(sys.argv[4]).decode() if len(sys.argv) > 4 and sys.argv[4] else None
    if mode == "rest":
        url = "http://127.0.0.1:" + os.environ["APACHE_PORT"] + "/freepbx/rest/" + urllib.parse.quote(target.lstrip("/"), safe="/")
        headers = {"User": "admin", "Secretkey": admin_secret_key()}
        body = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            body = payload.encode()
        result = http_request(method, url, body, headers)
    elif mode == "gwapi":
        # Control API of the video gateway, as the nethcti-server user
        options = json.loads(payload) if payload else {}
        url = "http://127.0.0.1:" + os.environ["MEDIAMTX_API_PORT"] + target
        headers = {}
        if options.get("auth") in ("secret", "wrong"):
            passwords = agent.read_envfile(os.path.join(os.environ["AGENT_STATE_DIR"], "passwords.env"))
            password = passwords.get("MEDIAMTX_API_PASSWORD", "")
            require(password, "MEDIAMTX_API_PASSWORD is missing")
            if options["auth"] == "wrong":
                password = password + "x"
            credentials = base64.b64encode(("nethcti-server:" + password).encode()).decode()
            headers["Authorization"] = "Basic " + credentials
        result = http_request(method, url, None, headers)
    elif mode == "http":
        options = json.loads(payload) if payload else {}
        headers = options.get("headers", {})
        body = options["body"].encode() if "body" in options else None
        result = http_request(method, target, body, headers)
    else:
        raise RuntimeError("unknown mode")
    print(json.dumps(result))
except Exception as error:
    print(json.dumps({"ok": False, "error": str(error)}))
    sys.exit(1)
'''


def _run_remote(module_id, mode, method, target, payload):
    encoded_request = base64.b64encode(REMOTE_REQUEST.encode()).decode()
    launcher = f'import base64;exec(base64.b64decode("{encoded_request}"))'
    encoded_payload = base64.b64encode(payload.encode()).decode() if payload is not None else ""
    command = shlex.join(
        ["runagent", "-m", module_id, "python3", "-c", launcher, mode, method, target, encoded_payload]
    )
    ssh = BuiltIn().get_library_instance("SSHLibrary")
    stdout, stderr, return_code = ssh.execute_command(
        command,
        return_stdout=True,
        return_stderr=True,
        return_rc=True,
    )
    try:
        result = json.loads(stdout)
    except json.JSONDecodeError as error:
        raise AssertionError("request helper returned invalid output: " + stderr) from error
    if return_code != 0 or not result.get("ok"):
        raise AssertionError(result.get("error", "request helper failed"))
    return result


def freepbx_rest_request(module_id, method, path, body=None):
    """Call the FreePBX REST API (/freepbx/rest/<path>) as the admin user.

    body is a dict/list (sent as JSON) or a JSON string. Return a dict with
    the HTTP "status", the decoded JSON "body" and the raw "text".
    """
    if body is not None and not isinstance(body, str):
        body = json.dumps(body)
    return _run_remote(module_id, "rest", method.upper(), path, body)


def gateway_api_request(module_id, method, path, auth="secret"):
    """Call the control API of the video gateway (MediaMTX) on the node.

    auth is "secret" (the nethcti-server user with MEDIAMTX_API_PASSWORD of
    passwords.env), "wrong" (a wrong password) or "none". Return the same
    dict as Freepbx Rest Request.
    """
    return _run_remote(module_id, "gwapi", method.upper(), path, json.dumps({"auth": auth}))


def node_http_request(module_id, method, url, body=None, headers=None):
    """Send an HTTP(S) request from the node, without credentials.

    TLS certificates are not verified. Return the same dict as
    Freepbx Rest Request.
    """
    options = {"headers": dict(headers or {})}
    if body is not None:
        options["body"] = body
    return _run_remote(module_id, "http", method.upper(), url, json.dumps(options))
