"""Check preserved encrypted resources and interrupt restored execution owners."""
import base64
from agent.application.crypto import ContentKey
from agent.workflows.repository import WorkflowRepository
from agent.application.contracts import ApplicationError
key=ContentKey(base64.b64encode(b'phase5-isolated-test-key'.ljust(32,b'0')).decode())
repo=WorkflowRepository()
repo.initialize('after-restore');repo.initialize_workflows('after-restore',active_runs=[])
assert repo.workflow_version('agent','payment-secretary',1)['name']=='Payment secretary'
assert repo.data_rows('payments',2,key)['rows'][0]['amount']=='125.50'
try: repo.data_rows('payments',1,key)
except ApplicationError as exc: assert exc.code=='data_unavailable'
else: raise AssertionError('Revocation lost after restore')
row=repo.execution('restore-pending')
assert row['status']=='interrupted' and row['reconciliation_required']
assert row['steps'][0]['status']=='interrupted'
with repo.connect() as db:
    assert db.execute("SELECT state FROM agent_application.effects WHERE operation_id='restore-effect'").fetchone()['state']=='unknown'
    result=db.execute("SELECT run_id,result FROM agent_workflows.executions WHERE agent_id='api-echo' AND status='completed'").fetchone()
    assert key.decrypt('workflow-result:'+result['run_id'],result['result'])=={'message':'hello'}
print('PostgreSQL dump/restore: encrypted files/results and revocations preserved; unfinished work interrupted; dispatched effect unknown, no replay')
