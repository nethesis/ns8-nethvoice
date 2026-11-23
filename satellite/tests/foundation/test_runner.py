import json
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from voice_agent.runner import create_app, settings
from voice_agent.repository import PublishedRepository
from test_contract import CONTRACT


def test_private_runner_has_no_transcription_or_configuration_api(monkeypatch):
    monkeypatch.delenv('DEEPGRAM_API_KEY', raising=False)
    client = TestClient(create_app('synthetic-token'))
    assert client.get('/internal/ready').status_code == 401
    response = client.get('/internal/ready', headers={'Authorization': 'Bearer synthetic-token'})
    assert response.json()['voice_calls_enabled'] is False
    for path in ['/docs', '/openapi.json', '/api/get_transcription', '/configuration',
                 '/satellite-webhooks/unexpected']:
        assert client.get(path).status_code == 404
    with pytest.raises(ValueError):
        create_app('')


def test_bind_is_actually_private(monkeypatch):
    monkeypatch.setenv('VOICE_AGENT_HTTP_HOST', '127.0.0.1')
    monkeypatch.setenv('VOICE_AGENT_HTTP_PORT', '8765')
    assert settings() == ('127.0.0.1', 8765)
    monkeypatch.setenv('VOICE_AGENT_HTTP_HOST', '0.0.0.0')
    with pytest.raises(ValueError, match='loopback_bind_required'):
        settings()


def test_published_repository_pins_and_checks_database_identity():
    snapshot = json.loads((CONTRACT / 'published-v8.example.json').read_text())
    db = MagicMock()
    cursor = db.cursor.return_value
    row = {k: snapshot[k] for k in ['agent_id', 'destination_id', 'workflow_version', 'contract_version']}
    row['definition_json'] = json.dumps(snapshot)
    cursor.fetchone.return_value = row
    repo = PublishedRepository(lambda: db)
    pinned = repo.load(snapshot['agent_id'])
    row['definition_json'] = '{}'
    assert pinned == snapshot
    cursor.execute.assert_called_with(
        'SELECT agent_id, destination_id, workflow_version, contract_version, definition_json '
        'FROM asterisk.voice_agent_published WHERE agent_id = %s', (snapshot['agent_id'],))
    with pytest.raises(ValueError, match='invalid_snapshot'):
        repo.load(snapshot['agent_id'])
    cursor.fetchone.return_value = None
    with pytest.raises(ValueError, match='agent_unavailable'):
        repo.load(snapshot['agent_id'])
    assert db.close.call_count == 3
