# Attended transfer

This feature adds an opt-in consultation before transferring a caller to a person.
Queues retain direct transfer. Existing v8 publications and tools-v5 remain
unchanged; new settings use publication v9 and transfer tool v3 in tools-v6.
Deploy matching NethVoice, Satellite, CTI server and chat gateway images before
enabling it. The development Satellite image must become a versioned release
before merge. Live acceptance gaps are listed below.

## Enable it for Receptionist

1. In **Agents**, create an **Internal consultation assistant**. Select its own
   provider trunk, voice model, language, voice and instructions. For chat, enter
   a text model supported by that provider, or use a GPT-Live backend model.
   Save, publish and enable this assistant. It has no public VisualPlan destination,
   public fallback route or general PBX tools.
2. Open **Receptionist** and select **Attended transfer** under **Transfer to
   people**. Authorize phone consultation, chat consultation, or both, and select
   the published internal assistant.
3. Keep the intended people in Receptionist's existing transfer grants. These
   settings add no destinations. Save and publish Receptionist. New calls pin
   both published agents; ongoing calls retain their existing versions.
4. Test with consenting colleagues on the staging instance. To return to direct
   transfers, explicitly select **Direct transfer**, save and publish.

No new public built-in agent is seeded. Internal assistants cannot be converted
into public agents or deleted while a published public agent references them.
Existing agents stay direct until an administrator publishes these settings.

## Call behavior

The Receptionist obtains a concise reason, announces the consultation and places
the caller on hold. The caller is detached from provider audio while held.
A separate provider session talks privately to the colleague. Only a main
extension uniquely belonging to one CTI person qualifies.

When current CTI presence and native device state permit, the phone rings for at
most 20 seconds. Busy, unavailable, no answer or an ordinary phone/provider failure
falls back to authorized chat. An explicit decline is terminal. DND permits chat
but forbids a new ring; a chat acceptance asks the colleague to become available
and accept again within the original deadline. Forwarding and voicemail routes
are excluded: the generated route dials only the person's native PJSIP devices,
checks DND/forwarding and ignores endpoint redirect requests.

The colleague may accept, decline, return a message or ask one question. The
Receptionist temporarily resumes the caller conversation for that question and
returns one bounded answer. A final decision may supersede the question. Hold
updates occur around 20 and 40 seconds. Everything shares one 60-second budget,
bounded by the caller's remaining session. Updates never reset it.

A phone answer or voicemail greeting is not acceptance. Backend actions require
colleague input before a phone decision; the configured model interprets the
colleague's explicit intent. Phone acceptance reuses the answered leg. Chat
acceptance rings only after a fresh eligibility check. A result never silently
becomes blind transfer. Failed consultations resume the working Receptionist.
The same person cannot be retried automatically within the caller session.

## Private services and chat

The CTI prerequisite is [nethcti-server PR #374](https://github.com/nethesis/nethcti-server/pull/374),
pinned by source revision in `nethcti-server/Containerfile`. No middleware or
staff-session workaround is used. A separate authenticated loopback listener
returns only recipient identity, main extension, current effective presence,
native device state, chat permission and observation time. Native freshness is
checked on the existing ordered AMI connection. Unknown/stale identity fails
closed. The current CTI user/profile components remain authoritative.

The chat gateway has a separate authenticated loopback HTTP interface; it shares
no routes with the public gateway. Satellite receives scoped recipient/chat keys,
never a staff JWT, administrator token or broad XMPP component secret. Provisioning
stores keys in protected module state and includes them in normal backup/restore.
No reverse-proxy route exposes either private listener.

The reserved XMPP identity is `voice-agent-assistant`. Human JWT login as that
identity is forbidden and account retirement excludes it. Consultation messages
contain a short `#REFERENCE` and expiry. Reply with that reference and a decision;
bare yes, quoted references, wrong senders, rooms, expired and replayed replies
cannot authorize connection. Gateway receipts contain bounded metadata and a body
hash, not message text. Reconnects preserve send idempotency, never decisions.
Unsolicited messages receive a bounded consultation-only explanation. DND push
suppression uses the scoped native presence reader without a human login.

## Native handoff and cleanup

Both exact channels receive reciprocal unique IDs and an attempt token. After
private media cleanup and a final grant check, the answered Local `;1` channel and
caller enter bounded native contexts. `Bridge()` targets the complete channel
name: a Local uniqueid alone can also match its `;2` peer. Success requires both
exact channels in the same native basic bridge and both correlated `StasisEnd`
events. An ARI acknowledgement or dialplan entry alone is insufficient.

Native contexts clear the agent absolute timeout. Successful transfer releases
human legs from Satellite cleanup. A correlated native failure returns the caller
to the Receptionist; uncertain release records an uncertain outcome and leaves
native ownership intact, without a competing fallback or second transfer.
Restart reconciliation only removes consultation channels with persisted session
ownership and matching role/attempt markers still in this application's Stasis.
It never resumes an attempt or touches a native human bridge.

One consultation is permitted per caller and per recipient. Private voice and
text sessions count against runtime capacity and link to the caller's monitoring
run. Monitoring records bounded states, outcomes and errors under existing
retention/debug rules; transcripts remain disabled by default.

## Validation evidence and remaining gates

`freepbx/tests/agents/attended-handoff-probe.py` is an opt-in synthetic Local-channel
proof for an explicitly authorized NS8 staging node:

```sh
python3 attended-handoff-probe.py --authorized-test \
  --expected-host test-node --module nethvoice_test
```

On 2026-10-27 it passed on Asterisk 22.10.0 with the production reciprocal-token
checks and 10-second native waiting context: both answered channels entered one
basic bridge, both left Stasis, and the bridge survived controller disconnect for
11 seconds, beyond the original absolute timeout. Attempt tokens and the shared caller/colleague linked ID survived.
Cleanup removed only owned temporary channels/contexts and left zero calls, zero
provider connections, zero extension calls and unchanged containers/restart counts.
No FreePBX reload, service restart, human recording or transcript was collected.
Synthetic CDR/CEL history remains. No persistent probe rollback is pending.

Automated coverage includes PHP/Python publication parity, immutable v8 assets,
internal admission rejection, permission/concurrency/deadline limits, decline,
phone-to-chat fallback, DND chat acceptance, one clarification, exact native bridge
confirmation, uncertain-release safety, owned restart recovery, gateway sender/
reference/expiry/reconnect checks, repeatable setup and existing transcription
regressions. Browser checks exercise EN/IT opt-in settings and unchanged direct
agents. See [testing](voice-agents-testing.md) for commands.

The primitive proof does not replace end-to-end acceptance of the new image pair.
Before enabling on a live PBX, record image digests and source revisions, prove
service reads with no human login, real browser/mobile chat replies, all supported
provider paths, actual Satellite-stop survival, linked-ID/CDR/recording continuity
and transcription disabled plus each supported mode. Human listening must confirm
pronunciation, hold quality, private audio isolation, reason accuracy, clarification,
message relay and final audio. These results must not be inferred from unit tests.
