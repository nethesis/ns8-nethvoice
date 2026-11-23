import copy
import json
from unittest.mock import AsyncMock

import pytest
from test_contract import CONTRACT
from voice_agent.tools import ToolRegistry


@pytest.mark.asyncio
async def test_tools_enforce_pinned_grants_and_idempotency():
    snapshot = json.loads((CONTRACT / 'published-v8.example.json').read_text())
    snapshot['tool_bindings'][1]['config'].update(extensions_enabled=True, extension_allowlist=['extension:203'])
    controller = AsyncMock()
    targets = lambda: [{'id': 'extension:203', 'name': 'Test extension'}, {'id': 'extension:204', 'name': 'Other test extension'}]
    registry = ToolRegistry(snapshot, targets, controller)
    assert await registry.invoke('one', 'pbx.find_destinations', {}) == {'destinations': [{'id': 'extension:203', 'name': 'Test extension', 'description': ''}], 'next_offset': None}
    assert (await registry.invoke('two', 'pbx.transfer', {'destination_id': 'extension:204'}))['error'] == 'destination_denied'
    assert (await registry.invoke('three', 'pbx.transfer', {'context': 'arbitrary', 'destination_id': 'extension:203'}))['error'] == 'invalid_arguments'
    controller.transfer.return_value = {'outcome': 'transferred'}
    assert (await registry.invoke('four', 'pbx.transfer', {'destination_id': 'extension:203'}))['outcome'] == 'transferred'
    await registry.invoke('four', 'pbx.transfer', {'destination_id': 'extension:203'})
    controller.transfer.assert_awaited_once_with('extension:203')
    disabled = copy.deepcopy(snapshot)
    disabled['tool_bindings'][1]['enabled'] = False
    denied = ToolRegistry(disabled, targets, controller)
    assert (await denied.invoke('five', 'pbx.transfer', {'destination_id': 'extension:203'}))['error'] == 'tool_denied'
    snapshot['tool_bindings'][1]['enabled'] = False
    assert registry.snapshot['tool_bindings'][1]['enabled']
