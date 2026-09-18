#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import base64
import json
import shlex

from robot.libraries.BuiltIn import BuiltIn


REMOTE_CHECK = r'''
import base64
import csv
import io
import json
import os
import secrets
import subprocess
import sys
import urllib.error
import urllib.request

import agent


def read_env_file(path):
    values = {}
    with open(path, encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.rstrip("\n")
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key] = value
    return values


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


state_dir = os.environ["AGENT_STATE_DIR"]
install_dir = os.environ["AGENT_INSTALL_DIR"]
module_id = os.environ["MODULE_ID"]
environment_path = os.path.join(state_dir, "environment")
agent_env_path = os.path.join(state_dir, "agent.env")
environment = read_env_file(environment_path)
agent_env = read_env_file(agent_env_path)
provider_url = environment.get("NETHVOICE_USER_PORTAL_URL", "").rstrip("/")
provider_node = environment.get("NETHVOICE_USER_PORTAL_NODE", "")
username = agent_env.get("REDIS_USER", "")
password = agent_env.get("REDIS_PASSWORD", "")
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def api_request(endpoint, payload, token=""):
    require(provider_url, "users-admin provider is unavailable")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(
        provider_url + "/api/" + endpoint,
        data=json.dumps(payload).encode(),
        headers=headers,
        method="POST",
    )
    try:
        with opener.open(request, timeout=15) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        raise RuntimeError(endpoint + " returned HTTP " + str(error.code)) from None
    except urllib.error.URLError:
        raise RuntimeError(endpoint + " request failed") from None


def login():
    response = api_request(
        "login",
        {
            "username": username,
            "password": password,
            "auth_backend": "api-server",
        },
    )
    token = response.get("token", "")
    require(token, "users-admin login failed")
    return token


def list_users(token):
    response = api_request("list-users", {}, token)
    users = response.get("users")
    require(isinstance(users, (dict, list)), "users-admin list failed")
    return users.values() if isinstance(users, dict) else users


def user_exists(token, target_user):
    return any(item.get("user") == target_user for item in list_users(token))


def add_user(token, target_user, display_name):
    response = api_request(
        "add-user",
        {
            "user": target_user,
            "display_name": display_name,
            "password": "Nethesis,1234",
            "locked": False,
            "groups": [],
        },
        token,
    )
    require(response.get("status") == "success", "users-admin add failed")


def remove_user(token, target_user, required=True):
    if not user_exists(token, target_user):
        return
    response = api_request("remove-user", {"user": target_user}, token)
    if required:
        require(response.get("status") == "success", "users-admin remove failed")


def container_env(variable):
    result = subprocess.run(
        ["podman", "exec", "freepbx", "printenv", variable],
        text=True,
        capture_output=True,
        timeout=15,
    )
    require(result.returncode == 0, "cannot inspect FreePBX environment")
    return result.stdout.rstrip("\n")


def check_contract():
    require("REDIS_USER" in agent_env, "REDIS_USER is missing from agent.env")
    require("REDIS_PASSWORD" in agent_env, "REDIS_PASSWORD is missing from agent.env")
    require("REDIS_USER" not in environment, "REDIS_USER leaked to environment")
    require("REDIS_PASSWORD" not in environment, "REDIS_PASSWORD leaked to environment")
    require("NETHVOICE_USER_PORTAL_URL" in environment, "provider URL is missing")
    require("NETHVOICE_USER_PORTAL_NODE" in environment, "provider node is missing")
    require("NETHVOICE_USER_PORTAL_URL" not in agent_env, "provider URL leaked to agent.env")
    require("NETHVOICE_USER_PORTAL_NODE" not in agent_env, "provider node leaked to agent.env")

    providers = agent.list_service_providers(
        agent.redis_connect(use_replica=True),
        "users-admin",
        "http",
        {"domain": environment["USER_DOMAIN"]},
    )
    require(providers, "users-admin provider list is empty")
    require(provider_url == providers[0]["url"], "provider URL is not the first result")
    require(provider_node == str(providers[0]["node"]), "provider node is not the first result")

    require(container_env("REDIS_USER") == username, "FreePBX REDIS_USER differs")
    require(container_env("REDIS_PASSWORD") == password, "FreePBX REDIS_PASSWORD differs")
    require(
        container_env("NETHVOICE_USER_PORTAL_URL") == provider_url,
        "FreePBX provider URL differs",
    )
    require(
        container_env("NETHVOICE_USER_PORTAL_NODE") == provider_node,
        "FreePBX provider node differs",
    )

    input_schema_path = os.path.join(
        install_dir, "actions", "configure-module", "validate-input.json"
    )
    output_schema_path = os.path.join(
        install_dir, "actions", "get-configuration", "validate-output.json"
    )
    with open(input_schema_path, encoding="utf-8") as schema_file:
        input_properties = json.load(schema_file).get("properties", {})
    with open(output_schema_path, encoding="utf-8") as schema_file:
        output_properties = json.load(schema_file).get("properties", {})
    legacy_fields = {"nethvoice_adm_username", "nethvoice_adm_password"}
    require(legacy_fields.isdisjoint(input_properties), "legacy input fields remain")
    require(legacy_fields.isdisjoint(output_properties), "legacy output fields remain")

    return {
        "ok": True,
        "provider_is_first_result": True,
        "credentials_are_agent_managed": True,
        "container_environment_matches": True,
        "legacy_fields_absent": True,
    }


def check_api_flow():
    token = login()
    direct_user = "direct" + secrets.token_hex(4)
    csv_user = "csv" + secrets.token_hex(4)
    direct_removed = False
    csv_removed = False
    try:
        list_users(token)
        add_user(token, direct_user, "Direct credential test")
        require(user_exists(token, direct_user), "directly added user is missing")
        remove_user(token, direct_user)
        direct_removed = not user_exists(token, direct_user)
        require(direct_removed, "directly removed user remains")

        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow([csv_user, "FreePBX credential test", "", "", "", "", "", "", ""])
        csv_payload = base64.b64encode(output.getvalue().encode()).decode()
        result = subprocess.run(
            [
                "podman",
                "exec",
                "freepbx",
                "php",
                "/var/www/html/freepbx/rest/lib/csvimport.php",
                csv_payload,
            ],
            text=True,
            capture_output=True,
            timeout=120,
        )
        require(result.returncode == 0, "FreePBX CSV import failed")
        require(user_exists(token, csv_user), "FreePBX-created user is missing")
        remove_user(token, csv_user)
        csv_removed = not user_exists(token, csv_user)
        require(csv_removed, "FreePBX-created user was not removed")
    finally:
        remove_user(token, direct_user, required=False)
        remove_user(token, csv_user, required=False)

    return {
        "ok": True,
        "login": True,
        "list": True,
        "direct_add_remove": direct_removed,
        "freepbx_add_remove": csv_removed,
    }


def check_upgrade_cleanup():
    token = login()
    legacy_user = module_id + "-adm"
    remove_user(token, legacy_user, required=False)
    before_agent_env = open(agent_env_path, "rb").read()
    removed = False
    try:
        add_user(token, legacy_user, "Legacy NethVoice administrator")
        require(user_exists(token, legacy_user), "legacy test user was not created")
        cleanup_script = os.path.join(
            install_dir, "update-module.d", "15cleanup_legacy_user"
        )
        result = subprocess.run(
            [cleanup_script],
            text=True,
            capture_output=True,
            timeout=30,
        )
        require(result.returncode == 0, "upgrade cleanup failed")
        removed = not user_exists(token, legacy_user)
        require(removed, "upgrade cleanup did not remove the legacy user")
        require(
            open(agent_env_path, "rb").read() == before_agent_env,
            "upgrade cleanup modified agent.env",
        )
    finally:
        remove_user(token, legacy_user, required=False)

    return {
        "ok": True,
        "legacy_user_removed": removed,
        "agent_credentials_unchanged": True,
    }


try:
    operation = sys.argv[1]
    if operation == "contract":
        result = check_contract()
    elif operation == "api-flow":
        result = check_api_flow()
    elif operation == "upgrade-cleanup":
        result = check_upgrade_cleanup()
    else:
        raise RuntimeError("unknown check")
    print(json.dumps(result))
except Exception as error:
    print(json.dumps({"ok": False, "error": str(error)}))
    sys.exit(1)
'''


def run_users_admin_check(module_id, operation):
    encoded_check = base64.b64encode(REMOTE_CHECK.encode()).decode()
    launcher = f'import base64;exec(base64.b64decode("{encoded_check}"))'
    command = shlex.join(
        ["runagent", "-m", module_id, "python3", "-c", launcher, operation]
    )
    ssh = BuiltIn().get_library_instance("SSHLibrary")
    stdout, _stderr, return_code = ssh.execute_command(
        command,
        return_stdout=True,
        return_stderr=True,
        return_rc=True,
    )

    try:
        result = json.loads(stdout)
    except json.JSONDecodeError as error:
        raise AssertionError("users-admin check returned invalid output") from error

    if return_code != 0 or not result.get("ok"):
        raise AssertionError(result.get("error", "users-admin check failed"))
    return result
