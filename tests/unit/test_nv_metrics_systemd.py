#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import subprocess
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "imageroot" / "pypkg"))

from nvmetrics import systemd  # noqa: E402


def unit(name, active, file_state="enabled", restarts="0", inactive_exit="1000", load="loaded"):
    return (
        f"Id={name}.service\n"
        f"LoadState={load}\n"
        f"ActiveState={active}\n"
        f"UnitFileState={file_state}\n"
        f"NRestarts={restarts}\n"
        f"InactiveExitTimestampMonotonic={inactive_exit}\n"
    )


def show_output(*units):
    return "\n".join(units)


class ParseShowTest(unittest.TestCase):
    def test_blocks_are_split_on_empty_lines(self):
        units = systemd.parse_show(show_output(unit("janus", "active"), unit("mariadb", "failed")))
        self.assertEqual([u["Id"] for u in units], ["janus.service", "mariadb.service"])
        self.assertEqual(units[1]["ActiveState"], "failed")

    def test_value_containing_equal_sign_is_kept(self):
        units = systemd.parse_show("Id=a.service\nDescription=x=y\n")
        self.assertEqual(units[0]["Description"], "x=y")


class ServiceUpTest(unittest.TestCase):
    def up(self, text):
        return systemd.service_up(systemd.parse_show(text)[0])

    def test_running_or_restarting_is_up(self):
        for state in ("active", "reloading", "activating"):
            self.assertEqual(self.up(unit("janus", state)), 1, state)

    def test_failed_is_down_even_if_disabled(self):
        # reports-redis is disabled but started by reports-api
        self.assertEqual(self.up(unit("reports-redis", "failed", file_state="disabled")), 0)

    def test_enabled_unit_stopped_after_running_is_down(self):
        self.assertEqual(self.up(unit("tancredi", "inactive")), 0)

    def test_enabled_unit_never_started_is_not_exported(self):
        # nethcti-server is enabled by configure-module, started after the wizard
        self.assertIsNone(self.up(unit("nethcti-server", "inactive", inactive_exit="0")))

    def test_disabled_stopped_unit_is_not_exported(self):
        # satellite with transcription turned off
        self.assertIsNone(self.up(unit("satellite", "inactive", file_state="disabled")))

    def test_static_stopped_unit_is_not_exported(self):
        self.assertIsNone(self.up(unit("reports-redis", "inactive", file_state="static")))


class RenderTest(unittest.TestCase):
    def render(self, *units):
        return systemd.render(systemd.parse_show(show_output(*units)))

    def test_samples(self):
        text = self.render(
            unit("freepbx", "active", restarts="2"),
            unit("satellite", "inactive", file_state="disabled"),
            unit("mariadb", "failed", restarts="5"),
        )
        self.assertIn('nethvoice_service_up{service="freepbx"} 1\n', text)
        self.assertIn('nethvoice_service_up{service="mariadb"} 0\n', text)
        self.assertNotIn('nethvoice_service_up{service="satellite"}', text)
        self.assertIn('nethvoice_service_restarts_total{service="freepbx"} 2\n', text)
        self.assertIn('nethvoice_service_restarts_total{service="mariadb"} 5\n', text)
        self.assertIn('nethvoice_service_restarts_total{service="satellite"} 0\n', text)
        self.assertIn("# TYPE nethvoice_service_up gauge\n", text)
        self.assertIn("# TYPE nethvoice_service_restarts_total counter\n", text)

    def test_unit_not_loaded_is_skipped(self):
        text = self.render(unit("sftp", "inactive", load="not-found"))
        self.assertNotIn('service="sftp"', text)

    def test_reserved_labels_are_never_set(self):
        text = self.render(unit("freepbx", "active"))
        self.assertNotRegex(text, r"(module|module_id|instance)=")


class ReadUnitsTest(unittest.TestCase):
    def test_one_systemctl_call_for_every_service(self):
        run = mock.Mock(return_value=subprocess.CompletedProcess([], 0, stdout=unit("janus", "active")))
        units = systemd.read_units(("janus", "mariadb"), run=run)
        args = run.call_args.args[0]
        self.assertEqual(args[:3], ["systemctl", "--user", "show"])
        self.assertEqual(args[-2:], ["janus.service", "mariadb.service"])
        self.assertEqual(run.call_args.kwargs["timeout"], systemd.TIMEOUT)
        self.assertEqual(units[0]["Id"], "janus.service")

    def test_watched_services(self):
        self.assertEqual(
            set(systemd.SERVICES),
            {
                "freepbx", "mariadb", "janus", "nethcti-ui", "nethcti-server",
                "nethcti-middleware", "phonebook", "tancredi", "satellite",
                "satellite-mqtt", "satellite-pgsql", "reports-api",
                "reports-redis", "reports-ui", "sftp", "saml2-proxy",
                "oauth2-proxy",
            },
        )


if __name__ == "__main__":
    unittest.main()
