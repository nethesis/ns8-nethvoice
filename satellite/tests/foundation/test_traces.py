import asyncio
import json
import uuid
from unittest.mock import AsyncMock, MagicMock

import aiohttp
import pytest

from voice_agent.monitoring import Monitoring
from voice_agent.providers.live import OpenAILiveAdapter
from voice_agent.providers.realtime import OpenAIAdapter, ProviderError


@pytest.mark.asyncio
@pytest.mark.parametrize('adapter_type', [OpenAIAdapter, OpenAILiveAdapter])
async def test_handshake_status_is_preserved_without_remote_message(adapter_type):
    client = MagicMock()
    client.ws_connect = AsyncMock(side_effect=aiohttp.WSServerHandshakeError(
        None, (), status=503, message='synthetic-private-provider-message'))
    adapter = adapter_type({'api_key': 'synthetic'}, session=client)
    adapter._call = 'synthetic-call'
    with pytest.raises(ProviderError) as caught:
        if adapter_type is OpenAILiveAdapter:
            await adapter.connect('synthetic-call')
        else:
            await adapter._connect('synthetic-call')
    assert caught.value.http_status == 503
    assert 'synthetic-private-provider-message' not in str(caught.value)


def test_monotonic_nested_spans_and_usage_are_content_free():
    from voice_agent.telemetry import CallTrace
    now = [10.0]
    monitor = Monitoring(MagicMock())
    trace = CallTrace(monitor, str(uuid.uuid4()), clock=lambda: now[0])
    parent = trace.start('tool', key='invocation', tool_id='pbx.transfer')
    now[0] = 10.25
    child = trace.start('transfer', parent=parent)
    now[0] = 10.75
    trace.end(child)
    trace.end(parent)
    trace.end(parent)  # repeated acknowledgments do not create measurements
    trace.usage({'scope': 'latest_provider_response', 'input_tokens': 10, 'output_tokens': 5}, 'response-1')
    trace.usage({'scope': 'latest_provider_response', 'input_tokens': 10, 'output_tokens': 5}, 'response-1')
    assert trace.usage_totals['response_input_tokens'] == 10
    finished = [e for e in monitor.pending.values() if e.get('phase') == 'transfer' and e.get('duration_ms') is not None]
    assert len(finished) == 1
    assert finished[0]['duration_ms'] == 500
    assert finished[0]['parent_span_id'] == parent
    assert 'response-1' not in json.dumps(list(monitor.pending.values()))


def test_cumulative_live_usage_and_trace_limits_are_explicit():
    from voice_agent.telemetry import CallTrace
    trace = CallTrace(Monitoring(MagicMock()), str(uuid.uuid4()))
    for seconds in [5, 5, 3, 12]:
        trace.usage({'scope': 'latest_live_session', 'seconds': seconds, 'backend': {'input_tokens': 20}})
    assert trace.usage_totals['live_seconds'] == 12
    assert trace.usage_totals['backend_input_tokens'] == 20
    for i in range(300):
        trace.end(trace.start('tool', key=str(i)))
    assert trace.partial
    assert sum(e['event_type'] == 'trace_gap' for e in trace.monitor.pending.values()) == 1
    assert sum(e['event_type'].startswith('trace_') for e in trace.monitor.pending.values()) <= 257
    assert sum(e['event_type']=='tool_completed' for e in trace.monitor.pending.values()) == 300


@pytest.mark.asyncio
async def test_runtime_persists_usage_with_capture_disabled():
    from test_runtime import fixtures, admit
    runtime, _, _, _ = fixtures()
    call = await admit(runtime)
    adapter = AsyncMock()
    async def observations():
        yield {'type': 'usage', 'observation_key': 'response-1', 'usage': {
            'scope': 'latest_provider_response', 'input_tokens': 10, 'output_tokens': 5}}
    adapter.events = observations
    runtime.adapter_factory = MagicMock(return_value=adapter)
    call.provider_call_id = 'synthetic'
    call.provider_answered.set()
    await runtime.converse(call)
    summaries = [e for e in runtime.monitoring.pending.values() if e.get('usage_json')]
    assert summaries
    assert json.loads(summaries[-1]['usage_json'])['response_input_tokens'] == 10
    assert any(e.get('phase')=='provider_stream' and e.get('status')=='failed' and e.get('error_code')=='provider_disconnected' for e in runtime.monitoring.pending.values())


@pytest.mark.asyncio
async def test_slow_spool_does_not_block_audio_loop(tmp_path, monkeypatch):
    import time
    monitor = Monitoring(MagicMock(), tmp_path)
    real_fsync = __import__('os').fsync
    def slow_fsync(fd):
        time.sleep(.1)
        real_fsync(fd)
    monkeypatch.setattr('os.fsync', slow_fsync)
    await monitor.start()
    start = asyncio.get_running_loop().time()
    monitor.emit(str(uuid.uuid4()), 'admitted')
    await asyncio.sleep(.01)
    assert asyncio.get_running_loop().time() - start < .07
    await monitor.stop()


def test_response_observations_can_arrive_out_of_order():
    from voice_agent.telemetry import CallTrace
    monitor=Monitoring(MagicMock())
    trace=CallTrace(monitor,str(uuid.uuid4()),clock=lambda:20,origin=10)
    trace.response('synthetic-response',status='completed',at=12)
    trace.response('synthetic-response',started=True,at=11)
    events=[e for e in monitor.pending.values() if e.get('duration_ms') is not None]
    assert len(events)==1 and events[0]['duration_ms']==1000
    assert events[0]['elapsed_ms']==2000
    assert 'synthetic-response' not in json.dumps(list(monitor.pending.values()))


def test_invalid_metadata_cannot_retain_content_or_fake_usage():
    from voice_agent.telemetry import CallTrace
    monitor=Monitoring(MagicMock())
    run=str(uuid.uuid4())
    assert not monitor.emit(run,'trace_finished',duration_ms=1)
    assert not monitor.emit(run,'trace_finished',phase='synthetic-private-data')
    assert not monitor.emit(run,'usage_snapshot',usage_json='{"prompt":"synthetic-private-data"}')
    monitor.emit(run,'tool_denied',error='synthetic-private-data',tool_id='arbitrary-tool')
    assert 'synthetic-private-data' not in json.dumps(list(monitor.pending.values()))
    trace=CallTrace(monitor,run)
    trace.usage({'scope':'latest_live_session','seconds':None,'backend':{}})
    assert not trace.usage_totals


@pytest.mark.asyncio
async def test_outage_spools_all_events_and_retry_is_serial(tmp_path):
    import threading
    storage=MagicMock()
    entered=threading.Event()
    release=threading.Event()
    def failing(event):
        entered.set()
        release.wait(1)
        raise RuntimeError('synthetic outage')
    storage.event.side_effect=failing
    monitor=Monitoring(storage,tmp_path)
    await monitor.start()
    for _ in range(4): monitor.emit(str(uuid.uuid4()),'admitted')
    await asyncio.to_thread(entered.wait,1)
    await asyncio.wait_for(monitor.spool_queue.join(),1)
    assert len(list(tmp_path.glob('*.json')))==4
    assert storage.event.call_count==1
    release.set()
    storage.event.side_effect=None
    await asyncio.wait_for(monitor.queue.join(),3)
    assert monitor.retries>=1 and monitor.degraded
    assert not list(tmp_path.glob('*.json'))
    await monitor.stop()


def test_php_python_monitoring_vocabulary_and_retention_match():
    import os
    import subprocess
    from pathlib import Path
    from voice_agent.telemetry import PHASES, retention_days
    root=Path(__file__).resolve().parents[3]
    source=root/'freepbx/var/www/html/freepbx/rest/lib/agents/Monitoring.php'
    for value in ['90','1','3650','0','3651','nope',' 10','10.5']:
        env=dict(os.environ,VOICE_AGENT_MONITORING_RETENTION_DAYS=value)
        result=subprocess.run(['php','-r',f'require {json.dumps(str(source))}; echo json_encode([NethVoice\\Agents\\Monitoring::retentionDays(),NethVoice\\Agents\\Monitoring::PHASES]);'],env=env,text=True,capture_output=True,check=True)
        days,phases=json.loads(result.stdout)
        expected=int(value) if value.isdigit() and 1<=int(value)<=3650 else 90
        assert days==expected
        assert set(phases)==PHASES


@pytest.mark.asyncio
async def test_cleanup_failure_is_separate_from_call_outcome():
    from test_runtime import fixtures, admit
    runtime, _, controller, _=fixtures()
    call=await admit(runtime)
    call.bridge_id='synthetic-owned-bridge'
    controller.destroy_bridge.side_effect=RuntimeError('synthetic-private-failure')
    await runtime.finish(call,'completed')
    events=list(runtime.monitoring.pending.values())
    assert any(e.get('phase')=='cleanup' and e.get('status')=='failed' for e in events)
    assert any(e.get('outcome')=='completed' for e in events)
    assert 'synthetic-private-failure' not in json.dumps(events)
    assert not runtime.calls


@pytest.mark.asyncio
async def test_confirmed_handoff_records_tool_completion_before_parent_cancellation():
    from test_runtime import fixtures, admit
    from voice_agent.tools import DEFINITIONS
    runtime, _, _, _=fixtures()
    call=await admit(runtime)
    call.adapter=AsyncMock()
    wire=next(t['wire_name'] for t in DEFINITIONS if t['id']=='pbx.transfer')
    handler=runtime.spawn(runtime.handle_tool(call,{'invocation_id':'synthetic-invocation','name':wire,
        'arguments':{'confirmed': True, 'destination_id':'extension:203'}}),call)
    async def wait_for_token():
        while not call.transfer_token: await asyncio.sleep(.001)
    await asyncio.wait_for(wait_for_token(),2)
    await runtime.event({'type':'StasisEnd','channel':{'id':call.caller_id}})
    await runtime.event({'type':'ChannelUserevent','eventname':'VoiceAgentTransfer','channel':{'id':call.caller_id},
        'userevent':{'token':call.transfer_token,'destination_id':'extension:203'}})
    await asyncio.gather(handler,return_exceptions=True)
    async def wait_for_finish():
        while runtime.calls: await asyncio.sleep(.001)
    await asyncio.wait_for(wait_for_finish(),2)
    completed=[e for e in runtime.monitoring.pending.values() if e['event_type']=='tool_completed']
    assert len(completed)==1 and completed[0]['duration_ms'] is not None
    assert completed[0]['status']=='completed'
    assert any(e.get('outcome')=='transferred' for e in runtime.monitoring.pending.values())


@pytest.mark.asyncio
async def test_spool_cleanup_failure_does_not_retry_committed_event_or_corrupt_counters(tmp_path, monkeypatch):
    from pathlib import Path
    real_unlink=Path.unlink
    def reject_event_unlink(path,*args,**kwargs):
        if path.suffix=='.json': raise PermissionError('synthetic cleanup failure')
        return real_unlink(path,*args,**kwargs)
    monkeypatch.setattr(Path,'unlink',reject_event_unlink)
    storage=MagicMock()
    monitor=Monitoring(storage,tmp_path)
    await monitor.start()
    monitor.emit(str(uuid.uuid4()),'admitted')
    try:
        await asyncio.wait_for(monitor.queue.join(),.5)
        assert storage.event.call_count==1 and monitor.pending_bytes==0
        assert not monitor.pending and monitor.degraded
        for _ in range(10): monitor.emit(str(uuid.uuid4()),'admitted')
        await asyncio.wait_for(monitor.queue.join(),1)
        assert len(list(tmp_path.glob('*.json')))==1
        assert monitor.health()['spool_writable'] is False
    finally:
        await monitor.stop()


@pytest.mark.asyncio
async def test_provider_stream_keeps_fixed_backend_error_category():
    from test_runtime import fixtures, admit
    runtime, _, _, _=fixtures()
    call=await admit(runtime)
    adapter=AsyncMock()
    async def observations():
        yield {'type':'error','code':'provider_live_backend_failed'}
    adapter.events=observations
    runtime.adapter_factory=MagicMock(return_value=adapter)
    call.provider_call_id='synthetic'
    call.provider_answered.set()
    await runtime.converse(call)
    assert any(e.get('phase')=='provider_stream' and e.get('error_code')=='provider_live_backend_failed' for e in runtime.monitoring.pending.values())
