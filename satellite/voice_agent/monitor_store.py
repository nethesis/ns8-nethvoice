"""Transactional monitoring projection. A unique event is the unit of aggregation."""
from datetime import datetime, timezone

from .monitoring import validate_event
from .telemetry import BUCKETS, retention_days

EVENT_COLUMNS = ('event_id', 'run_id', 'event_type', 'error_code', 'tool_id', 'destination_id',
    'occurred_at', 'result_count', 'monitoring_version', 'span_id', 'parent_span_id', 'phase',
    'status', 'elapsed_ms', 'duration_ms', 'http_status', 'provider_code')


def record_event(db, observation):
    event = validate_event(dict(observation))
    occurred = datetime.fromisoformat(event['occurred_at']).astimezone(timezone.utc).replace(tzinfo=None)
    with db.cursor(dictionary=True) as cursor:
        cursor.execute('SELECT run_id,agent_id,provider,adapter,outcome,error_code,started_at FROM '
            'asteriskcdrdb.voice_agent_runs WHERE run_id=%s AND started_at>=DATE_SUB(NOW(),INTERVAL %s DAY) FOR UPDATE',
            (event['run_id'], retention_days()))
        run = cursor.fetchone()
        # An expired spool must not recreate or aggregate a deleted run.
        if not run:
            return
        values = {**event, 'occurred_at': occurred}
        cursor.execute('INSERT IGNORE INTO asteriskcdrdb.voice_agent_run_events (' + ','.join(EVENT_COLUMNS)
                       + ') VALUES (' + ','.join(['%s']*len(EVENT_COLUMNS)) + ')', tuple(values.get(c) for c in EVENT_COLUMNS))
        if cursor.rowcount != 1:
            return
        common = (run['started_at'].replace(minute=0, second=0, microsecond=0), run['agent_id'],
                  run['provider'] or 'unknown', run['adapter'] or 'unknown')
        def metric(name, dimension='', result='', value=0, *, histogram=False):
            bucket = next((b for b in BUCKETS if value <= b), BUCKETS[-1]) if histogram else 0
            cursor.execute('INSERT INTO asteriskcdrdb.voice_agent_metric_hours '
                '(hour_start,agent_id,provider,adapter,metric,dimension,result,bucket,samples,total) '
                'VALUES (%s,%s,%s,%s,%s,%s,%s,%s,1,%s) '
                'ON DUPLICATE KEY UPDATE samples=samples+1,total=total+VALUES(total)',
                (*common, name, dimension, result, bucket, value))
        if event.get('outcome'):
            outcome = event['outcome']
            if run['outcome'] == 'running' or (run['outcome'] == 'interrupted' and run['error_code'] == 'runtime_restarted'):
                cursor.execute('UPDATE asteriskcdrdb.voice_agent_runs SET ended_at=%s,outcome=%s,error_code=%s WHERE run_id=%s',
                    (occurred, outcome, event.get('error_code'), event['run_id']))
            cursor.execute("UPDATE asteriskcdrdb.voice_agent_pending_calls SET state='finished' WHERE run_id=%s", (event['run_id'],))
        if event.get('run_duration_ms') is not None:
            if run['outcome'] == event.get('outcome'):
                cursor.execute('UPDATE asteriskcdrdb.voice_agent_runs SET ended_at=%s WHERE run_id=%s',(occurred,event['run_id']))
            cursor.execute('UPDATE asteriskcdrdb.voice_agent_runs SET duration_ms=%s,first_output_ms=%s,'
                "trace_status=IF(trace_status='partial' OR %s=0,'partial','complete') WHERE run_id=%s",
                (event['run_duration_ms'], event.get('first_output_ms'), event.get('trace_complete', False), event['run_id']))
            metric('run_duration', result=event.get('outcome') or '', value=event['run_duration_ms'], histogram=True)
        if event['event_type'] == 'media_connected' and event.get('elapsed_ms') is not None:
            cursor.execute('UPDATE asteriskcdrdb.voice_agent_runs SET setup_duration_ms=%s WHERE run_id=%s', (event['elapsed_ms'], event['run_id']))
            metric('setup_duration', value=event['elapsed_ms'], histogram=True)
        if event['event_type'] == 'trace_gap':
            cursor.execute("UPDATE asteriskcdrdb.voice_agent_runs SET trace_status='partial' WHERE run_id=%s", (event['run_id'],))
        if event['event_type'] == 'trace_finished' and event.get('duration_ms') is not None:
            metric('phase_duration', event['phase'], event['status'], event['duration_ms'], histogram=True)
            if event['status'] == 'failed' and event['phase'].startswith('provider_'):
                category = 'provider_http_' + str(event['http_status']) if event.get('http_status') else event.get('provider_code') or event.get('error_code') or 'other'
                metric('provider_error', event['phase'], category)
        if event['event_type'] == 'provider_output' and event.get('elapsed_ms') is not None:
            metric('first_output', value=event['elapsed_ms'], histogram=True)
        if event['event_type'] in ('tool_completed', 'tool_failed', 'tool_denied') and event.get('tool_id'):
            result = 'denied' if event['event_type']=='tool_denied' else event.get('status') or {'tool_completed':'completed','tool_failed':'failed'}[event['event_type']]
            metric('tool_invocations', event['tool_id'], result)
            if event.get('duration_ms') is not None:
                metric('tool_duration',event['tool_id'],result,event['duration_ms'],histogram=True)
        if event['event_type'] == 'usage_snapshot':
            cursor.execute('UPDATE asteriskcdrdb.voice_agent_runs SET usage_json=%s,usage_complete=%s WHERE run_id=%s',
                (event.get('usage_json'), event.get('usage_complete', False), event['run_id']))
