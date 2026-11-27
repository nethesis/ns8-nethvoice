import fcntl
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

import phone_cleanup as recovery


class OrphanRecoveryTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.owner = "nvtest-0123456789ab"
        self.label = self.owner + "-caller"
        self.target = {"module": "nethvoice70", "domain": "voice2.lab"}
        self.request = dict(self.target, owner=self.owner,
                            extensions=dict(zip(recovery.ROLES, map(str, range(8000000, 8000004)))))
        ctx = patch.dict(os.environ, MODULE_ID=self.target["module"], NETHVOICE_HOST=self.target["domain"])
        ctx.start()
        self.addCleanup(ctx.stop)

    def stamp(self, label):
        path = Path(tempfile.mkdtemp(prefix=f"nv-agent-phone-{label}-", dir=self.root))
        marker = path / recovery.MARKER
        marker.write_text(json.dumps(dict(self.target, label=label)))
        marker.chmod(0o600)
        (path / "received.wav").touch()
        return path

    def test_removes_owned_container_then_waits_and_erases_only_stamped_data(self):
        mine = self.stamp(self.label)
        other = self.stamp("nvtest-000000000000-caller")
        carrier = self.owner + "-carrier"
        mine_carrier = self.stamp(carrier)
        names = {label: ["nvtest-" + label + "-54ef32ab"] for label in (self.label, carrier)}

        def remove(name, label):
            self.assertEqual(names[label], [name])
            names.pop(label)

        with patch.object(recovery, "containers", side_effect=lambda label: names.get(label, [])), \
             patch.object(recovery, "registered", side_effect=[True, False]) as registered, \
             patch.object(recovery.time, "sleep") as sleep:
            result = recovery.recover(self.request, remove, tmp=self.root)
        self.assertEqual(result, {"containers": 2, "directories": 2})
        self.assertFalse(mine.exists())
        self.assertFalse(mine_carrier.exists())
        self.assertTrue(other.exists())
        self.assertEqual([c.args for c in registered.call_args_list], [("8000000",)] * 2)
        sleep.assert_called_once()

    def test_wrong_domain_and_active_driver_are_preserved(self):
        mine = self.stamp(self.label)
        remove = Mock()
        with patch.dict(os.environ, NETHVOICE_HOST="other.lab"), self.assertRaisesRegex(
                recovery.RecoveryError, "wrong_target"):
            recovery.recover(self.request, remove, tmp=self.root)
        with (mine / recovery.MARKER).open() as stream, self.assertRaisesRegex(
                recovery.RecoveryError, "still_active"):
            fcntl.flock(stream, fcntl.LOCK_EX)
            recovery.recover(self.request, remove, tmp=self.root)
        remove.assert_not_called()
        self.assertTrue(mine.exists())

    def test_mismatched_stamp_and_unrelated_podman_name_fail_closed(self):
        mine = self.stamp(self.label)
        (mine / recovery.MARKER).write_text(json.dumps(dict(self.target, label="other")))
        with self.assertRaisesRegex(recovery.RecoveryError, "stamp_mismatch"):
            recovery.recover(self.request, Mock(), tmp=self.root)
        self.assertTrue(mine.exists())
        with patch.object(recovery, "cli", return_value="unrelated-volume\n"), self.assertRaisesRegex(
                recovery.RecoveryError, "name_does_not_match"):
            recovery.containers(self.label)

    def test_symlink_directory_is_never_followed(self):
        other = self.stamp("nvtest-000000000000-caller")
        (self.root / ("nv-agent-phone-" + self.label + "-12345678")).symlink_to(other, target_is_directory=True)
        with self.assertRaisesRegex(recovery.RecoveryError, "invalid_phone_directory"):
            recovery.recover(self.request, Mock(), tmp=self.root)
        self.assertTrue(other.exists())
