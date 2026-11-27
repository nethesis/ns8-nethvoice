"""Agent-owned settings: strict cross-language contracts and call isolation."""
import copy
import json
import subprocess
from unittest.mock import AsyncMock

import pytest
from test_contract import CONTRACT, ROOT
from test_runtime import fixtures, admit
from voice_agent.contract import validate_snapshot


def snapshot(model='gpt-realtime-2.1'):
    value=json.loads((CONTRACT/'published-v8.example.json').read_text())
    value['contract_version']=8
    value['conversation'].update(model=model, voice='marin', options=None)
    if model=='gpt-live-1':
        value['conversation']['options']={
            'backend_model':'gpt-6-luna', 'backend_instructions':'Use only approved tools.',
            'reasoning_effort':'medium', 'verbosity':'low', 'service_tier':'default',
            'max_output_tokens':2048}
    return value


@pytest.mark.parametrize('model',['gpt-realtime-2.1','gpt-live-1'])
def test_v5_contract_and_php_python_agree(model):
    value=snapshot(model)
    if model=='gpt-live-1':
        value['conversation']['voice']='quartz'  # Live-only built-in voice.
    assert validate_snapshot(value)==value
    result=subprocess.run(['php',str(ROOT/'freepbx/tests/agents/validate.php')],
                          input=json.dumps(value),text=True,capture_output=True)
    assert result.returncode==0,result.stdout+result.stderr


@pytest.mark.parametrize('change',[
    {'model':'arbitrary-model'}, {'voice':'not-a-voice'}, {'voice':'quartz'}, {'options':{'tools':['arbitrary']}},
    {'options':{'backend_model':'gpt-6-luna'}},
])
def test_v5_invalid_combinations_fail_in_both_languages(change):
    value=snapshot();value['conversation'].update(change)
    with pytest.raises(ValueError): validate_snapshot(value)
    result=subprocess.run(['php',str(ROOT/'freepbx/tests/agents/validate.php')],
                          input=json.dumps(value),text=True,capture_output=True)
    assert result.returncode==1


@pytest.mark.parametrize('key,value',[
    ('backend_model','arbitrary'),('backend_instructions','   '),
    ('reasoning_effort','max'),('verbosity','verbose'),('service_tier','ultrafast'),
    ('max_output_tokens',15),('max_output_tokens',8193),
    ('max_output_tokens',True),('max_output_tokens',2048.0),
])
def test_live_options_match_provider_subset_and_strict_php_types(key,value):
    case=snapshot('gpt-live-1');case['conversation']['options'][key]=value
    with pytest.raises(ValueError): validate_snapshot(case)
    result=subprocess.run(['php',str(ROOT/'freepbx/tests/agents/validate.php')],input=json.dumps(case),text=True,capture_output=True)
    assert result.returncode==1


def test_v5_schema_and_capability_copies_match():
    for name in ['published-v8.schema.json','provider-models-v2.json']:
        assert (CONTRACT/name).read_bytes()==(ROOT/'satellite/voice_agent'/name).read_bytes()


@pytest.mark.asyncio
async def test_agent_model_wins_over_stale_trunk_and_is_detached():
    runtime,storage,controller,_=fixtures()
    first=snapshot('gpt-live-1')
    storage.snapshot.return_value=first
    from voice_agent.tools import DEFINITIONS
    storage.tools.return_value=copy.deepcopy(DEFINITIONS)
    storage.binding.return_value['model']='gpt-realtime-2'
    call=await admit(runtime)
    first['conversation']['options']['backend_model']='gpt-6-sol'
    first['conversation']['voice']='ash'
    assert call.binding['model']=='gpt-live-1'
    assert call.snapshot['conversation']['voice']=='marin'
    assert call.snapshot['conversation']['options']['backend_model']=='gpt-6-luna'
    await runtime.finish(call,'completed')


@pytest.mark.asyncio
async def test_bad_agent_voice_fails_before_any_paid_origination():
    runtime,storage,controller,_=fixtures()
    value=snapshot();value['conversation']['voice']='unavailable'
    storage.snapshot.return_value=value
    await runtime.admit({'id':'synthetic-caller','dialplan':{'context':'voice-agent-basic_voice'}},'basic_voice')
    controller.originate_local.assert_not_awaited()
    assert not runtime.calls
