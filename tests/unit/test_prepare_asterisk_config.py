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
            run.return_value = subprocess.CompletedProcess([], 0)
            self.script.main()
        self.assertIn('--dont-reload-asterisk', run.call_args.args[0])
        self.assertEqual(run.call_count, 2)

    def test_generation_failure_is_propagated(self):
        with mock.patch.object(self.script.subprocess, 'run') as run:
            run.side_effect = [subprocess.CompletedProcess([], 0), subprocess.CalledProcessError(1, ['fwconsole'])]
            with self.assertRaises(subprocess.CalledProcessError):
                self.script.main()

    def test_restored_shared_port_is_split_by_transport_protocol(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            transports = root / 'pjsip.transports.conf'
            transports.write_text('[0.0.0.0-udp]\nprotocol=udp\nbind=0.0.0.0:5060\n'
                                  '[0.0.0.0-tcp]\nprotocol=tcp\nbind=0.0.0.0:5060\n'
                                  '[0.0.0.0-tls]\nprotocol=tls\nbind=0.0.0.0:5061\n')
            custom = root / 'pjsip.transports_custom.conf'
            custom.write_text('custom bindings are user-owned\n')
            with mock.patch.dict(os.environ, NETHVOICE_FREEPBX_IMAGE='test-image'):
                with mock.patch.object(self.script.subprocess, 'run') as run:
                    run.return_value = subprocess.CompletedProcess([], 1)
                    self.script.main()
            code = run.call_args.kwargs['input'].replace('/etc/asterisk', directory)
            with mock.patch.dict(os.environ, ASTERISK_SIP_UDP_PORT='23002',
                                 ASTERISK_SIP_PORT='20132', ASTERISK_SIPS_PORT='20133'):
                exec(compile(code, '<container bindings>', 'exec'), {})
            self.assertIn('bind=0.0.0.0:23002', transports.read_text())
            self.assertIn('bind=0.0.0.0:20132', transports.read_text())
            self.assertIn('bind=0.0.0.0:20133', transports.read_text())
            self.assertEqual(custom.read_text(), 'custom bindings are user-owned\n')


if __name__ == '__main__':
    unittest.main()
