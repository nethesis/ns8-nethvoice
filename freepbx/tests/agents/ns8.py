"""Synthetic NS8 helper contract; no cluster actions or real secret files."""
import os
import runpy
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

root=Path(__file__).resolve().parents[3]
sys.path.insert(0, str(root/'imageroot/pypkg'))
from video_gateway import TCP_PORT_VARS
from voice_preview import TCP_PORT_VARS as AGENT_TCP_PORT_VARS

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
    mset_env=lambda values:state["environment"].update(values),
    allocate_ports=Mock(return_value=(30000,30000)),set_route=Mock())
with tempfile.TemporaryDirectory() as temporary, patch.dict('sys.modules',{'agent':agent}), patch.dict(os.environ,{'MODULE_ID':'nethvoice_test'}):
    before=os.getcwd()
    try:
        os.chdir(temporary)
        allocate = runpy.run_path(str(root/'imageroot/pypkg/voice_preview.py'))['allocate_agent_ports']
        allocate(state['environment'])
        allocate(state['environment'])
        agent.allocate_ports.assert_called_once_with(1,'tcp',keep_existing=True)
        # Reuse the dedicated slot without exceeding a fully allocated demand.
        for total in (43,44):
            state['environment'].pop('VOICE_AGENT_HTTP_PORT',None)
            state['environment']['TCP_PORTS_RANGE']='31000-'+str(31000+total-1)
            agent.allocate_ports.reset_mock()
            agent.allocate_ports.side_effect=RuntimeError('max_ports_exceeded')
            allocate(state['environment'])
            assert state['environment']['VOICE_AGENT_HTTP_PORT']=='31042'
            agent.allocate_ports.assert_not_called()
        # Older or differently laid-out installations need a new allocation.
        for total in (39,40,42,43):
            state['environment'].pop('VOICE_AGENT_HTTP_PORT',None)
            state['environment']['TCP_PORTS_RANGE']='31000-'+str(31000+total-1)
            if total==43:
                state['environment']['CHAT_GW_PORT']='31042'
            agent.allocate_ports.reset_mock()
            agent.allocate_ports.side_effect=None
            allocate(state['environment'])
            assert state['environment']['VOICE_AGENT_HTTP_PORT']=='30000'
            agent.allocate_ports.assert_called_once_with(1,'tcp',keep_existing=True)
            allocate(state['environment'])
            agent.allocate_ports.assert_called_once()
        # Repair a persisted chat conflict, including int/string env values.
        for chat_port in ('CHAT_C2S_PORT','CHAT_HTTP_PORT','CHAT_COMPONENT_PORT','CHAT_GW_PORT'):
            state['environment']={'NETHVOICE_HOST':'synthetic.example','NETHVOICE_RECIPIENT_SERVICE_PORT':'30001','VOICE_AGENT_CHAT_PORT':'30002',
                'TCP_PORTS_RANGE':'31000-31043',chat_port:31038,'VOICE_AGENT_HTTP_PORT':'31038'}
            agent.allocate_ports.reset_mock()
            agent.allocate_ports.side_effect=RuntimeError('max_ports_exceeded')
            allocate(state['environment'])
            assert state['environment']['VOICE_AGENT_HTTP_PORT']=='31042'
            assert state['environment'][chat_port]==31038
            allocate(state['environment'])
            agent.allocate_ports.assert_not_called()
        # Allocation failure must leave the conflicting state and route intact.
        state['environment']={'NETHVOICE_HOST':'synthetic.example','NETHVOICE_RECIPIENT_SERVICE_PORT':'30001','VOICE_AGENT_CHAT_PORT':'30002',
            'TCP_PORTS_RANGE':'31000-31041','CHAT_C2S_PORT':'31038','VOICE_AGENT_HTTP_PORT':'31038'}
        agent.set_route.reset_mock()
        try:
            allocate(state['environment'])
        except RuntimeError as error:
            assert str(error)=='max_ports_exceeded'
        else:
            raise AssertionError('conflicting port must require a successful allocation')
        assert state['environment']['VOICE_AGENT_HTTP_PORT']=='31038'
        agent.set_route.assert_not_called()
        # A legacy install used 39 TCP slots plus four extra chat ports.
        state['environment'] = {'NETHVOICE_HOST':'synthetic.example','TCP_PORTS_RANGE':'31000-31038','CHAT_GW_PORT':'32003'}
        agent.allocate_ports.reset_mock()
        agent.allocate_ports.side_effect = None
        agent.allocate_ports.return_value = (33000,33002)
        for _ in range(2):
            allocate(state['environment'])
        agent.allocate_ports.assert_called_once_with(3,'tcp',keep_existing=True)
        assert [state['environment'][name] for name in ('VOICE_AGENT_HTTP_PORT','NETHVOICE_RECIPIENT_SERVICE_PORT','VOICE_AGENT_CHAT_PORT')] == ['33000','33001','33002']
        # Execute the actual fresh-create mapping as well.
        state['environment'].clear()
        agent.allocate_ports.reset_mock()
        agent.allocate_ports.side_effect=[(40000,40999), (41000,41000), (41001,41001)]
        with patch.dict(os.environ,{'TCP_PORTS_RANGE':'32000-32053','UDP_PORTS_RANGE':'40000-42999'}):
            runpy.run_path(str(root/'imageroot/actions/create-module/05setenvs'))
        assert [state['environment'][name] for name in AGENT_TCP_PORT_VARS]==list(range(32046,32049))
        assert state['environment']['OAUTH2_PROXY_PORT']==32037
        assert [state['environment'][name] for name in
            ('CHAT_C2S_PORT','CHAT_HTTP_PORT','CHAT_COMPONENT_PORT','CHAT_GW_PORT')]==list(range(32038,32042))
        assert [state['environment'][name] for name in TCP_PORT_VARS]==list(range(32042,32046))
        assert [call.args for call in agent.allocate_ports.call_args_list]==[(1000,'udp'), (1,'udp')]
        assert agent.allocate_ports.call_args.kwargs=={'keep_existing':True}
        source = dict(state['passwords.env'])
        state['passwords.old'] = source
        with patch.dict(os.environ,{'TCP_PORTS_RANGE':'33000-33053','UDP_PORTS_RANGE':'40000-40999'}), patch('sys.argv',['05setenvs','--clone']):
            runpy.run_path(str(root/'imageroot/actions/create-module/05setenvs'))
        assert state['passwords.env']['SATELLITE_AGENT_CONFIG_KEY'] == source['SATELLITE_AGENT_CONFIG_KEY']
        assert all(state['passwords.env'][name] != source[name] for name in ('VOICE_AGENT_RUNTIME_TOKEN','VOICE_AGENT_CONFIG_PASSWORD','VOICE_AGENT_MONITOR_PASSWORD'))
        assert state['passwords.env']['MEDIAMTX_API_PASSWORD'] != source['MEDIAMTX_API_PASSWORD']
        assert state['environment']['VOICE_AGENT_ENABLED'] == state['environment']['VOICE_AGENT_SIP_LAB_ENABLED'] == 'false'
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
assert 'org.nethserver.tcp-ports-demand="54"' in (root/'Containerfile').read_text()
print('NS8 port allocation, clone secrets and route cleanup passed')
