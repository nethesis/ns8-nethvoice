# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / 'imageroot/actions/configure-module/80start_services'


class ConfigureServicesTest(unittest.TestCase):
    def run_configure(self, *, active=True, fail=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stub = root / 'stub'
            stub.write_text(f'#!{sys.executable}\n' + '''import json,os,sys
from pathlib import Path
name=Path(sys.argv[0]).name
args=sys.argv[1:]
with open(os.environ['TEST_CALLS'],'a') as output:
    output.write(json.dumps([name,*args])+'\\n')
if name=='systemctl' and args==['--user','is-active','mariadb.service']:
    active=os.environ['TEST_DB_ACTIVE']=='1'
    print('active' if active else 'inactive')
    sys.exit(0 if active else 3)
if name=='runagent' and args==['mysql-update-postprocess'] and os.environ['TEST_PREP_FAIL']=='1':
    sys.exit(17)
''')
            stub.chmod(0o755)
            for name in ['systemctl','runagent']:
                (root/name).symlink_to(stub)
            calls=root/'calls'
            result=subprocess.run(['bash',str(SCRIPT)],capture_output=True,text=True,
                                  env=dict(os.environ,PATH=str(root)+':'+os.environ['PATH'],
                                           TEST_CALLS=str(calls),TEST_DB_ACTIVE=str(int(active)),
                                           TEST_PREP_FAIL=str(int(fail)),NETHVOICE_HOTEL='False',
                                           SATELLITE_CALL_TRANSCRIPTION_ENABLED='False',
                                           SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED='False'))
            return result,[json.loads(line) for line in calls.read_text().splitlines()]

    def test_existing_database_and_apps_restart_once_after_preparation(self):
        result,calls=self.run_configure()
        self.assertEqual(result.returncode,0,result.stderr)
        restarts=[call for call in calls if call[:3]==['systemctl','--user','try-restart']]
        self.assertEqual(len(restarts),1)
        self.assertIn('mariadb.service',restarts[0])
        self.assertIn('freepbx.service',restarts[0])
        self.assertLess(calls.index(['runagent','mysql-update-postprocess']),
                        calls.index(['runagent','prepare-asterisk-config']))
        self.assertLess(calls.index(['runagent','prepare-asterisk-config']),calls.index(restarts[0]))

    def test_fresh_database_is_started_before_preparation_without_an_extra_restart(self):
        result,calls=self.run_configure(active=False)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertLess(calls.index(['systemctl','--user','enable','--now','mariadb.service']),
                        calls.index(['runagent','mysql-update-postprocess']))
        for call in calls:
            if 'try-restart' in call:
                self.assertNotIn('mariadb.service',call)

    def test_database_failure_prevents_all_application_restarts(self):
        result,calls=self.run_configure(fail=True)
        self.assertEqual(result.returncode,17)
        self.assertFalse(any('try-restart' in call for call in calls))
        self.assertNotIn(['runagent','prepare-asterisk-config'],calls)


if __name__=='__main__':
    unittest.main()
