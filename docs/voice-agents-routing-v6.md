# Typed PBX routing slice (v6)

For the additive recent-callback implementation, new defaults and validation,
see [contract v7](voice-agents-recent-callers-v7.md). The v6 implementation and
acceptance history below are retained for compatibility.

The current editor offers extension and queue routing for Receptionist and custom
Basic Voice agents. IVR support remains in the pinned runtime contract, but IVRs
are excluded from selectable routing categories and disabled in fresh, saved and
newly published drafts. It does not close v0.1 or declare v0.2 complete. Recent-caller
lookup, duplication, caller admission and the graph editor remain separate work.
The intermittent silence and human audio acceptance gates remain open.

## Source provenance

Active branches: `voice_agent`. Starting commits:

- ns8-nethvoice: `f94e43625ef94eb2ed129f958cb4279f8de05958`
- Satellite: `29220e83f3ae9a32db0c5c24583ad3739a81df90`

Both contained uncommitted v5/model work when this slice began; it was preserved.
Legacy references were read only: `ns8-nethvoice.bak` at
`2f41116fd2ed890e15439a912977ae1bb7189c5b` and `satellite.bak` at
`08cabfa08c71401dde933f18b21eb01499524f6b` (the latter also has pre-existing
uncommitted conflicts). Native discovery adapts `AgentContextSource.php`'s
Core/Queues/Ivr inventory pattern. Installed FreePBX Ivr, Queues and Destinations
implementations were checked in the existing staging-baseline image. Transfer
extends the active confirmed executor instead of importing the old workflow or
PostgreSQL configuration model. The existing schema editor and browser fixtures
were extended selectively.

## Contract and administration

`published-v6.schema.json` pins `pbx.find_destinations` v1 and `pbx.transfer` v1,
whose immutable manifests are in `tools-v3.json`. Contracts v1–v5 and historical
tool manifests are unchanged. No recent-caller manifest or handler is advertised.
Fresh Receptionist and custom drafts use the latest routing defaults (v6), shared
with the development reset. There is no routing-upgrade action or endpoint during
pre-release development. Existing test installations can be reset with the
explicit development reset CLI; saved configuration and immutable publications
are not automatically rewritten. Release migration behavior will be addressed
after merge into main. A v6 draft cannot be silently downgraded through save.

The transfer binding owns category policy. Direct extensions default off with an
empty allowlist; queues default on with an empty denylist and IVRs stay off. Disabled tools
cannot be invoked through either logical IDs or wire names. The same policy
filters startup context, lookup and execution. Description overrides are
per-agent data. Removed denylist entries persist as tombstones; unavailable
extension grants can be reviewed/removed in a saved draft, but publication rejects
missing approved extensions. Runtime independently checks current existence.

`GET /agents/destinations` is administrator-authenticated and supports `query`,
`type`, `offset`, `limit` and optional `agent_id`. Default page size is 20, maximum
100. It returns module availability, unavailable saved IDs and backend-computed
permissions for the saved draft. The agent editor uses schema-driven toggles,
paginated searchable destination lists, with optional description fields for
extensions and queues. IVRs are not selectable. The preview is
explicitly labeled as the saved draft, with EN/IT translations.

## Native routing and bounds

Stable IDs are `extension:<number>`, `queue:<number>` and `ivr:<object-id>`.
`AgentDirectory` reads native PBX modules and validates destinations through
FreePBX's destination registry. IVR options, invalid and timeout targets are
context only. Unknown targets remain unknown. Names and descriptions are data,
never prompt instructions. Nested model context is bounded to four levels and
50 branches per root, with cycle/depth/branch/unavailable markers. Disallowed
indirect targets are described as native behavior without exposing their names
or IDs as direct targets.

Startup routing context is at most 16 KiB. Oversized inventories explicitly
require paginated lookup; no list is silently truncated. Tool pages default to
20, maximum 100, additionally bounded by a 64 KiB page budget with a continuation
offset. Runtime inventory capacity is 10,000 destinations and 50,000 raw branches;
exceeding either fails explicitly as unavailable. Calls pin configuration and
manifests while names and destination existence are read from current PBX state.

Queue/IVR handoff uses generated native wrappers `voice-agent-transfer-queue`
and `voice-agent-transfer-ivr`. The executor checks the published grant and
current inventory again immediately before continuation. Both a matching private
token/typed destination event and ARI ownership release are required for success.
Requested, committed, failed, denied and uncertain events retain actual tool and
typed destination metadata. Existing extension wrappers and fallback behavior
remain compatible. No model argument becomes an arbitrary ARI context or URI.

## Migration and rollback

Migration 011 adds immutable manifests, accepts contract 6 and widens monitoring
tool IDs. Schema installation builds narrow SQL SECURITY DEFINER views for queue,
IVR and branch metadata, exposing no queue passwords. Optional missing tables
produce empty views. Module enabled state is checked where the native `modules`
table exists. Re-run `install-runtime.php` after installing a formerly absent PBX
module so its views are refreshed. Configuration-reader credentials receive
SELECT only on these views, never the underlying PBX tables. Monitoring
credentials remain separate. No second PBX configuration copy is created.

Rollback uses the retained pre-slice FreePBX and runner images under zero-call
and zero-channel gates. Disable/retire any isolated v6 test agent before rollback;
do not republish v6 agents with old code. Existing operator v1–v5 publications
remain compatible. Additive migration 011 and views can remain installed; do not
restore an old configuration dump over later operator edits. Protected server
backups and exact image receipts are recorded separately when deployment occurs.

## Verification

The initial v6 contract/routing tests failed before implementation. Local checks
cover PHP/Python schema parity, immutable legacy contracts, upgrade revision and
CSRF checks, independent grants, category defaults, renamed/new/deleted targets,
disabled-tool bypass, pagination, IVR cycles/depth/branch limits, hostile directory
text, queue/IVR token correlation and ARI release, repeatable migrations, scoped
credentials and backup/restore. Browser tests exercise the upgrade and schema
editor. These automated fixtures do not prove provider semantic choices, audible
conversation or native menu behavior on a real call.

Staging evidence and final test counts are appended after verification. No commit
or push is authorized by this slice.

Local verification on 2026-10-15 passed the full disposable MariaDB foundation
runner against `localhost/nethvoice-freepbx:routing-v6`: all PHP checks plus 126
Python cases, including 20 v6 routing cases. UI type-check, lint, formatting, three
unit cases, 13 browser cases and the canonical UI builder passed. Existing
transcription/voicemail regressions passed 9/9. The canonical runner built and
passed UID 65532/import checks; all 27 Python/JSON source files matched its image.
The UI builder produced a successful compiled production bundle (the existing
large-chunk advisory remains). The FreePBX image is a scoped staging overlay,
not a fresh full FreePBX rebuild. Sources and compiled UI assets for 104 installed
files were hashed for staging verification.

Local Docker image IDs:

- FreePBX overlay: `cdfa9e8b0905145781e4ceabd7789859baec8ca24187cf8fbd098cc99dfa34c9`
- Canonical runner: `eec090e183051b2305cf0adc9c53cc6c3453919b4fccd880a38e2171d11b06a4`

The local workspace filled during full image export; the incomplete archive was
removed, and the final foundation rerun passed after space was recovered. No
existing images, volumes or unrelated build artifacts were pruned. Staging's
normal build/commit paths rejected inherited mixed layer media types, matching
the class of error documented in the [upstream Buildah issue](https://github.com/podman-container-tools/buildah/issues/5272).
These failed offline builds did not restart live services. Subsequent staging
status and any deployment evidence are recorded below.

## Makako staging result — 2026-10-15

The user authorized use of this testing machine's targets for live acceptance.
Scope was limited to `nethvoice57` on Makako, node 1, the existing virtual host,
a separate custom v6 agent and temporary native targets. No external telephone
number or operator VisualPlan route was used. The node-local proxy route and
HTTPS certificate verification matched the instance's actual UDP SIP port.

Deployment completed at 17:53 UTC after independent zero-call/channel gates.
The normal image builder rejected inherited layer media types; the staging
images were constructed offline from disposable copies of the exact running
images, replacing only the verified agent files and compiled UI. Configuration,
UID, entrypoint/command, environment, dependency lock and stop-signal semantics
were verified, with only the build-tool version label differing. A complete
filesystem comparison additionally verified 88,001 FreePBX files and 2,284 Python
dependency files outside the replaced sources (including FreePBX file modes and
ownership). This is a verified staging transport workaround, not a canonical
full FreePBX release build.

Running Podman images:

- FreePBX: `234ddb96c4fd33ef374772f64e83e16775c1c846199513994c8d7897f99f25d5`
- Runner: `91a1f9d17e1a68adf5580ddfad11d74e6139e48bf65080cb98c9a7f9126b5435`

Protected rollback is retained in
`/home/nethvoice57/.config/state/routing-v6-20261015T174943Z`, with the exact
pre-deployment image overrides, configuration backup and hashed manifest.
Pre-slice images remain tagged `localhost/routing-v6-rollback:freepbx` and
`localhost/routing-v6-rollback:voice-agent`. Reverse the two saved overrides only
under fresh independent zero-call/channel gates; reload user systemd, stop the
runner, restart FreePBX, then start the runner and verify readiness/dialplan.
Migration 011 can remain installed; preserve later operator changes rather than
restoring the historical dump. Retired synthetic v6 publications remain immutable
for audit and are not routable.

Post-deployment authenticated API checks passed v6 catalog defaults, pagination,
CSRF/revision rejection, an isolated draft upgrade, saved permission preview and
cleanup. Read-only runtime views exposed six supported manifests and the actual
PBX directory. Native queue wrappers were present. FreePBX, runner, transcription,
CTI and Tancredi were running with zero restart counts. Runtime UID 65532,
loopback-only listener, readiness authentication, monitoring health, HTTPS UI
assets and public webhook-path isolation passed. Thirteen configuration/native
PBX tables matched their pre-deployment row counts and hashes exactly before any
test fixture was added. The operator's Receptionist stayed on its existing v5
publication. The transcription container was not restarted.

Three real OpenAI Realtime sessions then ran sequentially, each bounded to 60
seconds (observed about 55.8–55.9 seconds). They used one isolated agent, a virtual
extension, an empty queue and a native one-option IVR created through FreePBX
interfaces. Content capture on the test agent was off. Synthetic speech was
submitted through ARI playback. Each session recorded `provider_connected`,
`media_connected`, `response_completed` and `completed` without an error code.
None recorded a tool invocation or transfer. Therefore these runs do **not**
prove semantic routing, confirmed native handoff or native IVR option execution.
Playback acknowledgement also does not prove that the provider received the
synthetic speech. Human audio confirmation, the intermittent-silence investigation
and live routing/IVR acceptance remain open. No additional provider calls were
made beyond the three-call limit.

The temporary-target helper initially passed the native queue API's dynamic
member parameter as its default string rather than an empty array; the helper
was corrected and its partial fixtures removed before calls. No product code
change was needed for that test-helper error. Synthetic test audio was generated
locally with Flite and converted to 8 kHz PCM; no human audio, caller information,
transcripts or provider session identifiers were copied into these notes.

Sanitized receipts and reproducible staging helpers are retained under ignored
`local_testing/artifacts/routing-v6/`. They contain source hashes and fixed
verification fields; protected SQL/configuration backups remain on the server.
No NS8 route mutation, development reset, git commit, push or release declaration
was performed. Final cleanup and preservation checks are recorded below.

Final cleanup retired both isolated verification agents, removed the temporary
extension, queue and IVR through native APIs, deleted synthetic audio and applied
a native reload. No orphan queue-detail rows remained. All thirteen protected
configuration/native PBX table fingerprints matched their pre-deployment values
after excluding the two explicitly retained, removed test-agent records and
their audit history. The operator's Receptionist remained published on contract
5. Original directory counts were restored. All five services remained running
with zero restart counts; readiness, monitoring, private-listener authentication,
HTTPS assets and webhook-prefix isolation passed again. Shared configuration and
secret-file hashes were unchanged. Asterisk reported zero active calls and
channels. Protected rollback files and retained images were verified. Final
`git diff --check` passed in both active repositories.


## Pre-release editor simplification — 2026-10-20

Observed starting revisions: ns8-nethvoice
`292c9fbb8f087df9beac7a5f6795b22450f1ee96`, Satellite
`9499c10c6e0976d9a6675c6b1522b9ed6ff13213`; both `voice_agent`, initially clean.
The documented `.bak` and `old/` reference checkouts were absent in this workspace.
This change reuses the active agent editor, catalog metadata and default factory.

- Removed the provider-trunk shortcut before Greeting. Navigation order is
  Provider trunks, Agents, Activity.
- Removed the routing-upgrade UI, translations, REST endpoint and service method.
  The existing installation seed now creates Receptionist with the same current
  draft shape as the default factory and development reset. No new schema
  migration was added; existing saved records/publications are not converted.
- Removed IVRs from the catalog's selectable routing categories. Fresh defaults
  disable IVRs, and save/publish also disable them so an invisible IVR grant cannot
  survive a submitted draft. Immutable contracts and existing publications remain
  unchanged. Extensions and queues keep their optional description inputs.
- Updated browser, database/service and cross-repository fixture expectations.
  The seed-equality and link-removal checks failed before implementation; the IVR
  save check likewise reproduced the old behavior. One full browser run had a
  navigation timeout; its isolated retry and the subsequent full run passed.

Validation: UI production build/type-check, lint, formatting and four unit tests
passed; all 14 Playwright tests passed. The complete foundation harness passed
with the prepared Python environment and REST autoloader, including PHP services,
HTTP authorization/CSRF, 147 Satellite tests, runner correlation, backup/restore,
development reset and least-privilege accounts. PHP syntax and both repository
whitespace checks passed. The build retains its existing chunk-size warning;
Python reports a Starlette test-client deprecation warning.

Commands: `npm run build`, `npm run lint`, `npm run format`, `npm test`,
`npm run test:browser -- --workers=1`, and
`M0_PYTHON=/tmp/nethvoice-review-venv/bin/python M0_REST_AUTOLOAD=/tmp/nethvoice-review-rest-vendor/autoload.php bash ns8-nethvoice/freepbx/tests/agents/run-foundation.sh`.

No image build, deployment, Makako call, provider call or live-data reset was
performed. Rollback is to restore the changed source files and rebuild the UI;
there is no new database migration to undo. Already saved/published v6 snapshots
remain valid. Existing pre-release installations need an explicitly authorized
development reset to recreate Receptionist from these fresh defaults.
