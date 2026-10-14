"""Synthetic NS8 helper contract; no cluster actions or real secret files."""
import os
import runpy
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

root=Path(__file__).resolve().parents[3]
state={'environment':{'NETHVOICE_HOST':'synthetic.example'},'passwords.env':{'SATELLITE_ARI_PASSWORD':'synthetic-ari','MARIADB_ROOT_PASSWORD':'synthetic-root','OPENAI_API_KEY':'synthetic-provider'}}
def write(name,values):
    state[name]=dict(values)
    Path(name).write_text('synthetic-file-only')
def set_env(name,value):
    state['environment'][name]=value
agent=SimpleNamespace(read_envfile=lambda name:dict(state[name]),write_envfile=write,set_env=set_env,
    allocate_ports=Mock(return_value=(30000,30000)),set_route=Mock())
with tempfile.TemporaryDirectory() as temporary, patch.dict('sys.modules',{'agent':agent}), patch.dict(os.environ,{'MODULE_ID':'nethvoice_test'}):
    before=os.getcwd()
    try:
        os.chdir(temporary)
        runpy.run_path(str(root/'imageroot/bin/configure-voice-agents'))
        first=dict(state['passwords.env'])
        runpy.run_path(str(root/'imageroot/bin/configure-voice-agents'))
        assert first==state['passwords.env']
        agent.allocate_ports.assert_called_once_with(1,'tcp',keep_existing=True)
        assert 'MARIADB_ROOT_PASSWORD' not in state['voice-agent.env']
        assert len(state['voice-agent.env'])==6
        assert state['voice-agent.env']['OPENAI_API_KEY']=='synthetic-provider'
        assert Path('voice-agent.env').stat().st_mode & 0o777==0o600
        route=agent.set_route.call_args.args[0]
        assert route['url']=='http://127.0.0.1:30000' and route['path']=='/satellite-webhooks'
        assert route['instance']=='nethvoice_test-voice-agent-webhooks' and route['strip_prefix'] is False
        agent.set_route.reset_mock()
        with patch('sys.argv',['configure-voice-agents','--secrets-only']):
            try: runpy.run_path(str(root/'imageroot/bin/configure-voice-agents'))
            except SystemExit as result: assert result.code==0
        agent.set_route.assert_not_called()
        agent.allocate_ports.assert_called_once()
    finally:
        os.chdir(before)
assert 'org.nethserver.tcp-ports-demand="40"' in (root/'Containerfile').read_text()
print('NS8 secret filtering, idempotent port allocation and exact webhook route passed')
