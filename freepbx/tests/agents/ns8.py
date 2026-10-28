"""Synthetic NS8 helper contract; no cluster actions or real secret files."""
import os
import runpy
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

root=Path(__file__).resolve().parents[3]
state={'environment':{'NETHVOICE_HOST':'synthetic.example','NETHVOICE_RECIPIENT_SERVICE_PORT':'30001','VOICE_AGENT_CHAT_PORT':'30002'},'passwords.env':{
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
        runpy.run_path(str(root/'imageroot/actions/configure-module/29voice_agents'))
        first=dict(state['passwords.env'])
        runpy.run_path(str(root/'imageroot/actions/configure-module/29voice_agents'))
        assert first==state['passwords.env']
        agent.allocate_ports.assert_called_once_with(1,'tcp',keep_existing=True)
        runtime_env=state['satellite.env']
        assert 'MARIADB_ROOT_PASSWORD' not in runtime_env
        assert runtime_env['VOICE_AGENT_LIVE_WS_MAX_CALLS']=='4'
        assert len(runtime_env)==16
        assert runtime_env['VOICE_AGENT_MONITORING_RETENTION_DAYS']=='90'
        state['environment']['VOICE_AGENT_MONITORING_RETENTION_DAYS']='120'
        runpy.run_path(str(root/'imageroot/actions/configure-module/29voice_agents'))
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
        with patch('sys.argv',['29voice_agents','--secrets-only']):
            try: runpy.run_path(str(root/'imageroot/actions/configure-module/29voice_agents'))
            except SystemExit as result: assert result.code==0
        agent.set_route.assert_not_called()
        agent.allocate_ports.assert_called_once()
        # Integration saves must preserve the private consultation credentials/URLs.
        expected_runtime=dict(state['satellite.env'])
        helper=str(root/'imageroot/actions/configure-module/29voice_agents')
        commands=[]
        def process(args,**kwargs):
            commands.append(args)
            if args[0]==helper:
                assert args[1:] == ['--secrets-only']
                with patch('sys.argv',args):
                    try: runpy.run_path(helper)
                    except SystemExit as result: assert result.code==0
            return SimpleNamespace(returncode=0,stdout='sha256:synthetic\n' if args[:3]==['podman','image','inspect'] else 'not-found')
        with patch.dict(os.environ,{'AGENT_INSTALL_DIR':str(root/'imageroot'),'NETHVOICE_SATELLITE_IMAGE':'registry.invalid/synthetic:test'}),patch('subprocess.run',side_effect=process):
            runpy.run_path(str(root/'imageroot/actions/set-integrations/50manage_service'))
        assert state['satellite.env']==expected_runtime
        assert any(args[0]==helper for args in commands)
        assert all(state['satellite.env'].get('VOICE_AGENT_'+service+'_TOKEN') and state['satellite.env'].get('VOICE_AGENT_'+service+'_URL') for service in ('RECIPIENT','CHAT'))
        assert 'MARIADB_ROOT_PASSWORD' not in state['satellite.env']
        # Reuse the dedicated slot without exceeding a fully allocated demand.
        for total in (43,44):
            state['environment'].pop('VOICE_AGENT_HTTP_PORT',None)
            state['environment']['TCP_PORTS_RANGE']='31000-'+str(31000+total-1)
            agent.allocate_ports.reset_mock()
            agent.allocate_ports.side_effect=RuntimeError('max_ports_exceeded')
            runpy.run_path(str(root/'imageroot/actions/configure-module/29voice_agents'))
            assert state['environment']['VOICE_AGENT_HTTP_PORT']=='31042'
            agent.allocate_ports.assert_not_called()
        # Older or differently laid-out installations need a new allocation.
        for total in (39,40,42,44):
            state['environment'].pop('VOICE_AGENT_HTTP_PORT',None)
            state['environment']['TCP_PORTS_RANGE']='31000-'+str(31000+total-1)
            if total==44:
                state['environment']['CHAT_GW_PORT']='31042'
            agent.allocate_ports.reset_mock()
            agent.allocate_ports.side_effect=None
            runpy.run_path(str(root/'imageroot/actions/configure-module/29voice_agents'))
            assert state['environment']['VOICE_AGENT_HTTP_PORT']=='30000'
            agent.allocate_ports.assert_called_once_with(1,'tcp',keep_existing=True)
            runpy.run_path(str(root/'imageroot/actions/configure-module/29voice_agents'))
            agent.allocate_ports.assert_called_once()
        # Repair a persisted chat conflict, including int/string env values.
        for chat_port in ('CHAT_C2S_PORT','CHAT_HTTP_PORT','CHAT_COMPONENT_PORT','CHAT_GW_PORT'):
            state['environment']={'NETHVOICE_HOST':'synthetic.example','NETHVOICE_RECIPIENT_SERVICE_PORT':'30001','VOICE_AGENT_CHAT_PORT':'30002',
                'TCP_PORTS_RANGE':'31000-31043',chat_port:31038,'VOICE_AGENT_HTTP_PORT':'31038'}
            agent.allocate_ports.reset_mock()
            agent.allocate_ports.side_effect=RuntimeError('max_ports_exceeded')
            runpy.run_path(str(root/'imageroot/actions/configure-module/29voice_agents'))
            assert state['environment']['VOICE_AGENT_HTTP_PORT']=='31042'
            assert state['environment'][chat_port]==31038
            assert agent.set_route.call_args.args[0]['url']=='http://127.0.0.1:31042'
            runpy.run_path(str(root/'imageroot/actions/configure-module/29voice_agents'))
            agent.allocate_ports.assert_not_called()
        # Allocation failure must leave the conflicting state and route intact.
        state['environment']={'NETHVOICE_HOST':'synthetic.example','NETHVOICE_RECIPIENT_SERVICE_PORT':'30001','VOICE_AGENT_CHAT_PORT':'30002',
            'TCP_PORTS_RANGE':'31000-31041','CHAT_C2S_PORT':'31038','VOICE_AGENT_HTTP_PORT':'31038'}
        agent.set_route.reset_mock()
        try:
            runpy.run_path(str(root/'imageroot/actions/configure-module/29voice_agents'))
        except RuntimeError as error:
            assert str(error)=='max_ports_exceeded'
        else:
            raise AssertionError('conflicting port must require a successful allocation')
        assert state['environment']['VOICE_AGENT_HTTP_PORT']=='31038'
        agent.set_route.assert_not_called()
        # Execute the actual fresh-create mapping as well.
        state['environment'].clear()
        def shrink_udp(count, protocol, **kwargs):
            assert protocol=='udp' and count==1000
            return (40000,40999)
        agent.allocate_ports.reset_mock()
        agent.allocate_ports.side_effect=shrink_udp
        with patch.dict(os.environ,{'TCP_PORTS_RANGE':'32000-32044','UDP_PORTS_RANGE':'40000-42999'}):
            runpy.run_path(str(root/'imageroot/actions/create-module/05setenvs'))
        assert state['environment']['VOICE_AGENT_HTTP_PORT']==32042
        assert state['environment']['OAUTH2_PROXY_PORT']==32037
        assert [state['environment'][name] for name in
            ('CHAT_C2S_PORT','CHAT_HTTP_PORT','CHAT_COMPONENT_PORT','CHAT_GW_PORT')]==list(range(32038,32042))
        assert state['environment']['VOICE_AGENT_HTTP_PORT'] not in {
            value for name,value in state['environment'].items()
            if name!='VOICE_AGENT_HTTP_PORT' and name.endswith('PORT')}
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
assert 'org.nethserver.tcp-ports-demand="45"' in (root/'Containerfile').read_text()
print('NS8 secret filtering, idempotent port allocation and exact webhook route passed')
