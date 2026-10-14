# Receptionist v0.1 verification — 2026-10-14

This records the implemented Receptionist/tool slice and its bounded staging
tests. v0.1 is not fully certified: live Grok and complete NS8 upgrade/restore/clone
gates remain open.

## Source and implementation

Both active repositories stayed on `voice_agent`. Reference worktrees were read
only; no old branch was merged. Root AGENTS.md, PLAN.md and README.md were untouched.

| Repository | Starting revision | Deployed code revision |
| --- | --- | --- |
| ns8-nethvoice | `552da00dcf6e03634af16d6494c0ed074ed3882b` | `3bd2ea73add29df52314aa22700961cb985a01b5` |
| satellite | `946ef48a36a836e20017972fccf105bc37097f4b` | `ae95f312dd62e8c8ffcdc302c6db08764832f8a1` |
| ns8-nethvoice.bak reference | `2f41116fd2ed890e15439a912977ae1bb7189c5b` | unchanged |
| satellite.bak reference | `08cabfa08c71401dde933f18b21eb01499524f6b` | unchanged |

Migration 008 seeds only Receptionist on fresh installs, initially inactive with
both routing tools disabled and an empty extension allowlist. The agent page uses
the same schema-driven editor for builtin and custom Basic Voice agents. Search
has its own enable flag and bounded result limit; visible targets must also be
approved by the enabled transfer binding. New extensions receive no grants.

Global immutable manifest version two and per-agent typed tool bindings use the
additive published v3 contract. Existing v1/v2 snapshots/manifests remain immutable
and executable. PHP and Python reject duplicate tool IDs, noninteger versions and
invalid configuration, including floating-point values in integer settings.
Published snapshots pin tool configuration independently of later draft edits.

Legacy Internal/External configurations are read-only. Native references prevent
their removal; retirement preserves historical publications and monitoring. The
test installation deliberately retired both seeds through the service after its
owned legacy test DID was changed to Hangup through the native Core API. No generic
conversion or automatic merging of configured installations is claimed.

The existing VisualPlan Agent palette, Wizard Apps entry, voice/language dropdowns,
environment-key inheritance, trunk Hangup and per-agent native fallback remain in
place. Duplication, admission policy, queues/IVRs and recent-caller routing are v0.2
work, not part of this slice.

## Local checks

- Full Satellite suite: 153 passed, four expected skips and six warnings.
- Final foundation harness: 57 Python cases passed, plus PHP migration reruns,
  service validation, native provisioner/dialplan, real Slim HTTP authentication
  and CSRF, revision conflicts, retention, restricted accounts and disposable
  MariaDB dump/restore checks. The optional standalone Wizard-auth harness was
  skipped because M0_REST_AUTOLOAD was unset; real HTTP auth/CSRF did run.
- UI type-check, lint, formatting, three unit tests, six browser tests and built
  assets passed. Browser coverage includes actual VisualPlan draw2d code.
- Existing PHP transcription/voicemail regressions: 9/9 passed. No live recording
  or transcription test was enabled.
- OpenAI and Grok local provider emulators exercised signed admission, advertised
  tools, denial and disconnection. These are distinct from live-provider evidence.
- Image builds passed. Final staged library, native dialplan, runtime/controller
  and v3-schema hashes match local committed source. UI assets contain built output.

The disposable database restore verifies encrypted credentials, identities,
drafts, immutable versions and per-agent bindings. It does not establish full NS8
restore/clone or a complete normal FreePBX upgrade result.

## Authorized live tests

Target: node 1, makako.sf.nethserver.net, module nethvoice57, virtual host
voice2.makako.sf.nethserver.net. The user authorized builds/deployment and four
OpenAI synthetic calls of at most 60 seconds each, using one temporary DID and two
temporary echo-only extensions. No human endpoint was used. Zero active Asterisk
calls and channels were checked before service replacements and fixture removal.

| Call | Elapsed | Result |
| --- | --- | --- |
| Conversation | 22.26 s | Passed; provider audio and two completed responses |
| Initial approved transfer | 42.17 s | Failed; exposed transfer-confirmation defect |
| Denied then approved transfer | 38.62 s | Passed; denied target rejected, approved native handoff confirmed |
| Provider-disconnection fallback | 20.58 s | Passed; configured fallback with provider_disconnected code |

The initial transfer reached the native extension, but the runner misclassified
the Stasis release. The fix requires both caller release and the native wrapper's
channel-bound nonce/destination event, handles either ordering and detaches provider
media before handoff. The third live call confirmed this behavior. The fourth call
also verified cleanup when the provider leg had already disappeared. No fifth call
was originated; the four-call allocation is exhausted.

Only metadata and synthetic audio counters were collected; no transcripts, audio
recordings or packet captures were saved. Synthetic audio and temporary fixtures
were removed. A protected aggregate receipt stays with rollback evidence on the
server; immutable run history remains available in Agents UI.

Final authenticated browser checks rendered the confirmed transfer, denied tool
and fallback events, the inactive Receptionist editor and the VisualPlan Agent
palette on the original test route. HTTPS certificate verification stayed enabled.
UI cleanup saved/published generic Receptionist instructions, a 600-second limit,
both tools off and an empty allowlist, then disabled the agent. Temporary native
DID/extensions were deleted through FreePBX Core, followed by native dialplan
application. Their records and references are absent. The original legacy test
DID now points to Hangup, with no remaining Internal destination reference.

## Deployment and final health

| Container | Image ID | State / restarts |
| --- | --- | --- |
| freepbx | `0113b68fb27731139d68099cd99cc7bd64e624d370004e11f05690fe52d23412` | running / 0 |
| voice-agent | `f2be449715d902b39c03991a43681180c44e337c33b0defebaf762150b2ba8ae` | running / 0 |
| satellite transcription | `0eb3d2a9a91bd6f2faab9548a3baac9eceef3c8b4d90f63e9b48f90235661f9e` | running / 0 |

This is a scoped development image override, not a broad module reconfiguration.
The independent runtime received the new image; the existing transcription
service was not restarted and its source is unchanged. Schema version eight,
versioned catalog, inactive Receptionist and default-denied bindings were verified.
Publication, disable and native synchronization have configuration audit records.

Final readiness is healthy without monitoring degradation. Runtime UID is 65532,
the private event directory is mode 0700, and the retention timer is active. Asterisk
22.10.0 has zero active calls/channels; ARI has zero bridges. The closed fixture
application has zero subscriptions, channels, bridges and endpoints. Existing
satellite and voice-agent applications remain available.

The unchanged NethVoice proxy route maps voice2 to nethvoice57 at
sip:10.5.4.1:24005. The owned webhook route still forwards only
/satellite-webhooks to http://127.0.0.1:20043 with HTTPS redirection. No unrelated
route, module, credential or caller data was changed.

## Security artifacts and rollback

Trivy 0.75.0 found no secrets in either built component image. Satellite has four
critical findings; FreePBX has 16 critical entries (14 unique). Comparing unique
signatures against the previous component scans found no new critical findings.
Both Dive checks passed. CycloneDX SBOMs contain 379 Satellite and 1,185 FreePBX
components. Reports/SBOMs are retained locally in ignored testing artifacts.

Those scans cover the pre-handoff component build; final staged overlays contain
source changes and unchanged dependency packages. A separate final runtime-source
secret scan passed. This is not a fresh vulnerability scan of the exact final
staging image IDs or clearance of inherited findings. Release triage remains open.

Fresh rollback state is in module-owned v01-receptionist-rollback/, directory mode
0700 and files mode 0600: validated compressed pre-migration databases, private
environment files, prior image identities and sanitized aggregate results. The
retained v01-receptionist-rollback tags identify FreePBX
`532ae302dc5b9a1d794324b27c73809dcb29babb46434ea408e4bd43603fd627`
and Satellite
`0eb3d2a9a91bd6f2faab9548a3baac9eceef3c8b4d90f63e9b48f90235661f9e`.
No database or secret backup left the host. Rollback was not used.

Before image rollback, disable v3 agents and verify zero active calls/channels;
older runtimes cannot execute v3. Restore only the owned image references and
matching units, preserving the additive database history. A full database restore
requires a separately scoped maintenance action and must account for subsequent
operator changes. Do not use older backups that predate the corrected webhook
secret. Remaining release gates are live Grok, full NS8 upgrade/restore/clone and
inherited dependency vulnerability triage.
