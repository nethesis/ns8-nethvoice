#!/usr/bin/env python3

# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later

import argparse
import copy
import difflib
import hashlib
import json
import random
import re
import shlex
import shutil
import string
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import paramiko
import requests
import urllib3
import yaml

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

REPO_ROOT = Path(__file__).resolve().parents[2]
PLACEHOLDER_RE = re.compile(r"\$\{([^}]+)\}")


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


def deep_merge(base, override):
    result = copy.deepcopy(base)
    for key, value in (override or {}).items():
        if isinstance(result.get(key), dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def merge_operation(defaults, raw_operation):
    return deep_merge(defaults, raw_operation)


def resolve_operation(manifest_path, operation_name):
    manifest = load_manifest(manifest_path)
    defaults = manifest.get("defaults", {})
    for raw_operation in manifest.get("operations", []):
        if raw_operation.get("name") == operation_name:
            return merge_operation(defaults, raw_operation)
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


def run_remote_command(node_addr, ssh_key, command):
    with RemoteClient(node_addr, ssh_key) as remote:
        stdout, stderr, exit_code = remote.run(command)
    if exit_code != 0:
        raise RuntimeError(f"Remote command failed: {command}\n{stderr.strip()}")
    return stdout


def run_remote_freepbx_php(node_addr, ssh_key, module_id, script):
    command = (
        f"runagent -m {module_id} podman exec freepbx php -r {shlex.quote(script)}"
    )
    return run_remote_command(node_addr, ssh_key, command)


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


def deep_get(data, dotted_path):
    if dotted_path in ("", "$", None):
        return data

    current = data
    for segment in dotted_path.split("."):
        if segment in ("", "$"):
            continue
        if isinstance(current, list):
            if not segment.isdigit():
                raise KeyError(f"Path segment {segment!r} is not a list index")
            current = current[int(segment)]
            continue
        if not isinstance(current, dict) or segment not in current:
            raise KeyError(f"Path {dotted_path!r} not found at segment {segment!r}")
        current = current[segment]
    return current


def has_value(data, dotted_path):
    try:
        deep_get(data, dotted_path)
        return True
    except Exception:
        return False


def render_template(value, context):
    if isinstance(value, dict):
        return {key: render_template(item, context) for key, item in value.items()}
    if isinstance(value, list):
        return [render_template(item, context) for item in value]
    if not isinstance(value, str):
        return value

    full_match = PLACEHOLDER_RE.fullmatch(value)
    if full_match:
        return copy.deepcopy(deep_get(context, full_match.group(1)))

    def replace(match):
        resolved = deep_get(context, match.group(1))
        if isinstance(resolved, (dict, list)):
            return json.dumps(resolved, sort_keys=True)
        return str(resolved)

    return PLACEHOLDER_RE.sub(replace, value)


def stable_suffix():
    alphabet = string.ascii_lowercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(6))


def build_runtime_context():
    now = datetime.now(timezone.utc)
    suffix = stable_suffix()
    digits = "".join(character for character in suffix if character.isdigit())
    if len(digits) < 4:
        digits = (digits + "7315")[:4]
    extension = f"7{digits[-3:]}"
    return {
        "run_id": now.strftime("%Y%m%dT%H%M%SZ"),
        "suffix": suffix,
        "username": f"restapi{suffix}",
        "fullname": f"REST API {suffix}",
        "user_password": f"Rest-{suffix}-Pwd1",
        "mainextension": extension,
        "cti_group_name": f"REST Group {suffix}",
    }


def execute_call(base_url, method, path, expected_status, headers, payload=None, report_file=None):
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    request_headers = {"Accept": "application/json", **headers}
    request_kwargs = {
        "headers": request_headers,
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

    request_report_headers = {}
    for header_name in ("User", "Host", "Accept"):
        if header_name in request_headers:
            request_report_headers[header_name] = request_headers[header_name]

    report = {
        "request": {
            "method": method.upper(),
            "url": url,
            "payload": payload,
            "headers": request_report_headers,
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


def normalize_text(content):
    lines = content.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    stripped_lines = [line.rstrip() for line in lines]
    normalized = "\n".join(stripped_lines).strip("\n")
    if normalized:
        return normalized + "\n"
    return ""


def filter_content(content, include_lines=None, exclude_lines=None):
    lines = content.splitlines()
    if include_lines:
        include_patterns = [re.compile(pattern) for pattern in include_lines]
        lines = [line for line in lines if any(pattern.search(line) for pattern in include_patterns)]
    if exclude_lines:
        exclude_patterns = [re.compile(pattern) for pattern in exclude_lines]
        lines = [line for line in lines if not any(pattern.search(line) for pattern in exclude_patterns)]
    return "\n".join(lines).rstrip("\n") + "\n"


def fetch_remote_file(remote, module_id, file_path):
    command = f"runagent -m {module_id} podman exec freepbx sh -lc 'cat {file_path}'"
    stdout, stderr, exit_code = remote.run(command)
    if exit_code != 0:
        raise RuntimeError(f"Unable to capture {file_path}: {stderr.strip()}")
    return stdout


def expand_remote_glob(remote, module_id, glob_pattern):
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


def normalize_fixture_tree(input_dir, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    written_files = []
    for source_path in sorted(path for path in input_dir.rglob("*") if path.is_file()):
        if source_path.name == "capture-report.json":
            continue
        relative_path = source_path.relative_to(input_dir)
        target_path = output_dir / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        normalized_content = normalize_text(source_path.read_text(encoding="utf-8"))
        target_path.write_text(normalized_content, encoding="utf-8")
        written_files.append(str(relative_path))
    return written_files


def compare_fixture_trees(expected_dir, actual_dir, diff_path):
    expected_files = {path.relative_to(expected_dir) for path in expected_dir.rglob("*") if path.is_file()}
    actual_files = {path.relative_to(actual_dir) for path in actual_dir.rglob("*") if path.is_file()}
    all_files = sorted(expected_files | actual_files)
    diff_chunks = []
    for relative_path in all_files:
        expected_path = expected_dir / relative_path
        actual_path = actual_dir / relative_path
        expected_lines = expected_path.read_text(encoding="utf-8").splitlines(keepends=True) if expected_path.exists() else []
        actual_lines = actual_path.read_text(encoding="utf-8").splitlines(keepends=True) if actual_path.exists() else []
        if expected_lines == actual_lines:
            continue
        diff_chunks.extend(
            difflib.unified_diff(
                expected_lines,
                actual_lines,
                fromfile=str(expected_path),
                tofile=str(actual_path),
            )
        )
    diff_text = "".join(diff_chunks)
    diff_path.write_text(diff_text, encoding="utf-8")
    return diff_text


def match_subset(actual, expected):
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return False
        return all(key in actual and match_subset(actual[key], value) for key, value in expected.items())
    if isinstance(expected, list):
        if not isinstance(actual, list):
            return False
        remaining = list(actual)
        for expected_item in expected:
            match_index = None
            for index, actual_item in enumerate(remaining):
                if match_subset(actual_item, expected_item):
                    match_index = index
                    break
            if match_index is None:
                return False
            remaining.pop(match_index)
        return True
    if isinstance(actual, (int, float, str)) and isinstance(expected, (int, float, str)):
        return str(actual) == str(expected)
    return actual == expected


class ManifestExecutor:
    def __init__(
        self,
        manifest_path,
        node_addr,
        ssh_key,
        module_id,
        base_url,
        output_dir=None,
        host_header=None,
        auth_user=None,
        auth_password=None,
    ):
        self.manifest_path = Path(manifest_path)
        self.manifest = load_manifest(self.manifest_path)
        self.defaults = self.manifest.get("defaults", {})
        self.node_addr = node_addr
        self.ssh_key = ssh_key
        self.module_id = module_id
        self.base_url = base_url.rstrip("/")
        self.output_dir = Path(output_dir) if output_dir else None
        self.host_header = host_header
        self.auth_user = auth_user or self.defaults.get("auth", {}).get("user")
        self.auth_password = auth_password or self.defaults.get("auth", {}).get("password")
        self.context = {
            "runtime": build_runtime_context(),
            "seed": {},
            "vars": {},
            "manifest": {"path": str(self.manifest_path)},
        }
        self.secret = None
        self.auth_headers = None
        self.seed_reports = []
        self.operation_reports = []
        self.cleanup_reports = []
        self.executed_seeds = {}

    def prepare_output_dir(self):
        if self.output_dir is not None:
            self.output_dir.mkdir(parents=True, exist_ok=True)

    def run_remote_api(self, action, data=None, decode_json=True):
        payload = json.dumps(data or {}, separators=(",", ":"))
        command = f"api-cli run {shlex.quote(action)} --data {shlex.quote(payload)}"
        stdout = run_remote_command(self.node_addr, self.ssh_key, command)
        stdout = stdout.strip()
        if decode_json:
            if not stdout:
                return None
            return json.loads(stdout)
        return stdout

    def run_freepbx_php(self, script, decode_json=False):
        stdout = run_remote_freepbx_php(self.node_addr, self.ssh_key, self.module_id, script).strip()
        if decode_json:
            if not stdout:
                return None
            return json.loads(stdout)
        return stdout

    def get_auth_headers(self, include_auth=True):
        headers = {}
        if include_auth:
            if not self.auth_user or not self.auth_password:
                raise RuntimeError("Manifest auth.user/auth.password are required for authenticated execution")
            if self.secret is None:
                self.secret = fetch_secret(self.node_addr, self.ssh_key, self.module_id)
            if self.auth_headers is None:
                self.auth_headers = compute_headers(self.auth_user, self.auth_password, self.secret)
            headers.update(self.auth_headers)
        if self.host_header:
            headers["Host"] = self.host_header
        return headers

    def build_report_path(self, group_name, step_name):
        if self.output_dir is None:
            return None
        return self.output_dir / "steps" / slugify(group_name) / f"{slugify(step_name)}.json"

    def call_api(self, group_name, step_name, method, path, expected_status, payload=None, include_auth=True):
        report_path = self.build_report_path(group_name, step_name)
        return execute_call(
            base_url=self.base_url,
            method=method,
            path=path,
            expected_status=expected_status,
            headers=self.get_auth_headers(include_auth=include_auth),
            payload=payload,
            report_file=str(report_path) if report_path else None,
        )

    def wait_for(self, predicate, timeout_seconds, interval_seconds, description):
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            if predicate():
                return
            time.sleep(interval_seconds)
        raise RuntimeError(f"Timed out after {timeout_seconds}s while waiting for {description}")

    def execute_seed(self, seed_definition):
        seed_name = seed_definition["name"]
        if seed_name in self.executed_seeds:
            return self.executed_seeds[seed_name]
        helper_name = seed_definition.get("helper")
        helper = SEED_HELPERS.get(helper_name)
        if helper is None:
            raise RuntimeError(f"Unknown seed helper {helper_name!r}")
        params = render_template(seed_definition.get("params", {}), self.context)
        started_at = time.time()
        result = helper(self, params, seed_name) or {}
        duration = round(time.time() - started_at, 3)
        self.context["seed"][seed_name] = result
        self.executed_seeds[seed_name] = result
        self.seed_reports.append(
            {
                "name": seed_name,
                "helper": helper_name,
                "params": params,
                "result": result,
                "duration_seconds": duration,
            }
        )
        return result

    def ensure_required_seeds(self, names):
        available = {seed["name"]: seed for seed in self.manifest.get("seeds", [])}
        for name in names or []:
            if name not in available:
                raise RuntimeError(f"Seed {name!r} is required but not defined")
            self.execute_seed(available[name])

    def apply_assertions(self, operation, api_report):
        assertions = operation.get("assertions", {})
        response_json = api_report["response"]["json"]
        response_text = api_report["response"]["text"]

        if "json_equals" in assertions:
            expected = render_template(assertions["json_equals"], self.context)
            if response_json != expected:
                raise RuntimeError(f"JSON equality assertion failed: expected {expected!r}, got {response_json!r}")

        if "json_type" in assertions:
            expected_type = render_template(assertions["json_type"], self.context)
            type_map = {
                "array": list,
                "list": list,
                "object": dict,
                "dict": dict,
                "string": str,
                "integer": int,
                "number": (int, float),
                "boolean": bool,
                "null": type(None),
            }
            if not isinstance(response_json, type_map[expected_type]):
                raise RuntimeError(
                    f"JSON type assertion failed: expected {expected_type}, got {type(response_json).__name__}"
                )

        for assertion in assertions.get("json_path_equals", []):
            rendered = render_template(assertion, self.context)
            actual = deep_get(response_json, rendered["path"])
            if actual != rendered["value"]:
                raise RuntimeError(
                    f"JSON path assertion failed for {rendered['path']}: expected {rendered['value']!r}, got {actual!r}"
                )

        for assertion in assertions.get("json_path_exists", []):
            rendered = render_template(assertion, self.context) if isinstance(assertion, dict) else {"path": render_template(assertion, self.context)}
            if not has_value(response_json, rendered["path"]):
                raise RuntimeError(f"JSON path assertion failed: {rendered['path']} does not exist")

        for assertion in assertions.get("json_greater_or_equal", []):
            rendered = render_template(assertion, self.context)
            actual = deep_get(response_json, rendered["path"])
            if actual < rendered["value"]:
                raise RuntimeError(
                    f"JSON comparison assertion failed for {rendered['path']}: expected >= {rendered['value']!r}, got {actual!r}"
                )

        if "list_contains" in assertions:
            rendered = render_template(assertions["list_contains"], self.context)
            data = response_json if "path" not in rendered else deep_get(response_json, rendered["path"])
            if not isinstance(data, list):
                raise RuntimeError("list_contains assertion requires a JSON array")
            if not any(match_subset(item, rendered["item"]) for item in data):
                raise RuntimeError(f"list_contains assertion failed: item {rendered['item']!r} not found")

        if "list_not_contains" in assertions:
            rendered = render_template(assertions["list_not_contains"], self.context)
            data = response_json if "path" not in rendered else deep_get(response_json, rendered["path"])
            if not isinstance(data, list):
                raise RuntimeError("list_not_contains assertion requires a JSON array")
            if any(match_subset(item, rendered["item"]) for item in data):
                raise RuntimeError(f"list_not_contains assertion failed: item {rendered['item']!r} unexpectedly found")

        for text_value in assertions.get("text_contains", []):
            rendered = render_template(text_value, self.context)
            if rendered not in response_text:
                raise RuntimeError(f"text_contains assertion failed: {rendered!r} not found in response body")

    def apply_exports(self, operation, api_report):
        exported = {}
        export_context = {"response": api_report["response"], "request": api_report["request"]}
        for export_definition in operation.get("exports", []):
            value = deep_get(export_context, export_definition["from"])
            self.context["vars"][export_definition["name"]] = value
            exported[export_definition["name"]] = value
        return exported

    def maybe_compare_fixture(self, operation, operation_name):
        if operation.get("classification") != "mutating-with-fixture":
            return None
        fixture_profile = operation.get("fixture_profile", {})
        expected_fixture = operation.get("expected_fixture")
        if not fixture_profile or not expected_fixture:
            raise RuntimeError(f"Operation {operation_name} is mutating-with-fixture but fixture data is incomplete")
        if self.output_dir is None:
            raise RuntimeError("Fixture comparisons require --output-dir")

        capture_dir = self.output_dir / "fixtures" / slugify(operation_name) / "captured"
        expected_dir = REPO_ROOT / expected_fixture
        if not expected_dir.exists():
            raise RuntimeError(f"Expected fixture directory {expected_dir} does not exist")

        capture_dir.mkdir(parents=True, exist_ok=True)
        captured_files = []
        entries = fixture_profile.get("entries", [])
        with RemoteClient(self.node_addr, self.ssh_key) as remote:
            for entry in entries:
                if "path" in entry:
                    matched_paths = [entry["path"]]
                elif "glob" in entry:
                    matched_paths = expand_remote_glob(remote, self.module_id, entry["glob"])
                else:
                    raise RuntimeError(f"Fixture entry must define path or glob: {entry}")
                for matched_path in matched_paths:
                    raw_content = fetch_remote_file(remote, self.module_id, matched_path)
                    filtered_content = filter_content(
                        raw_content,
                        include_lines=entry.get("include_lines"),
                        exclude_lines=entry.get("exclude_lines"),
                    )
                    captured_files.append(write_capture(capture_dir, matched_path, filtered_content))

        normalized_expected = self.output_dir / "fixtures" / slugify(operation_name) / "expected-normalized"
        normalized_actual = self.output_dir / "fixtures" / slugify(operation_name) / "actual-normalized"
        shutil.rmtree(normalized_expected, ignore_errors=True)
        shutil.rmtree(normalized_actual, ignore_errors=True)
        normalize_fixture_tree(expected_dir, normalized_expected)
        normalize_fixture_tree(capture_dir, normalized_actual)
        diff_path = self.output_dir / "fixtures" / slugify(operation_name) / "fixture.diff"
        diff_text = compare_fixture_trees(normalized_expected, normalized_actual, diff_path)
        if diff_text:
            raise RuntimeError(f"Fixture mismatch for {operation_name}. Diff written to {diff_path}")
        return {
            "captured_files": sorted(captured_files),
            "expected_fixture": str(expected_dir.relative_to(REPO_ROOT)),
            "diff_path": str(diff_path.relative_to(self.output_dir)),
        }

    def execute_operation(self, operation):
        operation_name = operation["name"]
        self.ensure_required_seeds(operation.get("requires", []))
        rendered_path = render_template(operation["path"], self.context)
        rendered_payload = render_template(operation.get("payload"), self.context)
        expected_status = int(operation.get("expected_status", self.defaults.get("expected_status", 200)))
        started_at = time.time()
        api_report = self.call_api(
            group_name="operations",
            step_name=operation_name,
            method=operation["method"],
            path=rendered_path,
            expected_status=expected_status,
            payload=rendered_payload,
            include_auth=operation.get("include_auth", True),
        )
        wait_seconds = int(operation.get("post_wait_seconds", self.defaults.get("post_wait_seconds", 0)))
        if wait_seconds > 0:
            time.sleep(wait_seconds)
        self.apply_assertions(operation, api_report)
        exported = self.apply_exports(operation, api_report)
        fixture_report = self.maybe_compare_fixture(operation, operation_name)
        self.operation_reports.append(
            {
                "name": operation_name,
                "classification": operation.get("classification", "unspecified"),
                "tags": operation.get("tags", []),
                "request": api_report["request"],
                "response": api_report["response"],
                "expected_status": expected_status,
                "post_wait_seconds": wait_seconds,
                "exports": exported,
                "fixture": fixture_report,
                "duration_seconds": round(time.time() - started_at, 3),
            }
        )

    def should_run_cleanup(self, cleanup_step):
        for expression in cleanup_step.get("when_defined", []):
            if not has_value(self.context, expression):
                return False
        return True

    def execute_cleanup_step(self, cleanup_step):
        report = {"name": cleanup_step["name"], "status": "skipped"}
        if not self.should_run_cleanup(cleanup_step):
            report["reason"] = "required context value not defined"
            self.cleanup_reports.append(report)
            return
        helper_name = cleanup_step.get("helper")
        helper = CLEANUP_HELPERS.get(helper_name)
        if helper is None:
            raise RuntimeError(f"Unknown cleanup helper {helper_name!r}")
        params = render_template(cleanup_step.get("params", {}), self.context)
        started_at = time.time()
        helper(self, params, cleanup_step["name"])
        report.update(
            {
                "status": "completed",
                "helper": helper_name,
                "params": params,
                "duration_seconds": round(time.time() - started_at, 3),
            }
        )
        self.cleanup_reports.append(report)

    def run_cleanup(self):
        for cleanup_step in self.manifest.get("cleanup", []):
            self.execute_cleanup_step(cleanup_step)

    def write_summary(self, summary):
        if self.output_dir is None:
            return
        (self.output_dir / "manifest-report.json").write_text(
            json.dumps(summary, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )


def slugify(value):
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip())
    return slug.strip("-") or "step"


def helper_create_user_bundle(executor, params, seed_name):
    username = params["username"]
    fullname = params["fullname"]
    password = params["password"]
    extension = str(params["extension"])
    wizard_step = params.get("wizard_step")

    configuration = executor.run_remote_api(f"module/{executor.module_id}/get-configuration") or {}
    user_domain = configuration.get("user_domain")
    if not user_domain:
        raise RuntimeError("NethVoice module has no configured user_domain")

    provider_list = executor.run_remote_api(
        f"module/{executor.module_id}/list-service-providers",
        {
            "service": "users-admin",
            "transport": "http",
            "filter": {"domain": user_domain},
        },
    )
    if not provider_list:
        raise RuntimeError(f"No users-admin provider found for domain {user_domain}")
    provider_module_id = provider_list[0].get("module_id")
    if not provider_module_id:
        raise RuntimeError(f"users-admin provider for domain {user_domain} has no module_id")

    executor.run_remote_api(
        f"module/{provider_module_id}/add-user",
        {
            "user": username,
            "password": password,
            "display_name": fullname,
            "locked": False,
            "groups": [],
        },
        decode_json=False,
    )

    executor.call_api(
        group_name=f"seed-{seed_name}",
        step_name="trigger-users-sync",
        method="POST",
        path="/users/sync",
        expected_status=200,
        payload={},
    )
    time.sleep(10)

    def sync_completed():
        report = executor.call_api(
            group_name=f"seed-{seed_name}",
            step_name="poll-users-sync",
            method="GET",
            path="/users/sync",
            expected_status=200,
            payload=None,
        )
        return report["response"]["json"] is False

    executor.wait_for(sync_completed, timeout_seconds=60, interval_seconds=5, description=f"user sync for {username}")

    provider_host = executor.run_freepbx_php(
        'include "/etc/freepbx.conf"; echo getenv("NETHVOICE_LDAP_HOST");'
    )
    candidate_usernames = [username]
    if provider_host:
        candidate_usernames.append(f"{username}@{provider_host}")

    def resolve_userman_username():
        candidates_php = ", ".join(json.dumps(candidate) for candidate in candidate_usernames)
        script = f'''include "/etc/freepbx.conf";
$candidates = array({candidates_php});
$matches = array();
foreach ($candidates as $candidate) {{
    if (empty($candidate)) {{
        continue;
    }}
    $user = FreePBX::create()->Userman->getUserByUsername($candidate);
    if (!empty($user) && isset($user["username"])) {{
        $matches[] = $user["username"];
    }}
}}
if (empty($matches)) {{
    foreach (FreePBX::create()->Userman->getAllUsers() as $user) {{
        if (strpos($user["username"], {json.dumps(username)}) === 0) {{
            $matches[] = $user["username"];
        }}
    }}
}}
echo json_encode(array_values(array_unique($matches)));'''
        matches = executor.run_freepbx_php(script, decode_json=True) or []
        return matches[0] if matches else None

    resolved_username = None

    def user_visible_in_userman():
        nonlocal resolved_username
        resolved_username = resolve_userman_username()
        return resolved_username is not None

    executor.wait_for(
        user_visible_in_userman,
        timeout_seconds=90,
        interval_seconds=5,
        description=f"userman import for {username}",
    )

    create_extension_script = f'''include "/etc/freepbx.conf";
include "/var/www/html/freepbx/rest/lib/libExtensions.php";
$result = createMainExtensionForUser({json.dumps(resolved_username)}, {json.dumps(extension)}, "");
if ($result === true) {{
    echo json_encode(array("status" => true));
    exit(0);
}}
fwrite(STDERR, json_encode($result));
exit(1);'''
    executor.run_freepbx_php(create_extension_script)

    executor.run_freepbx_php(
        'include "/etc/freepbx.conf"; system("/var/www/html/freepbx/rest/lib/retrieveHelper.sh > /dev/null 2>&1 &"); echo "queued";'
    )

    if wizard_step is not None:
        executor.call_api(
            group_name=f"seed-{seed_name}",
            step_name="advance-wizard",
            method="POST",
            path="/configuration/wizard",
            expected_status=200,
            payload={"status": True, "step": wizard_step},
        )

    def extension_visible():
        script = f'''include "/etc/freepbx.conf";
$extensions = FreePBX::create()->Core->getAllUsersByDeviceType('virtual');
foreach ($extensions as $user) {{
    if (isset($user["extension"]) && (string)$user["extension"] === {json.dumps(extension)}) {{
        echo "true";
        exit(0);
    }}
}}
echo "false";'''
        return executor.run_freepbx_php(script) == "true"

    executor.wait_for(extension_visible, timeout_seconds=120, interval_seconds=5, description=f"main extension {extension}")
    return {
        "provider_host": provider_host,
        "provider_module_id": provider_module_id,
        "resolved_username": resolved_username,
        "user_domain": user_domain,
        "username": username,
        "fullname": fullname,
        "password": password,
        "extension": extension,
    }


def helper_delete_webrtc(executor, params, cleanup_name):
    mainextension = str(params["mainextension"])
    executor.call_api(
        group_name=f"cleanup-{cleanup_name}",
        step_name="delete-webrtc",
        method="DELETE",
        path=f"/webrtc/{mainextension}",
        expected_status=200,
        payload=None,
    )

    def webrtc_removed():
        report = executor.call_api(
            group_name=f"cleanup-{cleanup_name}",
            step_name="verify-webrtc-removed",
            method="GET",
            path=f"/webrtc/{mainextension}",
            expected_status=200,
            payload=None,
        )
        return report["response"]["json"] is None

    executor.wait_for(webrtc_removed, timeout_seconds=60, interval_seconds=5, description=f"webrtc cleanup for {mainextension}")


def helper_delete_cti_group(executor, params, cleanup_name):
    executor.call_api(
        group_name=f"cleanup-{cleanup_name}",
        step_name="delete-cti-group",
        method="DELETE",
        path=f"/cti/groups/{params['group_id']}",
        expected_status=200,
        payload=None,
    )


def helper_delete_physical_extension(executor, params, cleanup_name):
    extension = str(params["extension"])
    executor.call_api(
        group_name=f"cleanup-{cleanup_name}",
        step_name="delete-physical-extension",
        method="DELETE",
        path=f"/physicalextensions/{extension}",
        expected_status=200,
        payload=None,
    )

    def extension_removed():
        report = executor.call_api(
            group_name=f"cleanup-{cleanup_name}",
            step_name="verify-physical-extension-removed",
            method="GET",
            path="/devices/phones/list",
            expected_status=200,
            payload=None,
        )
        phones = report["response"]["json"]
        expected_item = {"model": "custom", "lines": [{"extension": extension}]}
        return not any(match_subset(phone, expected_item) for phone in phones)

    executor.wait_for(
        extension_removed,
        timeout_seconds=60,
        interval_seconds=5,
        description=f"physical extension cleanup for {extension}",
    )


SEED_HELPERS = {
    "create_user_bundle": helper_create_user_bundle,
}


CLEANUP_HELPERS = {
    "delete_webrtc": helper_delete_webrtc,
    "delete_cti_group": helper_delete_cti_group,
    "delete_physical_extension": helper_delete_physical_extension,
}


def select_operations(manifest, args):
    defaults = manifest.get("defaults", {})
    selected = []
    for raw_operation in manifest.get("operations", []):
        operation = merge_operation(defaults, raw_operation)
        if operation.get("enabled", True) is False:
            continue
        if args.include_name and operation["name"] not in args.include_name:
            continue
        if args.exclude_name and operation["name"] in args.exclude_name:
            continue
        if args.include_method and operation.get("method", "").upper() not in args.include_method:
            continue
        if args.include_classification and operation.get("classification") not in args.include_classification:
            continue
        if args.include_path and not any(path_filter in operation.get("path", "") for path_filter in args.include_path):
            continue
        if args.include_tag:
            if not set(operation.get("tags", [])).intersection(args.include_tag):
                continue
        selected.append(operation)
    return selected


def command_operation(args):
    operation = resolve_operation(args.manifest, args.operation)
    print(json.dumps(operation, indent=2, sort_keys=True))


def command_headers(args):
    secret = fetch_secret(args.node_addr, args.ssh_key, args.module_id)
    headers = compute_headers(args.auth_user, args.auth_password, secret)
    if args.output_dir:
        Path(args.output_dir).mkdir(parents=True, exist_ok=True)
        report_path = Path(args.output_dir) / "auth-headers.json"
        report_path.write_text(json.dumps(headers, indent=2, sort_keys=True) + "\n", encoding="utf-8")
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


def command_execute_manifest(args):
    executor = ManifestExecutor(
        manifest_path=args.manifest,
        node_addr=args.node_addr,
        ssh_key=args.ssh_key,
        module_id=args.module_id,
        base_url=args.base_url,
        output_dir=args.output_dir,
        host_header=args.host_header,
        auth_user=args.auth_user,
        auth_password=args.auth_password,
    )
    executor.prepare_output_dir()
    operations = select_operations(executor.manifest, args)
    if not operations:
        raise RuntimeError("No manifest operations matched the provided filters")

    summary = {
        "manifest": str(Path(args.manifest).resolve().relative_to(REPO_ROOT)),
        "selected_operations": [operation["name"] for operation in operations],
        "runtime": executor.context["runtime"],
    }

    try:
        for operation in operations:
            executor.execute_operation(operation)
        summary["status"] = "passed"
    except Exception as error:
        summary["status"] = "failed"
        summary["error"] = str(error)
        raise
    finally:
        try:
            executor.run_cleanup()
        except Exception as cleanup_error:
            summary.setdefault("cleanup_errors", []).append(str(cleanup_error))
        summary["seed_reports"] = executor.seed_reports
        summary["operation_reports"] = executor.operation_reports
        summary["cleanup_reports"] = executor.cleanup_reports
        executor.write_summary(summary)
        print(json.dumps(summary, indent=2, sort_keys=True))


def build_parser():
    parser = argparse.ArgumentParser(description="REST API helper for Robot REST tests")
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

    manifest_parser = subparsers.add_parser("execute-manifest", help="Execute a manifest with optional filters")
    manifest_parser.add_argument("--manifest", required=True)
    manifest_parser.add_argument("--node-addr", required=True)
    manifest_parser.add_argument("--ssh-key", required=True)
    manifest_parser.add_argument("--module-id", required=True)
    manifest_parser.add_argument("--base-url", required=True)
    manifest_parser.add_argument("--output-dir")
    manifest_parser.add_argument("--host-header")
    manifest_parser.add_argument("--auth-user")
    manifest_parser.add_argument("--auth-password")
    manifest_parser.add_argument("--include-name", action="append", default=[])
    manifest_parser.add_argument("--exclude-name", action="append", default=[])
    manifest_parser.add_argument("--include-tag", action="append", default=[])
    manifest_parser.add_argument("--include-path", action="append", default=[])
    manifest_parser.add_argument("--include-method", action="append", default=[])
    manifest_parser.add_argument("--include-classification", action="append", default=[])
    manifest_parser.set_defaults(func=command_execute_manifest)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    if hasattr(args, "include_method"):
        args.include_method = [method.upper() for method in args.include_method]
    try:
        args.func(args)
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()