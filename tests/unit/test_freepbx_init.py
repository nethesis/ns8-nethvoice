# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]


class FreepbxInitTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / 'custom').mkdir()
        self.calls = self.root / 'calls'
        stub = self.root / 'stub'
        stub.write_text('''#!/bin/bash
echo "$(basename "$0") $*" >> "$TEST_CALLS"
case "$(basename "$0")" in
asterisk) echo 'Asterisk 22';;
fwconsole) if [[ "$*" == 'ma list' ]]; then echo '| core | 17.0 | Disabled |'; fi;;
su) exit "${TEST_RELOAD_EXIT:-0}";;
curl)
    count_file="$TEST_CALLS.curl-count"
    count=0
    if test -f "$count_file"; then read -r count < "$count_file"; fi
    echo "$((++count))" > "$count_file"
    if [[ "${TEST_TANCREDI_DOWN:-0}" == 1 ]]; then printf 000; exit 7; fi
    if ((count <= ${TEST_TANCREDI_FAILURES:-0})); then printf 503; else printf 403; fi;;
php)
    if [[ "$*" == *phonesRpsResetHelper* && -n "${TEST_RPS_GATE:-}" ]]; then
        touch "$TEST_RPS_GATE.entered"
        until test -f "$TEST_RPS_GATE"; do /bin/sleep 0.05; done
        touch "$TEST_RPS_GATE.done"
    fi
    cat >/dev/null;;
esac
if [[ "$(basename "$0") $*" == "${TEST_FAILURE:-}" ]]; then exit 1; fi
''')
        stub.chmod(0o755)
        for name in ['asterisk', 'fwconsole', 'su', 'php', 'ionice', 'sleep', 'chmod', 'curl']:
            (self.root / name).symlink_to(stub)
        script = (ROOT / 'freepbx/freepbx_init.sh').read_text()
        script = script.replace('/usr/sbin/asterisk', str(self.root / 'asterisk'))
        script = script.replace('/freepbx_custom_modules', str(self.root / 'custom'))
        self.ready = self.root / 'freepbx-ready'
        script = script.replace('/var/run/nethvoice/freepbx-ready', str(self.ready))
        script = script.replace('/var/run/nethvoice/freepbx-failed', str(self.root / 'freepbx-failed'))
        self.script = self.root / 'init.sh'
        # Wait for background stubs so their logs are complete.
        self.script.write_text(script + '\nwait\n')

    def run_init(self, **extra):
        result = subprocess.run(['bash', str(self.script)],
                                env=dict(os.environ, PATH=str(self.root) + ':' + os.environ['PATH'],
                                         TEST_CALLS=str(self.calls), TANCREDIPORT='20001', **extra),
                                capture_output=True, text=True, timeout=20)
        return result, self.calls.read_text()

    def test_installs_modules_then_reloads_without_restarting_asterisk(self):
        result, calls = self.run_init()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertLess(calls.index('fwconsole moduleadmin install core'), calls.index('su asterisk'))
        conversion = calls.index('php /convert-legacy-sip-trunks.php')
        self.assertLess(calls.index('fwconsole moduleadmin install core'), conversion)
        self.assertLess(conversion, calls.index('fwconsole userman --syncall'))
        self.assertNotIn('core restart', calls)
        self.assertNotIn('HTTPTLSBINDADDRESS', calls)
        self.assertTrue(self.ready.exists())

    def test_failed_reload_stops_remaining_initialization(self):
        result, calls = self.run_init(TEST_RELOAD_EXIT='1')
        self.assertEqual(result.returncode, 1)
        self.assertNotIn('phonesRpsResetHelper', calls)
        self.assertNotIn('core restart', calls)
        self.assertFalse(self.ready.exists())
        self.assertTrue((self.root / "freepbx-failed").exists())

    def test_required_step_failures_stop_initialization(self):
        for command in ['fwconsole moduleadmin install core',
                        'fwconsole userman --syncall --force --verbose']:
            with self.subTest(command=command):
                self.calls.unlink(missing_ok=True)
                result, calls = self.run_init(TEST_FAILURE=command)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertNotIn('su asterisk', calls)
                self.assertNotIn('phonesRpsResetHelper', calls)
                self.assertNotIn('slow_database_updates.php', calls)
                self.assertFalse(self.ready.exists())

    def test_optional_step_failures_do_not_skip_final_initialization(self):
        for command in ['ionice -c2 -n7 nice -n 10 fwconsole chown',
                        'php /convert-legacy-sip-trunks.php',
                        'php /var/www/html/freepbx/rest/lib/phonesRpsResetHelper.php --host-changed']:
            with self.subTest(command=command):
                self.calls.unlink(missing_ok=True)
                result, calls = self.run_init(TEST_FAILURE=command)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('fwconsole userman --syncall --force --verbose', calls)
                self.assertIn('su asterisk', calls)
                self.assertIn('phonesRpsResetHelper', calls)
                self.assertIn('slow_database_updates.php', calls)
                self.assertTrue(self.ready.exists())

    def test_rps_waits_for_tancredi(self):
        result, calls = self.run_init(TEST_TANCREDI_FAILURES='2')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls.count('curl '), 3)
        self.assertIn('http://127.0.0.1:20001/tancredi/api/v1/phones', calls)
        self.assertLess(calls.rindex('curl '), calls.index('phonesRpsResetHelper'))
        self.assertTrue(self.ready.exists())

    def test_tancredi_timeout_preserves_freepbx_readiness(self):
        result, calls = self.run_init(TEST_TANCREDI_DOWN='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls.count('curl '), 30)
        self.assertNotIn('phonesRpsResetHelper', calls)
        self.assertIn('timed out waiting for Tancredi', result.stderr)
        self.assertTrue(self.ready.exists())
        self.assertFalse((self.root / 'freepbx-failed').exists())

    def test_blocked_rps_does_not_hold_up_initialization(self):
        # Run the production script without the test harness's final wait.
        self.script.write_text(self.script.read_text().removesuffix('\nwait\n'))
        gate = self.root / 'rps-release'
        with (self.root / 'output').open('w') as output:
            process = subprocess.Popen(
                ['bash', str(self.script)], stdin=subprocess.DEVNULL,
                stdout=output, stderr=output,
                env=dict(os.environ, PATH=str(self.root) + ':' + os.environ['PATH'],
                         TEST_CALLS=str(self.calls), TANCREDIPORT='20001', TEST_RPS_GATE=str(gate)))
            try:
                self.assertEqual(process.wait(timeout=10), 0)
                deadline = time.monotonic() + 5
                while not gate.with_suffix('.entered').exists() and time.monotonic() < deadline:
                    time.sleep(0.05)
                self.assertTrue(gate.with_suffix('.entered').exists())
                self.assertFalse(gate.with_suffix('.done').exists())
                self.assertTrue(self.ready.exists())
                self.assertFalse((self.root / 'freepbx-failed').exists())
            finally:
                gate.touch()
                if process.poll() is None:
                    process.kill()
                    process.wait()
                deadline = time.monotonic() + 5
                while not gate.with_suffix('.done').exists() and time.monotonic() < deadline:
                    time.sleep(0.05)


if __name__ == '__main__':
    unittest.main()
