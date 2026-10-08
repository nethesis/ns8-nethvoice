"""Exercise the remote acceptance check's bounded FreePBX initialization wait."""

import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock


SOURCE = Path(__file__).resolve().parents[1] / "10_nethvoice_actions/UsersAdminAgentCredentials.py"


class UsersAdminReadinessTest(unittest.TestCase):
    def setUp(self):
        tree = ast.parse(SOURCE.read_text())
        remote = next(
            node.value.value for node in tree.body
            if isinstance(node, ast.Assign)
            and any(isinstance(target, ast.Name) and target.id == "REMOTE_CHECK" for target in node.targets)
        )
        functions = [
            node for node in ast.parse(remote).body
            if isinstance(node, ast.FunctionDef) and node.name in ("require", "wait_for_freepbx_init")
        ]
        self.process = Mock()
        self.clock = SimpleNamespace(monotonic=Mock(return_value=0), sleep=Mock())
        namespace = {"subprocess": SimpleNamespace(run=self.process), "time": self.clock}
        exec(compile(ast.Module(body=functions, type_ignores=[]), str(SOURCE), "exec"), namespace)
        self.wait = namespace["wait_for_freepbx_init"]

    def test_waits_for_initialization_to_exit(self):
        self.process.side_effect = [SimpleNamespace(returncode=code) for code in (0, 0, 1)]
        self.wait()
        self.assertEqual(self.process.call_count, 3)
        self.assertEqual(self.clock.sleep.call_count, 2)
        self.assertEqual(self.process.call_args.args[0],
            ["podman", "exec", "freepbx", "pgrep", "-f", "^/bin/bash /freepbx_init.sh$"])

    def test_container_failure_is_not_treated_as_ready(self):
        self.process.return_value = SimpleNamespace(returncode=125)
        with self.assertRaisesRegex(RuntimeError, "cannot inspect"):
            self.wait()
        self.clock.sleep.assert_not_called()

    def test_initialization_wait_is_bounded(self):
        self.clock.monotonic.side_effect = [0, 0, 301]
        self.process.return_value = SimpleNamespace(returncode=0)
        with self.assertRaisesRegex(RuntimeError, "did not finish"):
            self.wait()
        self.assertEqual(self.process.call_count, 1)


if __name__ == "__main__":
    unittest.main()
