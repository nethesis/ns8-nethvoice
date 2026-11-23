"""Exercise the ARI caller over TCP and verify ownership-scoped cleanup."""
import asyncio
import json
from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer

from diagnostics import call_probe
from diagnostics.rtp import SyntheticRTP
from diagnostics.scoped_runner import fingerprint


@pytest.mark.asyncio
@pytest.mark.parametrize('fail_originate', [False, True])
async def test_caller_uses_actual_route_and_only_removes_its_resources(monkeypatch, tmp_path, fail_originate):
    snapshot = {'agent_id': 'receptionist', 'conversation': {'model': 'gpt-live-1'}}
    monkeypatch.setattr(call_probe, 'Storage', lambda: SimpleNamespace(snapshot=lambda _: snapshot))
    monkeypatch.setattr(call_probe, 'ARM', tmp_path / 'arm.json')
    monkeypatch.setattr(call_probe, 'ROOT', tmp_path)
    attempts = []
    monkeypatch.setattr(call_probe, 'reserve_session', lambda case: attempts.append(case) or 1)

    @contextmanager
    def database(_):
        @contextmanager
        def cursor(**_):
            yield SimpleNamespace(execute=lambda *args: None, fetchall=lambda: [])
        yield SimpleNamespace(cursor=cursor)
    monkeypatch.setattr(call_probe, 'database', database)

    class ShortRTP(SyntheticRTP):
        async def stream(self, speech):
            await super().stream(speech, duration=.06, speech_at=0)
    monkeypatch.setattr(call_probe, 'SyntheticRTP', ShortRTP)
    state = {'channels': [], 'ws': None, 'deleted': [], 'originated': None, 'result_task': None, 'created': []}

    async def delayed_result(label):
        await asyncio.sleep(.05)
        (tmp_path / ('live-diagnostic-result-' + label + '.json')).write_text(json.dumps({'variant': 'current'}))

    async def events(request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        state['ws'] = ws
        async for _ in ws:
            pass
        return ws

    async def ari(request):
        path = request.path.removeprefix('/ari')
        if request.method == 'DELETE':
            state['deleted'].append(path)
            state['channels'] = [c for c in state['channels'] if c['id'] != path.split('/')[-1]]
            if not fail_originate and not state['channels'] and state['result_task'] is None:
                label = state['label']
                state['result_task'] = asyncio.create_task(delayed_result(label))
            return web.Response(status=204)
        if request.method == 'GET':
            if path == '/channels':
                return web.json_response(state['channels'])
            assert path.endswith('/variable')
            return web.json_response({'value': '12345' if request.query['variable'].endswith('PORT') else '127.0.0.1'})
        if path == '/channels/externalMedia':
            assert len(request.query['channelId']) <= 30
            state['created'].append('/channels/' + request.query['channelId'])
            state['channels'].append({'id': request.query['channelId']})
        elif path == '/channels':
            assert all(len(request.query[key] + ';2') <= 32 for key in ('channelId', 'otherChannelId'))
            state['originated'] = dict(request.query)
            state['label'] = json.loads(call_probe.ARM.read_text())['label']
            state['created'].extend('/channels/' + request.query[key] for key in ('channelId', 'otherChannelId'))
            arm = json.loads(call_probe.ARM.read_text())
            assert arm['linkedid'] == request.query['channelId']
            assert arm['agent_channel_id'] == request.query['otherChannelId']
            from diagnostics.scoped_runner import select_call
            from types import SimpleNamespace
            assert select_call(SimpleNamespace(linkedid=arm['linkedid'], caller_id=arm['agent_channel_id'], snapshot=snapshot), arm) == arm
            if fail_originate:
                return web.Response(status=500)
            state['channels'].extend({'id': request.query[key]} for key in ('channelId', 'otherChannelId'))
            for _ in range(2):
                await state['ws'].send_json({'type': 'StasisStart', 'channel': {'id': request.query['channelId']}})
        elif path.startswith('/bridges/') and path.count('/') == 2:
            state['created'].append(path)
        return web.json_response({})

    app = web.Application()
    app.router.add_get('/ari/events', events)
    app.router.add_route('*', '/ari/{path:.*}', ari)
    server = TestServer(app)
    await server.start_server()
    monkeypatch.setenv('ASTERISK_URL', str(server.make_url('')).rstrip('/'))
    monkeypatch.setenv('ARI_USERNAME', 'test-user')
    monkeypatch.setenv('SATELLITE_ARI_PASSWORD', 'test-password')
    try:
        if fail_originate:
            with pytest.raises(RuntimeError, match='ari_request_failed'):
                await call_probe.probe('current', fingerprint(snapshot), b'\xff' * 160)
        else:
            result = await call_probe.probe('current', fingerprint(snapshot), b'\xff' * 160)
            assert result['all_channels_zero']
            assert result['caller_audio']['sent_packets'] == 3
            assert result['provider']['variant'] == 'current'
        assert attempts == ['current']
        assert state['originated']['endpoint'] == 'Local/7777@from-internal/n'
        assert not state['channels'] and not call_probe.ARM.exists()
        assert len(state['deleted']) == 4
        assert len(set(state['deleted'])) == 4
        assert set(state['deleted']) == set(state['created'])
    finally:
        if state['result_task']:
            await state['result_task']
        await server.close()
