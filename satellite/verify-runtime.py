"""Build/import guard: reject runtimes without Phase 5 routes and manifests."""
import inspect
import json
import sys
import api
import main
from agent.runtime import AgentRuntime
from agent.workflows.contracts import definition
from agent.workflows.templates import templates
assert isinstance(api.agent_runtime, AgentRuntime)
paths = api.app.openapi()['paths']
assert '/api/agent/v1/readiness' in paths
assert '/agents-api/v1/runs' in paths
assert '/api/agent/v1/application/workflows/inventory' in paths
assert '/api/agent/v1/application/workflows/definitions/{kind}/{agent_id}/publish' in paths
assert inspect.iscoroutinefunction(main.main) and 'server.serve' in inspect.getsource(main.main)
for sample in templates(): definition(sample)
with open('/app/phase5-source.json') as stream:
    source = json.load(stream)
    assert source['workflow_schema'] == 1
    if len(sys.argv) > 1:
        assert source['patch_sha256'] == sys.argv[1], 'Runtime patch does not match this module build'
    if len(sys.argv) > 2:
        assert source['upstream_ref'] == sys.argv[2], 'Runtime source does not match runtime-ref'
print('Satellite Phase 5 runtime routes and templates verified')
