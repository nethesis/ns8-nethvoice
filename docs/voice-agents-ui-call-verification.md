# Agents UI and call repair verification — 2026-10-14

This is a scoped development deployment, not certification of all v0.1 release
gates. User authorization covered implementation, build/deployment to nethvoice57,
commits/pushes to both voice_agent branches, and three synthetic calls bounded to
60 seconds each. A subsequent explicit approval covered creating one new OpenAI
webhook for this instance and storing its signing secret encrypted in the trunk.

## Provenance and changes

Starting revisions were NethVoice `a6b11e33532181dd1cfaa6764495ca19e3562e32`
and Satellite `2b6ad713b9212f6a216c78ed3036dff6c0d0db30`. Read-only references
were `2f41116fd2ed890e15439a912977ae1bb7189c5b` and
`08cabfa08c71401dde933f18b21eb01499524f6b`. Neither reference tree nor the
workspace-root AGENTS.md, PLAN.md and README.md was changed. No old branch was
merged or bulk cherry-picked.

The changes add environment credential inheritance, FreePBX default-language and
provider-voice dropdowns, native VisualPlan fallback editing, Wizard Apps launch,
and the requested sidebar removal. Built-in agents/tools remain configurable in
Agents UI. OpenAI uses its documented Realtime voice enumeration; Grok fetches its
voice roster server-side. Explicit encrypted API keys take precedence over env
keys, and blank edits preserve existing secrets. PHP and the runner both enforce
configuration and permission rules.

The native trunk uses Hangup, checks actual Core ownership and Asterisk endpoint
availability, and can recover a missing managed trunk through synchronization.
Ordinary trunk deletion rejects agent-owned trunks. The provider dial string
reuses the proven explicit SIP URI/TLS proxy path and trunk hint from the legacy
implementation. Provider adapters and correlation/signature enforcement remain
separate. Repeated unrelated SIP headers are allowed; duplicate correlation
headers are rejected.

Additive migration 006 preserves immutable v1 publications and allows contract v2
with Hangup/native fallbacks. Historical native fallback wrappers remain available
for pinned calls. VisualPlan changes clone the active publication's fallback only,
without publishing unrelated draft edits. Migration 007 adds metadata-only provider,
media and response phases. Caller hangup before media connection is interrupted,
including the interval after bridge allocation but before bridge completion.

## Local and staged evidence

- The disposable MariaDB harness passed migration reruns, encrypted credentials,
  env-key precedence, immutable v1/v2 contracts, revision conflicts, fallback
  validation, HTTP authentication/CSRF, native endpoint recovery, real FreePBX
  dialplan classes, restricted runtime roles, retention and synthetic SQL restore.
  All 38 cross-repository tests passed. The optional standalone Wizard autoload
  harness was skipped; real authenticated staged UI/API checks passed separately.
- Satellite's broader runtime/transcription suite passed 132 tests with four
  expected environment-dependent skips before the final bridge-race regression.
  The final affected runtime suite passed 14 cases, including bounded/deduplicated
  response metadata, pre-connection hangup and partial bridge setup. Existing PHP
  transcription/voicemail regressions passed 9/9.
- UI lint, type-check, formatting, three unit tests, five browser flows and the
  production build passed. The VisualPlan regression uses actual jQuery/Draw2D
  drag input, which reproduced the empty picker before the normalization fix.
- With actual staged admin authentication and TLS verification, the UI selected
  Italian (FreePBX default), displayed provider voice choices and omitted the three
  requested sidebar entries. Wizard Apps opened Agents UI in a new tab. Actual
  VisualPlan dragging, picking the disposable agent, fallback-port creation and
  saving Hangup passed. No existing inbound route or approved extension was used.
- Both final component images built and had zero Trivy secret findings. No new
  dependency was added. Inherited base-image vulnerability risks recorded in
  voice-agents-v01-verification.md remain unresolved; no release clearance is
  claimed. Reports stay in ignored local_testing/artifacts/voice-agent-v01fix/.

## Call diagnosis and provider blocker

The reported failed calls had a missing managed PJSIP endpoint despite a stored
synced status. Authenticated synchronization recreated the native trunk through
Core APIs and confirmed the Asterisk endpoint. No generated PBX rows or dialplan
were edited by hand. Bounded full-log inspection and a synthetic originated call
confirmed that the repaired path reaches OpenAI SIP ringing.

One synthetic call was originated. It ended before provider admission and has no
provider session or media/response evidence. Its short playback also encountered
an unavailable silence fixture; a retry must use existing silence/10 segments.
The pre-fix run was labelled completed; future pre-connection hangups are now
interrupted. Historical evidence was not rewritten. No live conversation passed.

A read-only provider listing found one existing realtime.call.incoming endpoint
for another host/path, and none for this instance. Creation of the approved
https://voice2.makako.sf.nethserver.net/satellite-webhooks/openai endpoint failed
with HTTP 401, error missing_scope for api.webhooks.write. The configured key
cannot perform that write. No endpoint was created, no existing endpoint was
changed, and no signing secret was replaced. There is no authenticated provider
browser session available. The user was asked to enable Webhooks write for that
key or configure the endpoint/signing secret through the provider and Agents UI.
The remaining two bounded call attempts are pending that external credential fix.
They must verify provider admission, audio bridge and actual responses; SIP ringing
alone is insufficient. Grok calls, approved transfer and NS8 restore/clone also
remain separate release gates.

## Deployment and rollback

Target: node 1, makako.sf.nethserver.net, nethvoice57, virtual host
voice2.makako.sf.nethserver.net. The installed module bundle remains the earlier
development override. Only the built component images and three source-owned NS8
artifacts were changed: configure-voice-agents, voice-agent.service and
set-integrations/50manage_service. The private listener remains loopback port
20043 and the dedicated webhook-prefix route is unchanged. The verified SIP proxy
route remains owned by nethvoice57 at sip:10.5.4.1:24005. Other instances, routes
and caller data were untouched. Replacements required zero active calls/channels.

The fresh v01fix-rollback state directory is mode 0700 and contains a validated
combined gzip dump of asterisk and asteriskcdrdb, prior environment/private-secret
files, previous unit states and the three artifact backups. Database/env/state files are mode 0600; source artifact permissions are preserved
inside the private directory.
Previous component images are retained as localhost/nethvoice-freepbx:v01fix-rollback
and localhost/nethvoice-satellite:v01fix-rollback; earlier rollback generations
remain available. Nothing was restored or retired. At zero active calls, retag the
preserved images to the existing unit image references, restore only those three
artifacts, reload user systemd and restart matching units. Leave additive tables
and immutable versions intact. Do not deallocate the module's ports. A data restore
requires the supported NS8 restore workflow and separate scope authorization.
No external webhook rollback is needed because creation failed.

All diagnostic outputs were filtered on the server. Keys, signing secrets, raw
provider responses, caller details, transcripts and database dumps were kept out
of terminal output and git. The disposable custom agent and generic audio fixture
are removed after checks; its ordinary immutable versions/run history remain.

Final post-change checks confirmed all three units/containers running with zero
unexpected restarts, Asterisk 22.10.0 with both satellite and voice-agent ARI apps,
zero active calls/channels, authenticated readiness and healthy monitoring. The
runner is UID 65532 with mode-0700 outbox storage. The owned webhook route still
forwards only its prefix to loopback; normal HTTPS serves Agents UI with certificate
verification enabled. The SIP route and both rollback images/backups were verified.
Authenticated synchronization/catalog/voice reads passed after disposable cleanup.
Scoped configuration audit summaries confirm native synchronization and the
disposable profile create/publish/enable/remove actions without exposing actors
or inputs. The image/artifact overrides use the authorized development procedure,
not a broad NS8 module update.

| Component | Local scanned Docker image ID | Deployed Podman image ID |
| --- | --- | --- |
| FreePBX | `e0bb8db69a7944eb958de97f1702cafc0cd1bb965a6a08207d170b2eae30efba` | `c5acfc067210bc46a679cd328141e63587b7c911f21696f32845c4cb6ac81755` |
| Satellite / runner | `bfbb9f78244eb508d4e4914b7bee76ba024c8a003608cc8f197edb25968568ec` | `0eb3d2a9a91bd6f2faab9548a3baac9eceef3c8b4d90f63e9b48f90235661f9e` |

Images were streamed through authenticated SSH into rootless Podman. Transfer can
change image configuration IDs; source checksums inside the loaded images were
verified before tagging/restarting. Native functions checksum:
`bf8f507dbc6a66c42c09f2e26a0711ab5a799c87ed9b9245a1bf6e74a879fe4b`;
final runtime checksum:
`a593deb9774d051c0262267be767b886ebde8b273af2257440e8fa593e5ec301`.

## Follow-up after provider endpoint configuration

The user reported configuring the endpoint. Read-only project inspection confirms
exactly one matching instance URL with realtime.call.incoming subscribed. A
server-side comparison against the provider's masked signing-secret hint does not
match the encrypted secret saved in the trunk. The hint is present and has a
comparable suffix; neither hint nor secret was output. Incoming events would fail
signature verification. The user was asked to save that endpoint's signing secret
through Agents UI. No further call was originated, preserving both remaining
60-second attempts. No provider write, credential replacement or service restart
was performed in this follow-up.

The same deployed source/image identities remain healthy. Active calls/channels
are zero, both ARI apps are present, monitoring readiness is healthy and protected
rollback images/backups are retained. Source branches were clean at revisions
5d7f2ca46afce5981b8abae75b3165e3159c4ac2 and
946ef48a36a836e20017972fccf105bc37097f4b. The previously disposable agent/audio
remain removed. The user-configured endpoint must be preserved; the agent did not
create or alter it.

## Completed OpenAI retries after signing-secret correction

The user saved the endpoint's signing secret through Agents UI. Read-only
preflight confirms one matching endpoint, realtime.call.incoming subscription,
and a matching stored-secret hint. The prior webhook/secret blocker is resolved.
No provider endpoint write, secret rotation or integration reconfiguration was
performed by the agent during these retries.

A new disposable custom agent reused the configured OpenAI binding and selected
voice/language, with generic instructions, no tools, no transfer destinations,
Hangup fallback and a 60-second maximum duration. It was provisioned through the
actual authenticated/CSRF-protected REST API. No existing inbound route, extension
or caller was used. Zero active calls/channels was checked before each origination.
A local generic speech fixture was sent by native Asterisk Playback, using existing
silence/10 segments instead of the unavailable earlier fixture.

| Approved attempt | UTC start | Duration | Outcome | Completed responses |
| --- | --- | --- | --- | --- |
| 2 | 2026-10-14 10:22:57 | 41.2196 seconds | completed | 2 |
| 3 | 2026-10-14 10:24:50 | 41.2626 seconds | completed | 2 |

Both runs have provider admission, provider_connected, media_connected and
completed events, with no run error. This verifies real signed provider delivery,
the three SIP correlation headers, call acceptance, sideband establishment and
ARI bridge lifecycle, followed by provider responses to the greeting/synthetic
speech. The actual authenticated Activity API lists both completed runs and their
expected event details, including after disposable-agent removal. SIP ringing
alone was not used as the success criterion.

The attempted filtered Asterisk RTP-statistics sample returned no matching row,
so no packet-counter or bidirectional audio-quality result is claimed. No recording
or transcript was captured, and language-switch output content was not inspected.
Grok calls, approved extension transfer and NS8 restore/clone remain separate v0.1
release gates. All three approved call attempts are used; no further provider call
is authorized by the original bounded test scope.

Scoped full-log inspection of 106 correlated lines finds no missing endpoint or
origination failure. It still finds the existing native ODBC CDR/CEL warnings
(40 cel_odbc.c and 8 cdr_adaptive_odbc.c warning/error lines); these are separate
from the metadata-only agent monitoring, which records both runs successfully.
The bounded runtime log summary has no safe phase errors. No native CDR/CEL schema
or integration was modified in this slice.

The disposable agent was removed through REST and its generic server-side audio
fixture was deleted and checked absent. Ordinary run history and immutable versions
remain inspectable. Final checks show all three units/containers healthy, zero
unexpected restarts, zero active calls/channels, both ARI apps present and no
monitoring degradation. Deployed image/source identities are unchanged and the
protected rollback images/backups remain available. The user-configured provider
endpoint/signing secret is preserved. The verified SIP proxy and HTTP webhook
routes are unchanged, and HTTPS still serves the UI with certificate verification.
The disposable configuration audit records create, publish, enable, native
synchronization and removal without returning actors or input data.
