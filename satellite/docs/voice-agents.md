# Voice agents runtime preview

Enable **Voice agents preview** under NethVoice **Integrations** to run GPT-Live.
The switch defaults to off. PHP owns the versioned preview database schema.
Satellite reads immutable v8 and v9 publications and pins one version per call.
Fresh preview installation rejects earlier development databases before making
changes. Recover those databases with the original module backup, secret file
and matching alpha images on an isolated instance.

The published schemas, tool catalogs and provider model definitions are mirrored
between Satellite and FreePBX. Each enabled tool uses the published agent grants.

The runner validates contract, provider capability and trusted tool definitions
before paid provider usage. The conversation's model and voice belong to the
agent; stale trunk model settings cannot override them. Direct extensions are
initially disabled. Queues require explicit grants and the initial list is empty.
Callbacks default to seven days. Call ending is initially disabled. Callbacks require an extension on the published
allowlist, even when direct extension dialing is disabled. The callback denylist
can further exclude extensions. Callback evidence is short-lived and bound to
the inbound caller number, live session, agent and publication. The number is
supplied by the PBX and may be spoofed on trunks that accept unverified caller
ID. Enable callbacks only for routes where revealing the approved contacts is
acceptable. The model cannot supply a different number for the lookup.
IVR routing is removed: directories, model advertisements and transfer execution
support extensions and queues only. Existing v8 IVR fields are inert and do not
authorize transfers. Native administrator-selected fallback routing is unchanged.

Realtime and Grok SIP admission and signed webhooks require
`VOICE_AGENT_SIP_LAB_ENABLED=true` in addition to the preview switch. GPT-Live uses primary
WebSocket audio through private Asterisk `chan_websocket`; see
[live transport](live-websocket.md). No automatic SIP failover exists.
Transfers require caller confirmation. The executor checks current inventory and grants, subscribes
to the owned caller, flushes provider media and waits for both native token/destination
acknowledgement and Stasis release. A tool acknowledgement alone is never success.
Compact media/provider channel identities fit native CDR/CEL limits; session/run
UUIDs remain independent. Hangup is opt-in, bounded and rechecks caller ownership.

The opening receives the PBX-resolved caller name from the admitted ARI channel,
bounded to 256 UTF-8 bytes with control characters removed. The model is asked to
use a confidently identified first name and otherwise greet neutrally, including
for anonymous, numeric, company-only or ambiguous names. This display data grants
no permissions and does not change the configured welcome or language policy.
It is call-local; it is not added to publications or monitoring metadata. Actual
pronunciation and name selection still require human listening acceptance.

A published v9 receptionist can use a consultation assistant for attended transfer.
Public GPT-Live calls and private GPT-Live consultations share the default limit of
two. Overload takes the native fallback. ARI disconnect also attempts fallback
while Asterisk REST is available. After reconnect, new admissions resume.

Configuration and monitoring use separate least-privilege MariaDB accounts. Runs,
format-2 metadata/events and optional encrypted debug transcripts are stored in
`asteriskcdrdb`. Durable bounded outboxes preserve idempotency across retries and
restart. Permanent per-event rejections leave bounded quarantine markers and mark
the affected trace partial. Transient failures retry. Incomplete traces/usage remain unavailable or partial; they are never
invented as zero. Metadata retention defaults to 90 days, controlled by
`VOICE_AGENT_MONITORING_RETENTION_DAYS` (1–3650). Debug capture defaults off and
has a separate 1–24 hour lifetime. Audio is never persisted by the media bridge.

`python main.py` starts the shared application and binds the voice-agent HTTP
listener to loopback when `VOICE_AGENT_ENABLED=true`. The standalone
`python -m voice_agent.runner` remains for
agent-only diagnostics and the standalone image. Set
`VOICE_AGENT_RUNTIME_TOKEN` for authenticated `/internal/ready`; documentation and
configuration routes are absent. In SIP lab mode Traefik forwards the provider webhook prefix and
exact provider routes verify raw bytes, timestamps and pending-call correlation.
With the preview enabled, NS8 generates private credentials and starts voice agents
even when transcription is disabled. The shared process starts transcription and its separate private API
when both transcription flags are absent or either flag is true. Each component
owns a different ARI application. Transcription connection failures retry without
restarting agent calls. A stopped component is logged and the others keep
running. The process exits with an error if every configured component stops
unexpectedly. Shutdown closes both listeners, RTP/ARI/MQTT resources and
per-request workers. Keep Python on 3.12.13.

NethVoice builds Satellite from the bundled `satellite/` directory. CI tests the
runtime against the FreePBX contracts in the same checkout. From the NethVoice
root, run `BUILD_IMAGES=satellite bash build-images.sh` to build the module image.

## Checks and packaging

Run these commands from `satellite/`.

```sh
python -m voice_agent.runner --check-snapshot voice_agent/published-v8.example.json
python -m pytest --confcutdir=tests/foundation -o addopts='' tests/foundation -q
python -m pytest -o addopts='' tests -q --ignore=tests/foundation
docker build -f Containerfile.agent -t nethvoice-voice-agent:preview .
docker build -t nethvoice-satellite:preview .
```

Install `requirements-agent.lock` and `requirements-dev.txt` in an isolated Python
3.12 environment; install `requirements.txt` and native PortAudio dependencies for
transcription tests. Foundation checks isolate their fixtures from transcription
metrics. Run `freepbx/tests/agents/run-foundation.sh` from the NethVoice root. It
prepares disposable MariaDB, applies the fresh baseline repeatedly, tests grants and
restore, and runs paired contracts. Without this harness DB-specific cases skip.
The standalone image starts only the runner as UID/GID 65532. The normal image
uses `python main.py` for the shared lifecycle. Set both
`SATELLITE_CALL_TRANSCRIPTION_ENABLED` and
`SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED` to false to disable transcription.
Diagnostics remain in the source tree and are excluded from production images.

Use exact image/source provenance, a protected backup and a zero-call gate for
staging. Rollback across the alpha reset needs matching pre-reset databases,
secrets and images. Deployment-specific receipts stay outside published docs.
See [validation](voice-agents-validation.md) for evidence and remaining gaps.

## CleverAI is executed outside this runtime

NethVoice can configure CleverAI trunks and agents. CleverAI uses OpenAI SIP, with
the project's incoming-call webhook configured externally to point to CleverAI.
No CleverAI webhook relay, automatic provisioning, API key or webhook secret is
configured locally. CleverAI owns session acceptance, conversation settings,
tools and monitoring.

These agents use **Save** to request the shared `retrieveHelper.sh` PBX reload;
there is no local Publish step. Native FreePBX destinations and VisualPlan handle
routing and fallback. The native dialplan dials the managed OpenAI trunk directly,
with a 20-second connection timeout, and does not enter `Stasis(voice-agent)`.
Connection failures use the configured fallback; normal remote hangup ends the
call. Transfers back into NethVoice are deferred.

CleverAI configuration is outside the v8 publication contract. No dummy snapshot,
local provider session, run, transcript or usage record is created. CleverAI
trunks are excluded from `voice_agent_runtime_bindings`; local OpenAI/Grok
publications, adapters and monitoring remain unchanged. Native CDR and unrelated
Satellite transcription remain under their existing owners.

The four outbound metadata headers use inherited PBX caller number/name and
inbound `FROM_DID`, with the native `agent:<agent_id>` identity proposed for
`X-OS-Extension` and for a missing DID. **CleverAI's acceptance/registration of that
identity and empty caller fields is not verified:** the experimental dialplan was
not available in the workspace. Real CleverAI calling, audio, webhook setup and
remote identity mapping require external acceptance testing before rollout.

Private consultation openings receive the caller's available PBX name, the
requested colleague's native display name and the caller's concise reason before
speech starts. The speaking model announces those facts immediately, then asks
for explicit consent. Missing names and details must not be invented.

Recent-contact lookup retains its configured lookback and exclusions. It includes
existing outbound callback attempts and answered conversations initiated by the
external caller. Incoming evidence requires a positive-duration, answered native
trunk-to-device leg, or an exact native attended bridge joined to that answered
recipient leg. Private consultations and ambiguous Local legs alone do not count.
The caller still confirms the contact; only a call-bound reference authorizes
that transfer. Existing manifest versions and stored publications stay unchanged.

Private consultation refusals retain an accompanying colleague message, including
requests to send an email. The private handset is hung up before provider usage
finalization; the caller then hears the attributed message. The opening is a
short colleague greeting with caller name and reason, without a separate
self-introduction. Explicit acceptance remains required for a person-to-person
connection.

After an unavailable offline/DND recipient, the caller may explicitly choose
voicemail only when the native recipient service confirms a configured mailbox.
The offer expires after at most 60 seconds, is bound to the current call and
selected recipient, and rechecks native identity, mailbox availability and the
original destination or recent-contact grant before handoff. Voicemail uses a
separate native wrapper; it never rings the handset or treats mailbox pickup as
recipient consent.
