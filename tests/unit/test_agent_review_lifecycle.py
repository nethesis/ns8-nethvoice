"""Clone lifecycle and container secret boundary, without live services."""

import runpy
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]


def test_clone_removes_transferred_satellite_volumes(monkeypatch, tmp_path):
    commands = []
    monkeypatch.chdir(tmp_path)
    (tmp_path / 'satellite_postgresql.pg_dump.gz').write_bytes(b'synthetic-dump')
    monkeypatch.setenv('NETHVOICE_FREEPBX_IMAGE', 'synthetic-freepbx')
    monkeypatch.setenv('NETHVOICE_MARIADB_PORT', '3306')
    credentials = {'SATELLITE_AGENT_CONFIG_KEY': 'synthetic-key', 'MARIADB_ROOT_PASSWORD': 'synthetic-password'}
    monkeypatch.setitem(sys.modules, 'agent', SimpleNamespace(read_envfile=lambda path: credentials))
    def run(command, **kwargs):
        commands.append(command)
        return SimpleNamespace(stdout='', returncode=0)
    monkeypatch.setattr(subprocess, 'run', run)
    runpy.run_path(str(ROOT / 'imageroot/actions/clone-module/22satellite_agents'))
    assert commands[0] == ['systemctl', '--user', 'stop', 'satellite.service', 'satellite-pgsql.service']
    assert commands[1] == ['podman', 'volume', 'rm', '--force', '--ignore', 'satellite_pgdata', 'satellite_agent_state']
    assert not (tmp_path / 'satellite_postgresql.pg_dump.gz').exists()


def test_satellite_has_only_explicit_secrets_and_database_ordering():
    unit = (ROOT / 'imageroot/systemd/user/satellite.service').read_text()
    assert '--env-file=' not in unit
    for name in ('MARIADB_ROOT_PASSWORD', 'AMPDBPASS', 'NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN', 'SATELLITE_WORKFLOW_DB_PASSWORD', 'SATELLITE_AGENT_CONFIG_KEY'):
        assert name not in unit
    for name in ('SATELLITE_PBX_DATA_TOKEN', 'SATELLITE_MONITORING_CONTENT_KEY', 'SATELLITE_APPLICATION_CONTENT_KEY'):
        assert '--env=' + name in unit
    assert '--env=HTTP_HOST=127.0.0.1' in unit
    assert 'Wants=satellite-pgsql.service' in unit
    assert 'ExecStartPre=runagent wait-satellite-pgsql' in unit
