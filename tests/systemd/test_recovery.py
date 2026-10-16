#!/usr/bin/env python3
"""Real systemd ordering tests. Run only in the disposable test container."""
import os
from pathlib import Path
import subprocess
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]
UNITS = Path("/run/systemd/system")
HELPER = ROOT / "imageroot/bin/recover-dependent-services"


def ctl(*args, check=True):
    return subprocess.run(["/usr/bin/systemctl", *args], text=True,
                          capture_output=True, check=check, timeout=20)


def value(unit, prop):
    return ctl("show", unit, "--property=" + prop, "--value").stdout.strip()


def until(predicate):
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.1)
    raise AssertionError("systemd state did not converge within 15s")


class OrderingTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if (os.environ.get("NETHVOICE_ISOLATED_SYSTEMD_TEST") != "1"
                or subprocess.run(["systemd-detect-virt", "--container"],
                                  capture_output=True).returncode != 0):
            raise RuntimeError("Requires the disposable systemd test container")
        # Exercise real dependency transactions on the isolated PID 1 manager.
        # Only the manager scope differs from NS8's user manager; no mock jobs.
        bindir = Path("/run/recovery-test-bin")
        bindir.mkdir(exist_ok=True)
        wrapper = bindir / "systemctl"
        wrapper.write_text('#!/bin/sh\n[ "$1" = --user ] && shift\nexec /usr/bin/systemctl "$@"\n')
        wrapper.chmod(0o755)
        cls.env = dict(os.environ, PATH=f"{bindir}:/usr/bin:/bin")
        cls.names = ["mariadb", "freepbx", "tancredi", "reports-api", "reports-ui"]
        (UNITS / "mariadb.service").write_text(
            '[Service]\nType=oneshot\nRemainAfterExit=yes\n'
            'ExecStart=/bin/sh -c "test ! -f /run/recovery-test-fault"\n')
        for parent, child in (("freepbx", "tancredi"), ("reports-api", "reports-ui")):
            dependency = "Requires=mariadb.service\nAfter=mariadb.service\n" if parent == "freepbx" else ""
            # FreePBX's readiness post-command and Reports API's notify
            # readiness precede the exact recovery command shipped in the unit.
            source = (ROOT / f"imageroot/systemd/user/{parent}.service").read_text()
            recovery_line = next(line for line in source.splitlines()
                                 if line.startswith("ExecStartPost=-runagent recover-dependent-services"))
            recovery_line = recovery_line.replace("runagent recover-dependent-services", str(HELPER))
            if parent == "freepbx":
                start = ('Type=forking\nPIDFile=/run/recovery-test-freepbx.pid\n'
                         'ExecStart=/bin/sh -c "sleep infinity & echo $! > /run/recovery-test-freepbx.pid"\n'
                         'ExecStartPost=/bin/sleep 0.2\n')
            else:
                start = ('Type=notify\nNotifyAccess=all\n'
                         'ExecStart=/bin/sh -c "systemd-notify --ready; exec sleep infinity"\n')
            (UNITS / f"{parent}.service").write_text(
                f"[Unit]\n{dependency}[Service]\n{start}TimeoutStartSec=10\n"
                f"Environment=PATH={cls.env['PATH']}\n{recovery_line}\n")
            # Use the production child's actual Requires/After declarations.
            child_unit = (ROOT / f"imageroot/systemd/user/{child}.service").read_text().split("[Service]")[0]
            (UNITS / f"{child}.service").write_text(
                child_unit + '[Service]\nExecStart=/bin/sleep infinity\n'
                '[Install]\nWantedBy=multi-user.target\n')
        ctl("daemon-reload")

    def tearDown(self):
        Path("/run/recovery-test-fault").unlink(missing_ok=True)
        for name in self.names:
            ctl("unmask", "--runtime", name, check=False)
            ctl("disable", "--runtime", name, check=False)
        ctl("stop", *(name + ".service" for name in reversed(self.names)), check=False)
        ctl("reset-failed", check=False)

    def test_startup_queue_has_no_parent_child_deadlock(self):
        for parent, child in (("freepbx", "tancredi"), ("reports-api", "reports-ui")):
            ctl("enable", "--runtime", child)
            ctl("start", parent)
            until(lambda: value(child, "ActiveState") == "active")
            before = value(child, "ExecMainStartTimestampMonotonic")
            for _ in range(3):
                subprocess.run([str(HELPER), parent + ".service"], env=self.env, check=True)
            self.assertEqual(value(child, "ExecMainStartTimestampMonotonic"), before)

    def test_dependency_failure_followed_by_parent_recovery(self):
        ctl("enable", "--runtime", "tancredi")
        Path("/run/recovery-test-fault").touch()
        failure = ctl("start", "tancredi", check=False)
        self.assertNotEqual(failure.returncode, 0)
        self.assertIn("dependency", failure.stderr.lower())
        self.assertEqual(value("tancredi", "ActiveState"), "inactive")
        Path("/run/recovery-test-fault").unlink()
        ctl("start", "freepbx")
        until(lambda: value("tancredi", "ActiveState") == "active")

    def test_existing_child_start_job_does_not_deadlock(self):
        ctl("enable", "--runtime", "tancredi")
        ctl("start", "tancredi")
        self.assertEqual(value("tancredi", "ActiveState"), "active")
        self.assertEqual(value("freepbx", "NRestarts"), "0")

    def test_disabled_and_masked_child_remains_stopped(self):
        ctl("start", "freepbx")
        self.assertEqual(value("tancredi", "ActiveState"), "inactive")
        ctl("mask", "--runtime", "tancredi", check=False)
        # /run contains the fixture; replace it with a mask explicitly.
        fixture = UNITS / "tancredi.service"
        saved = fixture.read_text()
        fixture.unlink()
        fixture.symlink_to("/dev/null")
        try:
            ctl("daemon-reload")
            ctl("restart", "freepbx")
            self.assertEqual(value("tancredi", "ActiveState"), "inactive")
        finally:
            fixture.unlink()
            fixture.write_text(saved)
            ctl("daemon-reload")

    def test_update_recovers_inactive_child_using_current_definition(self):
        ctl("start", "freepbx")
        ctl("enable", "--runtime", "tancredi")
        parent_start = value("freepbx", "ExecMainStartTimestampMonotonic")
        fixture = UNITS / "tancredi.service"
        original = fixture.read_text()
        fixture.write_text(original.replace('ExecStart=/bin/sleep infinity',
                           'ExecStart=/bin/sh -c "echo pr-image > /run/recovery-test-image; exec sleep infinity"'))
        try:
            ctl("daemon-reload")
            subprocess.run([str(HELPER), "--wait", "10", "freepbx.service"], env=self.env, check=True)
            self.assertEqual(Path("/run/recovery-test-image").read_text().strip(), "pr-image")
            self.assertEqual(value("freepbx", "ExecMainStartTimestampMonotonic"), parent_start)
        finally:
            fixture.write_text(original)
            ctl("daemon-reload")

    def test_queue_failure_does_not_restart_healthy_parent(self):
        # Simulate a helper failure after readiness, retaining the production '-'.
        fixture = UNITS / "freepbx.service"
        original = fixture.read_text()
        fixture.write_text(original.replace(str(HELPER), "/bin/false"))
        try:
            ctl("daemon-reload")
            ctl("start", "freepbx")
            self.assertEqual(value("freepbx", "ActiveState"), "active")
            self.assertEqual(value("freepbx", "NRestarts"), "0")
        finally:
            fixture.write_text(original)
            ctl("daemon-reload")


if __name__ == "__main__":
    unittest.main(verbosity=2)
