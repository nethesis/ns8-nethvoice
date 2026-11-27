"""Check inherited correlation against the exact upstream runner used by the build."""
import asyncio
from pathlib import Path
import sys

import voice_agent.runtime as runner

sys.path.insert(0, str(Path(runner.__file__).resolve().parents[1] / 'tests/foundation'))
from test_runtime import admit, fixtures


async def check():
    runtime, storage, controller, snapshot = fixtures()
    call = await admit(runtime)
    variables = controller.originate_local.await_args.args[2]
    assert variables['__AGENT_SESSION_ID'] == call.session_id
    assert variables['__AGENT_PROVIDER_LEG_ID'] == call.leg_id
    assert variables['__VOICE_AGENT_ID'] == snapshot['agent_id']
    assert variables['__AGENT_PROVIDER_TRUNK'].startswith('VoiceAgentTrunk_')
    await runtime.finish(call, 'fallback', 'test_finished', fallback=True)


asyncio.run(check())
print('Pinned Satellite supplies inherited provider-leg correlation variables')
