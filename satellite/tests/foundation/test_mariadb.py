"""Real repository read on the disposable database prepared by PHP migration tests."""
import os
from contextlib import contextmanager

import pytest
from voice_agent.repository import PublishedRepository


@pytest.mark.skipif(not os.getenv('M0_TEST_PORT'), reason='disposable MariaDB not selected')
def test_reader_loads_only_published_snapshot():
    import mysql.connector
    repository = PublishedRepository(lambda: mysql.connector.connect(
        host='127.0.0.1', port=int(os.environ['M0_TEST_PORT']),
        user='m0_reader', password='', connection_timeout=5))
    snapshot = repository.load('basic_voice')
    assert snapshot['workflow_version'] == 1
    assert snapshot['destination_id'] == 'agent:basic_voice'
    with pytest.raises(ValueError, match='agent_unavailable'):
        repository.load('unpublished_agent')


@pytest.mark.skipif(not os.getenv('M0_TEST_PORT'), reason='disposable MariaDB not selected')
def test_published_binding_secretbox_matches_php_and_directory_is_read_only(monkeypatch):
    import mysql.connector
    import voice_agent.storage as module
    @contextmanager
    def config_only(role):
        assert role == 'config'
        db = mysql.connector.connect(host='127.0.0.1',port=int(os.environ['M0_TEST_PORT']),user='m0_reader',password='')
        try:
            yield db
        finally:
            db.close()
    monkeypatch.setattr(module,'database',config_only)
    monkeypatch.setenv('SATELLITE_AGENT_CONFIG_KEY','synthetic-disposable-key')
    monkeypatch.setenv('OPENAI_API_KEY','synthetic-environment-key')
    with config_only('config') as db:
        cursor = db.cursor()
        cursor.execute("SELECT binding_id FROM asterisk.voice_agent_runtime_bindings WHERE JSON_UNQUOTE(JSON_EXTRACT(settings_json,'$.openai_project_id'))='proj_test'")
        binding_id = cursor.fetchone()[0]
        with pytest.raises(mysql.connector.Error):
            cursor.execute('SELECT secrets_encrypted FROM asterisk.voice_agent_bindings LIMIT 0')
        cursor.close()
    storage = module.Storage()
    binding = storage.binding(binding_id)
    assert binding['api_key'] == 'synthetic-api'
    assert binding['trunk_name'].startswith('VoiceAgentTrunk_')
    assert storage.targets() == [{'id':'extension:203','name':'Test extension'}]
    from voice_agent.tools import DEFINITIONS
    from voice_agent.tools import SUPPORTED
    assert sorted(storage.tools(),key=lambda row:(row['id'],row['version']))==sorted(SUPPORTED.values(),key=lambda row:(row['id'],row['version']))
    repository = PublishedRepository(lambda: mysql.connector.connect(
        host='127.0.0.1',port=int(os.environ['M0_TEST_PORT']),user='m0_reader',password=''))
    snapshot=repository.load('receptionist')
    assert snapshot['contract_version']==8
    assert [binding['tool_id'] for binding in snapshot['tool_bindings']]==['pbx.find_destinations','pbx.transfer','pbx.find_recent_callers','telephony.hangup']
    assert snapshot['tool_bindings'][1]['config']['ivrs_enabled'] is False
    assert snapshot['debug']['transcription_enabled'] is False
    assert snapshot['tool_bindings'][0]['config']=={'max_results':2}


@pytest.mark.skipif(not os.getenv('M0_TEST_PORT'),reason='disposable MariaDB not selected')
def test_environment_binding_reads_key_only_at_admission(monkeypatch):
    import mysql.connector
    import voice_agent.storage as module
    @contextmanager
    def config_only(role):
        assert role=='config'
        db=mysql.connector.connect(host='127.0.0.1',port=int(os.environ['M0_TEST_PORT']),user='m0_reader',password='')
        try: yield db
        finally: db.close()
    monkeypatch.setattr(module,'database',config_only)
    monkeypatch.setenv('SATELLITE_AGENT_CONFIG_KEY','synthetic-disposable-key')
    monkeypatch.setenv('OPENAI_API_KEY','synthetic-current-environment')
    with config_only('config') as db:
        cur=db.cursor()
        cur.execute("SELECT binding_id FROM asterisk.voice_agent_runtime_bindings WHERE JSON_UNQUOTE(JSON_EXTRACT(settings_json,'$.openai_project_id'))='proj_env'")
        binding_id=cur.fetchone()[0]
    assert module.Storage().binding(binding_id)['api_key']=='synthetic-current-environment'
    monkeypatch.delenv('OPENAI_API_KEY')
    with pytest.raises(ValueError,match='provider_credentials_unavailable'): module.Storage().binding(binding_id)
