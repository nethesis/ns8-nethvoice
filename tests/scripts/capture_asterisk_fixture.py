#!/usr/bin/env python3

# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later

import argparse
import json
import re
import sys
from pathlib import Path

import paramiko
import yaml


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


def load_manifest_operation(manifest_path, operation_name):
    with open(manifest_path, "r", encoding="utf-8") as manifest_file:
        manifest = yaml.safe_load(manifest_file) or {}

    defaults = manifest.get("defaults", {})
    for raw_operation in manifest.get("operations", []):
        if raw_operation.get("name") != operation_name:
            continue
        operation = dict(defaults)
        operation.update(raw_operation)
        return operation

    raise KeyError(f"Operation {operation_name!r} not found in {manifest_path}")


def filter_content(content, include_lines=None, exclude_lines=None):
    lines = content.splitlines()
    if include_lines:
        include_patterns = [re.compile(pattern) for pattern in include_lines]
        lines = [line for line in lines if any(pattern.search(line) for pattern in include_patterns)]
    if exclude_lines:
        exclude_patterns = [re.compile(pattern) for pattern in exclude_lines]
        lines = [line for line in lines if not any(pattern.search(line) for pattern in exclude_patterns)]
    return "\n".join(lines).rstrip("\n") + "\n"


def fetch_file(remote, module_id, file_path):
    command = f"runagent -m {module_id} podman exec freepbx sh -lc 'cat {file_path}'"
    stdout, stderr, exit_code = remote.run(command)
    if exit_code != 0:
        raise RuntimeError(f"Unable to capture {file_path}: {stderr.strip()}")
    return stdout


def expand_glob(remote, module_id, glob_pattern):
    command = (
        f"runagent -m {module_id} podman exec freepbx sh -lc "
        f"'for path in {glob_pattern}; do [ -e \"$path\" ] && printf \"%s\\n\" \"$path\"; done'"
    )
    stdout, stderr, exit_code = remote.run(command)
    if exit_code != 0:
        raise RuntimeError(f"Unable to expand fixture glob {glob_pattern}: {stderr.strip()}")
    return [line.strip() for line in stdout.splitlines() if line.strip()]


def write_capture(output_dir, source_path, content):
    relative_path = Path(source_path.lstrip("/"))
    target_path = Path(output_dir) / relative_path
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(content, encoding="utf-8")
    return str(relative_path)


def main():
    parser = argparse.ArgumentParser(description="Capture a filtered FreePBX fixture snapshot")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--operation", required=True)
    parser.add_argument("--node-addr", required=True)
    parser.add_argument("--ssh-key", required=True)
    parser.add_argument("--module-id", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    operation = load_manifest_operation(args.manifest, args.operation)
    fixture_profile = operation.get("fixture_profile", {})
    entries = fixture_profile.get("entries", [])
    if not entries:
        raise RuntimeError(f"Operation {args.operation} does not define fixture_profile.entries")

    Path(args.output_dir).mkdir(parents=True, exist_ok=True)

    captured_files = []
    with RemoteClient(args.node_addr, args.ssh_key) as remote:
        for entry in entries:
            matched_paths = []
            if "path" in entry:
                matched_paths = [entry["path"]]
            elif "glob" in entry:
                matched_paths = expand_glob(remote, args.module_id, entry["glob"])
            else:
                raise RuntimeError(f"Fixture entry must define path or glob: {entry}")

            for matched_path in matched_paths:
                raw_content = fetch_file(remote, args.module_id, matched_path)
                filtered_content = filter_content(
                    raw_content,
                    include_lines=entry.get("include_lines"),
                    exclude_lines=entry.get("exclude_lines"),
                )
                relative_path = write_capture(args.output_dir, matched_path, filtered_content)
                captured_files.append(relative_path)

    metadata = {
        "operation": args.operation,
        "files": sorted(captured_files),
        "expected_fixture": operation.get("expected_fixture", ""),
    }
    metadata_path = Path(args.output_dir) / "capture-report.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)