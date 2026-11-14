"""Native schemas versus real runner IDs; only the disposable M0 database.

Temporary tables shadow the native names on this connection. No PBX access,
identifier truncation, schema widening or global SQL-mode changes are involved.
"""
import asyncio
from contextlib import contextmanager
import os
from pathlib import Path
import sys
import uuid
from unittest.mock import AsyncMock, patch

import mysql.connector
import voice_agent.runtime as runner
from voice_agent.ari import AriController
from voice_agent.storage import Storage

sys.path.insert(0, str(Path(runner.__file__).resolve().parents[1] / 'tests/foundation'))
from test_runtime import admit, fixtures


async def check():
    runtime, _, _, _ = fixtures()
    call = await admit(runtime)
    db = mysql.connector.connect(host='127.0.0.1', port=int(os.environ['M0_TEST_PORT']),
                                 user='root', password='', database='asteriskcdrdb')
    try:
        cursor = db.cursor()
        cursor.execute("SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'")
        schemas = Path(__file__).resolve().parents[3] / 'mariadb/docker-entrypoint-initdb.d'
        for table in ('cdr', 'daily_cdr', 'cel', 'tmp_cdr', 'ivr_choice'):
            sql = (schemas / f'20_asteriskcdrdb.{table}-schema.sql').read_text()
            ddl = sql[sql.index('CREATE TABLE'):].replace('CREATE TABLE', 'CREATE TEMPORARY TABLE', 1)
            cursor.execute(ddl)
            cursor.execute(f'SHOW COLUMNS FROM `{table}`')
            columns = cursor.fetchall()
            fields = [c[0] for c in columns if c[5] != 'auto_increment']
            defaults = {c[0]: (0 if 'int' in c[1] else '2026-10-23 00:00:00' if c[1] == 'datetime' else '')
                        for c in columns}
            identifiers = [c[0] for c in columns if c[0] in ('uniqueid', 'linkedid')]
            assert all(c[1] == 'varchar(32)' for c in columns if c[0] in identifiers)
            sql = f'INSERT INTO `{table}` (' + ','.join(f'`{c}`' for c in fields) + ') VALUES (' + ','.join(['%s'] * len(fields)) + ')'
            # Demonstrate the original failure independently for both identity columns.
            for column in identifiers:
                for old_id in (str(uuid.uuid4()), str(uuid.uuid4()) + ';2'):
                    values = {**defaults, 'uniqueid': 'synthetic', 'linkedid': 'synthetic', column: old_id}
                    try:
                        cursor.execute(sql, [values[c] for c in fields])
                    except mysql.connector.Error as error:
                        assert error.errno == 1406 and column in str(error)
                    else:
                        raise AssertionError(f'{table}.{column} accepted oversized identity')
            controller = AriController('http://synthetic', 'user', 'password')
            controller.request = AsyncMock()
            await controller.originate_local(call.session_id, call.leg_id, {})
            attempt = str(uuid.uuid4())
            await controller.originate_consult(call.session_id, attempt, call.leg_id, '203', 10)
            assert controller.request.await_args.kwargs['params']['appArgs'] == f'consult,{call.session_id},{attempt}'
            for request in controller.request.await_args_list:
                primary = request.kwargs['params']['channelId']
                # Asterisk uses the assigned ID on ;1 and appends ;2 on its peer.
                for uniqueid in (primary, primary + ';2'):
                    for linkedid in (primary, primary + ';2', call.linkedid):
                        values = {**defaults, 'uniqueid': uniqueid, 'linkedid': linkedid}
                        cursor.execute(sql, [values[c] for c in fields])
                        cursor.execute('SHOW WARNINGS')
                        assert cursor.fetchall() == []
                        if 'linkedid' in fields:
                            cursor.execute(f'SELECT uniqueid,linkedid FROM `{table}` WHERE uniqueid=%s AND linkedid=%s', (uniqueid, linkedid))
                            saved = cursor.fetchall()
                            assert saved and all(row == (uniqueid, linkedid) for row in saved)
                        else:
                            cursor.execute(f'SELECT uniqueid FROM `{table}` WHERE uniqueid=%s', (uniqueid,))
                            saved = cursor.fetchall()
                            assert saved and all(row == (uniqueid,) for row in saved)
            cursor.execute(f'SELECT COUNT(*) FROM `{table}`')
            assert cursor.fetchone()[0] == 12
        db.rollback()

        @contextmanager
        def database(role):
            assert role == 'monitor'
            yield db

        # Monitor and webhook correlation keep the full UUID session/run and provider ID.
        provider_id = 'synthetic-provider/' + str(uuid.uuid4())
        with patch('voice_agent.storage.database', database):
            storage = Storage()
            storage.admit(call)
            storage.accept(call, provider_id)
            cursor.execute('SELECT session_id,run_id,provider_leg_id,provider_call_id,state FROM voice_agent_pending_calls WHERE session_id=%s', (call.session_id,))
            assert cursor.fetchone() == (call.session_id, call.run_id, call.leg_id, provider_id, 'accepted')
            cursor.execute('SELECT linkedid,provider_call_id FROM voice_agent_runs WHERE run_id=%s', (call.run_id,))
            assert cursor.fetchone() == (call.linkedid, provider_id)
        db.rollback()
    finally:
        db.close()
        await runtime.finish(call, 'completed')


asyncio.run(check())
print('Native CDR/CEL: strict SQL rejects UUIDs (1406); compact Local halves/linked IDs and monitoring correlation persist unchanged')
