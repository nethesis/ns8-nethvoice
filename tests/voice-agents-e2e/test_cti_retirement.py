import json
import tempfile
import unittest
from unittest.mock import Mock

from lab import Lab, LabError


class CTIRetirementTests(unittest.TestCase):
    def test_projection_is_journaled_before_first_profile_write(self):
        with tempfile.TemporaryDirectory() as directory:
            lab = Lab(workdir=directory)
            lab.metadata = {"binding": "owned-test-trunk"}
            lab.manifest.write_text(json.dumps(lab.state))

            def fixture(op, **args):
                if op == "cti_prerequisite":
                    return {"cti_user_id": 51, "cti_profile_id": 2}
                self.assertEqual(op, "cti")
                receipt = json.loads(lab.manifest.read_text())
                self.assertEqual((receipt["cti_user_id"], receipt["cti_profile_id"]), (51, 2))
                raise LabError("interrupted profile projection")

            lab._php = fixture
            with self.assertRaisesRegex(LabError, "interrupted profile projection"):
                lab.configure("live", attended=True)

    def test_retry_after_failed_journal_persists_receipt_before_cti_write(self):
        with tempfile.TemporaryDirectory() as directory:
            lab = Lab(workdir=directory)
            lab.manifest.write_text(json.dumps(lab.state))
            save = lab._save_ownership
            saves = 0

            def fail_once():
                nonlocal saves
                saves += 1
                if saves == 1:
                    raise OSError("journal unavailable")
                save()

            def fixture(op, **args):
                if op == "cti_prerequisite":
                    return {"cti_user_id": 51, "cti_profile_id": 2}
                self.assertEqual(op, "cti")
                self.assertEqual(json.loads(lab.manifest.read_text())["cti_user_id"], 51)
                raise LabError("fixture write reached")

            lab._php = Mock(side_effect=fixture)
            lab._save_ownership = fail_once
            with self.assertRaisesRegex(OSError, "journal unavailable"):
                lab.configure("live", attended=True)
            self.assertNotIn("cti_user_id", json.loads(lab.manifest.read_text()))
            lab._php.assert_called_once_with("cti_prerequisite")
            with self.assertRaisesRegex(LabError, "fixture write reached"):
                lab.configure("live", attended=True)
            self.assertEqual(saves, 2)
            self.assertEqual([c.args[0] for c in lab._php.call_args_list], ["cti_prerequisite", "cti"])

    def test_unexpected_projection_retains_manifest_and_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            lab = Lab(workdir=directory)
            lab.state.update(cti_user_id=51, cti_profile_id=2)
            lab.manifest.write_text(json.dumps(lab.state))
            lab._cli = Mock(return_value="")
            lab._php = Mock(side_effect=LabError("unexpected_fixture_cti_profile"))
            with self.assertRaisesRegex(LabError, "unexpected_fixture_cti_profile"):
                lab.cleanup()
            self.assertTrue(lab.manifest.exists())
            lab._php.assert_called_once_with("retire_cti")

    def test_partial_setup_cleanup_verifies_config_and_reloads_before_retiring_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            lab = Lab(workdir=directory)
            lab.state.update(cti_user_id=51, cti_profile_id=2)
            lab.manifest.write_text(json.dumps(lab.state))
            lab._cli = Mock(return_value="")
            ops = []
            lab._php = Mock(side_effect=lambda op, **args: ops.append((op, args)))
            lab._reload = Mock(side_effect=lambda: ops.append(("reload", {})))
            lab._ssh = Mock(side_effect=LabError("middleware unavailable"))
            with self.assertRaisesRegex(LabError, "middleware unavailable"):
                lab.cleanup()
            self.assertTrue(lab.manifest.exists())
            self.assertEqual(ops, [("retire_cti", {}), ("reload", {}), ("cti_config", {"present": False})])
            lab._ssh.assert_called_once_with(["systemctl", "--user", "reload", "nethcti-middleware.service"])
            lab._ssh.side_effect = None
            lab.cleanup()
            self.assertFalse(lab.manifest.exists())
            self.assertEqual(ops[3:], [("retire_cti", {}), ("reload", {}), ("cti_config", {"present": False}),
                                       ("retire_cti_settings", {}), ("delete", {}), ("reload", {}),
                                       ("retire_cti_settings", {}), ("verify", {})])
            self.assertEqual(lab._ssh.call_args.args[0], ["systemctl", "--user", "reload", "nethcti-server.service"])

    def test_disabled_chat_blocks_before_allocating_colleague_profile(self):
        with tempfile.TemporaryDirectory() as directory:
            lab = Lab(workdir=directory)
            lab.manifest.write_text(json.dumps(lab.state))
            lab.metadata["chat_enabled"] = False
            lab._php = Mock()
            with self.assertRaisesRegex(LabError, "chat is disabled"):
                lab.configure("live", attended=True, chat=True)
            lab._php.assert_not_called()

    def test_directory_create_uses_stdin_and_retries_after_failed_submission(self):
        with tempfile.TemporaryDirectory() as directory:
            lab = Lab(workdir=directory)
            lab.cti = {"username": lab.state["owner"] + "-colleague", "password": "test"}
            lab._ssh = Mock(return_value="test.example")
            lab._reload_cti_profiles = Mock()
            lab._php = Mock(side_effect=[{"owned": False}, {"owned": False}, {"owned": False}, {"owned": True}])
            lab._root = Mock(side_effect=["openldap6", LabError("submission failed"), "openldap6", ""])
            with self.assertRaisesRegex(LabError, "submission failed"):
                lab.ensure_cti_login()
            self.assertEqual(json.loads(lab.manifest.read_text())["directory_provider"], "openldap6")
            lab.ensure_cti_login()
            submission = lab._root.call_args_list[-1]
            self.assertEqual(submission.args[0], ["api-cli", "run", "module/openldap6/add-user", "--data", "-"])
            self.assertEqual(json.loads(submission.kwargs["data"])["password"], "test")
