#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import json
import os
import secrets
import subprocess
import sys
import time
from contextlib import contextmanager
from urllib.request import Request, urlopen


JANUS = ("/usr/local/bin/janus", "--configs-folder=/usr/local/etc/janus")
PLUGINS = {
    "audiobridge": (483, 489, {"room": 80231}),
    "textroom": (413, 419, {"room": 80232}),
    "streaming": (453, 457, {
        "id": 80233,
        "type": "rtp",
        "media": [{"type": "audio", "mid": "audio", "port": 0, "pt": 111, "codec": "opus"}],
    }),
    "videoroom": (429, 433, {"room": 80234}),
}


def docker(*args, **kwargs):
    return subprocess.run(
        ["docker", *args], capture_output=True, timeout=30, **kwargs
    )


def docker_output(*args, **kwargs):
    return docker(*args, check=True, **kwargs).stdout


def cannot_contain(content, *values):
    assert all(value.encode() not in content for value in values), "Credential leaked"


def json_request(url, payload=None):
    if payload is not None:
        payload = json.dumps(payload).encode()
    request = Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=2) as response:
        return json.load(response)


def wait_for_janus(container):
    address = docker_output("port", container, "8089/tcp").decode().strip()
    url = f"http://{address}/janus"
    for _ in range(50):
        try:
            info = json_request(f"{url}/info")
        except OSError:
            time.sleep(0.2)
            continue
        assert info["version_string"] == "1.4.4", info["version_string"]
        return url
    raise AssertionError("Janus HTTP API did not start")


@contextmanager
def running_janus(image, key=None, *janus_args):
    environment = dict(os.environ)
    environment.pop("JANUS_ADMIN_SECRET", None)
    key_option = ()
    if key is not None:
        environment["JANUS_ADMIN_SECRET"] = key
        key_option = ("--env", "JANUS_ADMIN_SECRET")
    container = docker_output(
        "run", "--detach", "--log-driver=json-file", "--publish", "127.0.0.1::8089",
        *key_option, image, *JANUS, *janus_args, env=environment,
    ).decode().strip()
    try:
        yield container, wait_for_janus(container)
    finally:
        docker_output("rm", "--force", container)


def api(url, command, **fields):
    response = json_request(url, {"janus": command, "transaction": "verify", **fields})
    assert response["janus"] == "success", f"{command} failed through {url}"
    return response


def attach(session, plugin):
    handle = api(session, "attach", plugin=f"janus.plugin.{plugin}")["data"]["id"]
    return f"{session}/{handle}"


def create(handle, **params):
    return api(handle, "message", body={"request": "create", **params})["plugindata"]["data"]


def verify_protected(image, key, wrong):
    with running_janus(image, key, "--debug-level=4", "--log-file=/tmp/janus.log") as (container, url):
        session = f'{url}/{api(url, "create")["data"]["id"]}'
        for plugin, (missing_code, wrong_code, params) in PLUGINS.items():
            handle = attach(session, plugin)
            assert create(handle, **params).get("error_code") == missing_code, plugin
            assert create(handle, admin_key=wrong, **params).get("error_code") == wrong_code, plugin
            path = f"/usr/local/etc/janus/janus.plugin.{plugin}.jcfg"
            assert docker_output("exec", container, "stat", "-c", "%a", path) == b"600\n", path
            docker_output("exec", container, "rm", path)
            result = create(handle, admin_key=key, permanent=True, **params)
            assert result.get(plugin) == "created", plugin
            assert result.get("permanent") is True, f"{plugin} did not save its configuration"
            assert docker_output("exec", container, "stat", "-c", "%a", path) == b"600\n", path

        attach(session, "sip")

        cannot_contain(docker_output("exec", container, "cat", "/proc/1/cmdline"), key)
        children = docker_output("exec", container, "cat", "/proc/1/task/1/children").decode().split()
        filters = [pid for pid in children
                   if docker_output("exec", container, "cat", f"/proc/{pid}/comm").strip() == b"sed"]
        assert len(filters) == 1, "Expected one sed log filter"
        lookup = docker("exec", container, "grep", "-zq", "^JANUS_ADMIN_SECRET=", f"/proc/{filters[0]}/environ")
        assert lookup.returncode == 1, "Could not confirm the key is absent from the log filter environment"

        docker_output("restart", "--timeout", "2", container)
        url = wait_for_janus(container)
        session = f'{url}/{api(url, "create")["data"]["id"]}'
        handle = attach(session, "audiobridge")
        saved_room = api(handle, "message", body={"request": "exists", "room": 80231})
        assert saved_room["plugindata"]["data"].get("exists") is True
        assert create(handle, room=80235).get("error_code") == 483
        assert create(handle, admin_key=key, room=80235).get("audiobridge") == "created"
        logs = docker("logs", container, check=True)
        for output in (logs.stdout + logs.stderr, docker_output("exec", container, "cat", "/tmp/janus.log")):
            assert b"Debug/log level is 4" in output
            assert b"can expose the plugin admin_key" not in output
            cannot_contain(output, key, wrong)


def verify_standalone(image):
    with running_janus(image, None, "--debug-level=7") as (_, url):
        session = f'{url}/{api(url, "create")["data"]["id"]}'
        for plugin, (_, _, params) in PLUGINS.items():
            assert create(attach(session, plugin), **params).get(plugin) == "created", plugin


def verify_startup_failure(image, key, message, *options, janus_args=()):
    container = f"janus-startup-check-{secrets.token_hex(6)}"
    try:
        result = docker(
            "run", "--name", container, "--env", "JANUS_ADMIN_SECRET", *options, image, *JANUS, *janus_args,
            env=dict(os.environ, JANUS_ADMIN_SECRET=key),
        )
    finally:
        docker("rm", "--force", container)
    log = result.stdout + result.stderr
    if key:
        cannot_contain(log, key)
    assert result.returncode == 1 and message in log, "Expected a safe startup error"


if __name__ == "__main__":
    image = sys.argv[1]
    key, wrong = secrets.token_hex(16), secrets.token_hex(16)
    verify_protected(image, key, wrong)
    print("Protected creation, VideoRoom, SIP attachment, config modes, process arguments, and restart passed")
    verify_standalone(image)
    print("Standalone startup at level 7 without a key passed")
    verify_startup_failure(image, "", b"JANUS_ADMIN_SECRET must be non-empty")
    verify_startup_failure(image, wrong + '"!', b"JANUS_ADMIN_SECRET must be non-empty")
    for level, args in ((5, ("--debug-level=5",)), (6, ("--debug-level", "6")), (7, ("-od", "7"))):
        with running_janus(image, key, *args) as (container, url):
            session = f'{url}/{api(url, "create")["data"]["id"]}'
            assert create(attach(session, "textroom"), room=80235).get("error_code") == 413
            logs = docker("logs", container, check=True)
            output = logs.stdout + logs.stderr
            assert f"WARNING: Janus debug level {level} can expose the plugin admin_key in logs".encode() in output
            assert f"Debug/log level is {level}".encode() in output
    print("Keyed startup warned and served HTTP requests at levels 5–7")
    verify_startup_failure(image, key, b"Janus debug level must be 0 through 7", janus_args=("-d", "8"))
    verify_startup_failure(
        image, key, b"Cannot set admin_key in /usr/local/etc/janus/janus.plugin.audiobridge.jcfg",
        "--read-only",
    )
    print("Invalid keys, an invalid log level, and an unwritable configuration failed startup safely")
