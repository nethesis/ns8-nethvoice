"""The alpha deliberately accepts exactly the current publication format."""
import copy
import json
import subprocess

import pytest
from test_contract import CONTRACT, ROOT
from voice_agent.contract import validate_snapshot


@pytest.mark.parametrize('version', list(range(1, 8)) + [9, True, 8.0, '8'])
def test_unsupported_publications_are_rejected_by_both_readers(version):
    value = json.loads((CONTRACT/'published-v8.example.json').read_text())
    value['contract_version'] = version
    with pytest.raises(ValueError):
        validate_snapshot(value)
    result = subprocess.run(['php', str(ROOT/'freepbx/tests/agents/validate.php')],
                            input=json.dumps(value), text=True, capture_output=True)
    assert result.returncode == 1


def test_current_publication_is_detached():
    value = json.loads((CONTRACT/'published-v8.example.json').read_text())
    pinned = validate_snapshot(value)
    value['tool_bindings'][1]['enabled'] = not value['tool_bindings'][1]['enabled']
    assert pinned != value


@pytest.mark.parametrize('version', [None, 1, True, '2'])
def test_unsupported_monitoring_formats_fail_closed(version):
    import uuid
    from unittest.mock import MagicMock
    from voice_agent.monitoring import Monitoring, validate_event
    monitor = Monitoring(MagicMock())
    monitor.emit(str(uuid.uuid4()), 'admitted')
    event = next(iter(monitor.pending.values()))
    event['monitoring_version'] = version
    with pytest.raises(ValueError, match='invalid_outbox_event'):
        validate_event(event)


def test_formerly_valid_v7_publication_is_rejected_without_conversion():
    value = json.loads((CONTRACT/'published-v8.example.json').read_text())
    value['contract_version'] = 7
    value['tool_bindings'] = value['tool_bindings'][:3]
    original = copy.deepcopy(value)
    with pytest.raises(ValueError, match='invalid_snapshot'):
        validate_snapshot(value)
    result = subprocess.run(['php', str(ROOT/'freepbx/tests/agents/validate.php')],
                            input=json.dumps(value), text=True, capture_output=True)
    assert result.returncode == 1
    assert value == original
