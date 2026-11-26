"""Projection checks against the PHP-migrated disposable MariaDB, never a PBX."""
import json
import os
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import pytest

pytestmark = pytest.mark.skipif(not os.getenv('M0_TEST_PORT'), reason='disposable MariaDB not selected')


@pytest.fixture
def monitor_database(monkeypatch):
    import mysql.connector
    import voice_agent.storage as module
    @contextmanager
    def database(role):
        assert role == 'monitor'
        db = mysql.connector.connect(host='127.0.0.1', port=int(os.environ['M0_TEST_PORT']), user='root', password='', time_zone='+00:00')
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()
    monkeypatch.setattr(module, 'database', database)
    return database


def test_idempotent_projection_and_hourly_histograms(monitor_database):
    import mysql.connector
    import voice_agent.storage as module
    from voice_agent.telemetry import CallTrace
    from voice_agent.monitoring import Monitoring, EVENTS
    from voice_agent.runtime import Call
    database = monitor_database
    call = Call(str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()), 'synthetic',
        {'agent_id': 'receptionist', 'workflow_version': 11, 'max_call_duration_seconds': 60},
        {'binding_id': 'synthetic', 'provider': 'openai', 'adapter': 'realtime', 'model': 'synthetic-model'}, None)
    storage = module.Storage()
    storage.admit(call)
    monitor = Monitoring(storage)
    trace = CallTrace(monitor, call.run_id)
    span = trace.start('tool', tool_id='pbx.transfer')
    trace.end(span)
    trace.usage({'scope':'latest_provider_response','input_tokens':12,'output_tokens':4},'synthetic-response')
    monitor.emit(call.run_id,'provider_warning',provider_code='input_audio_rate_limit_exceeded',elapsed_ms=500)
    details = trace.finish()
    monitor.emit(call.run_id,'completed',outcome='completed',**details)
    for kind in EVENTS:
        if kind.startswith('consultation_'):
            monitor.emit(call.run_id,kind,error='consultation_announcement_timeout')
    for event in monitor.pending.values():
        storage.event(event)
        storage.event(event)
    with database('monitor') as db:
        cursor=db.cursor(dictionary=True)
        cursor.execute('SELECT duration_ms,usage_json,trace_status,provider,adapter FROM asteriskcdrdb.voice_agent_runs WHERE run_id=%s',(call.run_id,))
        row=cursor.fetchone()
        assert row['trace_status']=='complete'
        assert json.loads(row['usage_json'])['response_input_tokens']==12
        cursor.execute("SELECT SUM(samples) samples FROM asteriskcdrdb.voice_agent_metric_hours WHERE agent_id='receptionist' AND metric='tool_duration' AND dimension='pbx.transfer'")
        assert cursor.fetchone()['samples']==1
        cursor.execute('SELECT COUNT(*) count FROM asteriskcdrdb.voice_agent_run_events WHERE run_id=%s',(call.run_id,))
        assert cursor.fetchone()['count']==len(monitor.pending)
        cursor.execute("SELECT provider_code FROM asteriskcdrdb.voice_agent_run_events WHERE run_id=%s AND event_type='provider_warning'",(call.run_id,))
        assert cursor.fetchall()==[{'provider_code':'input_audio_rate_limit_exceeded'}]
        cursor.execute("SELECT event_type,error_code FROM asteriskcdrdb.voice_agent_run_events WHERE run_id=%s AND event_type LIKE 'consultation_%%'",(call.run_id,))
        consultation_events=cursor.fetchall()
        assert {row['event_type'] for row in consultation_events}=={kind for kind in EVENTS if kind.startswith('consultation_')}
        assert {row['error_code'] for row in consultation_events}=={'consultation_announcement_timeout'}
        # A DB failure after event insertion must roll back the event and rollup together.
        cursor.execute("CREATE TRIGGER asteriskcdrdb.synthetic_metric_failure BEFORE INSERT ON asteriskcdrdb.voice_agent_metric_hours FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic failure'")
    event={'event_id':str(uuid.uuid4()),'run_id':call.run_id,'event_type':'trace_finished','outcome':None,
        'error_code':None,'tool_id':None,'destination_id':None,'monitoring_version':2,'occurred_at':datetime.now(timezone.utc).isoformat(),
        'span_id':str(uuid.uuid4()),'elapsed_ms':300,'phase':'provider_sideband','status':'completed','duration_ms':200}
    try:
        with pytest.raises(mysql.connector.Error): storage.event(event)
        with database('monitor') as db:
            cursor=db.cursor()
            cursor.execute('SELECT COUNT(*) FROM asteriskcdrdb.voice_agent_run_events WHERE event_id=%s',(event['event_id'],))
            assert cursor.fetchone()[0]==0
    finally:
        with database('monitor') as db:
            db.cursor().execute('DROP TRIGGER asteriskcdrdb.synthetic_metric_failure')
    storage.health({**monitor.health(),'ari_connected':True,'active_calls':0,'invalid_webhook_signatures':3})
    # Native handoff can commit before cleanup/final-summary spooling.
    committed=Call(str(uuid.uuid4()),str(uuid.uuid4()),str(uuid.uuid4()),'synthetic',call.snapshot,call.binding,None)
    storage.admit(committed)
    storage.event({'event_id':str(uuid.uuid4()),'run_id':committed.run_id,'event_type':'transfer_committed',
        'outcome':'transferred','error_code':None,'tool_id':'pbx.transfer','destination_id':'extension:203',
        'monitoring_version':2,'occurred_at':datetime.now(timezone.utc).isoformat()})
    newer=Call(str(uuid.uuid4()),str(uuid.uuid4()),str(uuid.uuid4()),'synthetic',call.snapshot,call.binding,None)
    newer.started_at=datetime.now(timezone.utc)+timedelta(seconds=10)
    storage.admit(newer)
    storage.recover()
    with database('monitor') as db:
        cursor=db.cursor(dictionary=True)
        cursor.execute('SELECT outcome,trace_status FROM asteriskcdrdb.voice_agent_runs WHERE run_id=%s',(committed.run_id,))
        assert cursor.fetchone()=={'outcome':'transferred','trace_status':'partial'}
        cursor.execute('SELECT outcome,trace_status FROM asteriskcdrdb.voice_agent_runs WHERE run_id=%s',(newer.run_id,))
        assert cursor.fetchone()=={'outcome':'running','trace_status':'recording'}
        cursor.execute('SELECT state FROM asteriskcdrdb.voice_agent_pending_calls WHERE run_id=%s',(newer.run_id,))
        assert cursor.fetchone()['state']=='pending'


def test_pending_claim_retries_and_conflicts(monitor_database):
    from voice_agent.runtime import Call
    from voice_agent.storage import ClaimRejected, Storage

    storage = Storage()

    def admit():
        call = Call(str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()), 'caller',
                    {'agent_id': 'receptionist', 'workflow_version': 1, 'max_call_duration_seconds': 60},
                    {'binding_id': 'synthetic', 'provider': 'openai', 'adapter': 'realtime'}, None)
        storage.admit(call)
        return call

    first, second = admit(), admit()
    provider_id = str(uuid.uuid4())
    storage.accept(first, provider_id)
    storage.accept(first, provider_id)
    with pytest.raises(ClaimRejected):
        storage.accept(first, str(uuid.uuid4()))
    with pytest.raises(ClaimRejected):
        storage.accept(second, provider_id)

    with monitor_database('monitor') as db, db.cursor() as cursor:
        cursor.execute(
            "SELECT p.state, p.provider_call_id, r.provider_call_id "
            "FROM asteriskcdrdb.voice_agent_pending_calls p "
            "JOIN asteriskcdrdb.voice_agent_runs r ON r.run_id=p.run_id WHERE p.session_id=%s",
            (first.session_id,))
        assert cursor.fetchone() == ('accepted', provider_id, provider_id)
        cursor.execute("SELECT state, provider_call_id FROM asteriskcdrdb.voice_agent_pending_calls "
                       "WHERE session_id=%s", (second.session_id,))
        assert cursor.fetchone() == ('pending', None)
        cursor.execute("UPDATE asteriskcdrdb.voice_agent_pending_calls SET expires_at=NOW()-INTERVAL 1 SECOND "
                       "WHERE session_id IN (%s, %s)", (first.session_id, second.session_id))
    with pytest.raises(ClaimRejected):
        storage.accept(first, provider_id)
    with pytest.raises(ClaimRejected):
        storage.accept(second, str(uuid.uuid4()))
