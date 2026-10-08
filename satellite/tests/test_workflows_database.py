"""Isolated PostgreSQL acceptance, including publication, encrypted data and API runs."""
import asyncio
import base64
import os
import time
from unittest.mock import patch

import httpx
from fastapi import FastAPI

from agent.application.contracts import ApplicationError, connector
from agent.application.crypto import ContentKey
from agent.runtime import AgentRuntime
from agent.workflows.repository import WorkflowRepository
from agent.workflows.templates import templates, graph, node, source
from agent.workflows.data import ingest
from agent.workflows.connectors import presets
from agent.workflows.api import create_workflow_router
from tests.test_workflows import payment_settings, CSV


async def main():
    runtime=AgentRuntime(); app=runtime.application; service=runtime.workflows
    app.key=ContentKey(base64.b64encode(b'phase5-isolated-test-key'.ljust(32,b'0')).decode())
    assert app.key.key is not None
    app.repository.initialize(app.epoch); service.repository.initialize_workflows(app.epoch)
    app.available=True; service.available=True
    app.repository.set_enabled(True,'acceptance')
    repo=service.repository
    # Both voice APIs survive the administrator save/validate/publish/activate
    # path with the same string binding ID and existing database schema.
    http_app = FastAPI()
    http_app.include_router(create_workflow_router(service))
    with patch.dict(os.environ, {'API_TOKEN': 'isolated-workflow-token'}):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=http_app), base_url='http://test',
                headers={'Authorization': 'Bearer isolated-workflow-token', 'X-Agents-Actor': 'acceptance'}) as client:
            base = '/api/agent/v1/application/workflows'
            for model in ('gpt-realtime', 'gpt-live-1'):
                voice = graph(model, model, [node('call', 'start.call'), node('done', 'end')], [('call', 'success', 'done')])
                voice.update(provider_binding_ref='1', voice_settings={'model': model})
                path = base + '/definitions/agent/' + model
                response = await client.put(path, json={'definition': voice, 'expected_revision': 0})
                assert response.status_code == 200, response.text
                response = await client.post(base + '/validate', json={'definition': voice})
                assert response.status_code == 200 and response.json()['valid'], response.text
                response = await client.post(path + '/publish', json={'expected_revision': 1})
                assert response.status_code == 200, response.text
                response = await client.post(path + '/activate', json={'version': 1, 'enabled': True, 'expected_revision': 2})
                assert response.status_code == 200, response.text
                saved = repo.workflow_version('agent', model, 1)
                assert saved['provider_binding_ref'] == '1' and saved['voice_settings']['model'] == model
    rows,errors=ingest(CSV,payment_settings()); assert not errors
    repo.data_save('payments',payment_settings(),0,'acceptance')
    uploaded=repo.data_publish('payments',1,rows,base64.b64encode(CSV).decode(),{'country_code':'39'},app.key,'acceptance')
    assert uploaded['version']==1 and repo.data_rows('payments',1,app.key)['rows'][0]['amount']=='125.50'
    payment=templates()[1]
    repo.workflow_save('agent',payment['agent_id'],payment,0,'acceptance')
    published=repo.workflow_publish('agent',payment['agent_id'],1,'acceptance')
    assert published['version']==1
    repo.workflow_activate('agent',payment['agent_id'],1,True,2,'acceptance')
    modified=templates()[1];modified['name']='New draft'
    repo.workflow_save('agent',payment['agent_id'],modified,3,'acceptance')
    assert repo.workflow_version('agent',payment['agent_id'],1)['name']=='Payment secretary'
    try: repo.workflow_save('agent',payment['agent_id'],modified,3,'acceptance')
    except ApplicationError as exc: assert exc.code=='revision_conflict'
    else: raise AssertionError('Stale writer accepted')
    for connector_id,preset in presets().items():
        app.repository.add_secret(preset['secret_ref'],'isolated-fixture-key',app.key,'acceptance')
        app.repository.save('connector',connector_id,preset,0,'acceptance')
        app.repository.publish('connector',connector_id,1,'acceptance',connector)
    support=templates()[2]
    repo.workflow_save('agent','customer-support',support,0,'acceptance')
    repo.workflow_publish('agent','customer-support',1,'acceptance')
    invalid=templates()[2];next(node for node in invalid['nodes'] if node['id']=='tickets')['inputs']['customer_id']['path']='missing_customer'
    try: repo.workflow_validate(invalid)
    except ApplicationError as exc: assert exc.code=='unknown_output_field'
    else: raise AssertionError('Connector field picker accepted an unknown published output')
    api=graph('api-echo','API echo',[node('start','start.api'),node('done','end',inputs={'message':source('start','message')})],[('start','success','done')])
    api['entrypoints']=['api'];api['input_schema']={'type':'object','properties':{'message':{'type':'string'}},'required':['message'],'additionalProperties':False}
    api['output_schema']=api['input_schema']
    repo.workflow_save('agent','api-echo',api,0,'acceptance');repo.workflow_publish('agent','api-echo',1,'acceptance');repo.workflow_activate('agent','api-echo',1,True,2,'acceptance')
    child=dict(api);child['agent_id']='echo-block';child['name']='Echo block'
    repo.workflow_save('subflow','echo-block',child,0,'acceptance');repo.workflow_publish('subflow','echo-block',1,'acceptance');repo.workflow_activate('subflow','echo-block',1,True,2,'acceptance')
    parent=graph('api-with-subflow','Subflow API',[node('start','start.api'),node('child','subflow',{'resource':{'resource_id':'echo-block','version':1}},{'message':source('start','message')}),node('done','end',inputs={'message':source('child','message')})],[('start','success','child'),('child','success','done')])
    parent['entrypoints']=['api'];parent['input_schema']=api['input_schema'];parent['output_schema']=api['output_schema']
    repo.workflow_save('agent','api-with-subflow',parent,0,'acceptance');repo.workflow_publish('agent','api-with-subflow',1,'acceptance');repo.workflow_activate('agent','api-with-subflow',1,True,2,'acceptance')
    token=app.repository.create_client('phase5-client',{'scopes':['runs:create','runs:read','runs:cancel'],'presets':['api-echo','api-with-subflow'],'operations':[],'customer_ids':['fixture']},time.time()+3600,'acceptance')['token']
    client=app.repository.authenticate(token)
    request={'agent_id':'api-echo','version':1,'input':{'message':'hello'}}
    admission=await app.submit(client,request,'first')
    task=service.active[admission['run_id']]['task'];await task
    assert (await app.result(client,admission['run_id']))['result']=={'message':'hello'}
    assert (await app.submit(client,request,'first'))['run_id']==admission['run_id']
    try: await app.submit(client,request|{'input':{'message':'different'}},'first')
    except ApplicationError as exc: assert exc.code=='idempotency_conflict'
    else: raise AssertionError('Conflicting admission accepted')
    nested=await app.submit(client,{'agent_id':'api-with-subflow','version':1,'input':{'message':'nested'}},'nested')
    await service.active[nested['run_id']]['task']
    assert (await app.result(client,nested['run_id']))['result']=={'message':'nested'}
    steps=repo.execution(nested['run_id'])['steps'];assert any(step['subflow_path']=='child' for step in steps)
    repo.workflow_activate('subflow','echo-block',1,False,3,'acceptance')
    try: repo.workflow_validate(parent)
    except ApplicationError as exc: assert exc.code=='subflow_disabled'
    else: raise AssertionError('Disabled subflow callable')
    job=await service.enqueue_data('payments',uploaded['revision'],CSV,'acceptance')
    await asyncio.gather(*service._ingestion)
    assert repo.ingestion_job(job['job_id'])['state']=='ready'
    repo.data_revoke('payments',1,'acceptance')
    try: repo.data_rows('payments',1,app.key)
    except ApplicationError as exc: assert exc.code=='data_unavailable'
    else: raise AssertionError('Revoked data readable')
    with repo.connect() as db:
        value=db.execute("SELECT ciphertext,original FROM agent_workflows.data_versions WHERE resource_id='payments' AND version=2").fetchone()
        assert b'125.50' not in bytes(value['ciphertext']) and b'Mario' not in bytes(value['original'])
    repo.execution_admit('restore-pending',api,1,'api','phase5-client',app.epoch)
    repo.execution_step('restore-pending',1,api['nodes'][0],'running')
    with repo.connect() as db:
        db.execute("INSERT INTO agent_application.effects(operation_id,run_id,effect_key,input_digest,connector_id,version,operation,state,created,updated) VALUES('restore-effect','restore-pending','create-ticket','fixture','freshdesk',1,'create_ticket','dispatched',%s,%s)", (time.time(),time.time()))
    inventory=await service.inventory();assert len(inventory['connector_operations'])==5
    assert next(agent for agent in inventory['agents'] if agent['agent_id']=='payment-secretary')['status']=='invalid'
    repo.workflow_activate('agent','payment-secretary',1,False,4,'acceptance')
    assert next(agent for agent in (await service.inventory())['agents'] if agent['agent_id']=='payment-secretary')['status']=='disabled'
    print('PostgreSQL Realtime/Live publication, conflicts, encrypted data, async ingestion, revocation and scoped/idempotent API execution passed')


if __name__=='__main__': asyncio.run(main())
