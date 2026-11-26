"""Call one owned lab extension and exercise Satellite's real private opening."""
import asyncio
import io
import json
import os
from pathlib import Path
import re
import sys
import time
import wave
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from uuid import uuid4


def measure_private_greeting(case, row):
    from media import speech_edges
    from scenarios import Phrase, matches, require

    route = case.configure(attended=True)
    extension = case.lab.state["extensions"]["colleague"]
    agent_id = case.lab.agent_ids["live"]
    mode = case.case.removeprefix("parent-")
    caller = ""
    if mode != case.case:
        case.start(route)
        caller = case.lab.state["extensions"]["caller"]
    command = ["podman", "exec", "-i", "satellite", "python3", "-", extension, agent_id, mode, caller]
    source = Path(__file__).read_text()
    with ThreadPoolExecutor(max_workers=1) as pool:
        case.dial_attempted = True
        probe = pool.submit(case.lab._ssh, command, data=source, timeout=65)
        try:
            case.peer.wait("RINGING", 20)
            mark = case.answer_ringing_peer(case.peer)
            case.evidence.append("recipient answered owned consultation leg")
            if mode == "hello":
                time.sleep(3)
                if not probe.done():
                    case.play(case.peer, "hello")
        finally:
            row["probe"] = json.loads(probe.result())
    audio = case.peer.received(mark)
    with wave.open(io.BytesIO(audio)) as recorder:
        rate = recorder.getframerate()
        first, _ = speech_edges(rate, recorder.readframes(recorder.getnframes()))
    row["recipient_signal_ms_from_mark"] = None if first is None else round(first * 500 / rate)
    row["heard"] = case.speech.transcribe(audio, "it")[:240] if first is not None else ""
    require(matches(row["heard"], Phrase("consegna del pianoforte")), "Recipient did not hear the private call reason")
    case.score()


async def probe(extension, agent_id, mode, caller_extension):
    from voice_agent.ari import AriController
    from voice_agent.consultation import Consultation
    from voice_agent.consultation_phone import PhoneConsultation
    from voice_agent.providers.live import OpenAILiveAdapter
    from voice_agent.providers.live_primary import OpenAILiveWebSocketSession
    from voice_agent.runtime import Runtime
    from voice_agent.storage import Storage

    if (not re.fullmatch(r"8[0-9]{6}", extension) or mode not in ("silent", "hello", "activation", "recovery")
            or (caller_extension and not re.fullmatch(r"8[0-9]{6}", caller_extension))):
        raise ValueError("Invalid private greeting probe parameters")

    class ProbeStorage(Storage):
        # The published assistant and binding are real. Leave no synthetic run
        # with a fabricated parent in the module's Activity or claim tables.
        def admit(self, call):
            pass

        def accept(self, call, provider_call_id):
            pass

    class ProbeSession(OpenAILiveWebSocketSession):
        input_frames = 0
        first_input_ms = None
        first_voice_ms = None
        output_chunks = 0
        greeting_timed_out = False

        async def _send(self, event):
            await super()._send(event)
            if event["type"] == "session.input_audio.append":
                self.input_frames += 1
                if self.first_input_ms is None:
                    self.first_input_ms = elapsed()

        async def _emit(self, event):
            if event.get("type") == "input_speech" and self.first_voice_ms is None:
                self.first_voice_ms = elapsed()
            await super()._emit(event)

        async def _handle(self, event):
            if event.get("type") == "session.output_audio.delta" and self._audio_enabled:
                self.output_chunks += 1
            await super()._handle(event)

        async def respond(self, instructions=None, *, response_id=None):
            try:
                await super().respond(instructions, response_id=response_id)
            except TimeoutError:
                if response_id is not None:
                    raise
                self.greeting_timed_out = True
                if mode != "recovery" or "signal" in self.startup_marks:
                    raise
                # Keep only this probe alive past the production watchdog so
                # the same silent provider session can receive the control.
                async with asyncio.timeout(7):
                    await send_activation(self)
                    await self._greeting_played.wait()

    def elapsed():
        return round((time.monotonic() - answered_at) * 1000)

    async def send_activation(adapter):
        result["activation_sent_ms"] = elapsed()
        result["input_frames_at_activation"] = adapter.input_frames
        result["output_chunks_at_activation"] = adapter.output_chunks
        try:
            await OpenAILiveAdapter.respond(adapter)
            result["activation_ack_ms"] = elapsed()
        except Exception as error:
            result["activation_error"] = type(error).__name__
            raise

    async def activation(adapter):
        await asyncio.wait_for(adapter._ready.wait(), 12)
        await asyncio.sleep(3)
        if "signal" not in adapter.startup_marks:
            await send_activation(adapter)

    # This process subscribes only to its own Stasis app and runs no recovery.
    os.environ.pop("VOICE_AGENT_EVENT_DIR", None)
    controller = AriController(os.environ["ASTERISK_URL"], os.environ["ARI_USERNAME"],
                               os.environ["SATELLITE_ARI_PASSWORD"], app="voice-agent-lab-" + uuid4().hex)
    storage = ProbeStorage()
    runtime = Runtime(storage, controller, adapter_factory=ProbeSession)

    async def event(payload):
        if payload["type"] != "AgentAriConnected":
            await runtime.event(payload)

    controller.on_event = event
    public = runtime.load_snapshot(agent_id)
    transfer = next(tool for tool in public["tool_bindings"] if tool["tool_id"] == "pbx.transfer")
    if "extension:" + extension not in transfer["config"]["extension_allowlist"]:
        raise ValueError("Extension outside the fixture's published allowlist")
    assistant = runtime.load_snapshot(public["consultation"]["assistant_id"])
    bound = storage.binding(assistant["provider_binding_id"])
    if assistant["role"] != "consultation" or assistant["conversation"]["model"] != "gpt-live-1" or bound["provider"] != "openai":
        raise ValueError("Expected a published GPT-Live consultation assistant")
    parent = SimpleNamespace(session_id=str(uuid4()), run_id=str(uuid4()), caller_id=None,
                             caller_name="Mario Rossi", caller_number=None, linkedid=None, terminal=False,
                             assistant_snapshot=assistant, assistant_binding={**bound, "adapter": "live_ws", "model": "gpt-live-1"})
    recipient = {"mainextension": extension, "recipient_id": "lab-colleague",
                 "effective_presence": "online", "device_state": "0"}
    consultation = Consultation(parent, "extension:" + extension, recipient, "consegna del pianoforte",
                                None, recipient_name="Giulia Ferri", state="phone", deadline=time.monotonic() + 38)

    async def fixture_recipient(owned):
        if owned is not consultation:
            raise ValueError("Unexpected consultation")
        return recipient

    runtime.consultations.current = fixture_recipient
    phone = consultation.phone = PhoneConsultation(runtime, runtime.consultations, consultation)
    result = {"mode": mode, "with_parent": bool(caller_extension)}
    activated = None
    answered_at = time.monotonic()
    await controller.start()
    try:
        async with asyncio.timeout(8):
            while not controller.connected:
                await asyncio.sleep(.02)
        if caller_extension:
            parents = [channel for channel in await controller.list_channels()
                       if channel["name"].startswith(f"PJSIP/{caller_extension}-")
                       and channel["state"] == "Up"
                       and channel["dialplan"]["app_name"] == "Stasis"
                       and channel["dialplan"]["app_data"] == f"voice-agent,caller,{agent_id}"]
            if len(parents) != 1:
                raise RuntimeError("Expected one owned public agent call")
            parent.caller_id = parents[0]["id"]
        if not await phone.ring(15):
            raise RuntimeError("Owned recipient did not answer")
        answered_at = time.monotonic()
        call = phone.private
        while not call.adapter and not call.terminal:
            await asyncio.sleep(.02)
        adapter = call.adapter
        if mode == "activation" and adapter:
            activated = asyncio.create_task(activation(adapter))
        duration_ms = 19000 if mode == "recovery" else 12000
        async with asyncio.timeout(duration_ms / 1000 + 2):
            while not call.terminal and elapsed() < duration_ms:
                await asyncio.sleep(.05)
        result["startup_ms"] = {key: round((value - answered_at) * 1000)
                                for key, value in adapter.startup_marks.items()} if adapter else {}
        if adapter:
            result.update(input_frames=adapter.input_frames, first_input_ms=adapter.first_input_ms,
                          first_voice_ms=adapter.first_voice_ms, output_chunks=adapter.output_chunks,
                          greeting_timed_out=adapter.greeting_timed_out)
        if call.audio_bridge:
            result.update(padded_frames=call.audio_bridge.input_silence_frames,
                          real_frames=call.audio_bridge.input_real_frames,
                          max_input_gap_ms=call.audio_bridge.max_input_gap_ms)
        result["ended_before_probe_cleanup"] = call.terminal
        return result
    finally:
        if activated:
            activated.cancel()
            await asyncio.gather(activated, return_exceptions=True)
        try:
            call = phone.private
            await phone.close()
            if call and call.finalizer:
                await asyncio.shield(call.finalizer)
        finally:
            await controller.stop()


if __name__ == "__main__":
    print(json.dumps(asyncio.run(probe(*sys.argv[1:]))))
