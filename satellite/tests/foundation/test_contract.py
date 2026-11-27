import copy
import json
import pathlib
import subprocess

import pytest

from voice_agent.contract import validate_snapshot

ROOT = pathlib.Path(__file__).resolve().parents[3]
CONTRACT = ROOT / 'freepbx/var/www/html/freepbx/rest/lib/agents/contracts'


def test_php_python_contract_parity():
    valid = json.loads((CONTRACT / 'published-v8.example.json').read_text())
    cases = [valid]
    for key, value in [('contract_version', 3), ('workflow_version', 0),
                       ('agent_id', '../bad'), ('api_key', 'synthetic'),
                       ('enabled_tools', ['arbitrary.execute']), ('workflow_version', 1.0),
                       ('workflow_version', True), ('agent_id', 'bad\n'),
                       ('destination_id', 'agent:other'), ('enabled_tools', ['pbx.transfer'] * 2),
                       ('approved_destination_ids', ['queue:600']),
                       ('max_call_duration_seconds', 3601), ('conversation', {})]:
        case = copy.deepcopy(valid)
        case[key] = value
        cases.append(case)
    for index, case in enumerate(cases):
        result = subprocess.run(['php', str(ROOT / 'freepbx/tests/agents/validate.php')],
                                input=json.dumps(case), text=True, capture_output=True)
        if index == 0:
            validate_snapshot(case)
            assert result.returncode == 0, result.stderr
        else:
            with pytest.raises(ValueError):
                validate_snapshot(case)
            assert result.returncode == 1, result.stdout


def test_schema_copies_are_identical():
    runtime_schema = ROOT / 'satellite/voice_agent/published-v8.schema.json'
    assert runtime_schema.read_bytes() == (CONTRACT / 'published-v8.schema.json').read_bytes()
    assert (ROOT/'satellite/voice_agent/tools-v5.json').read_bytes()==(CONTRACT/'tools-v5.json').read_bytes()
    assert (ROOT/'satellite/voice_agent/provider-models-v2.json').read_bytes()==(CONTRACT/'provider-models-v2.json').read_bytes()


@pytest.mark.parametrize("target", ["hangup", "extension:203", "native:ivr-7,s,1"])
def test_native_fallback_contract_is_shared(target):
    snapshot=json.loads((CONTRACT/'published-v8.example.json').read_text())
    snapshot['fallback_destination_id']=target
    assert validate_snapshot(snapshot)['fallback_destination_id']==target
    result=subprocess.run(['php',str(ROOT/'freepbx/tests/agents/validate.php')],input=json.dumps(snapshot),text=True,capture_output=True)
    assert result.returncode==0
