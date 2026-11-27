#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import io
import json
import os
import subprocess
import types
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

from event_test_utils import load_script


ROOT = Path(__file__).resolve().parents[2] / "imageroot"


class FakeRedis:
    def __init__(self, modules):
        self.modules = modules

    def scan_iter(self, match):
        assert match == "module/*/environment"
        return iter(f"module/{module_id}/environment" for module_id in self.modules)

    def hgetall(self, key):
        return dict(self.modules[key.split("/")[1]])


def fake_agent():
    agent = types.ModuleType("agent")
    agent.get_image_name_from_url = lambda url: url.rsplit("/", 1)[-1].split(":")[0] if url else ""
    agent.set_env = mock.Mock()
    agent.set_status = mock.Mock()
    agent.run_helper = mock.Mock(return_value=subprocess.CompletedProcess([], 0))
    agent.environment = {}
    agent.read_envfile = lambda path: dict(agent.environment)
    agent.redis_connect = mock.Mock()
    return agent


def instance(domain, prefix=None, image="ghcr.io/nethesis/nethvoice:latest"):
    environment = {"IMAGE_URL": image, "USER_DOMAIN": domain}
    if prefix is not None:
        environment["NETHVOICE_ADMIN_GROUP_PREFIX"] = prefix
    return environment


class AdminGroupPrefixTest(unittest.TestCase):
    def setUp(self):
        self.agent = fake_agent()
        self.module = load_script("admin_group_prefix", ROOT / "pypkg" / "admin_group_prefix.py", {"agent": self.agent})
        self.env = mock.patch.dict(os.environ, {"AGENT_STATE_DIR": "/state", "MODULE_ID": "nethvoice3"})
        self.env.start()

    def tearDown(self):
        self.env.stop()

    def configure(self, modules, current=None, domain="ns8.example.org"):
        self.agent.environment = {"USER_DOMAIN": domain}
        if current is not None:
            self.agent.environment["NETHVOICE_ADMIN_GROUP_PREFIX"] = current
        return self.module.configure(FakeRedis(modules))

    def test_alone_on_the_domain_takes_the_default(self):
        self.assertEqual(self.configure({"nethvoice3": instance("ns8.example.org")}), "nethvoice")
        self.agent.set_env.assert_called_once_with("NETHVOICE_ADMIN_GROUP_PREFIX", "nethvoice")

    def test_another_instance_with_the_default_gives_the_module_number(self):
        modules = {"nethvoice1": instance("ns8.example.org", "nethvoice")}
        self.assertEqual(self.configure(modules), "nethvoice3")

    def test_an_older_instance_without_prefix_keeps_the_default(self):
        modules = {"nethvoice1": instance("ns8.example.org")}
        self.assertEqual(self.configure(modules), "nethvoice3")

    def test_a_newer_instance_without_prefix_does_not_matter(self):
        modules = {"nethvoice7": instance("ns8.example.org")}
        self.assertEqual(self.configure(modules), "nethvoice")

    def test_other_domains_and_other_images_are_ignored(self):
        modules = {
            "nethvoice1": instance("other.example.org", "nethvoice"),
            "nethvoice2": instance("other.example.org"),
            "nethvoice-proxy1": instance("ns8.example.org", "nethvoice", "ghcr.io/nethesis/nethvoice-proxy:latest"),
            "mail1": instance("ns8.example.org", "nethvoice", "ghcr.io/nethserver/mail:1.0"),
        }
        self.assertEqual(self.configure(modules), "nethvoice")

    def test_a_valid_unclaimed_prefix_is_kept(self):
        modules = {"nethvoice1": instance("ns8.example.org", "nethvoice")}
        self.assertEqual(self.configure(modules, "nethvoice-sales"), "nethvoice-sales")
        self.agent.set_env.assert_not_called()

    def test_a_claimed_or_invalid_prefix_is_replaced(self):
        modules = {"nethvoice1": instance("ns8.example.org", "nethvoice-sales")}
        self.assertEqual(self.configure(modules, "nethvoice-sales"), "nethvoice")
        self.assertEqual(self.configure({}, "NethVoice"), "nethvoice")
        self.assertEqual(self.configure({}, "voice"), "nethvoice")

    def test_a_clone_gets_its_own_prefix(self):
        modules = {"nethvoice1": instance("ns8.example.org", "nethvoice")}
        self.assertEqual(self.configure(modules, ""), "nethvoice3")

    def test_a_collision_on_the_module_number_gets_a_suffix(self):
        modules = {
            "nethvoice1": instance("ns8.example.org", "nethvoice"),
            "nethvoice2": instance("ns8.example.org", "nethvoice3"),
        }
        self.assertEqual(self.configure(modules), "nethvoice3-2")

    def test_no_domain_changes_nothing(self):
        self.assertEqual(self.configure({}, "nethvoice", ""), "nethvoice")
        self.agent.set_env.assert_not_called()

    def test_every_chosen_prefix_is_valid(self):
        for module_id in ["nethvoice3", "nethvoice12345678901234567890", "weird"]:
            prefix = self.module.choose_prefix(module_id, "", [("nethvoice1", "nethvoice")])
            self.assertTrue(self.module.is_valid(prefix), prefix)


class SetAdminGroupPrefixActionTest(unittest.TestCase):
    def setUp(self):
        self.agent = fake_agent()
        self.module = load_script("admin_group_prefix", ROOT / "pypkg" / "admin_group_prefix.py", {"agent": self.agent})
        self.env = mock.patch.dict(os.environ, {"AGENT_STATE_DIR": "/state", "MODULE_ID": "nethvoice3"})
        self.env.start()

    def tearDown(self):
        self.env.stop()

    def run_action(self, prefix, modules, current="nethvoice3"):
        self.agent.environment = {"USER_DOMAIN": "ns8.example.org", "NETHVOICE_ADMIN_GROUP_PREFIX": current}
        self.agent.redis_connect.return_value = FakeRedis(modules)
        output = io.StringIO()
        with mock.patch("sys.stdin", io.StringIO(json.dumps({"prefix": prefix}))), redirect_stdout(output):
            try:
                load_script("set_admin_group_prefix", ROOT / "actions" / "set-admin-group-prefix" / "20set", {"agent": self.agent, "admin_group_prefix": self.module})
            except SystemExit as exit:
                return exit.code, output.getvalue()
        return 0, output.getvalue()

    def test_sets_the_prefix_and_restarts_freepbx(self):
        self.assertEqual(self.run_action("nethvoice-sales", {"nethvoice1": instance("ns8.example.org", "nethvoice")})[0], 0)
        self.agent.set_env.assert_called_once_with("NETHVOICE_ADMIN_GROUP_PREFIX", "nethvoice-sales")
        self.agent.run_helper.assert_called_once_with("systemctl", "--user", "try-restart", "freepbx.service")

    def test_refuses_a_prefix_of_another_instance(self):
        code, output = self.run_action("nethvoice", {"nethvoice1": instance("ns8.example.org", "nethvoice")})
        self.assertEqual(code, 2)
        self.assertEqual(json.loads(output)[0]["error"], "prefix_already_used")
        self.agent.set_env.assert_not_called()
        self.agent.run_helper.assert_not_called()

    def test_the_same_prefix_restarts_nothing(self):
        self.assertEqual(self.run_action("nethvoice3", {})[0], 0)
        self.agent.set_env.assert_not_called()
        self.agent.run_helper.assert_not_called()

    def test_the_input_schema_matches_the_prefix_rule(self):
        schema = json.loads((ROOT / "actions" / "set-admin-group-prefix" / "validate-input.json").read_text())
        self.assertEqual(schema["properties"]["prefix"]["pattern"], "^" + self.module.PREFIX_PATTERN.pattern + "$")


class AdminGroupPrefixWiringTest(unittest.TestCase):
    def test_the_prefix_is_chosen_on_configure_update_and_clone(self):
        for step in ["actions/configure-module/51admin_group_prefix", "update-module.d/13admin_group_prefix"]:
            path = ROOT / step
            self.assertTrue(os.access(path, os.X_OK), step)
            self.assertIn("configure-admin-group-prefix", path.read_text())
        self.assertTrue(os.access(ROOT / "actions/clone-module/31admin_group_prefix", os.X_OK))
        self.assertIn("agent.unset_env('NETHVOICE_ADMIN_GROUP_PREFIX')", (ROOT / "actions" / "clone-module" / "30clean_env").read_text())
        self.assertIn("    'NETHVOICE_ADMIN_GROUP_PREFIX',\n", (ROOT / "actions" / "restore-module" / "20copyenv").read_text())

    def run_clone_steps(self, request):
        agent = types.ModuleType("agent")
        agent.unset = []
        agent.unset_env = agent.unset.append
        agent.mset_env = lambda values: None
        agent.read_envfile = lambda name: {}
        agent.write_envfile = lambda name, values: None
        prefix = types.ModuleType("admin_group_prefix")
        prefix.calls = []
        prefix.configure = lambda: prefix.calls.append("configure")
        for step in ("30clean_env", "31admin_group_prefix"):
            with mock.patch("sys.stdin", io.StringIO(json.dumps(request))):
                load_script(step, ROOT / "actions" / "clone-module" / step,
                            {"agent": agent, "admin_group_prefix": prefix})
        return "NETHVOICE_ADMIN_GROUP_PREFIX" in agent.unset, prefix.calls

    def test_a_copy_gets_a_new_prefix(self):
        self.assertEqual(self.run_clone_steps({"replace": False}), (True, ["configure"]))

    def test_a_move_keeps_the_prefix_of_the_instance_it_replaces(self):
        self.assertEqual(self.run_clone_steps({"replace": True}), (False, []))

    def test_the_re_read_timer_is_enabled_and_runs_the_job(self):
        for step in ["actions/configure-module/80start_services", "update-module.d/70enable"]:
            self.assertIn("systemctl --user enable --now nethvoice-admins-sync.timer", (ROOT / step).read_text())
        service = (ROOT / "systemd" / "user" / "nethvoice-admins-sync.service").read_text()
        self.assertIn("ExecCondition=/usr/bin/systemctl --user --quiet is-active freepbx.service", service)
        job = "/var/www/html/freepbx/rest/lib/domainAdminsSync.php"
        self.assertIn(job, service)
        self.assertTrue((ROOT.parent / "freepbx" / "var" / "www" / "html" / "freepbx" / "rest" / "lib" / "domainAdminsSync.php").is_file())
        self.assertIn("OnCalendar=*-*-* *:*:00", (ROOT / "systemd" / "user" / "nethvoice-admins-sync.timer").read_text())


if __name__ == "__main__":
    unittest.main()
