"""Least-privilege MariaDB connections and durable pending-call correlation."""
import base64
import hashlib
import json
import os
import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from contextlib import contextmanager

from mysql.connector import connect
from mysql.connector.errors import IntegrityError
from mysql.connector.errorcode import ER_DUP_ENTRY
from nacl.secret import SecretBox


@contextmanager
def database(role):
    connection = connect(host='127.0.0.1', port=int(os.environ['VOICE_AGENT_DB_PORT']),
                         user='voice_agent_config' if role == 'config' else 'voice_agent_monitor',
                         password=os.environ['VOICE_AGENT_CONFIG_PASSWORD' if role == 'config' else 'VOICE_AGENT_MONITOR_PASSWORD'],
                         connection_timeout=3, read_timeout=3, write_timeout=3, time_zone='+00:00')
    try:
        yield connection
        if role == 'monitor':
            connection.commit()
    finally:
        connection.close()


class ClaimRejected(ValueError):
    """The pending call expired or belongs to a different provider claim."""


class Storage:
    def recent_calls(self, caller_number, days):
        from .recent_callers import normalize_number
        from .recent_cdr import number_variants, qualify
        caller = normalize_number(caller_number)
        if not caller or type(days) is not int or not 1 <= days <= 90:
            raise ValueError('recent_lookup_unavailable')
        zone = ZoneInfo(os.environ.get('VOICE_AGENT_CDR_TIMEZONE', 'UTC'))
        now = datetime.now(timezone.utc)
        earliest = now - timedelta(days=days)
        with database('config') as db:
            with db.cursor(dictionary=True) as cursor:
                def bounded(sql, args=(), limit=1000, *, examined=None):
                    if examined:
                        sql += f' ROWS EXAMINED {examined}'
                    cursor.execute('SET STATEMENT max_statement_time=1 FOR ' + sql, args)
                    values = cursor.fetchall()
                    if examined:
                        cursor.execute('SHOW WARNINGS')
                        warnings = cursor.fetchall()
                        if any(int(w['Code']) == 1931 for w in warnings):
                            raise ValueError('recent_lookup_overflow')
                        if warnings:
                            raise ValueError('recent_lookup_unavailable')
                    if len(values) > limit:
                        raise ValueError('recent_lookup_overflow')
                    return values
                devices = bounded('SELECT device_id,tech,destination_id FROM asterisk.voice_agent_callback_devices LIMIT 1001')
                trunks = bounded('SELECT tech,peer FROM asterisk.voice_agent_callback_trunks LIMIT 1001')
                rules = bounded('SELECT prefix,pattern,prepend,tech,peer FROM asterisk.voice_agent_callback_patterns LIMIT 1001')
                variants = sorted(number_variants(caller, rules))
                placeholders = ','.join(['%s'] * len(variants))
                # Equality on dst plus a raw calldate range uses the existing
                # idx_cdr_dst_calldate index. No function is applied to columns.
                columns = 'calldate,src,dst,channel,dstchannel,lastapp,lastdata,billsec,disposition,linkedid,uniqueid,sequence '
                records = bounded(
                    'SELECT ' + columns +
                    f'FROM asterisk.voice_agent_recent_cdr WHERE dst IN ({placeholders}) '
                    'AND calldate >= %s AND calldate <= %s LIMIT 1001',
                    (*variants, earliest.astimezone(zone).replace(tzinfo=None), now.astimezone(zone).replace(tzinfo=None)), examined=500)
                incoming = bounded(
                    'SELECT ' + columns +
                    'FROM asterisk.voice_agent_recent_cdr WHERE src = %s '
                    'AND calldate >= %s AND calldate <= %s AND disposition=\'ANSWERED\' AND billsec>0 LIMIT 1001',
                    (caller, earliest.astimezone(zone).replace(tzinfo=None), now.astimezone(zone).replace(tzinfo=None)), examined=500)
                records = list({(r['uniqueid'], r['sequence']): r for r in records + incoming}.values())
                if len(records) > 1000:
                    raise ValueError('recent_lookup_overflow')
                linked = sorted({r['linkedid'] for r in records if r['linkedid']})
                if linked:
                    ids = ','.join(['%s'] * len(linked))
                    seen = ','.join(['(%s,%s)'] * len(records))
                    extra = bounded(
                        'SELECT ' + columns +
                        f'FROM asterisk.voice_agent_recent_cdr WHERE linkedid IN ({ids}) '
                        f'AND (uniqueid,sequence) NOT IN ({seen}) LIMIT {1001-len(records)}',
                        (*linked, *(v for r in records for v in (r['uniqueid'], r['sequence']))), 1000-len(records), examined=500)
                    records.extend(extra)
        return qualify(records, devices, trunks, caller, rules, zone, earliest, now)

    def snapshot(self, agent_id):
        from .repository import PublishedRepository
        return PublishedRepository(lambda: connect(host='127.0.0.1', port=int(os.environ['VOICE_AGENT_DB_PORT']),
            user='voice_agent_config', password=os.environ['VOICE_AGENT_CONFIG_PASSWORD'],
            connection_timeout=3, read_timeout=3, write_timeout=3)).load(agent_id)

    def binding(self, binding_id):
        with database('config') as db:
            with db.cursor(dictionary=True) as cursor:
                cursor.execute('SELECT binding_id,provider,settings_json,secrets_encrypted,freepbx_trunk_id,trunk_name FROM asterisk.voice_agent_runtime_bindings WHERE binding_id=%s', (binding_id,))
                row = cursor.fetchone()
        if not row:
            raise ValueError('binding_unavailable')
        master = os.environ['SATELLITE_AGENT_CONFIG_KEY'].encode()
        encrypted = row.pop('secrets_encrypted')
        row['_signing_generation'] = hashlib.sha256(encrypted.encode('ascii')).hexdigest()
        secret = SecretBox(hashlib.sha256(master).digest()).decrypt(base64.b64decode(encrypted, validate=True))
        row.update(json.loads(secret))
        if not row.get('api_key'):
            names=('OPENAI_API_KEY',) if row['provider']=='openai' else ('XAI_API_KEY','GROK_API_KEY')
            row['api_key']=next((os.environ[name] for name in names if os.environ.get(name)),None)
        if not isinstance(row.get('api_key'),str) or not row['api_key'] or any(c in row['api_key'] for c in '\r\n\x00'):
            raise ValueError('provider_credentials_unavailable')
        row.update(json.loads(row.pop('settings_json')))
        if not re.fullmatch(r'VoiceAgentTrunk_[1-9][0-9]*', row['trunk_name']):
            raise ValueError('invalid_native_binding')
        return row

    def targets(self):
        with database('config') as db:
            with db.cursor(dictionary=True) as cursor:
                cursor.execute('SELECT id,name FROM asterisk.voice_agent_extension_directory LIMIT 1000')
                return cursor.fetchall()

    def routing_targets(self):
        # Read narrowly scoped authoritative views, never a configuration mirror.
        with database('config') as db:
            with db.cursor(dictionary=True) as cursor:
                cursor.execute("SELECT id,name,'' description FROM asterisk.voice_agent_extension_directory "
                               "UNION ALL SELECT id,name,description FROM asterisk.voice_agent_queue_directory ORDER BY id LIMIT 10001")
                rows = cursor.fetchall()
                if len(rows) > 10000:
                    raise ValueError('directory_capacity_exceeded')
        return rows

    def tools(self):
        with database('config') as db:
            with db.cursor(dictionary=True) as cursor:
                cursor.execute('SELECT tool_id,tool_version,manifest_json FROM asterisk.voice_agent_runtime_tools')
                return [json.loads(row['manifest_json']) for row in cursor.fetchall()]

    def admit(self, call, *, voice=True, capacity_fallback=False):
        from .telemetry import retention_days
        with database('monitor') as db:
            with db.cursor() as cursor:
                cursor.execute("INSERT INTO asteriskcdrdb.voice_agent_runs (run_id,agent_id,workflow_version,linkedid,started_at,retention_until,monitoring_version,provider,adapter,model,trace_status,deadline_at) VALUES (%s,%s,%s,%s,%s,DATE_ADD(%s,INTERVAL %s DAY),2,%s,%s,%s,'recording',DATE_ADD(NOW(),INTERVAL %s SECOND))", (call.run_id, call.snapshot['agent_id'], call.snapshot['workflow_version'], call.linkedid, call.started_at.replace(tzinfo=None), call.started_at.replace(tzinfo=None), retention_days(), call.binding['provider'], call.binding.get('adapter','realtime'), call.binding.get('model'), call.snapshot['max_call_duration_seconds']+60))
                if call.parent_run_id:
                    cursor.execute('UPDATE asteriskcdrdb.voice_agent_runs SET parent_run_id=%s WHERE run_id=%s', (call.parent_run_id, call.run_id))
                if capacity_fallback:
                    cursor.execute("UPDATE asteriskcdrdb.voice_agent_runs SET ended_at=NOW(6),outcome='fallback',"
                                   "error_code='capacity_exceeded',trace_status='complete',duration_ms=0 WHERE run_id=%s",
                                   (call.run_id,))
                elif voice:
                    cursor.execute('INSERT INTO asteriskcdrdb.voice_agent_pending_calls (session_id,run_id,provider,binding_id,agent_id,provider_leg_id,expires_at) VALUES (%s,%s,%s,%s,%s,%s,DATE_ADD(NOW(),INTERVAL 30 SECOND))',
                        (call.session_id, call.run_id, call.binding['provider'], call.binding['binding_id'], call.snapshot['agent_id'], call.leg_id))

    def accept(self, call, provider_call_id):
        with database('monitor') as db:
            with db.cursor() as cursor:
                cursor.execute(
                    "SELECT p.state, p.provider_call_id FROM asteriskcdrdb.voice_agent_pending_calls p "
                    "JOIN asteriskcdrdb.voice_agent_runs r ON r.run_id=p.run_id "
                    "WHERE p.session_id=%s AND p.provider_leg_id=%s AND p.run_id=%s "
                    "AND r.adapter=%s AND p.expires_at>NOW(6) FOR UPDATE",
                    (call.session_id, call.leg_id, call.run_id, call.binding.get('adapter', 'realtime')))
                claim = cursor.fetchone()
                if claim == ('accepted', provider_call_id):
                    return  # A prior attempt committed before its response timed out.
                if not claim or claim[0] != 'pending':
                    raise ClaimRejected('pending_call_unavailable')
                try:
                    cursor.execute("UPDATE asteriskcdrdb.voice_agent_pending_calls "
                                   "SET state='accepted', provider_call_id=%s WHERE session_id=%s",
                                   (provider_call_id, call.session_id))
                except IntegrityError as error:
                    if error.errno == ER_DUP_ENTRY:
                        raise ClaimRejected('provider_call_already_claimed') from None
                    raise
                cursor.execute('UPDATE asteriskcdrdb.voice_agent_runs SET provider_call_id=%s WHERE run_id=%s', (provider_call_id, call.run_id))

    def verify_signing_secret(self, binding):
        with database('monitor') as db:
            with db.cursor() as cursor:
                cursor.execute('UPDATE asterisk.voice_agent_webhook_verification SET webhook_verified_at=NOW() '
                               'WHERE binding_id=%s AND SHA2(secrets_encrypted,256)=%s',
                               (binding['binding_id'], binding['_signing_generation']))

    def media_ownership(self):
        with database('monitor') as db:
            with db.cursor() as cursor:
                cursor.execute("SELECT p.provider_leg_id,p.session_id FROM asteriskcdrdb.voice_agent_pending_calls p JOIN asteriskcdrdb.voice_agent_runs r ON r.run_id=p.run_id WHERE r.adapter='live_ws' AND r.started_at>NOW()-INTERVAL 1 DAY ORDER BY r.started_at DESC LIMIT 1024")
                return dict(cursor.fetchall())

    def consultation_ownership(self):
        with database('monitor') as db:
            with db.cursor() as cursor:
                cursor.execute("SELECT session_id FROM asteriskcdrdb.voice_agent_pending_calls p JOIN asteriskcdrdb.voice_agent_runs r ON r.run_id=p.run_id WHERE r.started_at>NOW()-INTERVAL 1 DAY ORDER BY r.started_at DESC LIMIT 1024")
                return {row[0] for row in cursor.fetchall()}

    def event(self, event):
        from .monitor_store import record_event
        with database('monitor') as db:
            record_event(db, event)

    def health(self, values):
        with database('monitor') as db:
            with db.cursor() as cursor:
                cursor.execute('INSERT INTO asteriskcdrdb.voice_agent_runtime_health '
                    '(singleton,observed_at,ari_connected,active_calls,degraded,spool_writable,queue_depth,pending_bytes,oldest_pending_seconds,dropped,retries,invalid_webhook_signatures,last_write_at) '
                    'VALUES (1,NOW(6),%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE '
                    'observed_at=VALUES(observed_at),ari_connected=VALUES(ari_connected),active_calls=VALUES(active_calls),'
                    'degraded=VALUES(degraded),spool_writable=VALUES(spool_writable),queue_depth=VALUES(queue_depth),pending_bytes=VALUES(pending_bytes),'
                    'oldest_pending_seconds=VALUES(oldest_pending_seconds),dropped=VALUES(dropped),retries=VALUES(retries),invalid_webhook_signatures=VALUES(invalid_webhook_signatures),last_write_at=VALUES(last_write_at)',
                    (values['ari_connected'],values['active_calls'],values['degraded'],values['spool_writable'],values['queue_depth'],values['pending_bytes'],
                     values['oldest_pending_seconds'],values['dropped'],values['retries'],values['invalid_webhook_signatures'],
                     datetime.fromisoformat(values['last_write_at']).replace(tzinfo=None) if values['last_write_at'] else None))

    def transcript(self, turn):
        with database('monitor') as db:
            with db.cursor() as cursor:
                cursor.execute('INSERT IGNORE INTO asteriskcdrdb.voice_agent_transcripts (event_id,run_id,position,content_encrypted,occurred_at,expires_at) SELECT %s,%s,%s,%s,%s,%s FROM asteriskcdrdb.voice_agent_runs WHERE run_id=%s AND NOW()<%s',
                    (turn['event_id'],turn['run_id'],turn['position'],turn['content_encrypted'],turn['occurred_at'].replace(tzinfo=None),turn['expires_at'].replace(tzinfo=None),turn['run_id'],turn['expires_at'].replace(tzinfo=None)))

    def _terminate_abandoned(self, sql, outcome, error, args=()):
        import uuid
        with database('monitor') as db:
            with db.cursor() as cursor:
                cursor.execute(sql + ' LIMIT 1024', args)
                ids = [row[0] for row in cursor.fetchall()]
        for run_id in ids:
            self.event({'event_id':str(uuid.uuid5(uuid.UUID(run_id),error)), 'run_id':run_id,
                'event_type':outcome, 'outcome':outcome, 'error_code':error, 'tool_id':None,
                'destination_id':None, 'occurred_at':datetime.now(timezone.utc).isoformat(),
                'monitoring_version':2})
        if ids:
            with database('monitor') as db:
                with db.cursor() as cursor:
                    cursor.execute("UPDATE asteriskcdrdb.voice_agent_runs SET trace_status='partial' WHERE run_id IN (" + ','.join(['%s']*len(ids)) + ") AND monitoring_version=2", tuple(ids))

    def recover(self):
        # A native handoff outcome may precede the final trace summary.
        # Preserve that outcome while making the interrupted trace explicit.
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None)
        with database('monitor') as db:
            with db.cursor() as cursor:
                cursor.execute("UPDATE asteriskcdrdb.voice_agent_runs SET trace_status='partial' WHERE trace_status='recording' AND monitoring_version=2 AND started_at<%s", (cutoff,))
        self._terminate_abandoned("SELECT run_id FROM asteriskcdrdb.voice_agent_runs WHERE outcome='running' AND started_at<%s", 'interrupted','runtime_restarted',(cutoff,))
        with database('monitor') as db:
            with db.cursor() as cursor:
                cursor.execute("UPDATE asteriskcdrdb.voice_agent_pending_calls p JOIN asteriskcdrdb.voice_agent_runs r ON r.run_id=p.run_id SET p.state='finished' WHERE p.state<>'finished' AND r.started_at<%s", (cutoff,))

    def expire_pending(self):
        self._terminate_abandoned("SELECT r.run_id FROM asteriskcdrdb.voice_agent_runs r JOIN asteriskcdrdb.voice_agent_pending_calls p ON p.run_id=r.run_id WHERE p.state='pending' AND p.expires_at<NOW() AND r.outcome='running'", 'fallback','setup_expired')


def trusted_target(destination_id, *, allow_pbx=False):
    pattern = r'(extension|queue):[0-9]{1,20}' if allow_pbx else r'extension:[0-9]{1,20}'
    if not isinstance(destination_id, str) or not re.fullmatch(pattern, destination_id):
        raise ValueError('invalid_destination')
    kind, number = destination_id.split(':', 1)
    context = 'voice-agent-transfer' + ('-' + kind if kind != 'extension' else '')
    return {'context': context, 'extension': number, 'priority': 1}
