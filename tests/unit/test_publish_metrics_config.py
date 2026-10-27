#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import importlib.machinery
import importlib.util
import json
import os
import re
import sys
import tempfile
import types
import unittest
from unittest import mock
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "imageroot"
    / "bin"
    / "publish-metrics-config"
)
KEY = "module/nethvoice1/metrics_alert_rules"
EVENT = "module/nethvoice1/event/metrics-alert-rules-changed"
DASHBOARDS_KEY = "module/nethvoice1/metrics_dashboards"
DASHBOARDS_EVENT = "module/nethvoice1/event/metrics-dashboard-changed"


def load_script():
    sys.modules["agent"] = types.ModuleType("agent")
    loader = importlib.machinery.SourceFileLoader("publish_metrics_config", str(SCRIPT_PATH))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


class FakePipeline:
    def __init__(self, redis):
        self.redis = redis
        self.queued = []

    def hset(self, key, field, value):
        self.queued.append(("hset", key, field, value))

    def hdel(self, key, field):
        self.queued.append(("hdel", key, field))

    def publish(self, channel, message):
        self.queued.append(("publish", channel, message))

    def execute(self):
        for command in self.queued:
            self.redis.commands.append(command)
            if command[0] == "hset":
                self.redis.hashes.setdefault(command[1], {})[command[2]] = command[3]
            elif command[0] == "hdel":
                self.redis.hashes.get(command[1], {}).pop(command[2], None)


class FakeRedis:
    def __init__(self, hashes=None):
        self.hashes = hashes or {}
        self.commands = []

    def hgetall(self, key):
        return dict(self.hashes.get(key, {}))

    def pipeline(self):
        return FakePipeline(self)

    def events(self):
        return [c for c in self.commands if c[0] == "publish"]


class PublishTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.script = load_script()

    def publish(self, redis, rules):
        return self.script.publish(redis, "nethvoice1", "module/nethvoice1", rules)

    def test_first_publish_writes_and_emits_once(self):
        redis = FakeRedis()
        self.assertTrue(self.publish(redis, {"nethvoice-services": "groups: []\n"}))
        self.assertEqual(redis.hashes[KEY], {"nethvoice-services": "groups: []\n"})
        self.assertEqual(redis.events(), [("publish", EVENT, "{}")])

    def test_second_publish_is_noop(self):
        redis = FakeRedis({KEY: {"nethvoice-services": "groups: []\n"}})
        self.assertFalse(self.publish(redis, {"nethvoice-services": "groups: []\n"}))
        self.assertEqual(redis.commands, [])

    def test_rule_file_change_updates_field(self):
        redis = FakeRedis({KEY: {"nethvoice-services": "old\n"}})
        self.assertTrue(self.publish(redis, {"nethvoice-services": "new\n"}))
        self.assertEqual(redis.hashes[KEY]["nethvoice-services"], "new\n")
        self.assertEqual(len(redis.events()), 1)

    def test_removed_rule_file_deletes_owned_field(self):
        redis = FakeRedis({KEY: {"nethvoice-services": "x\n", "nethvoice-old": "y\n"}})
        self.assertTrue(self.publish(redis, {"nethvoice-services": "x\n"}))
        self.assertEqual(redis.hashes[KEY], {"nethvoice-services": "x\n"})
        self.assertEqual(len(redis.events()), 1)

    def test_foreign_fields_untouched(self):
        redis = FakeRedis({KEY: {"custom": "z\n"}})
        self.publish(redis, {"nethvoice-services": "x\n"})
        self.assertEqual(redis.hashes[KEY]["custom"], "z\n")

    def test_foreign_field_alone_is_noop(self):
        redis = FakeRedis({KEY: {"custom": "z\n", "nethvoice-services": "x\n"}})
        self.assertFalse(self.publish(redis, {"nethvoice-services": "x\n"}))
        self.assertEqual(redis.commands, [])


    def test_disabled_alerts_remove_owned_fields_only(self):
        redis = FakeRedis({KEY: {"custom": "z\n", "nethvoice-services": "x\n"}})
        self.assertTrue(self.publish(redis, {}))
        self.assertEqual(redis.hashes[KEY], {"custom": "z\n"})
        self.assertEqual(redis.events(), [("publish", EVENT, "{}")])

    def test_disabled_alerts_without_rules_is_noop(self):
        redis = FakeRedis({KEY: {"custom": "z\n"}})
        self.assertFalse(self.publish(redis, {}))
        self.assertEqual(redis.commands, [])


class AlertsEnabledTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.script = load_script()

    def test_off_by_default(self):
        self.assertFalse(self.script.alerts_enabled({}))

    def test_on_only_when_true(self):
        self.assertTrue(self.script.alerts_enabled({"NETHVOICE_ALERTS_ENABLED": "True"}))
        self.assertFalse(self.script.alerts_enabled({"NETHVOICE_ALERTS_ENABLED": "False"}))
        self.assertFalse(self.script.alerts_enabled({"NETHVOICE_ALERTS_ENABLED": ""}))


class DesiredRulesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.script = load_script()

    def test_one_field_per_owned_yml_file(self):
        with tempfile.TemporaryDirectory() as rules_dir:
            Path(rules_dir, "nethvoice-services.yml").write_text("a\n")
            Path(rules_dir, "README").write_text("b\n")
            Path(rules_dir, "other.yml").write_text("c\n")
            self.assertEqual(self.script.desired_rules(rules_dir), {"nethvoice-services": "a\n"})

    def test_shipped_rules(self):
        self.assertIn("nethvoice-services", self.script.desired_rules())


class PublishDashboardsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.script = load_script()

    def publish(self, redis, dashboards):
        return self.script.publish_dashboards(redis, "nethvoice1", "module/nethvoice1", dashboards)

    def test_first_publish_writes_and_emits_dashboard_event(self):
        redis = FakeRedis()
        self.assertTrue(self.publish(redis, {"nethvoice-overview": "{}"}))
        self.assertEqual(redis.hashes[DASHBOARDS_KEY], {"nethvoice-overview": "{}"})
        self.assertEqual(redis.events(), [("publish", DASHBOARDS_EVENT, "{}")])

    def test_second_publish_is_noop(self):
        redis = FakeRedis({DASHBOARDS_KEY: {"nethvoice-overview": "{}"}})
        self.assertFalse(self.publish(redis, {"nethvoice-overview": "{}"}))
        self.assertEqual(redis.commands, [])

    def test_rules_and_dashboards_are_separate(self):
        redis = FakeRedis({KEY: {"nethvoice-services": "x\n"}})
        self.publish(redis, {"nethvoice-overview": "{}"})
        self.assertEqual(redis.hashes[KEY], {"nethvoice-services": "x\n"})


class DesiredDashboardsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.script = load_script()

    def test_module_id_is_replaced(self):
        with tempfile.TemporaryDirectory() as dashboards_dir:
            Path(dashboards_dir, "nethvoice-overview.json").write_text('{"uid": "ns8-__MODULE_ID__"}')
            Path(dashboards_dir, "other.json").write_text("{}")
            self.assertEqual(
                self.script.desired_dashboards("nethvoice3", dashboards_dir),
                {"nethvoice-overview": '{"uid": "ns8-nethvoice3"}'},
            )

    def test_shipped_dashboard(self):
        dashboards = self.script.desired_dashboards("nethvoice12")
        self.assertIn("nethvoice-overview", dashboards)
        text = dashboards["nethvoice-overview"]
        self.assertNotIn("__MODULE_ID__", text)
        dashboard = json.loads(text)
        # One dashboard per instance: Grafana keeps only one dashboard per uid
        self.assertEqual(dashboard["uid"], "ns8-nethvoice12")
        self.assertLessEqual(len(dashboard["uid"]), 40)
        self.assertEqual(dashboard["title"], "NethVoice nethvoice12")
        ids = [panel["id"] for panel in dashboard["panels"]]
        self.assertEqual(len(ids), len(set(ids)))
        exprs = []
        for panel in dashboard["panels"]:
            for target in panel.get("targets", []):
                self.assertEqual(target["datasource"], {"type": "prometheus", "uid": "prometheus"})
                exprs.append(target["expr"])
        self.assertTrue(exprs)
        for expr in exprs:
            self.assertEqual(expr.count("("), expr.count(")"), expr)
            # Every NethVoice series is read for this instance only
            for selector in re.findall(r"\b(?:nethvoice_(?!proxy_)\w+|asterisk_\w+|satellite_\w+)\{([^}]*)\}", expr):
                self.assertIn('module_id="nethvoice12"', selector, expr)


class MainTest(unittest.TestCase):
    def run_main(self, redis, *args):
        script = load_script()
        script.agent.redis_connect = lambda privileged: redis
        env = {"MODULE_ID": "nethvoice1", "AGENT_ID": "module/nethvoice1", "NETHVOICE_ALERTS_ENABLED": "True"}
        with tempfile.TemporaryDirectory() as workdir, \
                mock.patch.dict(os.environ, env), \
                mock.patch.object(sys, "argv", ["publish-metrics-config", *args]):
            cwd = os.getcwd()
            os.chdir(workdir)
            try:
                script.main()
            finally:
                os.chdir(cwd)

    def test_default_run_leaves_dashboards_alone(self):
        redis = FakeRedis({DASHBOARDS_KEY: {"nethvoice-old": "{}"}})
        self.run_main(redis)
        self.assertIn("nethvoice-services", redis.hashes[KEY])
        self.assertEqual(redis.hashes[DASHBOARDS_KEY], {"nethvoice-old": "{}"})
        self.assertNotIn(("publish", DASHBOARDS_EVENT, "{}"), redis.events())

    def test_install_dashboards_leaves_rules_alone(self):
        redis = FakeRedis()
        self.run_main(redis, "--dashboards", "install")
        self.assertIn("nethvoice-overview", redis.hashes[DASHBOARDS_KEY])
        self.assertNotIn(KEY, redis.hashes)
        self.assertEqual(redis.events(), [("publish", DASHBOARDS_EVENT, "{}")])

    def test_remove_dashboards(self):
        redis = FakeRedis({DASHBOARDS_KEY: {"nethvoice-overview": "{}", "other": "{}"}})
        self.run_main(redis, "--dashboards", "remove")
        self.assertEqual(redis.hashes[DASHBOARDS_KEY], {"other": "{}"})
        self.assertEqual(redis.events(), [("publish", DASHBOARDS_EVENT, "{}")])


if __name__ == "__main__":
    unittest.main()
