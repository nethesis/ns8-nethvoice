import os
import subprocess
import sys

import pytest

from voice_agent import drain
from test_runtime import fixtures, admit


@pytest.mark.asyncio
async def test_idle_claim_is_atomic_across_processes_and_active_calls(monkeypatch, tmp_path):
    lock = tmp_path / drain.LOCK.name
    monkeypatch.setattr(drain, 'LOCK', lock)
    def control(*args):
        return subprocess.run([sys.executable, '-m', 'voice_agent.drain', *args],
                              env={**os.environ, 'TMPDIR': str(tmp_path)}, check=False).returncode
    runtime, _, controller, _ = fixtures()
    call = await admit(runtime)
    assert control() == os.EX_TEMPFAIL
    await runtime.finish(call, 'completed')
    assert control() == 0
    await runtime.admit({'id': 'new', 'dialplan': {'context': 'voice-agent-basic_voice'}}, 'basic_voice')
    controller.continue_channel.assert_awaited_once_with('new')
    assert not runtime.calls
    assert control('--cancel') == 0
    call = await admit(runtime)
    await runtime.finish(call, 'completed')
