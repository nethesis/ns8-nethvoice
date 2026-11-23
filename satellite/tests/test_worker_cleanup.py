"""Transcription request workers never survive timeout, cancellation or shutdown."""
import asyncio
import os
import sys

import pytest

import api


@pytest.mark.asyncio
@pytest.mark.parametrize('reason', ['timeout', 'cancel', 'shutdown'])
async def test_request_worker_is_terminated_and_reaped(tmp_path, monkeypatch, reason):
    monkeypatch.setattr(api.db, 'is_configured', lambda: False)
    marker = tmp_path / 'worker.pid'
    program = '''
import os, signal, sys, time
from pathlib import Path
signal.signal(signal.SIGTERM, signal.SIG_IGN)
Path(sys.argv[1]).write_text(str(os.getpid()))
while True: time.sleep(1)
'''
    async with api.lifespan(api.app):
        task = asyncio.create_task(api._run_worker(
            [sys.executable, '-c', program, str(marker)], timeout=0.3 if reason == 'timeout' else None))
        try:
            async with asyncio.timeout(2):
                while not marker.exists():
                    await asyncio.sleep(0.01)
            if reason == 'cancel':
                task.cancel()
            if reason != 'shutdown':
                with pytest.raises((TimeoutError, asyncio.CancelledError)):
                    await task
        finally:
            if reason != 'shutdown' and not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
    assert task.done()
    assert not api._worker_tasks
    with pytest.raises(ProcessLookupError):
        os.kill(int(marker.read_text()), 0)
