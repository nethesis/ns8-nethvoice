"""One application, private listeners, optional transcription and graceful signals."""
import asyncio
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

import main
import transcription


@pytest.fixture
def resources(monkeypatch):
    monkeypatch.setenv('DEEPGRAM_API_KEY', 'synthetic-test')
    monkeypatch.setenv('ARI_APP', 'satellite')
    monkeypatch.delenv('GOOGLE_APPLICATION_CREDENTIALS', raising=False)
    rtp, mqtt, ari = AsyncMock(), AsyncMock(), AsyncMock()
    mqtt.set_callback = MagicMock()
    monkeypatch.setattr(transcription, 'RTPServer', MagicMock(return_value=rtp))
    monkeypatch.setattr(transcription, 'MQTTClient', MagicMock(return_value=mqtt))
    monkeypatch.setattr(transcription, 'AsteriskBridge', MagicMock(return_value=ari))
    return rtp, mqtt, ari


@pytest.mark.asyncio
async def test_transcription_pipeline_starts_and_cleans_up(resources, monkeypatch):
    monkeypatch.delenv('ARI_APP')
    stop = asyncio.Event()
    rtp, mqtt, ari = resources
    ari.connect.side_effect = stop.set
    await transcription.run(stop)
    rtp.start.assert_awaited_once()
    mqtt.connect.assert_awaited_once()
    mqtt.subscribe.assert_awaited_once_with('transcription/control')
    ari.connect.assert_awaited_once()
    assert transcription.AsteriskBridge.call_args.kwargs['app'] == 'asterisk_dialogflow'
    control = mqtt.set_callback.call_args.args[0]
    await control('ignored', {'action': 'start', 'linkedid': 'call-id'})
    await control('ignored', {'action': 'stop', 'uniqueid': 'call-id'})
    ari.start_transcription.assert_awaited_once_with('call-id')
    ari.stop_transcription.assert_awaited_once_with('call-id')
    ari.disconnect.assert_awaited_once()
    rtp.stop.assert_awaited_once()
    mqtt.disconnect.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("cancel_owner", [False, True])
async def test_slow_transcription_finalizer_releases_resources_before_mqtt_shutdown(resources, monkeypatch, cancel_owner):
    from types import SimpleNamespace
    from asterisk_bridge import AsteriskBridge
    from deepgram_connector import DeepgramConnector

    stop, finalizing = asyncio.Event(), asyncio.Event()
    rtp, mqtt, _ = resources
    bridge = AsteriskBridge("http://ari", "test", "user", "pass", mqtt, rtp)
    connector = DeepgramConnector("synthetic", None, None, mqtt, "call")
    connector.complete_call = [{"speaker_name": "caller", "transcription": "final words"}]

    async def stuck_finalize():
        finalizing.set()
        await asyncio.Event().wait()

    connector.dg_connection = SimpleNamespace(finalize=stuck_finalize, _socket=AsyncMock())
    bridge.channels["caller"] = {"connector": connector, "snoop_channel_in": "snoop"}
    bridge.connect = AsyncMock(side_effect=stop.set)
    bridge._ari_request = AsyncMock()
    bridge.session, bridge.ws = AsyncMock(), AsyncMock()
    monkeypatch.setattr(transcription, "AsteriskBridge", lambda **kwargs: bridge)
    monkeypatch.setattr("deepgram_connector.CLOSE_IO_TIMEOUT", 0.03)
    # Reproduce a provider operation lasting longer than the old ten-second outer deadline.
    timeout = asyncio.timeout
    monkeypatch.setattr(asyncio, "timeout", lambda seconds: timeout(0.01 if seconds == 10 else seconds))

    async def close_mqtt():
        mqtt.publish.assert_awaited_once()
        connector.dg_connection._socket.close.assert_awaited_once()
        bridge._ari_request.assert_awaited_once_with("DELETE", "/channels/snoop")
        bridge.session.close.assert_awaited_once()
        assert not bridge._closing_channels

    mqtt.disconnect.side_effect = close_mqtt
    task = asyncio.create_task(transcription.run(stop))
    await asyncio.wait_for(finalizing.wait(), 1)
    if cancel_owner:
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await asyncio.wait_for(task, 2)
    else:
        await asyncio.wait_for(task, 2)
    mqtt.disconnect.assert_awaited_once()
    await close_mqtt()


@pytest.mark.asyncio
async def test_stop_interrupts_mqtt_startup_and_cleans_partial_resources(resources):
    stop, connecting = asyncio.Event(), asyncio.Event()
    rtp, mqtt, ari = resources

    async def unavailable():
        connecting.set()
        await asyncio.Event().wait()

    mqtt.connect.side_effect = unavailable
    task = asyncio.create_task(transcription.run(stop))
    await asyncio.wait_for(connecting.wait(), 1)
    stop.set()
    await asyncio.wait_for(task, 1)
    ari.connect.assert_not_awaited()
    ari.disconnect.assert_awaited_once()
    mqtt.disconnect.assert_awaited_once()
    rtp.stop.assert_awaited_once()


@pytest.mark.asyncio
async def test_transcription_retries_initial_ari_failure(resources, monkeypatch):
    stop = asyncio.Event()
    rtp, mqtt, ari = resources
    attempts = 0

    async def connect():
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise ConnectionError('synthetic unavailable ARI')
        stop.set()

    ari.connect.side_effect = connect
    monkeypatch.setattr(transcription.asyncio, 'sleep', AsyncMock())
    await transcription.run(stop)
    assert attempts == 2
    assert ari.disconnect.await_count == mqtt.disconnect.await_count == rtp.stop.await_count == 2


def test_transcription_api_bind_is_private(monkeypatch):
    monkeypatch.delenv('HTTP_HOST', raising=False)
    assert main.api_server_settings()['host'] == '127.0.0.1'
    monkeypatch.setenv('HTTP_HOST', '127.0.0.2')
    monkeypatch.setenv('HTTP_PORT', '8765')
    assert main.api_server_settings()['port'] == 8765
    monkeypatch.setenv('HTTP_HOST', '0.0.0.0')
    with pytest.raises(ValueError, match='loopback_bind_required'):
        main.api_server_settings()


def free_port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


@pytest.mark.parametrize('voice,call,voicemail', [
    (False, None, None), (False, 'False', 'False'), (True, 'False', 'False'),
    (True, 'True', 'False'), (True, 'False', 'True'), (True, 'True', 'True'),
])
@pytest.mark.parametrize('stop_signal', [signal.SIGTERM, signal.SIGINT])
def test_single_process_endpoints_and_shutdown(tmp_path, voice, call, voicemail, stop_signal):
    agent_port, api_port = free_port(), free_port()
    while api_port == agent_port:
        api_port = free_port()
    env = {key: value for key, value in os.environ.items()
           if not key.startswith(('PGVECTOR_', 'VOICE_AGENT_', 'SATELLITE_'))
           and key not in ('GOOGLE_APPLICATION_CREDENTIALS', 'OPENAI_API_KEY')}
    env.update(VOICE_AGENT_HTTP_PORT=str(agent_port), VOICE_AGENT_HTTP_HOST='127.0.0.1',
               HTTP_HOST='127.0.0.1', HTTP_PORT=str(api_port), API_TOKEN='synthetic-api',
               ASTERISK_URL='http://127.0.0.1:1', ARI_USERNAME='synthetic-ari',
               ARI_APP='satellite', DEEPGRAM_API_KEY='synthetic-deepgram', MQTT_URL='mqtt://127.0.0.1:1',
               RTP_HOST='127.0.0.1', RTP_PORT='0', LOG_LEVEL='WARNING')
    if voice:
        env.update(VOICE_AGENT_ENABLED='true', VOICE_AGENT_RUNTIME_TOKEN='synthetic-token',
                   SATELLITE_ARI_PASSWORD='synthetic-ari')
    if call is not None:
        env.update(SATELLITE_CALL_TRANSCRIPTION_ENABLED=call,
                   SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED=voicemail)
    enabled = (call is None and voicemail is None) or 'True' in (call, voicemail)
    process = subprocess.Popen([sys.executable, str(Path(main.__file__))], cwd=tmp_path,
                               env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        with httpx.Client(timeout=0.3, trust_env=False) as client:
            agent_url = f'http://127.0.0.1:{agent_port}'
            api_url = f'http://127.0.0.1:{api_port}'
            def wait_for_signal_handlers():
                # The no-listener configuration still needs to handle both signals.
                status = Path(f'/proc/{process.pid}/status').read_text()
                caught = next(line.split()[1] for line in status.splitlines() if line.startswith('SigCgt:'))
                return int(caught, 16) & (1 << (signal.SIGTERM - 1))

            deadline = time.monotonic() + 15
            while True:
                assert process.poll() is None, process.communicate()
                try:
                    if ((not voice or client.get(agent_url + '/internal/ready').status_code == 401)
                            and (not enabled or client.get(api_url + '/metrics').status_code == 401)
                            and wait_for_signal_handlers()):
                        break
                except httpx.TransportError:
                    pass
                assert time.monotonic() < deadline, 'HTTP startup timed out'
                time.sleep(0.05)
            if voice:
                assert client.get(agent_url + '/internal/ready', headers={
                    'Authorization': 'Bearer synthetic-token'}).status_code == 200
                assert client.get(agent_url + '/api/get_transcription').status_code == 404
                assert client.post(agent_url + '/satellite-webhooks/unexpected').status_code == 404
            else:
                with pytest.raises(httpx.TransportError):
                    client.get(agent_url + '/internal/ready')
            if enabled:
                assert client.get(api_url + '/metrics', headers={'X-API-Token': 'synthetic-api'}).status_code == 200
                assert client.get(api_url + '/internal/ready').status_code == 404
                assert client.post(api_url + '/satellite-webhooks/openai').status_code == 404
            else:
                with pytest.raises(httpx.TransportError):
                    client.get(api_url + '/metrics')
            assert not Path(f'/proc/{process.pid}/task/{process.pid}/children').read_text().strip()
        process.send_signal(stop_signal)
        _, errors = process.communicate(timeout=10)
        assert process.returncode == 0, errors.decode()
        assert b'Unclosed client session' not in errors
        assert b'Task was destroyed' not in errors
    finally:
        if process.poll() is None:
            process.kill()
            process.communicate()


@pytest.mark.asyncio
async def test_transcription_recovery_preserves_running_agent_calls(resources, monkeypatch):
    from types import SimpleNamespace
    from voice_agent.runner import create_app

    rtp, mqtt, ari = resources
    runtime = SimpleNamespace(start=AsyncMock(), stop=AsyncMock(),
                              controller=SimpleNamespace(connected=True),
                              monitoring=SimpleNamespace(degraded=False), calls={'active-call': object()})
    active_call = runtime.calls['active-call']
    monkeypatch.setattr(main, 'app_from_env', lambda: create_app('synthetic-token', runtime))
    agent_port, api_port = free_port(), free_port()
    monkeypatch.setenv('VOICE_AGENT_HTTP_PORT', str(agent_port))
    monkeypatch.setenv('VOICE_AGENT_HTTP_HOST', '127.0.0.1')
    monkeypatch.setenv('VOICE_AGENT_ENABLED', 'true')
    monkeypatch.setenv('HTTP_PORT', str(api_port))
    monkeypatch.setenv('HTTP_HOST', '127.0.0.1')
    monkeypatch.setenv('SATELLITE_CALL_TRANSCRIPTION_ENABLED', 'True')
    monkeypatch.setenv('SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED', 'False')
    monkeypatch.setattr(asyncio.get_running_loop(), 'add_signal_handler', MagicMock())
    monkeypatch.setattr(asyncio.get_running_loop(), 'remove_signal_handler', MagicMock())
    recovered = asyncio.Event()
    attempts = 0

    async def connect():
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise ConnectionError('synthetic transcription ARI outage')
        recovered.set()

    ari.connect.side_effect = connect
    stop = asyncio.Event()
    application = asyncio.create_task(main.run(stop))
    try:
        async with httpx.AsyncClient(timeout=0.5, trust_env=False) as client:
            async with asyncio.timeout(3):
                while True:
                    try:
                        response = await client.get(f'http://127.0.0.1:{agent_port}/internal/ready',
                            headers={'Authorization': 'Bearer synthetic-token'})
                        if response.status_code == 200:
                            break
                    except httpx.TransportError:
                        pass
                    await asyncio.sleep(0.01)
            assert response.json()['voice_calls_enabled'] is True
            await asyncio.wait_for(recovered.wait(), 7)
            assert runtime.calls['active-call'] is active_call
            runtime.start.assert_awaited_once()
            runtime.stop.assert_not_awaited()
            assert (await client.get(f'http://127.0.0.1:{agent_port}/internal/ready', headers={
                'Authorization': 'Bearer synthetic-token'})).json()['voice_calls_enabled'] is True
    finally:
        stop.set()
        await asyncio.wait_for(application, 3)
    runtime.stop.assert_awaited_once()
    assert rtp.stop.await_count == mqtt.disconnect.await_count == ari.disconnect.await_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', ['settings', 'lifespan', 'bind', 'collision'])
async def test_voice_startup_failure_preserves_transcription(resources, monkeypatch, caplog, failure):
    from types import SimpleNamespace
    from voice_agent.runner import create_app

    rtp, _, ari = resources
    connected = asyncio.Event()
    ari.connect.side_effect = connected.set
    runtime = SimpleNamespace(start=AsyncMock(), stop=AsyncMock())
    if failure == 'lifespan':
        runtime.start.side_effect = RuntimeError('synthetic startup failure')
    monkeypatch.setattr(main, 'app_from_env', lambda: create_app(
        '' if failure == 'settings' else 'synthetic-token', runtime))
    api_port, agent_port = free_port(), free_port()
    while api_port == agent_port:
        agent_port = free_port()
    monkeypatch.setenv('VOICE_AGENT_ENABLED', 'true')
    monkeypatch.setenv('VOICE_AGENT_HTTP_HOST', '127.0.0.1')
    monkeypatch.setenv('HTTP_HOST', '127.0.0.1')
    monkeypatch.setenv('HTTP_PORT', str(api_port))
    monkeypatch.setenv('API_TOKEN', 'synthetic-api')
    monkeypatch.setenv('SATELLITE_CALL_TRANSCRIPTION_ENABLED', 'true')
    stop = asyncio.Event()
    with socket.socket() as occupied:
        if failure == 'bind':
            occupied.bind(('127.0.0.1', agent_port))
            occupied.listen()
        monkeypatch.setenv('VOICE_AGENT_HTTP_PORT', str(api_port if failure == 'collision' else agent_port))
        application = asyncio.create_task(main.run(stop))
        try:
            await asyncio.wait_for(connected.wait(), 3)
            async with httpx.AsyncClient(timeout=0.5, trust_env=False) as client:
                async with asyncio.timeout(3):
                    while 'voice-agents ' not in caplog.text:
                        await asyncio.sleep(0.01)
                    while True:
                        try:
                            response = await client.get(f'http://127.0.0.1:{api_port}/metrics',
                                                        headers={'X-API-Token': 'synthetic-api'})
                            assert response.status_code == 200
                            break
                        except httpx.TransportError:
                            await asyncio.sleep(0.01)
            assert not application.done()
            rtp.stop.assert_not_awaited()
        finally:
            stop.set()
            await asyncio.wait_for(application, 3)
    rtp.stop.assert_awaited_once()
    if failure in ('lifespan', 'bind'):
        runtime.start.assert_awaited_once()
        runtime.stop.assert_awaited_once()
    else:
        runtime.start.assert_not_awaited()


@pytest.mark.asyncio
async def test_only_enabled_component_failure_is_fatal(monkeypatch):
    from voice_agent.runner import create_app

    monkeypatch.setenv('VOICE_AGENT_ENABLED', 'true')
    monkeypatch.setenv('SATELLITE_CALL_TRANSCRIPTION_ENABLED', 'false')
    monkeypatch.setenv('SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED', 'false')
    monkeypatch.setattr(main, 'app_from_env', lambda: create_app(''))
    with pytest.raises(RuntimeError, match='All configured Satellite components stopped'):
        await main.run()


@pytest.mark.asyncio
async def test_transcription_cannot_use_voice_agent_ari_app(resources, monkeypatch):
    monkeypatch.setenv('ARI_APP', 'voice-agent')
    with pytest.raises(ValueError, match='transcription_ari_app_must_differ'):
        await transcription.run(asyncio.Event())
