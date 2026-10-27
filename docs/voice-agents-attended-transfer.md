# Attended transfer integration gates

Attended transfer is **not implemented or enabled**. This record covers the
independent caller greeting and the prerequisite investigation, not completion
of the attended-transfer feature. The workspace plan remains local.

## Implemented independently

Satellite captures the admitted ARI channel's PBX-resolved caller name, removes
controls and bounds it to 256 UTF-8 bytes. Its opening asks the model to use a
confident first name or a neutral greeting for missing, anonymous, numeric,
company-only or ambiguous values. The configured greeting and language behavior
remain in force. No phonebook query, first-name parser, stored identity or grant
is added. Name selection and pronunciation are model behavior requiring human
acceptance; automated tests verify the context and trust boundary.

NethVoice already restricts extension directories to configured main extensions
at `54b42f8714df2adce228b8696da70aeda6a33170`. That native behavior is retained.
It does not yet prove unique recipient identity for a consultation: the new
service read must reject multiple people sharing an extension, missing or multiple
main-extension mappings, removed users and stale state. Device-to-main callback
mapping remains call-bound and does not grant consultation permissions.

## Required upstream presence prerequisite

The current NethVoice build consumes `nethcti-middleware:v0.7.0`. Its source at
`1b89f9c0265e1093ac7d4d0465c1aaee2de88f30` has no scoped service read for
consultation recipients. `/user/endpoints/all` is proxied through a logged-in
user session, or the broad FreePBX administrator interface.

The chat gateway's `internal/api/middleware.go` stores the most recently seen
staff JWT in `lastJWT`; `Directory` and `Presence` depend on it. Its normal
directory fallback from `mainextension` to a secondary extension is also
unsuitable for consultation eligibility. Existing chat transport authentication
does not supply authoritative, session-independent CTI presence or chat permission.
The authorized staging instance does not run the new chat gateway/server either.

These are unmet integration prerequisites, not permission to reuse a human login,
pass an administrator token to Satellite, infer availability from registration,
or reproduce CTI presence/profile policy in the consultation coordinator.

The upstream change must provide a dedicated authenticated, private, versioned
service read that works with zero human sessions. For one requested recipient it
must return only a verified person identity, an unambiguous main extension,
current effective presence, the authoritative chat permission and freshness.
It must expose no SIP secrets, arbitrary user profiles or credential material.
The existing CTI code must remain authoritative for effective presence and
profile permissions. Unknown, stale or ambiguous results must not permit ringing.

Deliver and test that prerequisite upstream, then verify its versioned image,
source revision and digest before consuming it here. No new token, dormant
consultation publication, configuration migration or public service route has
been installed as a substitute for that dependency.

## Native handoff proof

`freepbx/tests/agents/attended-handoff-probe.py` is an explicit opt-in test for an
authorized NS8 staging node. Run it on that node, outside the module container:

```sh
python3 attended-handoff-probe.py --authorized-test \
  --expected-host test-node --module nethvoice_test
```

The script verifies zero calls, installs one random temporary CLI dialplan
context, originates two answered synthetic Local channels through an independent
test ARI application, and releases them into native `Bridge()`/waiting contexts.
It requires both exact channels in one native basic bridge, Stasis release,
survival of the test controller disconnect and the original absolute timeout,
and preservation of the attempt token. Cleanup targets only its own Local names,
subscriptions and temporary contexts (including Asterisk's generated `stasis-`
context) and verifies unchanged container identities/restart counts
and zero final calls. No FreePBX reload, staff/external call or paid provider
connection is made. The synthetic native CDR/CEL history remains.

Use the complete answered channel name including the Local `;1` suffix as the
`Bridge()` target. The uniqueid is a prefix of the Local peer's uniqueid and can
select `;2`; the native bridge must still be verified using both exact IDs.
`Bridge()` accepts channel-name prefixes as documented by
[Asterisk](https://docs.asterisk.org/Latest_API/API_Documentation/Dialplan_Applications/Bridge/).
Neither an ARI acknowledgement nor a native entry event proves a human connection.
The ARI application's `channel_ids` also includes passive channel subscriptions;
use correlated `StasisEnd` events to prove release, not absence from that list.

On 2026-10-27, the corrected probe passed on installed Asterisk **22.10.0**:
both answered exact channels entered a basic bridge, both emitted `StasisEnd`,
and the same bridge survived controller disconnect for 11 seconds, beyond the
original 10-second absolute timeout. Both attempt tokens were preserved. Cleanup
removed the owned channels and context, left zero calls, and changed no container
identities, start times or restart counts. The final report had every proof and
cleanup boolean true, with zero provider connections and zero extension calls.
FreePBX, Satellite and CTI middleware services remained active with zero restarts;
Asterisk uptime and reload age were preserved. No NS8 configuration action was
performed: the authorized temporary CLI/ARI probes are not API configuration
audit entries. No credentials, recordings or transcripts were collected. The
temporary changes were removed, so no persistent rollback action is pending.

The installed image identities were FreePBX
`ba0d3f6aae4017af900949246518908ca4d2f451c3921cb37221333ab4e82a44`
and Satellite
`7a760f4b61f99fe16aa50bda04108f97cd0cae4d793257cc5133f14e2f824f0f`.
These existing staging images supplied Asterisk and ARI transport dependencies;
they are not new feature builds. The greeting changes were not deployed.

This isolated primitive test does not establish the proposed production route,
forward/voicemail prevention, grant revalidation, actual Satellite shutdown,
media privacy, human audio, provider behavior, or CDR/recording/transcription
continuity through the final consultation flow. Those remain integration gates.

## Validation and remaining delivery

- Paired PHP/MariaDB/runtime foundation: 297 runtime tests passed, including the
  five database cases skipped by the standalone suite, native dialplan generation,
  repeat/interrupted installation, immutable contracts, restore and least privileges.
- Satellite standalone foundation: 292 passed, five database cases skipped.
- Greeting checks: 49 passed across EN/IT, malformed/hostile/oversized names,
  pinned admission data, call isolation and Live SIP/primary WebSocket seeds.
- Existing native PHP transcription regressions: nine passed.
- The optional full Wizard HTTP authentication harness was not selected.

No new publication/catalog version or consultation settings are enabled. Phone
and chat coordination, isolated colleague sessions, deadlines, one clarification,
confirmed production handoff, monitoring, EN/IT administration UI, paired-image
validation and human listening acceptance remain unimplemented. Continue only
after the upstream service prerequisite and the native integration gates have
evidence. The existing development Satellite image must still be replaced with
a versioned release before merge.
