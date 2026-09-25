#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import contextlib
import io
import os
import subprocess
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

import yaml

from event_test_utils import load_script


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


class PrometheusAlertRulesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.agent = types.ModuleType("agent")
        cls.publisher = load_script(
            "prometheus_alert_rules",
            REPOSITORY_ROOT / "imageroot/bin/prometheus-alert-rules",
            {"agent": cls.agent},
        )

    def setUp(self):
        self.env = {
            "NETHVOICE_SYSTEMD_EXPORTER_PORT": "20137",
            "NETHVOICE_HOST": "voice.example.test",
        }
        self.previous = {}
        self.agent.read_envfile = mock.Mock(return_value=self.env)
        self.rdb = mock.MagicMock()
        self.rdb.hmget.side_effect = lambda key, fields: [self.previous.get(f) for f in fields]
        self.agent.redis_connect = mock.MagicMock()
        self.agent.redis_connect.return_value.__enter__.return_value = self.rdb
        patch = mock.patch.dict(os.environ, {"MODULE_ID": "nethvoice42", "AGENT_ID": "module/nethvoice42"})
        patch.start()
        self.addCleanup(patch.stop)
        process_patch = mock.patch.object(self.publisher.subprocess, "run")
        self.process = process_patch.start()
        self.addCleanup(process_patch.stop)
        self.process.side_effect = self.run_command

    def run_command(self, args, **kwargs):
        if args[0] == "podman":
            return subprocess.CompletedProcess(args, 0, "13\n", "")
        return subprocess.CompletedProcess(args, 1, "disabled\n", "")

    def rules(self, documents):
        return [rule for document in documents.values()
                for group in yaml.safe_load(document)["groups"] for rule in group["rules"]]

    def test_unconfigured_instance_only_monitors_exporter(self):
        self.env.pop("NETHVOICE_HOST")
        documents = self.publisher.build_rule_sets(self.env, {})
        self.assertEqual(set(documents), {"systemd-exporter"})
        self.process.assert_not_called()

    def test_upgrade_without_exporter_port_does_not_publish_rules(self):
        self.env.pop("NETHVOICE_SYSTEMD_EXPORTER_PORT")
        self.assertEqual(self.publisher.build_rule_sets(self.env, {}), {})
        self.process.assert_not_called()

    def test_configured_services_have_distinct_bilingual_alerts(self):
        documents = self.publisher.build_rule_sets(self.env, {})
        rules = self.rules(documents)
        self.assertEqual({r["labels"]["service"] for r in rules}, {
            "systemd-exporter.service", "freepbx.service", "mariadb.service", "janus.service",
            "tancredi.service", "phonebook.service", "nethcti-ui.service", "nethcti-server.service",
            "nethcti-middleware.service", "reports-api.service", "reports-redis.service", "reports-ui.service",
        })
        self.assertEqual(len({r["alert"] for r in rules}), len(rules))
        for rule in rules:
            self.assertEqual(rule["for"], "5m")
            self.assertEqual(rule["labels"]["severity"], "critical")
            self.assertNotIn("module_id", rule["labels"])
            self.assertEqual(set(rule["annotations"]), {
                "summary_en", "summary_it", "description_en", "description_it",
            })
            self.assertTrue(all(rule["annotations"].values()))

    def test_cti_follows_existing_wizard_threshold(self):
        for step, expected in (("0", False), ("9", False), ("10", True), ("13", True)):
            with self.subTest(step=step):
                self.process.return_value = subprocess.CompletedProcess([], 0, step, "")
                self.process.side_effect = None
                self.assertEqual(self.publisher.cti_ready(), expected)
                self.assertEqual(self.process.call_args.kwargs["timeout"], 10)

    def test_incomplete_wizard_removes_previous_cti_rules(self):
        with mock.patch.object(self.publisher, "cti_ready", return_value=False):
            documents = self.publisher.build_rule_sets(self.env, {"cti-services": "old rules"})
        self.assertNotIn("cti-services", documents)

    def test_readiness_failures_retain_cti_without_blocking_other_rules(self):
        for failure in (subprocess.TimeoutExpired("mysql", 10), OSError("unavailable"),
                        subprocess.CompletedProcess([], 1, "", "unavailable"),
                        subprocess.CompletedProcess([], 0, "invalid", "")):
            with self.subTest(failure=failure), contextlib.redirect_stderr(io.StringIO()) as log:
                def fail_mysql(args, **kwargs):
                    if args[0] != "podman":
                        return subprocess.CompletedProcess(args, 1, "disabled", "")
                    if isinstance(failure, Exception):
                        raise failure
                    return failure
                self.process.side_effect = fail_mysql
                documents = self.publisher.build_rule_sets(self.env, {"cti-services": "previous bytes\n"})
                self.assertEqual(documents["cti-services"], "previous bytes\n")
                self.assertIn("core-services", documents)
                self.assertIn("systemd-exporter", documents)
                self.assertIn("retaining existing CTI", log.getvalue())
                self.assertNotIn("cti-services", self.publisher.build_rule_sets(self.env, {}))

    def test_wizard_startup_intent_does_not_depend_on_database_or_startup_success(self):
        with mock.patch.object(self.publisher, "cti_ready", side_effect=AssertionError("must not query")):
            documents = self.publisher.build_rule_sets(self.env, {}, force_cti_ready=True)
        self.assertIn("cti-services", documents)
        self.assertTrue(all(call.args[0][0] != "podman" for call in self.process.call_args_list))

    def test_either_transcription_flag_includes_all_satellite_services(self):
        for flag in ("SATELLITE_CALL_TRANSCRIPTION_ENABLED", "SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED"):
            with self.subTest(flag=flag):
                documents = self.publisher.build_rule_sets(dict(self.env, **{flag: "True"}), {})
                services = {r["labels"]["service"] for r in self.rules({"s": documents["satellite-services"]})}
                self.assertEqual(services, {"satellite.service", "satellite-mqtt.service", "satellite-pgsql.service"})

    def test_disabling_transcription_retains_enabled_history_database(self):
        with mock.patch.object(self.publisher, "satellite_database_enabled", return_value=True):
            documents = self.publisher.build_rule_sets(self.env, {})
        self.assertEqual([r["labels"]["service"] for r in self.rules({"s": documents["satellite-services"]})],
                         ["satellite-pgsql.service"])

    def test_systemd_query_failure_is_not_mistaken_for_disabled(self):
        self.process.side_effect = None
        self.process.return_value = subprocess.CompletedProcess([], 1, "", "Failed to connect to bus")
        with self.assertRaisesRegex(RuntimeError, "Cannot determine"):
            self.publisher.satellite_database_enabled()

    def test_publication_uses_current_identity_and_one_transaction(self):
        self.publisher.publish_rules()
        self.rdb.hmget.assert_called_once_with("module/nethvoice42/metrics_alert_rules", self.publisher.RULE_SETS)
        self.agent.redis_connect.assert_called_once_with(privileged=True)
        trx = self.rdb.pipeline.return_value
        self.assertEqual(trx.hset.call_count, 3)
        trx.publish.assert_called_once_with("module/nethvoice42/event/metrics-alert-rules-changed", "{}")
        trx.execute.assert_called_once_with()
        self.assertEqual([call[0] for call in trx.method_calls][-2:], ["publish", "execute"])

    def test_repeated_publication_is_idempotent_with_byte_responses(self):
        self.previous.update({key: value.encode() for key, value in self.publisher.build_rule_sets(self.env, {}).items()})
        self.publisher.publish_rules()
        self.rdb.pipeline.assert_not_called()

    def test_disabling_optional_services_only_deletes_obsolete_owned_field(self):
        self.previous.update(self.publisher.build_rule_sets(self.env, {}))
        self.previous["satellite-services"] = "old satellite rules"
        self.previous["custom"] = "unrelated rule"
        self.publisher.publish_rules()
        trx = self.rdb.pipeline.return_value
        trx.hset.assert_not_called()
        trx.hdel.assert_called_once_with("module/nethvoice42/metrics_alert_rules", "satellite-services")
        trx.delete.assert_not_called()

    def test_removal_preserves_custom_rules_and_is_idempotent(self):
        self.previous.update({"core-services": "old", "custom": "unrelated"})
        self.publisher.publish_rules(remove=True)
        trx = self.rdb.pipeline.return_value
        trx.hdel.assert_called_once_with("module/nethvoice42/metrics_alert_rules", "core-services")
        self.agent.read_envfile.assert_not_called()
        self.process.assert_not_called()
        self.previous.pop("core-services")
        self.rdb.reset_mock()
        self.publisher.publish_rules(remove=True)
        self.rdb.pipeline.assert_not_called()

    def test_redis_write_failure_propagates(self):
        self.rdb.pipeline.return_value.execute.side_effect = RuntimeError("Redis unavailable")
        with self.assertRaisesRegex(RuntimeError, "Redis unavailable"):
            self.publisher.publish_rules()


class WizardAlertPublicationTest(unittest.TestCase):
    def test_failed_cti_start_still_publishes_readiness(self):
        self.run_watcher("restart_nethcti-server", "1", True)

    def test_middleware_start_publishes_readiness(self):
        self.run_watcher("start_nethcti-middleware", "0", True)

    def test_unrelated_restart_does_not_publish_cti_readiness(self):
        self.run_watcher("restart_reports-api", "0", False)

    def test_unrelated_restart_keeps_failure_status(self):
        self.run_watcher("restart_reports-api", "1", False)

    def test_cti_reload_does_not_publish_startup_readiness(self):
        self.run_watcher("reload_nethcti-server", "0", False)

    def run_watcher(self, notification, systemctl_status, should_publish):
        script = (REPOSITORY_ROOT / "imageroot/bin/adjust-services").read_text()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "notify").mkdir()
            (root / "notify" / notification).touch()
            fake_systemctl = root / "systemctl"
            fake_systemctl.write_text(f"#!/bin/sh\nexit {systemctl_status}\n")
            fake_systemctl.chmod(0o755)
            helper = root / "prometheus-alert-rules"
            helper.write_text('#!/bin/sh\nprintf "%s\\n" "$*" > published\n')
            helper.chmod(0o755)
            result = subprocess.run(
                ["bash"], input=script.replace("/usr/bin/systemctl", str(fake_systemctl)),
                cwd=root, env=dict(os.environ, PATH=f"{root}:{os.environ['PATH']}"),
                text=True, capture_output=True, timeout=5,
            )
            self.assertEqual(result.returncode, int(systemctl_status), result.stderr)
            self.assertFalse((root / "notify" / notification).exists())
            self.assertEqual((root / "published").exists(), should_publish)
            if should_publish:
                self.assertEqual((root / "published").read_text(), "update --cti-ready\n")


if __name__ == "__main__":
    unittest.main()
