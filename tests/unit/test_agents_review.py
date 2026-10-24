"""Regression checks for PBX update isolation and safe reload/restart helpers."""
import os
from pathlib import Path
import subprocess
import sys

import pytest


ROOT = Path(__file__).resolve().parents[2]


def test_agent_install_failure_does_not_skip_core_updates(tmp_path):
    empty = tmp_path / 'empty.php'
    empty.write_text('<?php')
    source = (ROOT / 'freepbx/initdb.d/update.php').read_text()
    source = source.replace("include_once '/etc/freepbx_db.conf';", '')
    for name in ('Schema', 'RuntimeAccounts'):
        source = source.replace(f"'/var/www/html/freepbx/rest/lib/agents/{name}.php'", repr(str(empty)))
    update = tmp_path / 'update.php'
    update.write_text(source)
    driver = tmp_path / 'driver.php'
    driver.write_text('''<?php
namespace NethVoice\\Agents {
    class Schema { public static function install($db) { throw new \\RuntimeException('synthetic_agent_failure'); } }
    class RuntimeAccounts { public static function install() {} }
}
namespace {
    class Statement {
        public function execute($args=[]) { return true; }
        public function fetchColumn() { return 0; }
        public function fetchAll($mode) { return []; }
        public function fetch($mode) { return false; }
        public function rowCount() { return 0; }
        public function closeCursor() { return true; }
    }
    class Database {
        public array $queries=[];
        public function prepare($sql) { $this->queries[]=$sql; return new Statement(); }
        public function query($sql) { return $this->prepare($sql); }
        public function exec($sql) { $this->queries[]=$sql; return 0; }
    }
    $db=new Database();
    include __DIR__.'/update.php';
    assert(count(array_filter($db->queries,fn($sql)=>str_contains($sql,'required_tables')))===1);
    echo 'all core updates completed';
}
''')
    result = subprocess.run(['php', '-d', 'zend.assertions=1', '-d', 'assert.exception=1', str(driver)],
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert 'all core updates completed' in result.stdout
    assert 'Voice agent setup failed' in result.stderr


@pytest.mark.parametrize('busy,expected_attempts,status', [('yes', 2, 0), ('no', 1, 2)])
def test_agent_reload_retries_only_the_freepbx_lock(tmp_path, busy, expected_attempts, status):
    counter = tmp_path / 'attempts'
    stub = tmp_path / 'fwconsole'
    stub.write_text(f'''#!{sys.executable}
import os
from pathlib import Path
counter=Path(os.environ['TEST_COUNTER'])
attempts=int(counter.read_text()) if counter.exists() else 0
counter.write_text(str(attempts+1))
if os.environ['TEST_BUSY']=='yes':
    if attempts==0:
        print('Process is already running. Process ID : 42')
        raise SystemExit(255)
else:
    print('synthetic configuration failure')
    raise SystemExit(2)
''')
    stub.chmod(0o755)
    (tmp_path / 'sleep').write_text('#!/bin/sh\nexit 0\n')
    (tmp_path / 'sleep').chmod(0o755)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ['PATH'],
               TEST_COUNTER=str(counter), TEST_BUSY=busy)
    result = subprocess.run(['bash', str(ROOT / 'freepbx/var/www/html/freepbx/admin/modules/satellite/bin/voice-agent-reload')],
                            env=env, capture_output=True, text=True)
    assert result.returncode == status
    assert int(counter.read_text()) == expected_attempts


@pytest.mark.parametrize('mode,status', [('busy_then_idle', 0), ('unavailable', 1), ('invalid', 1)])
def test_wait_only_never_restarts_services_or_assumes_failed_queries_are_idle(tmp_path, mode, status):
    stub = tmp_path / 'podman'
    stub.write_text(f'''#!{sys.executable}
import os
from pathlib import Path
mode=os.environ['TEST_MODE']
if mode=='unavailable':
    raise SystemExit(1)
if mode=='invalid':
    print('unknown active calls')
else:
    counter=Path(os.environ['TEST_COUNTER'])
    count=int(counter.read_text()) if counter.exists() else 0
    counter.write_text(str(count+1))
    print(str(1 if count==0 else 0)+' active calls')
''')
    stub.chmod(0o755)
    (tmp_path / 'sleep').write_text('#!/bin/sh\nexit 0\n')
    (tmp_path / 'sleep').chmod(0o755)
    (tmp_path / 'systemctl').write_text('#!/bin/sh\ntouch "$TEST_RESTARTED"\n')
    (tmp_path / 'systemctl').chmod(0o755)
    env = dict(os.environ, PATH=str(tmp_path) + os.pathsep + os.environ['PATH'],
               TEST_COUNTER=str(tmp_path / 'attempts'), TEST_RESTARTED=str(tmp_path / 'restarted'), TEST_MODE=mode)
    result = subprocess.run(['bash', str(ROOT / 'imageroot/bin/restart-services-when-convenient'), '--wait-only'],
                            env=env, capture_output=True, text=True, timeout=5)
    assert result.returncode == status, result.stderr
    assert not (tmp_path / 'restarted').exists()
