import json
from unittest.mock import AsyncMock, MagicMock

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


def test_webhook_rejection_limit_is_per_client_and_expires(monkeypatch):
    from types import SimpleNamespace
    from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
    from voice_agent import runner

    now = [200]
    monkeypatch.setattr(runner, 'time', SimpleNamespace(monotonic=lambda: now[0]))
    webhook = AsyncMock(side_effect=ValueError('synthetic rejection'))
    app = create_app('synthetic-token', SimpleNamespace(sip_lab_enabled=True, webhook=webhook))
    app = ProxyHeadersMiddleware(app, trusted_hosts=runner.TRUSTED_FORWARDERS)
    proxy = TestClient(app, client=('127.0.0.1', 12345), headers={'X-Forwarded-For':'192.0.2.1'})
    bad_peer = TestClient(app, client=('192.0.2.1', 12345), headers={'X-Forwarded-For':'192.0.2.2'})
    path = '/satellite-webhooks/openai'
    for _ in range(runner.REJECTIONS_PER_SENDER):
        assert proxy.post(path).status_code == 403
    response = bad_peer.post(path)
    assert response.status_code == 429 and response.headers['Retry-After'] == str(runner.REJECTION_WINDOW)
    assert proxy.post(path, headers={'X-Forwarded-For':'192.0.2.2'}).status_code == 403
    webhook.side_effect = None
    webhook.return_value = {'status': 'accepted'}
    assert proxy.post(path).json() == {'status': 'accepted'}
    now[0] += runner.REJECTION_WINDOW
    webhook.side_effect = ValueError('synthetic rejection')
    assert proxy.post(path).status_code == 403


@pytest.mark.asyncio
async def test_webhook_limits_concurrent_requests_by_sender(monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from httpx import ASGITransport, AsyncClient
    from voice_agent import runner

    monkeypatch.setattr(runner, 'MAX_IN_FLIGHT_PER_SENDER', 2)
    webhook = AsyncMock(return_value={'status':'accepted'})
    app = create_app('synthetic-token', SimpleNamespace(sip_lab_enabled=True, webhook=webhook))
    path = '/satellite-webhooks/openai'
    entered, release = asyncio.Event(), asyncio.Event()
    pending = 0

    async def delayed_body():
        nonlocal pending
        pending += 1
        if pending == 2:
            entered.set()
        await release.wait()
        yield b'{}'

    async with AsyncClient(transport=ASGITransport(app=app, client=('192.0.2.1', 1)), base_url='http://lab') as sender:
        async with asyncio.TaskGroup() as tasks:
            deliveries = [tasks.create_task(sender.post(path, content=delayed_body())) for _ in range(2)]
            try:
                await asyncio.wait_for(entered.wait(), 1)
                assert (await sender.post(path)).status_code == 429
                async with AsyncClient(transport=ASGITransport(app=app, client=('192.0.2.2', 1)), base_url='http://lab') as other:
                    assert (await other.post(path)).status_code == 200
            finally:
                release.set()
        assert all(delivery.result().status_code == 200 for delivery in deliveries)
        assert (await sender.post(path)).status_code == 200


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
