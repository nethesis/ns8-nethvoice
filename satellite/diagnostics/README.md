# Controlled voice diagnostics

These source-only helpers require an authorized disposable test instance, a
short-lived arm and a bounded shared provider budget. They are excluded from
production images and are never imported by the normal runner. The current
runtime uses primary WebSocket media for GPT-Live. An armed `primary-ws` probe
measures audio on that transport. The `current` and `concise` probes compare
greeting commands over the SIP sideband.

`call_probe.py` exercises an owned Local caller through a pre-reviewed test route,
bridge and loopback externalMedia endpoint. It accepts only bounded synthetic
speech, measures audio in memory and removes only its owned channel/bridge IDs.
`live_audio.py` and `rtp.py` report content-free signal timing/counts. Signal energy
is not evidence of intelligibility or listener playback.

`direct_probe.py`, `primary_bridge.py` and `live_startup.py` support isolated
provider/media comparisons. `scoped_runner.py` instruments only a matching
synthetic call, pinned publication hash and arm expiring within sixty seconds;
normal calls keep the production factory. Never expose diagnostic controls over
HTTP or provider messages. Optional diagnostic transcript capture is disabled.

The shared budget has `starts_at`, `expires_at`, `limit` (1–12) and `attempts`.
Create it in the helper's expected protected location only for an authorized
window of at most one hour. Keep it outside the monitoring outbox. Probes fail
closed when the arm/budget, snapshot, topology or zero-active-call gate differs.
Resolve credentials within the protected runtime; never put keys in arguments,
reports or fixtures. Save sanitized measurements outside published docs and
verify final outcomes independently after monitoring delivery flushes.

See [runtime operations](../docs/voice-agents.md) and
[validation limits](../docs/voice-agents-validation.md).
