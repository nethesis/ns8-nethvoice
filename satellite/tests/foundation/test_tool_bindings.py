"""Cross-plane v3 policies: typed per-agent settings never grant global access."""
import copy
import json
import subprocess
from unittest.mock import AsyncMock

import pytest
from test_contract import CONTRACT, ROOT
from voice_agent.contract import validate_snapshot
from voice_agent.tools import ToolRegistry


def snapshot():
    value = json.loads((CONTRACT / 'published-v8.example.json').read_text())
    value['tool_bindings'][0]['config']['max_results'] = 1
    value['tool_bindings'][1]['config'].update(extensions_enabled=True, extension_allowlist=['extension:203', 'extension:204'])
    return value


def test_v3_contract_and_manifest_copies():
    validate_snapshot(snapshot())
    for filename in ('published-v8.schema.json', 'tools-v5.json'):
        assert (CONTRACT / filename).read_bytes() == (ROOT / 'satellite/voice_agent' / filename).read_bytes()


@pytest.mark.parametrize('invalid', [None, 'boolean', 'limit', 'float_limit', 'duplicate', 'duplicate_variant', 'version', 'unknown', 'queue'])
def test_v3_php_python_configuration_parity(invalid):
    value = snapshot()
    if invalid == 'boolean': value['tool_bindings'][0]['enabled'] = 1
    if invalid == 'limit': value['tool_bindings'][0]['config']['max_results'] = 101
    if invalid == 'float_limit': value['tool_bindings'][0]['config']['max_results'] = 20.0
    if invalid == 'duplicate': value['tool_bindings'].append(copy.deepcopy(value['tool_bindings'][0]))
    if invalid == 'duplicate_variant':
        value['tool_bindings'][1] = copy.deepcopy(value['tool_bindings'][0])
        value['tool_bindings'][1]['enabled'] = False
    if invalid == 'version': value['tool_bindings'][0]['tool_version'] = 999
    if invalid == 'unknown': value['tool_bindings'][0]['config']['arbitrary'] = True
    if invalid == 'queue': value['tool_bindings'][1]['config']['extension_allowlist'] = ['queue:600']
    result = subprocess.run(['php', str(ROOT / 'freepbx/tests/agents/validate.php')],
                            input=json.dumps(value), text=True, capture_output=True)
    assert result.returncode == (1 if invalid else 0)
    if invalid:
        with pytest.raises(ValueError): validate_snapshot(value)
    else:
        assert validate_snapshot(value) == value


@pytest.mark.asyncio
async def test_v3_config_pins_limit_and_transfer_visibility():
    value = snapshot()
    targets = lambda: [{'id': 'extension:203', 'name': 'Allowed'},
                       {'id': 'extension:204', 'name': 'Also allowed'},
                       {'id': 'extension:205', 'name': 'Denied'}]
    controller = AsyncMock()
    registry = ToolRegistry(value, targets, controller)
    value['tool_bindings'][1]['config']['extension_allowlist'] = []
    assert len(registry.advertised()) == 2
    assert await registry.invoke('search', 'nv_pbx_find_destinations_v1', {}) == {'destinations': [{'id': 'extension:203', 'name': 'Allowed', 'description': ''}], 'next_offset': 1}
    assert await registry.invoke('deny', 'nv_pbx_transfer_v2', {'confirmed': True, 'destination_id': 'extension:205'}) == {'error': 'destination_denied'}
    controller.transfer.assert_not_awaited()
    disabled = snapshot()
    disabled['tool_bindings'][1]['enabled'] = False
    registry = ToolRegistry(disabled, targets, controller)
    assert len(registry.advertised()) == 1
    assert await registry.invoke('empty', 'pbx.find_destinations', {}) == {'destinations': [], 'next_offset': None}
    assert await registry.invoke('guess', 'pbx.transfer', {'confirmed': True, 'destination_id': 'extension:203'}) == {'error': 'tool_denied'}
    disabled['tool_bindings'][0]['enabled'] = False
    disabled['tool_bindings'][2]['enabled'] = False
    registry = ToolRegistry(disabled, targets, controller)
    assert registry.advertised() == []
    assert await registry.invoke('disabled', 'pbx.find_destinations', {}) == {'error': 'tool_denied'}
