# GPT-Live audio over WebSocket

GPT-Live uses a primary OpenAI WebSocket for audio and session control. Asterisk
connects to Satellite through a private `chan_websocket` externalMedia channel.
Realtime and Grok continue to use provider SIP and their own sideband protocols.

The transport is fixed by the selected adapter. There is no transport selector or
automatic SIP failover. Configure models, voices and tool permissions on the agent.

## Lifecycle and privacy

The runtime creates a durable run and owned media identity before opening the
provider session. It validates the Asterisk-generated media connection and codec,
then sends `session.start` once and claims the real ID from `session.started`.
WebSocket runs cannot be claimed by a SIP webhook. The existing pending/run tables
hold ownership, with `live_ws` identifying this adapter in monitoring.

The shared Live configuration and Responses tool handler retain the existing
conversation and authorization rules. The full opening is seeded at startup;
one short instruction activates the greeting when media and provider are ready.
Input continues during speech and silence. Live's continuous conversation does
not use Realtime cancellation/truncation events.

Asterisk media is PCMU/8000 mono, reframed into 160-byte/20 ms frames. Each direction
has a two-second/16,000-byte ceiling. Output is paced; Asterisk queue status and
XOFF/XON control are processed separately, targeting no more than 100 ms of queued
PBX audio. A two-second stall or buffer overflow fails safely. Initial caller input
is buffered within the same limit; no accumulated recording is burst upstream.

Transfers stop input and flush both output queues before releasing the caller.
Disconnects, caller cancellation and startup errors clean up owned resources;
late ARI creation is reaped, and restart recovery checks durable ownership plus
channel markers. No provider endpoint or caller-supplied URL controls media access.

The overall setup deadline is 30 seconds. Graceful provider close waits up to
15 seconds for final usage after caller media is detached. A missing terminal
event remains explicitly incomplete. Optional debug transcripts retain their
existing encrypted, per-agent opt-in policy. Audio is never persisted by the bridge.

## Operations

`VOICE_AGENT_LIVE_WS_MAX_CALLS` defaults to **4**; valid values are 0–32.
Zero blocks new bridge admissions and takes the published safe fallback while
existing calls drain. Invalid values fail closed. The NS8 helper passes this
nonsecret setting into Satellite and restore preserves it. Changing a container
environment requires its normal service restart under the active-call gate.

Asterisk must load `chan_websocket` and support incoming JSON media/control on
its private HTTP listener. Startup exercises these APIs before opening a paid
provider session. No public media route, new service or database migration is
required. Keep voice-agent and transcription logic and ARI ownership separate within the
shared Python application; transcription connection recovery must not restart
agent calls.

Monitoring identifies the primary WebSocket adapter as `live_ws`. Startup/media
phases, safe failure codes and first output are separate observations. The
`provider_audio` marker records the first locally observed 20 ms PCMU frame above
RMS 200; it is a content-free signal threshold, not speech recognition, a provider
clock, playback confirmation or evidence of intelligibility. Generated silence
must not be counted as first audible speech in diagnostic latency comparisons.

## Realtime schema compatibility

The immutable `pbx.transfer` v2 manifest uses root `oneOf` to require exactly one
of `destination_id` and `candidate_ref`. OpenAI Realtime rejects that keyword.
Only the known Realtime advertisement is projected into its accepted dialect;
the canonical manifests and Satellite's argument/call-bound authorization remain
strict. Live Responses and Grok receive their original schemas. Existing agents
need no publication changes for this repair.

Before deployment, verify the Satellite and FreePBX image digests against the
same NethVoice build revision. Drain calls before an upgrade. Rollback restores the preceding
verified image; never restore an old configuration database over operator edits.
Test helpers and provider budgets belong only in controlled staging, not images.

See [validation](voice-agents-validation.md) for evidence and remaining checks.
