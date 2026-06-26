#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import base64
import csv
import io
import json
import random
import shlex


REQUIRED_RUNTIME_KEYS = (
    "NETHVOICE_HOST",
    "USER_DOMAIN",
    "REDIS_USER",
    "REDIS_PASSWORD",
)


def parse_runtime_environment(environment, agent_env):
    values = {}
    values.update(_parse_env_file(environment))
    values.update(_parse_env_file(agent_env))

    return {
        "nethvoice_host": values.get("NETHVOICE_HOST", ""),
        "user_domain": values.get("USER_DOMAIN", ""),
        "redis_user": values.get("REDIS_USER", ""),
        "redis_password": values.get("REDIS_PASSWORD", ""),
        "missing": [
            variable for variable in REQUIRED_RUNTIME_KEYS if not values.get(variable)
        ],
    }


def build_users_admin_api_command(host, domain, endpoint, payload, token=""):
    command = [
        "curl",
        "-sk",
        "--resolve",
        f"{host}:443:127.0.0.1",
        f"https://{host}/users-admin/{domain}/api/{endpoint}",
        "-H",
        "Content-Type: application/json",
    ]
    if token:
        command.extend(["-H", f"Authorization: Bearer {token}"])
    command.extend(["--data", payload])
    return _quote_command(command)


def build_users_admin_login_payload(username, password):
    return json.dumps(
        {
            "username": username,
            "password": password,
            "auth_backend": "api-server",
        }
    )


def build_remove_user_payload(username):
    return json.dumps({"user": username})


def build_freepbx_csv_import_payload(username, display_name):
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow([username, display_name, "", "", "", "", "", "", ""])
    return base64.b64encode(output.getvalue().encode()).decode()


def build_freepbx_csv_import_command(module_id, csv_payload):
    inner_command = _quote_command(
        [
            "podman",
            "exec",
            "freepbx",
            "php",
            "/var/www/html/freepbx/rest/lib/csvimport.php",
            csv_payload,
        ]
    )
    return _quote_command(["su", "-", module_id, "-c", inner_command])


def load_json(document):
    return json.loads(document)


def generate_test_username(prefix="credtest"):
    return f"{prefix}{random.randint(0, 999999):06d}"


def users_contains_user(users, username):
    if isinstance(users, dict):
        users = users.values()
    return any(user.get("user") == username for user in users)


def _parse_env_file(content):
    values = {}
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = _split_env_line(line)
        values[key] = value
    return values


def _split_env_line(line):
    try:
        parts = shlex.split(line, comments=False, posix=True)
        if len(parts) == 1 and "=" in parts[0]:
            return parts[0].split("=", 1)
    except ValueError:
        pass

    key, value = line.split("=", 1)
    return key, value.strip().strip("\"'")


def _quote_command(command):
    return " ".join(shlex.quote(part) for part in command)
