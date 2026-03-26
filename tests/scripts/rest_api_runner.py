#!/usr/bin/env python3

# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later

import argparse
import hashlib
import json
import sys
from pathlib import Path

import paramiko
import requests
import urllib3
import yaml

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class RemoteClient:
    def __init__(self, host, key_path, user="root"):
        self.host = host
        self.key_path = key_path
        self.user = user
        self.client = None

    def __enter__(self):
        key = load_private_key(self.key_path)
        self.client = paramiko.SSHClient()
        self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self.client.connect(self.host, username=self.user, pkey=key, timeout=30)
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if self.client is not None:
            self.client.close()

    def run(self, command):
        stdin, stdout, stderr = self.client.exec_command(command, timeout=60)
        exit_code = stdout.channel.recv_exit_status()
        return stdout.read().decode("utf-8"), stderr.read().decode("utf-8"), exit_code


def load_private_key(key_path):
    key_loaders = (
        paramiko.RSAKey,
        paramiko.ECDSAKey,
        paramiko.Ed25519Key,
        paramiko.DSSKey,
    )

    last_error = None
    for key_loader in key_loaders:
        try:
            return key_loader.from_private_key_file(key_path)
        except Exception as error:
            last_error = error

    raise RuntimeError(f"Unable to load SSH private key {key_path}: {last_error}")


def load_manifest(manifest_path):
    with open(manifest_path, "r", encoding="utf-8") as manifest_file:
        return yaml.safe_load(manifest_file) or {}


def resolve_operation(manifest_path, operation_name):
    manifest = load_manifest(manifest_path)
    defaults = manifest.get("defaults", {})
    for raw_operation in manifest.get("operations", []):
        if raw_operation.get("name") != operation_name:
            continue
        operation = dict(defaults)
        operation.update(raw_operation)

        auth = dict(defaults.get("auth", {}))
        auth.update(raw_operation.get("auth", {}))
        operation["auth"] = auth

        return operation
    raise KeyError(f"Operation {operation_name!r} not found in {manifest_path}")


def fetch_secret(node_addr, ssh_key, module_id):
    command = f"runagent -m {module_id} grep '^NETHVOICESECRETKEY=' passwords.env | cut -d '=' -f2-"
    with RemoteClient(node_addr, ssh_key) as remote:
        stdout, stderr, exit_code = remote.run(command)
    if exit_code != 0:
        raise RuntimeError(f"Unable to read NETHVOICESECRETKEY: {stderr.strip()}")

    secret = stdout.strip()
    if not secret:
        raise RuntimeError("NETHVOICESECRETKEY is empty")
    return secret


def compute_headers(user, password, secret):
    password_sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest()
    secretkey = hashlib.sha1(f"{user}{password_sha1}{secret}".encode("utf-8")).hexdigest()
    return {"User": user, "Secretkey": secretkey}


def ensure_parent_dir(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)


def parse_json_body(payload_json):
    if payload_json in (None, ""):
        return None
    return json.loads(payload_json)


def execute_call(base_url, method, path, expected_status, headers, payload=None, report_file=None):
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    request_kwargs = {
        "headers": {"Accept": "application/json", **headers},
        "timeout": 30,
        "verify": False,
    }
    if payload is not None:
        request_kwargs["json"] = payload

    response = requests.request(method.upper(), url, **request_kwargs)
    content_type = response.headers.get("Content-Type", "")
    response_json = None
    response_text = response.text
    if "application/json" in content_type:
        try:
            response_json = response.json()
        except ValueError:
            response_json = None

    report = {
        "request": {
            "method": method.upper(),
            "url": url,
            "payload": payload,
            "headers": {"User": headers.get("User", "")},
        },
        "response": {
            "status": response.status_code,
            "reason": response.reason,
            "headers": dict(response.headers),
            "json": response_json,
            "text": response_text,
        },
        "expected_status": expected_status,
    }

    if report_file:
        ensure_parent_dir(report_file)
        with open(report_file, "w", encoding="utf-8") as output_file:
            json.dump(report, output_file, indent=2, sort_keys=True)
            output_file.write("\n")

    if response.status_code != expected_status:
        raise RuntimeError(
            f"Expected HTTP {expected_status} for {method.upper()} {path}, got {response.status_code}: {response_text}"
        )

    return report


def command_operation(args):
    operation = resolve_operation(args.manifest, args.operation)
    print(json.dumps(operation, indent=2, sort_keys=True))


def command_headers(args):
    secret = fetch_secret(args.node_addr, args.ssh_key, args.module_id)
    headers = compute_headers(args.auth_user, args.auth_password, secret)

    if args.output_dir:
        Path(args.output_dir).mkdir(parents=True, exist_ok=True)
        report_path = Path(args.output_dir) / "auth-headers.json"
        with open(report_path, "w", encoding="utf-8") as output_file:
            json.dump(headers, output_file, indent=2, sort_keys=True)
            output_file.write("\n")

    print(json.dumps(headers, indent=2, sort_keys=True))


def command_call(args):
    headers = json.loads(args.headers_json)
    payload = parse_json_body(args.payload_json)
    report = execute_call(
        base_url=args.base_url,
        method=args.method,
        path=args.path,
        expected_status=args.expected_status,
        headers=headers,
        payload=payload,
        report_file=args.report_file,
    )
    print(json.dumps(report, indent=2, sort_keys=True))


def build_parser():
    parser = argparse.ArgumentParser(description="REST API helper for Robot smoke tests")
    subparsers = parser.add_subparsers(dest="command", required=True)

    operation_parser = subparsers.add_parser("operation", help="Print one merged manifest operation")
    operation_parser.add_argument("--manifest", required=True)
    operation_parser.add_argument("--operation", required=True)
    operation_parser.set_defaults(func=command_operation)

    headers_parser = subparsers.add_parser("headers", help="Compute REST auth headers")
    headers_parser.add_argument("--node-addr", required=True)
    headers_parser.add_argument("--ssh-key", required=True)
    headers_parser.add_argument("--module-id", required=True)
    headers_parser.add_argument("--auth-user", required=True)
    headers_parser.add_argument("--auth-password", required=True)
    headers_parser.add_argument("--output-dir")
    headers_parser.set_defaults(func=command_headers)

    call_parser = subparsers.add_parser("call", help="Execute one REST API call")
    call_parser.add_argument("--base-url", required=True)
    call_parser.add_argument("--method", required=True)
    call_parser.add_argument("--path", required=True)
    call_parser.add_argument("--expected-status", type=int, required=True)
    call_parser.add_argument("--headers-json", required=True)
    call_parser.add_argument("--payload-json")
    call_parser.add_argument("--report-file")
    call_parser.set_defaults(func=command_call)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    try:
        args.func(args)
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()