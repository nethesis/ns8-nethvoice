# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path
import unittest
from unittest import mock

from event_test_utils import load_script

SCRIPT = Path(__file__).resolve().parents[2] / 'imageroot/actions/restore-module/68update_user_dbconn'


class RestoreDbconnTest(unittest.TestCase):
    def test_credentials_are_passed_through_environment_and_stdin(self):
        agent = mock.Mock()
        agent.read_envfile.return_value = {
            'MARIADB_ROOT_PASSWORD': 'private-root-password',
            'NETHCTI_DB_PASSWORD': 'private-cti-password',
            'AMPDBPASS': 'private-pbx-password',
        }
        with mock.patch.dict(os.environ, NETHVOICE_MARIADB_PORT='20100',
                             NETHCTI_DB_USER='nethcti', AMPDBUSER='freepbx'), \
                mock.patch('subprocess.run') as run:
            load_script('restore_dbconn', SCRIPT, {'agent': agent})
        agent.run_helper.assert_called_once_with('systemctl', '--user', 'start', 'mariadb.service')
        run.assert_called_once()
        args = run.call_args.args[0]
        kwargs = run.call_args.kwargs
        for secret in agent.read_envfile.return_value.values():
            self.assertNotIn(secret, ' '.join(args))
        self.assertIn('MYSQL_PWD', args)
        self.assertEqual(kwargs['env']['MYSQL_PWD'], 'private-root-password')
        self.assertIn('private-cti-password', kwargs['input'])
        self.assertIn('private-pbx-password', kwargs['input'])
        self.assertEqual(kwargs['input'].count('INSERT INTO user_dbconn'), 2)
        self.assertTrue(kwargs['check'])


if __name__ == '__main__':
    unittest.main()
