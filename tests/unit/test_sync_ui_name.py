# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
import os
import types
import unittest
from pathlib import Path
from unittest import mock

from event_test_utils import load_script

SCRIPT = Path(__file__).resolve().parents[2] / 'imageroot' / 'bin' / 'sync-ui-name'


class FakeRedis:
    def __init__(self, name):
        self.name = name

    def get(self, key):
        return self.name if key == 'module/nethvoice3/ui_name' else None


class FakeAgent(types.ModuleType):
    def __init__(self, name=None):
        super().__init__('agent')
        self.env = {}
        self.name = name

    def redis_connect(self, use_replica=False):
        return FakeRedis(self.name)

    def set_env(self, name, value):
        self.env[name] = value


def run(arguments, ui_name=None):
    agent = FakeAgent(ui_name)
    with mock.patch('sys.argv', ['sync-ui-name', *arguments]), \
            mock.patch.dict(os.environ, {'MODULE_ID': 'nethvoice3'}), \
            mock.patch('subprocess.run') as run_command:
        load_script('sync_ui_name', SCRIPT, {'agent': agent})
    return agent.env['NETHVOICE_UI_NAME'], run_command.call_args.args[0]


class SyncUiNameTest(unittest.TestCase):
    def test_the_name_never_breaks_the_environment_file(self):
        cases = [
            (['Acme "Voice" $HOME \\ PBX'], None, 'Acme "Voice" $HOME  PBX'),
            (['L\'Azienda\nNETHVOICE_X=y'], None, "L'AziendaNETHVOICE_X=y"),
            (['"Sales'], None, 'Sales'),
            ([], '"\'\\', 'nethvoice3'),
            ([], 'Ufficio Rossi & Co.', 'Ufficio Rossi & Co.'),
            (['  '], None, 'nethvoice3'),
        ]
        for arguments, ui_name, expected in cases:
            with self.subTest(arguments=arguments, ui_name=ui_name):
                name, command = run(arguments, ui_name)
                self.assertEqual(name, expected)
                self.assertIn('NETHVOICE_UI_NAME=' + expected, command)


if __name__ == '__main__':
    unittest.main()
