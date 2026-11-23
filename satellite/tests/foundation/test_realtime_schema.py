"""The canonical routing contract is stricter than Realtime's schema dialect."""
import copy

import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer

from voice_agent.providers.realtime import OpenAIAdapter
from voice_agent.tools import DEFINITIONS


@pytest.mark.asyncio
async def test_realtime_projects_transfer_schema_without_mutating_the_manifest():
    original = copy.deepcopy(DEFINITIONS)
    accepted = []

    async def accept(request):
        body = await request.json()
        # Match the real provider rejection reproduced on Makako.
        if any('oneOf' in t['parameters'] for t in body['tools']):
            return web.json_response({'error': {'code': 'invalid_function_parameters'}}, status=400)
        accepted.append(body)
        return web.Response()

    app = web.Application()
    app.router.add_post('/calls/test/accept', accept)
    server = TestServer(app)
    await server.start_server()
    adapter = OpenAIAdapter({'api_key': 'synthetic'})
    adapter.http_base = str(server.make_url('')).rstrip('/')
    try:
        await adapter.accept('test', {'model': 'gpt-realtime-2.1'}, DEFINITIONS)
        transfer = next(t for t in accepted[0]['tools'] if t['name'] == 'nv_pbx_transfer_v2')
        expected = copy.deepcopy(original[1]['input_schema'])
        expected.pop('oneOf')
        expected['properties']['destination_id']['pattern'] = r'^(extension|queue):[0-9]{1,20}$(?![\s\S])'
        assert transfer['parameters'] == expected
        assert 'exactly one' in transfer['description']
        assert DEFINITIONS == original
    finally:
        await adapter.close()
        await server.close()


@pytest.mark.asyncio
async def test_realtime_rejects_an_unrecognized_transfer_schema_before_network():
    tools = copy.deepcopy(DEFINITIONS)
    tools[1]['input_schema']['oneOf'] = [{'required': ['untrusted']}]
    adapter = OpenAIAdapter({'api_key': 'synthetic'})
    class NoNetwork:
        def post(self, *args, **kwargs):
            pytest.fail('invalid schemas must not reach the provider')
    adapter._session = NoNetwork()
    with pytest.raises(ValueError, match='unsupported_realtime_tool_schema'):
        await adapter.accept('test', {'model': 'gpt-realtime-2.1'}, tools)
