import asyncio
import json
import uuid
from unittest.mock import MagicMock

import pytest
from voice_agent.monitoring import Monitoring, MAX_PENDING, RESERVED


def test_queue_is_bounded_and_degradation_is_detectable():
    monitor=Monitoring(MagicMock())
    for number in range(MAX_PENDING+10):
        monitor.emit(str(uuid.uuid4()),'admitted',key=str(number))
    assert monitor.queue.qsize()==MAX_PENDING-RESERVED
    assert len(monitor.pending)==MAX_PENDING-RESERVED
    assert monitor.degraded
    for number in range(32):
        monitor.emit(str(uuid.uuid4()),'completed',outcome='completed',key=str(number))
    assert monitor.queue.qsize()==MAX_PENDING-RESERVED+32


@pytest.mark.asyncio
async def test_capacity_gap_survives_restart(tmp_path):
    before=Monitoring(MagicMock(),tmp_path)
    for number in range(MAX_PENDING-RESERVED+1):
        before.emit(str(uuid.uuid4()),'admitted',key=str(number))
    await asyncio.to_thread(before._persist_marker)
    assert Monitoring(MagicMock(),tmp_path).degraded


def test_existing_container_volume_becomes_private(tmp_path):
    tmp_path.chmod(0o755)
    Monitoring(MagicMock(),tmp_path)
    assert tmp_path.stat().st_mode & 0o777==0o700


@pytest.mark.asyncio
async def test_private_outbox_recovers_idempotent_metadata_after_restart(tmp_path):
    run_id=str(uuid.uuid4())
    before=Monitoring(MagicMock(),tmp_path)
    before.emit(run_id,'tool_denied',error='tool_denied',key='synthetic-invocation')
    await asyncio.to_thread(before._persist, next(iter(before.pending.values())))
    files=list(tmp_path.glob('*.json'))
    assert len(files)==1 and files[0].stat().st_mode & 0o777==0o600
    event=json.loads(files[0].read_text())
    assert set(event)=={'event_id','run_id','event_type','outcome','error_code','tool_id','destination_id','occurred_at','monitoring_version'}
    storage=MagicMock()
    after=Monitoring(storage,tmp_path)
    await after.start()
    await asyncio.wait_for(after.queue.join(),timeout=1)
    storage.event.assert_called_once_with(event)
    assert not list(tmp_path.glob('*.json'))
    await after.stop()

@pytest.mark.asyncio
async def test_permanent_rejection_then_good_event_survives_restart(tmp_path):
    from mysql.connector.errors import DataError
    storage = MagicMock()
    run = str(uuid.uuid4())

    def write(event):
        if event['event_type'] == 'tool_started':
            raise DataError(errno=1406, msg='rejected row')

    storage.event.side_effect = write
    monitor = Monitoring(storage, tmp_path)
    await monitor.start()
    monitor.emit(run, 'tool_started')
    monitor.emit(run, 'completed', outcome='completed')
    await asyncio.wait_for(monitor.queue.join(), 1)
    assert [c.args[0]['event_type'] for c in storage.event.call_args_list] == ['tool_started', 'completed', 'trace_gap']
    assert monitor.dropped == 1 and monitor.retries == 0
    await monitor.stop()
    assert next(tmp_path.glob('*.rejected')).read_text() == run

    (tmp_path / 'invalid.json').write_text('private malformed payload')
    after = Monitoring(storage, tmp_path)
    await after.start()
    after.emit(run, 'media_connected')
    await asyncio.wait_for(after.queue.join(), 1)
    assert not after.pending and not after.spool_disabled
    assert storage.event.call_args.args[0]['event_type'] == 'media_connected'
    assert not list(tmp_path.glob('*.json'))
    assert all('private' not in p.read_text() for p in tmp_path.glob('*.rejected'))
    await after.stop()
