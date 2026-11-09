# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later

import base64
import io
import json
import os
import shlex
import tarfile
import uuid

from robot.libraries.BuiltIn import BuiltIn


def _execute(command, timeout="15 minutes"):
    ssh = BuiltIn().get_library_instance("SSHLibrary")
    return ssh.execute_command(
        command,
        return_stdout=True,
        return_stderr=True,
        return_rc=True,
        timeout=timeout,
    )


def _safe_extract(encoded_archive, destination):
    archive = base64.b64decode(encoded_archive)
    destination = os.path.realpath(destination)
    os.makedirs(destination, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as bundle:
        for member in bundle.getmembers():
            target = os.path.realpath(os.path.join(destination, member.name))
            if target != destination and not target.startswith(destination + os.sep):
                raise AssertionError("FIAS evidence archive contains an unsafe path")
        bundle.extractall(destination)


def run_fias_end_to_end(module_id, scenario, output_dir):
    """Run the isolated FIAS stack and always retrieve its sanitized evidence."""
    run_id = uuid.uuid4().hex
    artifact_dir = f"/tmp/fias-e2e-ci-{run_id}"
    scenario = str(scenario).lower()
    local_dir = os.path.join(output_dir, "fias-e2e", scenario)

    harness = shlex.join(
        [
            "runagent",
            "-m",
            module_id,
            "podman",
            "exec",
            "-e",
            f"FIAS_E2E_ARTIFACT_DIR={artifact_dir}",
            "-e",
            f"FIAS_E2E_SCENARIO={scenario}",
            "-e",
            f"FIAS_E2E_MODULE_ID={module_id}",
            "freepbx",
            "php",
            "/usr/share/neth-hotel-fias/fias-server-e2e.php",
        ]
    )
    stdout, stderr, return_code = _execute(harness)

    archive_command = shlex.join(
        ["podman", "exec", "freepbx", "tar", "-C", artifact_dir, "-czf", "-", "."]
    ) + " | base64 -w0"
    retrieve = shlex.join(
        ["runagent", "-m", module_id, "sh", "-lc", archive_command]
    )
    archive_stdout, archive_stderr, archive_rc = _execute(retrieve)

    cleanup = shlex.join(
        [
            "runagent",
            "-m",
            module_id,
            "podman",
            "exec",
            "freepbx",
            "rm",
            "-rf",
            "--",
            artifact_dir,
        ]
    )
    _execute(cleanup)

    if archive_rc != 0:
        detail = archive_stderr.strip() or archive_stdout.strip()
        raise AssertionError("Unable to retrieve FIAS evidence: " + detail)
    try:
        _safe_extract(archive_stdout.strip(), local_dir)
    except Exception as error:
        raise AssertionError("Unable to extract FIAS evidence") from error

    report_path = os.path.join(local_dir, "report.json")
    if not os.path.isfile(report_path):
        raise AssertionError("FIAS harness did not produce report.json")
    with open(report_path, encoding="utf-8") as report_file:
        report = json.load(report_file)

    if return_code != 0 or report.get("status") != "PASS":
        detail = report.get("error") or stderr.strip() or stdout.strip()
        raise AssertionError(
            f"FIAS end-to-end test failed; evidence: {local_dir}: {detail}"
        )
    return report
