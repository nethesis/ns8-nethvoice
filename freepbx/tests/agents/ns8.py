"""Synthetic NS8 helper contract; no cluster actions or real secret files."""
import os
import runpy
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

root=Path(__file__).resolve().parents[3]
state={'environment':{'NETHVOICE_HOST':'synthetic.example'},'passwords.env':{
    'SATELLITE_ARI_PASSWORD':'synthetic-ari','MARIADB_ROOT_PASSWORD':'synthetic-root',
    'OPENAI_API_KEY':'synthetic-provider','SATELLITE_API_TOKEN':'synthetic-api',
    'SATELLITE_PGSQL_PASSWORD':'synthetic-pg','SATELLITE_MQTT_PASSWORD':'synthetic-mqtt',
    'DEEPGRAM_API_KEY':'synthetic-deepgram'}}
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
        runtime_env=state['satellite.env']
        assert 'MARIADB_ROOT_PASSWORD' not in runtime_env
        assert len(runtime_env)==11
        assert runtime_env['VOICE_AGENT_MONITORING_RETENTION_DAYS']=='90'
        state['environment']['VOICE_AGENT_MONITORING_RETENTION_DAYS']='120'
        runpy.run_path(str(root/'imageroot/bin/configure-voice-agents'))
        assert state['satellite.env']['VOICE_AGENT_MONITORING_RETENTION_DAYS']=='120'
        assert runtime_env['OPENAI_API_KEY']=='synthetic-provider'
        assert runtime_env['DEEPGRAM_API_KEY']=='synthetic-deepgram'
        assert runtime_env['SATELLITE_MQTT_PASSWORD']=='synthetic-mqtt'
        assert runtime_env['API_TOKEN']=='synthetic-api'
        assert runtime_env['PGVECTOR_PASSWORD']=='synthetic-pg'
        assert Path('satellite.env').stat().st_mode & 0o777==0o600
        route=agent.set_route.call_args.args[0]
        assert route['url']=='http://127.0.0.1:30000' and route['path']=='/satellite-webhooks'
        assert route['instance']=='nethvoice_test-voice-agent-webhooks' and route['strip_prefix'] is False
        agent.set_route.reset_mock()
        with patch('sys.argv',['configure-voice-agents','--secrets-only']):
            try: runpy.run_path(str(root/'imageroot/bin/configure-voice-agents'))
            except SystemExit as result: assert result.code==0
        agent.set_route.assert_not_called()
        agent.allocate_ports.assert_called_once()
        # Full demand is already assigned at create: never ask for port 41.
        for total in (39,40):
            state['environment'].pop('VOICE_AGENT_HTTP_PORT',None)
            state['environment']['TCP_PORTS_RANGE']='31000-'+str(31000+total-1)
            agent.allocate_ports.reset_mock()
            agent.allocate_ports.side_effect=RuntimeError('max_ports_exceeded')
            runpy.run_path(str(root/'imageroot/bin/configure-voice-agents'))
            assert state['environment']['VOICE_AGENT_HTTP_PORT']=='31038'
            agent.allocate_ports.assert_not_called()
        # Execute the actual fresh-create mapping as well.
        state['environment'].clear()
        def shrink_udp(count, protocol, **kwargs):
            assert protocol=='udp' and count==1000
            return (40000,40999)
        agent.allocate_ports.reset_mock()
        agent.allocate_ports.side_effect=shrink_udp
        with patch.dict(os.environ,{'TCP_PORTS_RANGE':'32000-32039','UDP_PORTS_RANGE':'40000-42999'}):
            runpy.run_path(str(root/'imageroot/actions/create-module/05setenvs'))
        assert state['environment']['VOICE_AGENT_HTTP_PORT']==32038
        assert state['environment']['OAUTH2_PROXY_PORT']==32037
        agent.allocate_ports.assert_called_once_with(1000,'udp')
        # Removal must delete the exact public route previously registered.
        removed=[]
        agent.resolve_agent_id=lambda _: 'module/traefik_test'
        tasks=SimpleNamespace(run=lambda **args: removed.append(args) or {'exit_code':0})
        agent.tasks=tasks
        with patch.dict('sys.modules',{'agent.tasks':tasks}):
            runpy.run_path(str(root/'imageroot/actions/destroy-module/20destroy'))
        assert any(call['data']['instance']=='nethvoice_test-voice-agent-webhooks' for call in removed)
    finally:
        os.chdir(before)
assert 'org.nethserver.tcp-ports-demand="40"' in (root/'Containerfile').read_text()
print('NS8 secret filtering, idempotent port allocation and exact webhook route passed')
