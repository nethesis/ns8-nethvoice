"""Regression for caller disconnect while optional connector admission awaits."""

import asyncio

from tests.test_agent_voice import setup, run_async


@run_async
async def test_hangup_during_connector_binding_does_not_originate(setup):
    _, runtime, ari, _ = setup
    entered, release = asyncio.Event(), asyncio.Event()

    async def bindings(profile, origin):
        entered.set()
        await release.wait()
        return []

    runtime.application.voice_bindings = bindings
    admission = asyncio.create_task(runtime._admit("caller-1", ["caller", "42", "builtin_internal"]))
    await asyncio.wait_for(entered.wait(), 1)
    await runtime._handle_ari_event({"type": "StasisEnd", "channel": {"id": "caller-1"}})
    release.set()
    await admission
    assert not runtime.calls
    assert not runtime.by_caller
    assert not ari.originated
