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
