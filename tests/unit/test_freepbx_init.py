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
fwconsole)
    if [[ "$*" == 'ma list' ]]; then echo '| core | 17.0 | Disabled |'; fi
    if [[ "$*" == 'userman --syncall --force --verbose' && -n "${TEST_SYNC_GATE:-}" ]]; then
        touch "$TEST_SYNC_GATE.entered"
        until test -f "$TEST_SYNC_GATE"; do /bin/sleep 0.05; done
    fi;;
su)
    if test -f "$TEST_READY"; then exit "${TEST_POST_SYNC_RELOAD_EXIT:-0}"; fi
    exit "${TEST_RELOAD_EXIT:-0}";;
curl)
    if [[ "$*" == *'/admin/reload/profiles' ]]; then exit "${TEST_MIDDLEWARE_EXIT:-0}"; fi
    count_file="$TEST_CALLS.curl-count"
    count=0
    if test -f "$count_file"; then read -r count < "$count_file"; fi
    echo "$((++count))" > "$count_file"
    if [[ "${TEST_TANCREDI_DOWN:-0}" == 1 ]]; then printf 000; exit 7; fi
    if ((count <= ${TEST_TANCREDI_FAILURES:-0})); then printf 503; else printf 403; fi;;
php)
    if [[ "$*" == *'SELECT id FROM devices WHERE tech = ?'* ]]; then
        printf '%s' "${TEST_LEGACY_EXTENSIONS:-}"
        exit 0
    fi
    if [[ "$*" == *phonesRpsResetHelper* && -n "${TEST_RPS_GATE:-}" ]]; then
        touch "$TEST_RPS_GATE.entered"
        until test -f "$TEST_RPS_GATE"; do /bin/sleep 0.05; done
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
        helper = '/var/www/html/freepbx/rest/lib/middlewareProfilesReloadHelper.sh'
        script = script.replace(helper, str(ROOT / 'freepbx' / helper.lstrip('/')))
        self.middleware_env = {'NETHVOICE_MIDDLEWARE_PORT': '20038',
                               'NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN': 'test-token'}
        self.ready = self.root / 'freepbx-ready'
        script = script.replace('/var/run/nethvoice/freepbx-ready', str(self.ready))
        script = script.replace('/var/run/nethvoice/freepbx-failed', str(self.root / 'freepbx-failed'))
        self.script = self.root / 'init.sh'
        # Wait for background stubs so their logs are complete.
        self.script.write_text(script + '\nwait\n')

    def run_init(self, **extra):
        result = subprocess.run(['bash', str(self.script)],
                                env=dict(os.environ, PATH=str(self.root) + ':' + os.environ['PATH'],
                                         TEST_CALLS=str(self.calls), TEST_READY=str(self.ready),
                                         TANCREDIPORT='20001', **self.middleware_env, **extra),
                                capture_output=True, text=True, timeout=20)
        return result, self.calls.read_text()

    def test_installs_modules_then_reloads_without_restarting_asterisk(self):
        result, calls = self.run_init(TEST_LEGACY_EXTENSIONS='1201,1202')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertLess(calls.index('fwconsole moduleadmin --skipchown install core'), calls.index('su asterisk'))
        trunk_conversion = calls.index('php /convert-legacy-sip-trunks.php')
        extension_conversion = calls.index('fwconsole convert2pjsip --range 1201,1202')
        self.assertLess(calls.index('fwconsole moduleadmin --skipchown install core'), trunk_conversion)
        self.assertLess(trunk_conversion, extension_conversion)
        self.assertLess(extension_conversion, calls.index('fwconsole userman --syncall'))
        self.assertLess(extension_conversion, calls.index('su asterisk'))
        self.assertNotIn('core restart', calls)
        self.assertNotIn('HTTPTLSBINDADDRESS', calls)
        self.assertTrue(self.ready.exists())

    def test_skips_extension_conversion_when_no_legacy_devices_remain(self):
        result, calls = self.run_init()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('fwconsole convert2pjsip', calls)
        self.assertTrue(self.ready.exists())

    def test_failed_reload_stops_remaining_initialization(self):
        result, calls = self.run_init(TEST_RELOAD_EXIT='1')
        self.assertEqual(result.returncode, 1)
        self.assertNotIn('fwconsole userman --syncall', calls)
        self.assertNotIn('phonesRpsResetHelper', calls)
        self.assertNotIn('core restart', calls)
        self.assertFalse(self.ready.exists())
        self.assertTrue((self.root / "freepbx-failed").exists())

    def test_module_install_failure_stops_initialization(self):
        result, calls = self.run_init(TEST_FAILURE='fwconsole moduleadmin --skipchown install core')
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertNotIn('su asterisk', calls)
        self.assertNotIn('fwconsole userman --syncall', calls)
        self.assertNotIn('phonesRpsResetHelper', calls)
        self.assertNotIn('slow_database_updates.php', calls)
        self.assertFalse(self.ready.exists())
        self.assertTrue((self.root / 'freepbx-failed').exists())

    def test_failed_sync_preserves_readiness_and_skips_second_reload(self):
        result, calls = self.run_init(TEST_FAILURE='fwconsole userman --syncall --force --verbose')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('FreePBX user sync failed (exit 1)', result.stderr)
        self.assertEqual(calls.count('su asterisk'), 1)
        self.assertNotIn('/admin/reload/profiles', calls)
        self.assertTrue(self.ready.exists())
        self.assertFalse((self.root / 'freepbx-failed').exists())

    def test_failed_post_sync_reload_preserves_readiness(self):
        result, calls = self.run_init(TEST_POST_SYNC_RELOAD_EXIT='7')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('FreePBX post-sync reload failed (exit 7)', result.stderr)
        self.assertEqual(calls.count('su asterisk'), 2)
        self.assertNotIn('/admin/reload/profiles', calls)
        self.assertTrue(self.ready.exists())
        self.assertFalse((self.root / 'freepbx-failed').exists())

    def test_failed_middleware_refresh_preserves_readiness(self):
        result, calls = self.run_init(TEST_MIDDLEWARE_EXIT='22')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('FreePBX post-sync middleware refresh failed (exit 22)', result.stderr)
        self.assertIn('/admin/reload/profiles', calls)
        self.assertTrue(self.ready.exists())
        self.assertFalse((self.root / 'freepbx-failed').exists())

    def test_optional_step_failures_do_not_skip_final_initialization(self):
        for command in ['ionice -c2 -n7 nice -n 10 fwconsole chown --module=framework',
                        'php /convert-legacy-sip-trunks.php',
                        'fwconsole convert2pjsip --range 1201',
                        'php /var/www/html/freepbx/rest/lib/phonesRpsResetHelper.php --host-changed']:
            with self.subTest(command=command):
                self.calls.unlink(missing_ok=True)
                result, calls = self.run_init(TEST_FAILURE=command, TEST_LEGACY_EXTENSIONS='1201')
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(command, calls)
                self.assertIn('fwconsole userman --syncall --force --verbose', calls)
                self.assertIn('su asterisk', calls)
                self.assertIn('phonesRpsResetHelper', calls)
                self.assertIn('slow_database_updates.php', calls)
                self.assertTrue(self.ready.exists())

    def test_rps_waits_for_tancredi(self):
        result, calls = self.run_init(TEST_TANCREDI_FAILURES='2')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls.count('/tancredi/api/v1/phones'), 3)
        self.assertIn('http://127.0.0.1:20001/tancredi/api/v1/phones', calls)
        self.assertLess(calls.rindex('/tancredi/api/v1/phones'), calls.index('phonesRpsResetHelper'))
        self.assertTrue(self.ready.exists())

    def test_tancredi_timeout_preserves_freepbx_readiness(self):
        result, calls = self.run_init(TEST_TANCREDI_DOWN='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls.count('/tancredi/api/v1/phones'), 30)
        self.assertNotIn('phonesRpsResetHelper', calls)
        self.assertIn('timed out waiting for Tancredi', result.stderr)
        self.assertTrue(self.ready.exists())
        self.assertFalse((self.root / 'freepbx-failed').exists())

    def check_background_job(self, gate_variable):
        # Run the production script without the test harness's final wait.
        self.script.write_text(self.script.read_text().removesuffix('\nwait\n'))
        gate = self.root / 'release'
        with subprocess.Popen(
                ['bash', str(self.script)], stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                env=dict(os.environ, PATH=str(self.root) + ':' + os.environ['PATH'],
                         TEST_CALLS=str(self.calls), TEST_READY=str(self.ready),
                         TANCREDIPORT='20001', **self.middleware_env, **{gate_variable: str(gate)})) as process:
            try:
                self.assertEqual(process.wait(timeout=10), 0)
                deadline = time.monotonic() + 5
                while not gate.with_suffix('.entered').exists() and time.monotonic() < deadline:
                    time.sleep(0.05)
                self.assertTrue(gate.with_suffix('.entered').exists())
                self.assertTrue(self.ready.exists())
                self.assertFalse((self.root / 'freepbx-failed').exists())
                blocked_calls = self.calls.read_text()
            finally:
                gate.touch()
                if process.poll() is None:
                    process.kill()
                # Background jobs inherit stdout. EOF means they have finished.
                process.communicate(timeout=5)
        return blocked_calls

    def test_blocked_rps_does_not_hold_up_initialization(self):
        self.check_background_job('TEST_RPS_GATE')

    def test_blocked_sync_reloads_after_initialization(self):
        blocked_calls = self.check_background_job('TEST_SYNC_GATE')
        self.assertEqual(blocked_calls.count('su asterisk'), 1)
        self.assertNotIn('/admin/reload/profiles', blocked_calls)
        self.assertLess(blocked_calls.index('su asterisk'), blocked_calls.index('fwconsole userman'))
        calls = self.calls.read_text()
        self.assertEqual(calls.count('fwconsole userman'), 1)
        self.assertEqual(calls.count('su asterisk'), 2)
        self.assertLess(calls.rindex('su asterisk'), calls.index('/admin/reload/profiles'))


if __name__ == '__main__':
    unittest.main()
