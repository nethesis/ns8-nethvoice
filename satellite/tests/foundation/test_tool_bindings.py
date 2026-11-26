"""Cross-plane v3 policies: typed per-agent settings never grant global access."""
import copy
import json
import subprocess
from unittest.mock import AsyncMock, MagicMock

import pytest
from test_consultation import publication
from test_contract import CONTRACT, ROOT
from test_runtime import admit, fixtures
from voice_agent.contract import MAX_SNAPSHOT_BYTES, validate_snapshot
from voice_agent.repository import PublishedRepository
from voice_agent.tools import SUPPORTED, ToolRegistry


def snapshot():
    value = json.loads((CONTRACT / 'published-v8.example.json').read_text())
    value['tool_bindings'][0]['config']['max_results'] = 1
    value['tool_bindings'][1]['config'].update(extensions_enabled=True, extension_allowlist=['extension:203', 'extension:204'])
    return value


@pytest.fixture(params=[8, 9])
def historical_snapshot(request):
    value = snapshot() if request.param == 8 else publication()
    config = value['tool_bindings'][1]['config']
    config.update(extensions_enabled=True, extension_allowlist=['extension:203'], queues_enabled=True,
                  queue_denylist=['queue:601'])
    del config['queue_allowlist']
    return value


def historical_definitions():
    definitions = copy.deepcopy(list(SUPPORTED.values()))
    for item in definitions:
        if item['id'] == 'pbx.transfer':
            defaults = item['defaults']
            defaults['queue_denylist'] = defaults.pop('queue_allowlist')
            schema = item['configuration_schema']
            schema['required'][schema['required'].index('queue_allowlist')] = 'queue_denylist'
            field = schema['properties'].pop('queue_allowlist')
            field['title'] = 'Excluded queues'
            schema['properties']['queue_denylist'] = field
    return definitions


@pytest.mark.asyncio
async def test_historical_transfer_catalog_and_publication(historical_snapshot):
    original = copy.deepcopy(historical_snapshot)
    config = historical_snapshot['tool_bindings'][1]['config']
    pinned = validate_snapshot(historical_snapshot)
    assert pinned == historical_snapshot and pinned is not historical_snapshot
    current = validate_snapshot(pinned, project_legacy=True)
    assert historical_snapshot == original
    projected = current['tool_bindings'][1]['config']
    assert projected == {key: val for key, val in config.items() if key != 'queue_denylist'} | {'queue_allowlist': []}
    assert validate_snapshot(current) == current
    current['tool_bindings'][1]['config']['queue_allowlist'] = ['queue:600']
    assert validate_snapshot(current) == current

    targets = lambda: [{'id': 'extension:203', 'name': 'Allowed extension'},
                       {'id': 'queue:600', 'name': 'Formerly eligible queue'},
                       {'id': 'queue:601', 'name': 'Excluded queue'}]
    controller = AsyncMock()
    controller.transfer.return_value = {'outcome': 'transferred'}
    registry = ToolRegistry(historical_snapshot, targets, controller, historical_definitions())
    assert registry.advertised() == ToolRegistry(current, targets, controller).advertised()
    directory = await registry.invoke('search', 'nv_pbx_find_destinations_v1', {})
    assert [row['id'] for row in directory['destinations']] == ['extension:203']
    transfer_version = historical_snapshot['tool_bindings'][1]['tool_version']
    wire_name = f'nv_pbx_transfer_v{transfer_version}'
    reason = {'reason': 'Schedule an appointment'} if transfer_version == 3 else {}
    assert await registry.invoke('unconfirmed', wire_name, dict(destination_id='extension:203', **reason)) == {'error': 'confirmation_required'}
    assert await registry.invoke('queue', wire_name, dict(confirmed=True, destination_id='queue:600', **reason)) == {'error': 'destination_denied'}
    assert await registry.invoke('extension', wire_name, dict(confirmed=True, destination_id='extension:203', **reason)) == {'outcome': 'transferred'}
    controller.transfer.assert_awaited_once_with('extension:203', **reason)


@pytest.mark.asyncio
async def test_historical_snapshot_at_byte_limit_survives_admission(historical_snapshot):
    def serialize(value):
        return json.dumps(value, ensure_ascii=False, separators=(',', ':'))

    historical_snapshot['tool_bindings'][1]['config']['queue_denylist'] = []
    conversation = historical_snapshot['conversation']
    conversation['instructions'] = ''
    remaining = MAX_SNAPSHOT_BYTES - len(serialize(historical_snapshot).encode())
    conversation['instructions'] = 'é' * (remaining // 2) + 'a' * (remaining % 2)
    raw = serialize(historical_snapshot)
    assert len(raw.encode()) == MAX_SNAPSHOT_BYTES

    db = MagicMock()
    row = {field: historical_snapshot[field] for field in ('agent_id', 'destination_id', 'workflow_version', 'contract_version')}
    db.cursor.return_value.fetchone.return_value = dict(row, definition_json=raw)
    runtime, storage, _, _ = fixtures()
    storage.snapshot.side_effect = PublishedRepository(lambda: db).load
    storage.tools.return_value = historical_definitions()
    storage.routing_targets.return_value.append({'id': 'queue:600', 'name': 'Queue'})
    call = await admit(runtime)
    try:
        assert call.snapshot == historical_snapshot
        projected = call.tools.snapshot
        assert projected['tool_bindings'][1]['config']['queue_allowlist'] == []
        directory = await call.tools.invoke('search', 'nv_pbx_find_destinations_v1', {})
        assert [row['id'] for row in directory['destinations']] == ['extension:203']
        assert len(serialize(projected).encode()) == MAX_SNAPSHOT_BYTES + 1
        with pytest.raises(ValueError, match='invalid_snapshot'):
            validate_snapshot(projected)
    finally:
        await runtime.finish(call, 'fallback', 'test_finished', fallback=True)


def test_historical_transfer_catalog_rejects_variants_and_duplicates(historical_snapshot):
    version = historical_snapshot['tool_bindings'][1]['tool_version']
    definitions = historical_definitions()
    current = SUPPORTED['pbx.transfer', version]
    historical = next(item for item in definitions if item['id'] == current['id'] and item['version'] == version)
    for invalid in (definitions + [current], definitions + [historical],
                    [dict(item, description='Unexpected description') if item is historical else item for item in definitions],
                    [dict(item, version=float(version)) if item is historical else item for item in definitions]):
        with pytest.raises(ValueError, match='unsupported_tool_definition'):
            ToolRegistry(historical_snapshot, None, None, invalid)


def test_historical_queue_config_still_validates_raw_input(historical_snapshot):
    config = historical_snapshot['tool_bindings'][1]['config']
    config['queue_allowlist'] = ['queue:600']
    with pytest.raises(ValueError, match='invalid_snapshot'):
        validate_snapshot(historical_snapshot)
    del config['queue_allowlist']
    for denylist in (None, {}, 'queue:601', [601], ['extension:601'], ['queue:601\n'],
                     ['queue:601', 'queue:601'], [f'queue:{i}' for i in range(101)]):
        config['queue_denylist'] = denylist
        with pytest.raises(ValueError, match='invalid_snapshot'):
            validate_snapshot(historical_snapshot)
    config['queue_denylist'] = [f'queue:{i:020d}' for i in range(100)]
    validate_snapshot(historical_snapshot)
    historical_snapshot['conversation']['instructions'] = 'é' * 31_000
    with pytest.raises(ValueError, match='invalid_snapshot'):
        validate_snapshot(historical_snapshot)
    config['queue_denylist'] = []
    validate_snapshot(historical_snapshot)


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
