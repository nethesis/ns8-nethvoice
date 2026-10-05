"""Phase 5 regressions: contracts, private lookup, effects and call ownership."""

import asyncio
import copy
import io
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from agent.application.contracts import ApplicationError, connector
from agent.application.http import mapped_request, project
from agent.application.service import credential_headers
from agent.runtime import AgentRuntime, CallState
from agent.workflows.contracts import DefinitionError, definition, execution_hash
from agent.workflows.data import ingest, normalized_phone, settings, published_csv_url
from agent.workflows.engine import WorkflowEngine
from agent.workflows.templates import templates, graph, node, literal, source
from agent.workflows.voice import VoiceWorkflows


def payment_settings(fmt='csv'):
    return settings({'name': 'Payments', 'format': fmt, 'mapping': {k: k for k in
        ('resident_id', 'name', 'phone', 'period', 'amount', 'currency', 'verification_code')},
        'country_code': '39', 'decimal_separator': '.', 'header_row': 1, 'delimiter': ','})


CSV = b'resident_id,name,phone,period,amount,currency,verification_code\nr1,Mario Rossi,+393331234567,2026-10,125.50,EUR,secret1\nr2,Maria Rossi,+393331234568,2026-10,84.20,EUR,secret2\n'


def test_published_google_csv_configuration_and_scoped_redirect():
    url='https://docs.google.com/spreadsheets/d/e/2PACX-'+'a'*50+'/pub?gid=0&single=true&output=csv'
    cfg=payment_settings() | {'format':'google_csv','published_url':url,'refresh_seconds':3600}
    assert settings(cfg)['format']=='google_csv'
    assert published_csv_url('https://doc-10-64-sheets.googleusercontent.com/pub/data.csv')=='doc-10-64-sheets.googleusercontent.com'
    for bad in [url.replace('https:', 'http:'), url.replace('docs.google.com','example.com'), url+'&output=html', url.replace('/pub?', '/edit?'), url.replace('gid=0','gid=unbounded'), url.replace('docs.google.com','docs.google.com:8443')]:
        with pytest.raises(ApplicationError):settings(cfg | {'published_url':bad})
    for bad in ['https://127.0.0.1/file.csv','https://metadata.google.internal/file.csv','https://sheets.googleusercontent.com.evil.example/file.csv']:
        with pytest.raises(ApplicationError):published_csv_url(bad)


@pytest.mark.asyncio
async def test_name_variation_requires_exact_code_and_unambiguous_resident():
    service=AgentRuntime().workflows;rows,_=ingest(CSV,payment_settings())
    table={'payments':{'rows':rows,'created':time.time(),'metadata':{'country_code':'39'}}}
    fixtures={'ask_identity':{'outcome':'success','output':{'name':'Mario Rosso','resident_code':'secret1'}},'period':{'outcome':'success','output':{'period':'2026-10'}}}
    assert (await service.test(templates()[1],fixtures,{}, {'phone':'+390201000099'},table))['status']=='completed'
    strict=templates()[1];next(n for n in strict['nodes'] if n['id']=='verify')['config']['name_match']='exact'
    assert (await service.test(strict,fixtures,{}, {'phone':'+390201000099'},table))['status']=='fallback'
    fixtures['ask_identity']['output']['resident_code']='wrong'
    assert (await service.test(templates()[1],fixtures,{}, {'phone':'+390201000099'},table))['status']=='fallback'
    fixtures['ask_identity']['output']['resident_code']='secret1'
    rows.append(rows[0] | {'resident_id':'other','name':'Mario Rosso','name_key':'mario rosso'})
    assert (await service.test(templates()[1],fixtures,{}, {'phone':'+390201000099'},table))['status']=='fallback'


def test_sample_graphs_and_execution_hash():
    for sample in templates():
        definition(sample)
        changed = copy.deepcopy(sample); changed['layout'] = {}
        assert execution_hash(changed) == execution_hash(sample)
        changed['nodes'][0]['name'] += '!'
        assert execution_hash(changed) != execution_hash(sample)


@pytest.mark.parametrize('mutation,code', [
    (lambda g: g['edges'].append({'source':'choose','outcome':'error','target':'destinations'}), 'graph_cycle'),
    (lambda g: g['nodes'][2]['inputs'].update({'bad':source('route_pbx')}), 'unavailable_branch_output'),
    (lambda g: g['edges'].append({'source':'call','outcome':'success','target':'choose'}), 'duplicate_outcome_edge'),
    (lambda g: g['nodes'][1].update({'version':999}), 'unknown_block_version'),
])
def test_reject_invalid_graph(mutation, code):
    sample = templates()[0]; mutation(sample)
    with pytest.raises(DefinitionError) as error:
        definition(sample)
    assert error.value.code == code


def test_csv_decimal_duplicate_and_private_fields():
    rows, errors = ingest(CSV, payment_settings())
    assert not errors and rows[0]['amount'] == '125.50'
    assert rows[0]['phone'] == '+393331234567'
    duplicate = CSV + CSV.splitlines(keepends=True)[1]
    _, errors = ingest(duplicate, payment_settings())
    assert errors == [{'row':4,'error':'duplicate_resident_period'}]
    assert normalized_phone('0039 333 1234567') == '+393331234567'
    assert normalized_phone('333 1234567') == '+393331234567'


def test_xlsx_formulas_are_not_executed():
    from openpyxl import Workbook
    workbook = Workbook(); sheet = workbook.active
    sheet.append(CSV.decode().splitlines()[0].split(',')); sheet.append(['r1','Mario','3331234567','2026-10','=1+1','EUR','secret'])
    stream = io.BytesIO(); workbook.save(stream)
    with pytest.raises(ApplicationError, match='formula_values_require_export'):
        ingest(stream.getvalue(), payment_settings('xlsx'))


def test_text_regex_extraction_and_timeout():
    cfg = payment_settings('text')
    cfg['text_pattern'] = r'(?P<resident_id>\w+)\|(?P<name>[^|]+)\|(?P<phone>[^|]+)\|(?P<period>[^|]+)\|(?P<amount>[^|]+)\|(?P<currency>[^|]+)\|(?P<verification_code>[^|]+)'
    rows, errors = ingest(b'r1|Mario|3331234567|2026-10|125.50|EUR|secret', cfg)
    assert not errors and rows[0]['amount'] == '125.50'
    with pytest.raises(ApplicationError, match='unparsed_text_line'):
        ingest(b'not a payment record', cfg)


@pytest.mark.asyncio
async def test_known_payment_caller_only_receives_own_row():
    runtime = AgentRuntime(); service = runtime.workflows
    rows, _ = ingest(CSV, payment_settings())
    result = await service.test(templates()[1], {'period':{'outcome':'success','output':{'period':'2026-10'}}}, {},
        {'phone':'+393331234567'}, {'payments':{'rows':rows,'created':time.time(),'metadata':{'country_code':'39'}}})
    assert result['status'] == 'completed'
    lookup = next(step for step in result['trace'] if step['node_id'] == 'payment')
    assert lookup['output']['row']['resident_id'] == 'r1'
    assert lookup['output']['row']['amount'] == '125.50'
    assert 'verification_code' not in str(result)
    assert '84.20' not in str(result)


@pytest.mark.asyncio
async def test_unknown_payment_caller_requires_code_and_ambiguous_phone_does_not_choose_first():
    runtime = AgentRuntime(); service = runtime.workflows
    rows, _ = ingest(CSV, payment_settings())
    rows[1]['phone'] = rows[0]['phone']
    fixtures = {'ask_identity':{'outcome':'success','output':{'name':'Mario Rossi','resident_code':'wrong'}},
                'period':{'outcome':'success','output':{'period':'2026-10'}}}
    table = {'payments':{'rows':rows,'created':time.time(),'metadata':{'country_code':'39'}}}
    result = await service.test(templates()[1], fixtures, {}, {'phone':rows[0]['phone']}, table)
    assert result['status'] == 'fallback' and not any(s['node_id']=='payment' for s in result['trace'])
    fixtures['ask_identity']['output']['resident_code']='secret1'
    result = await service.test(templates()[1], fixtures, {}, {'phone':rows[0]['phone']}, table)
    assert result['status']=='completed'


@pytest.mark.asyncio
async def test_stale_payment_snapshot_falls_back():
    service=AgentRuntime().workflows; rows,_=ingest(CSV,payment_settings())
    result=await service.test(templates()[1],{'period':{'outcome':'success','output':{'period':'2026-10'}}},{},
        {'phone':'+393331234567'}, {'payments':{'rows':rows,'created':0,'metadata':{'country_code':'39'}}})
    assert result['status']=='fallback'


@pytest.mark.asyncio
async def test_router_rechecks_enabled_catalog():
    result=await AgentRuntime().workflows.test(templates()[0],{'choose':{'outcome':'pbx','output':{'destination_id':'extension:201','reason':'support'}}},{},{},
        destinations=[{'id':'extension:201','type':'extension','name':'Support'}])
    assert result['status']=='handed_off'
    result=await AgentRuntime().workflows.test(templates()[0],{'choose':{'outcome':'pbx','output':{'destination_id':'extension:201','reason':'support'}}},{},{})
    assert result['status']=='fallback'


def test_extended_connector_transport_does_not_send_key_as_header_or_skip_projection():
    assert credential_headers({'auth':{'type':'basic_api_key'}},'sample') == {'Authorization':'Basic c2FtcGxlOlg='}
    operation={'method':'PUT','path':'/api/v2/tickets/{ticket_id}','query':{},'body':{'priority':'priority'},'input_schema':{'properties':{'ticket_id':{'type':'string'}}}}
    assert mapped_request(operation,{'ticket_id':'123','priority':4}) == ('/api/v2/tickets/123',{}, {'priority':4})
    operation={'projection':{'tickets':'$'}, 'array_projection':{'tickets':{'id':'id','priority':'priority'}},
        'output_schema':{'type':'object','properties':{'tickets':{'type':'array','items':{'type':'object','properties':{'id':{'type':'integer'},'priority':{'type':'integer'}},'required':['id','priority'],'additionalProperties':False}}},'required':['tickets'],'additionalProperties':False}}
    assert project([{'id':1,'priority':4,'private_note':'must not reach the model'}],operation)=={'tickets':[{'id':1,'priority':4}]}


@pytest.mark.asyncio
async def test_confirmation_does_not_accept_digit_before_readback():
    runtime=SimpleNamespace(workflow_speak=AsyncMock()); voice=VoiceWorkflows(runtime)
    call=SimpleNamespace(caller_id='caller',deadline=time.monotonic()+10)
    async def early_digit(*args):
        await voice.event({'type':'ChannelDtmfReceived','channel':{'id':'caller'},'digit':'1'})
    runtime.workflow_speak.side_effect=early_digit
    task=asyncio.create_task(voice.confirm(call,'Create ticket'))
    await asyncio.sleep(0)
    assert not task.done()
    await voice.event({'type':'ChannelDtmfReceived','channel':{'id':'caller'},'digit':'2'})
    assert await task is False and not voice.digits


@pytest.mark.asyncio
async def test_scope_check_uses_server_ticket_priority():
    runtime=AgentRuntime(); service=runtime.workflows
    service.check=AsyncMock(); service.application.require_available=lambda:None
    service.application.db=AsyncMock(side_effect=lambda method,*args: True if method=='enabled' else {})
    operation={'read_only':False,'public_voice':False,'identity_field':'customer_id'}
    ref={'connector_id':'freshdesk','version':1,'operation_id':'update_priority'}
    context={'workflow_graph':{'tool_grants':['connector.freshdesk.update_priority.v1']},
        'workflow_node':{'config':{'write_policy':'escalation','allowed_priorities':[4]}}, 'identity':{'customer_id':'c1'},
        'tickets':{'1':{'priority':4}}, 'execution_kind':'voice'}
    with pytest.raises(ApplicationError,match='urgency_rule_denied'):
        await service.authorize_connector({'reference':ref,'operation':operation},{'customer_id':'c1','ticket_id':'1','priority':4,'previous_priority':1},context)


@pytest.mark.parametrize('operation_id', ['update_priority','create_ticket'])
@pytest.mark.asyncio
async def test_freshdesk_writes_require_exact_live_confirmation(operation_id):
    from agent.application.contracts import digest
    service=AgentRuntime().workflows;service.check=AsyncMock()
    service.application.db=AsyncMock(side_effect=lambda method,*args:True if method=='enabled' else {})
    ref={'connector_id':'freshdesk','version':1,'operation_id':operation_id}
    args={'customer_id':123,'ticket_id':'77','priority':4} if operation_id=='update_priority' else {'customer_id':123,'summary':'Issue','description':'Details','priority':2,'status':2}
    context={'workflow_graph':{'tool_grants':[f'connector.freshdesk.{operation_id}.v1']},
        'workflow_node':{'config':{'allowed_priorities':[4]}},'identity':{'customer_id':123},
        'tickets':{'77':{'id':77,'priority':2},'78':{'id':78,'priority':2}},'confirmations':{}}
    item={'reference':ref,'operation':{'identity_field':'customer_id','read_only':False,'public_voice':False}}
    with pytest.raises(ApplicationError,match='write_confirmation_required'):
        await service.authorize_connector(item,args,context)
    context['confirmations'][digest({'operation':ref,'arguments':args})]=time.monotonic()+30
    await service.authorize_connector(item,args,context)
    with pytest.raises(ApplicationError,match='write_confirmation_required'):
        await service.authorize_connector(item,args|({'priority':3} if operation_id=='create_ticket' else {'ticket_id':'78'}),context)


def test_resident_identity_cannot_change_between_monthly_rows():
    raw=CSV+ b'r1,Mario Rossi,+393331234568,2026-11,125.50,EUR,changed\n'
    _,errors=ingest(raw,payment_settings())
    assert errors==[{'row':4,'error':'inconsistent_resident_identity'}]


@pytest.mark.asyncio
async def test_api_conversation_dispatches_only_offered_tools_within_turn_budget():
    runtime=AgentRuntime();service=runtime.workflows
    sample=templates()[4];sample['text_provider']={'model':'fixture-model','secret_ref':'fixture-key'}
    from agent.workflows.templates import conversation
    step=node('decision','conversation.decision',conversation('Retrieve documentation',{'answer':{'type':'string'}}))
    tool={'type':'function','name':'nv_read_fixture','parameters':{'type':'object'}}
    context={'run_id':'fixture','step_count':2,'connector_tools':[],'deadline_monotonic':time.monotonic()+30}
    service.conversation_tools=AsyncMock(return_value=[tool]);service.check=AsyncMock()
    service.application.db=AsyncMock(return_value='fixture-secret')
    service.application.transport.json_request=AsyncMock(side_effect=[
        {'output':[{'type':'function_call','name':'nv_read_fixture','arguments':'{}','call_id':'first'}]},
        {'output':[{'type':'message','content':[{'type':'output_text','text':'{"outcome":"success","data":{"answer":"Documented"}}'}]}]}])
    runtime.tools.dispatch=AsyncMock(return_value={'ok':True,'result':{'documentation':'Documented'}})
    result=await service.api_conversation(sample,context,step,{})
    assert result['data']['answer']=='Documented' and runtime.tools.dispatch.await_count==1
    service.application.transport.json_request=AsyncMock(return_value={'output':[{'type':'function_call','name':'nv_write_unoffered','arguments':'{}','call_id':'new'}]})
    with pytest.raises(ApplicationError,match='workflow_tool_denied'):
        await service.api_conversation(sample,context,step,{})
    assert runtime.tools.dispatch.await_count==1


@pytest.mark.asyncio
async def test_pbx_history_cannot_read_model_supplied_unrelated_numbers():
    service=AgentRuntime().workflows
    with pytest.raises(ApplicationError,match='caller_scope_mismatch'):
        await service.pbx_data({'caller':{'phone':'+393331234567'},'company_numbers':['+393331234567']},'pbx.history',{'numbers':['+393339999999']},{})


@pytest.mark.asyncio
async def test_subflow_reduces_permissions_uses_own_definition_and_restores_parent():
    from agent.workflows.templates import conversation
    child=graph('child-block','Child',[node('start','start.api'),node('decision','conversation.collect',conversation('Collect',{'message':{'type':'string'}})),node('done','end',inputs={'message':source('decision','message')})], [('start','success','decision'),('decision','success','done')])
    child['entrypoints']=['api'];child['permissions']={'directory.extensions':'deny'}
    child['output_schema']={'type':'object','properties':{'message':{'type':'string'}},'required':['message'],'additionalProperties':False}
    child['text_provider']={'model':'fixture','secret_ref':'child-key'}
    parent=graph('parent-block','Parent',[node('start','start.api'),node('child','subflow',{'resource':{'resource_id':'child-block','version':1}}),node('done','end',inputs={'message':source('child','message')})],[('start','success','child'),('child','success','done')])
    parent['entrypoints']=['api'];parent['output_schema']=child['output_schema']
    service=AgentRuntime().workflows;service.check=AsyncMock();service.subflow=AsyncMock(return_value=child)
    observed=[]
    async def step(context,sequence,node,status,*args):
        observed.append((node['id'],list(context.get('subflow_path',[]))))
    service.step=step
    async def collect(node,inputs,definition):
        assert definition['agent_id']=='child-block' and context['permissions']['directory.extensions']=='deny'
        return {'outcome':'success','data':{'message':'Collected'}}
    context={'permissions':{'directory.extensions':'allow'},'run_id':'test','conversation':collect,'deadline_monotonic':time.monotonic()+30}
    result=await service.engine.execute(parent,context,{})
    assert result['result']=={'message':'Collected'}
    assert ('decision',['child']) in observed and ('done',[]) in observed
    assert context['permissions']['directory.extensions']=='allow' and context['subflow_path']==[]


@pytest.mark.asyncio
@pytest.mark.parametrize('flag,priority', [(True,4),(False,2)])
async def test_merge_alternatives_returns_only_the_taken_branch(flag,priority):
    sample=graph('merge-example','Merge',[node('start','start.api'),node('choice','logic.condition',{'field':'urgent','operator':'eq','value':True},{'urgent':source('start','urgent')}),
        node('high','logic.map',inputs={'priority':literal(4)}),node('normal','logic.map',inputs={'priority':literal(2)}),
        node('merged','logic.merge',inputs={'high':source('high',optional=True),'normal':source('normal',optional=True)}),node('done','end',inputs={'priority':source('merged','priority')})],
        [('start','success','choice'),('choice','yes','high'),('choice','no','normal'),('high','success','merged'),('normal','success','merged'),('merged','success','done')])
    sample['entrypoints']=['api'];sample['input_schema']={'type':'object','properties':{'urgent':{'type':'boolean'}},'required':['urgent'],'additionalProperties':False}
    sample['output_schema']={'type':'object','properties':{'priority':{'type':'integer'}},'required':['priority'],'additionalProperties':False}
    service=AgentRuntime().workflows
    result=await service.test(sample,{}, {'urgent':flag},{})
    assert result['result']=={'priority':priority}
    assert len([step for step in result['trace'] if step['node_id']=='merged'])==1
