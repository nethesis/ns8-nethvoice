# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock
from event_test_utils import load_script

SCRIPT = Path(__file__).resolve().parents[2] / 'imageroot/bin/prepare-asterisk-config'


class PrepareConfigTest(unittest.TestCase):
    def setUp(self):
        self.script = load_script('prepare_asterisk_config', SCRIPT, {})

    def test_live_generation_does_not_reload_asterisk(self):
        with mock.patch.object(self.script.subprocess, 'run') as run:
            run.return_value = subprocess.CompletedProcess([], 0, stdout='')
            self.script.main()
        self.assertIn('--dont-reload-asterisk', run.call_args.args[0])
        self.assertEqual(run.call_count, 2)

    def test_generation_failure_is_propagated(self):
        with mock.patch.object(self.script.subprocess, 'run') as run:
            run.side_effect = [subprocess.CompletedProcess([], 0),
                               subprocess.CompletedProcess(['fwconsole'], 1, stdout='Reload failed')]
            with self.assertRaises(subprocess.CalledProcessError):
                self.script.main()

    def test_busy_reload_retries_then_succeeds(self):
        with mock.patch.object(self.script.subprocess, 'run') as run, \
                mock.patch.object(self.script.time, 'sleep') as sleep:
            run.side_effect = [subprocess.CompletedProcess([], 0),
                               subprocess.CompletedProcess([], 255, stdout='Process is already running.'),
                               subprocess.CompletedProcess([], 0, stdout='Reloaded')]
            self.script.main()
        self.assertEqual(run.call_count, 3)
        sleep.assert_called_once_with(5)

    def test_busy_reload_eventually_fails(self):
        with mock.patch.object(self.script.subprocess, 'run') as run, \
                mock.patch.object(self.script.time, 'sleep') as sleep:
            run.side_effect = [subprocess.CompletedProcess([], 0)] + [
                subprocess.CompletedProcess(['fwconsole'], 255, stdout='Process is already running.')
            ] * 60
            with self.assertRaises(subprocess.CalledProcessError) as raised:
                self.script.main()
        self.assertEqual(raised.exception.returncode, 255)
        self.assertEqual(run.call_count, 61)
        self.assertEqual(sleep.call_count, 59)

    def test_unrelated_exit_255_is_not_retried(self):
        with mock.patch.object(self.script.subprocess, 'run') as run, \
                mock.patch.object(self.script.time, 'sleep') as sleep:
            run.side_effect = [subprocess.CompletedProcess([], 0),
                               subprocess.CompletedProcess(['fwconsole'], 255, stdout='Database unavailable')]
            with self.assertRaises(subprocess.CalledProcessError):
                self.script.main()
        sleep.assert_not_called()

    def test_restored_shared_port_is_split_by_transport_protocol(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            transports = root / 'pjsip.transports.conf'
            transports.write_text('[0.0.0.0-udp]\nprotocol=udp\nbind=0.0.0.0:5060\n\n'
                                  '[0.0.0.0-tcp]\nprotocol=tcp\nbind=0.0.0.0:5060\n'
                                  '[0.0.0.0-tls]\nprotocol=tls\nbind=0.0.0.0:5061\n')
            files = {
                'sip_general_additional.conf': ('bindport=5060\n\n', 'bindport=23002\n\n'),
                'iax_general_additional.conf': ('bindport=4569\n', 'bindport=23001\n'),
                'rtp_additional.conf': ('rtpstart=10000\nrtpend=20000\n', 'rtpstart=22000\nrtpend=22999\n'),
                'http_additional.conf': (
                    'bindport=8088\n\ntlsbindaddr=0.0.0.0:8089\n',
                    'bindport=20134\n\ntlsbindaddr=0.0.0.0:20135\n'),
                'manager.conf': ('[general]\nport=5038\n\n[next]\n', '[general]\nport=20102\n\n[next]\n'),
            }
            for name, (original, _) in files.items():
                (root / name).write_text(original)
            custom = root / 'pjsip.transports_custom.conf'
            custom.write_text('custom bindings are user-owned\n')
            with mock.patch.dict(os.environ, NETHVOICE_FREEPBX_IMAGE='test-image'):
                with mock.patch.object(self.script.subprocess, 'run') as run:
                    run.return_value = subprocess.CompletedProcess([], 1)
                    self.script.main()
            code = run.call_args.kwargs['input'].replace('/etc/asterisk', directory)
            with mock.patch.dict(os.environ, ASTERISK_SIP_UDP_PORT='23002',
                                 ASTERISK_SIP_PORT='20132', ASTERISK_SIPS_PORT='20133',
                                 ASTERISK_IAX_PORT='23001', ASTERISK_RTPSTART='22000',
                                 ASTERISK_RTPEND='22999', ASTERISK_WS_PORT='20134',
                                 ASTERISK_WSS_PORT='20135', ASTMANAGERPORT='20102'):
                exec(compile(code, '<container bindings>', 'exec'), {})
                for name, (_, expected) in files.items():
                    self.assertEqual((root / name).read_text(), expected, name)
                http = root / 'http_additional.conf'
                http.write_text('tlsbindaddr=[::]:8089\n')
                exec(compile(code, '<container bindings>', 'exec'), {})
                self.assertEqual(http.read_text(), 'tlsbindaddr=[::]:20135\n')
            self.assertEqual(transports.read_text(),
                             '[0.0.0.0-udp]\nprotocol=udp\nbind=0.0.0.0:23002\n\n'
                             '[0.0.0.0-tcp]\nprotocol=tcp\nbind=0.0.0.0:20132\n'
                             '[0.0.0.0-tls]\nprotocol=tls\nbind=0.0.0.0:20133\n')
            self.assertEqual(custom.read_text(), 'custom bindings are user-owned\n')


if __name__ == '__main__':
    unittest.main()
