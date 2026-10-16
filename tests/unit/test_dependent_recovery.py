# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import subprocess
import unittest
from pathlib import Path
from unittest import mock

from event_test_utils import load_script

ROOT = Path(__file__).resolve().parents[2]


def service(active="inactive", enabled="enabled", job="0", substate="dead", load="loaded"):
    return dict(LoadState=load, UnitFileState=enabled, ActiveState=active,
                SubState=substate, Job=job)


class DependentRecoveryTest(unittest.TestCase):
    def setUp(self):
        self.helper = load_script("dependent_recovery", ROOT / "imageroot/bin/recover-dependent-services", {})
        self.child = service()
        self.parent = service("active", substate="running")
        self.states = mock.patch.object(self.helper, "state", side_effect=lambda unit, **kwargs:
                                       self.child if unit in self.helper.DEPENDENTS.values() else self.parent)
        self.states.start()
        self.addCleanup(self.states.stop)
        patch = mock.patch.object(self.helper.subprocess, "run")
        self.run = patch.start()
        self.addCleanup(patch.stop)

    def test_both_explicit_mappings_queue_nonblocking_start(self):
        for parent, child in self.helper.DEPENDENTS.items():
            with self.subTest(parent=parent):
                self.run.reset_mock()
                self.helper.recover(parent)
                self.run.assert_called_once_with(
                    ["systemctl", "--user", "--no-block", "--no-ask-password",
                     "--job-mode=fail", "start", child],
                    check=True, timeout=10, stdout=self.helper.sys.stderr)

    def test_disabled_masked_and_feature_disabled_services_stay_stopped(self):
        for unit_state, load in (("disabled", "loaded"), ("masked", "masked"),
                                 ("masked-runtime", "masked"), ("static", "loaded"),
                                 ("enabled", "not-found")):
            self.child = service(enabled=unit_state, load=load)
            self.helper.recover("freepbx.service")
        self.run.assert_not_called()

    def test_unhealthy_prerequisite_never_starts_child(self):
        for active in ("inactive", "failed", "deactivating", "activating"):
            self.parent = service(active)
            with self.assertRaisesRegex(RuntimeError, "not ready"):
                self.helper.recover("freepbx.service")
        self.run.assert_not_called()

    def test_startup_accepts_only_readiness_post_phase(self):
        self.parent = service("activating", substate="start-post")
        self.helper.recover("freepbx.service", startup=True)
        self.run.assert_called_once()
        with self.assertRaisesRegex(RuntimeError, "not ready"):
            self.helper.recover("freepbx.service")

    def test_repeated_recovery_leaves_active_or_pending_child_alone(self):
        for child in (service("active"), service(job="42"),
                      service("activating", job="42 /org/freedesktop/systemd1/job/42"),
                      service("deactivating", job="43")):
            self.child = child
            for _ in range(3):
                self.helper.recover("freepbx.service")
        self.run.assert_not_called()

    def test_wait_observes_completed_start_without_requeuing(self):
        def start(*args, **kwargs):
            self.child = service("active", substate="running")
        self.run.side_effect = start
        with mock.patch.object(self.helper.time, "sleep"):
            self.helper.recover("freepbx.service", wait=120)
        self.run.assert_called_once()

    def test_wait_is_bounded_when_child_never_starts(self):
        now = [0]
        with mock.patch.object(self.helper.time, "monotonic", side_effect=lambda: now[0]), \
                mock.patch.object(self.helper.time, "sleep", side_effect=lambda _: now.__setitem__(0, 120)):
            with self.assertRaisesRegex(RuntimeError, "timed out"):
                self.helper.recover("freepbx.service", wait=120)
        self.run.assert_called_once()

    def test_pending_job_must_finish_within_update_budget(self):
        self.child = service(job="42")
        now = [0]
        with mock.patch.object(self.helper.time, "monotonic", side_effect=lambda: now[0]), \
                mock.patch.object(self.helper.time, "sleep", side_effect=lambda _: now.__setitem__(0, 120)):
            with self.assertRaisesRegex(RuntimeError, "timed out"):
                self.helper.recover("freepbx.service", wait=120)
        self.run.assert_not_called()

    def test_queue_failure_is_reported(self):
        self.run.side_effect = subprocess.CalledProcessError(1, ["systemctl"])
        with self.assertRaises(subprocess.CalledProcessError):
            self.helper.recover("freepbx.service")

    def test_state_query_rejects_empty_or_partial_output(self):
        self.states.stop()
        for output in ("", "ActiveState=active\n"):
            self.run.return_value = subprocess.CompletedProcess([], 0, stdout=output)
            with self.assertRaisesRegex(RuntimeError, "Cannot determine"):
                self.helper.state("freepbx.service")

    def test_no_arbitrary_services_and_no_startup_wait(self):
        helper = ROOT / "imageroot/bin/recover-dependent-services"
        for args in (("satellite.service",), ("--startup", "--wait", "1", "freepbx.service")):
            result = subprocess.run([str(helper), *args], capture_output=True)
            self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
