# Basic Voice configuration and execution

This slice extends M0 with PHP-owned configuration, native destinations and a
shared Satellite runtime. It is not a declaration that the v0.1 live-call
release gates have passed. Provider calls, media and real transfer confirmation
must be verified independently on an approved test route.

The current local v5 slice puts model, voice and supported options on the agent
page and implements a separate GPT-Live adapter. It has not replaced the Makako
deployment recorded below. The earlier trunk-model implementation is historical;
see the final section for the current contract, development reset and build gates.

## Administrator flow

Open Agent from Wizard’s Apps menu; it opens `/freepbx/agents-ui/` in a new tab after the existing Wizard sign-in. Receptionist is the sole built-in agent and starts inactive. Each agent has its own editable draft and tool bindings. Administrators can also create Basic Voice agents. Receptionist cannot be deleted. Legacy Internal/External configurations are read-only and retain their historical publications. They can be disabled and explicitly retired after native references are removed; no configured agent is automatically deleted or merged.

Create an OpenAI or Grok provider trunk. API keys, Standard Webhooks signing
secrets and optional Grok SIP digest passwords are write-only. Blank credentials
on an edit retain the existing encrypted value. A new API key may be blank when
PHP and Satellite have `OPENAI_API_KEY` or `XAI_API_KEY` (`GROK_API_KEY` is an
alias). Explicit encrypted keys take precedence. NS8 refreshes the Satellite
credential file on startup and when integrations change; no keys reach the UI. Configure the provider's webhook
using the HTTPS endpoint shown by the UI; saving a trunk does not configure the
provider account. Native Core APIs own PJSIP trunk creation and removal; managed
trunk names start with `VoiceAgentTrunk_` to avoid adopting legacy records.

Trunks now offer a separate **Voice model** selector. OpenAI options are the
intersection of authenticated `/v1/models` discovery and the maintained Realtime
SIP adapter catalog. A five-minute cached response and an outage fallback catalog
are labelled separately; an empty successful response stays empty. Saved models
that disappear remain visible and are never replaced automatically. New/changed
selections and replacement API credentials are checked by PHP; unchanged saved
models can survive unrelated edits during a discovery outage. GPT-Live, text-only,
transcription and other-provider models are not accepted by this adapter.

Grok SIP displays a single provider-managed choice, not the direct WebSocket voice
model list: xAI ignores `model` when `call_id` identifies an inbound SIP session.
The UI explains this limitation and no fake model parameter is sent. See the
[xAI voice reference](https://docs.x.ai/developers/rest-api-reference/inference/voice).
OpenAI discovery and call acceptance follow the official
[model-list](https://developers.openai.com/api/reference/resources/models/methods/list)
and [Realtime SIP](https://developers.openai.com/api/docs/guides/voice-sip?voice-api=realtime)
contracts, checked on 2026-10-14.

Trunk model changes affect new calls without republishing agents or reloading the
PBX. At admission, the runtime validates and copies the trunk selection before SIP
origination. It takes precedence over a legacy conversation model, followed by
the existing adapter default (`gpt-realtime-2.1` for OpenAI, provider-managed for
Grok SIP). An explicit invalid trunk model fails before provider usage. Existing
v1–v4 publications and their strict schemas are unchanged. An omitted model field
on an older client's trunk edit preserves the existing selection; a legacy trunk
without a selection keeps its previous default. Provider-managed Grok identifies
the policy, not an independently selectable or locally pinned vendor model release.

Choose Default language from a dropdown, initialized to the FreePBX default,
and select a provider voice. The caller can request another language during the
conversation. OpenAI’s ten built-in Realtime voices come from its documented
enumeration; there is no documented built-in voice-list endpoint. Grok’s roster
is fetched server-side from its authenticated voice API, with bounded responses
and timeouts. Configure greeting, instructions and maximum call duration. Enable either or both tools:

- `directory.find_destinations`: search only existing extensions approved by this agent's enabled transfer binding. Its own result limit defaults to 20 (range 1–100).
- `telephony.transfer`: transfer only to an explicitly approved, currently existing extension. Its searchable extension allowlist starts empty. Both tools start disabled and are configured in expandable panels on the agent page; disabling transfer also removes all search visibility.

Save the draft, publish it and enable the agent. Calls pin the published version;
saved draft changes have no effect until published. Optimistic revision conflicts
preserve local edits and offer an explicit reload. Native synchronization failures
remain visible with a retry action. Prompt/tool changes do not require a PBX reload;
publication of a first destination, changed fallback/binding or enablement does.
Deleting an unpublished draft does not reload Asterisk.

VisualPlan's Agent palette object selects saved agents, including Receptionist and custom Basic Voice agents. Only enabled, published and synchronized agents can be added. New agent
opens `/freepbx/agents-ui/#/agents/new` in a new tab; configure/edit opens the saved
agent. The canvas stores a stable native reference and supports undo. Both agent
objects and incoming connection references are validated before any PBX write.
Connect the Agent’s Fallback output to its native fallback destination; leaving
it unconnected selects Hangup. Agents UI does not edit fallback routing. VisualPlan
checks revisions, destinations and cycles, then publishes only the fallback
change without publishing unrelated draft edits. Each admitted call keeps a
native wrapper for its pinned fallback. Provider trunks always use Hangup.
Synchronization repairs a missing managed native trunk and checks its actual
Asterisk endpoint; ordinary trunk deletion cannot remove an agent-owned trunk.

Activity lists paginated run metadata and bounded event details, including provider
connection, media bridge and completed provider responses. A caller who hangs up
before connection is interrupted, rather than reported as a completed conversation. No transcript,
audio or raw tool arguments/results are stored by this feature. Retention is seven
days; the module's hourly maintenance timer removes expired terminal runs in
bounded batches. Retention and content capture are fixed for this v1 contract.

## API and storage

All paths below are relative to `/freepbx/rest/agents`. Existing Wizard admin
header authentication is enforced on the server, with same-origin checks.
Mutations additionally require the identity-bound `X-Agents-CSRF` token obtained
from `GET /access`, JSON envelopes and an integer `expected_revision`.

| Path | Methods | Purpose |
| --- | --- | --- |
| `/access`, `/catalog` | GET | Identity/CSRF envelope and native inventory |
| `/profiles`, `/profiles/{id}` | GET, POST / GET, PUT, DELETE | Drafts and stable agent identities |
| `/profiles/{id}/publish` | POST | Atomic immutable publication |
| `/profiles/{id}/enabled` | POST | Enable or disable new admissions |
| `/trunks`, `/trunks/{id}` | GET, POST / PUT, DELETE | Encrypted provider bindings and native ownership |
| `/trunks/{id}/voices` | GET | Safe provider voice catalog |
| `/trunks/models` | POST | Authenticated compatible-model discovery with write-only credential input |
| `/synchronize` | POST | Audited native provisioning/reload retry |
| `/runs`, `/runs/{id}` | GET | Paginated activity and bounded event details |

Profile writes use `{profile: {name, draft}, expected_revision}`; trunk writes use
`{trunk: {...}, expected_revision}`. Create uses revision zero. Publish/delete use
`{expected_revision}`; enable adds `enabled`; synchronization uses `{retry: true}`.
The access response declares `v0.1-configuration`, not a release certification.

Model discovery uses `{provider, binding_id?, api_key?}` and requires the same
authentication, same-origin and CSRF protection, but no revision because it writes
no configuration. Effective credentials are an unsaved nonblank key, then the
binding's encrypted key, then the environment key. No credentials enter URLs or
responses. Results contain `items`, `source`, `selection` and `default_model`;
outage fallback adds the safe `discovery_error`. Trunk writes accept `model`, stored
in the existing settings JSON; reads add `model`, `effective_model` and
`model_selection`. No database migration or new runtime database privilege is needed.

Migrations 002–008 are additive and run once under the schema lock. Fresh installations seed only inactive Receptionist with INSERT IGNORE; the schema changes add add encrypted bindings/audits, extension
views, durable pending-call correlation and immutable version-one tool manifests.
Configuration stays in `asterisk`; execution metadata stays in `asteriskcdrdb`.
The shared v1/v2 published contracts implicitly pin tool manifest version one.
Version two adds Hangup and validated native fallback destination references;
previous version-one publications remain valid. Migration 006 extends the version
constraint and fallback synchronization column. Migration 007 extends monitoring
phases without capturing conversation content. Migration 008 adds immutable configuration-aware manifest version two and published contract v3. The v3 draft/publication stores `tool_bindings: [{tool_id, tool_version, enabled, config}]`; earlier v1/v2 snapshots and manifest version one stay immutable and executable. The catalog returns declarative configuration schemas and defaults for the new editor. New definitions never enable themselves on existing agents. PHP
owns manifests; Satellite verifies them against its supported handlers at admission.

NS8 provisions different passwords for `voice_agent_config` and
`voice_agent_monitor`. The reader gets SELECT only on four dedicated views; the
writer gets SELECT/INSERT on three execution tables and limited UPDATE columns.
Neither receives DDL, DELETE, drafts or unrestricted PBX table access. Satellite
receives an allowlisted mode-0600 `satellite.env` containing agent and transcription
credentials, without the MariaDB root password or unrelated module secrets.
Credentials and monitoring outbox storage are included in backup/restore.
The additional private listener requires TCP port demand 40 in the module bundle.

`satellite.service` runs one container using the canonical Satellite image as UID
65532. The NethVoice image wrapper adds `nethvoice_runtime.py`, which supervises
`python -m voice_agent.runner` and, when either transcription flag is enabled,
`python main.py`. Both components receive graceful shutdown; an unexpected exit
restarts only the failed component after five seconds. Podman init reaps orphaned
workers, so transcription remains running while the agent component recovers.
The agent listener still binds to loopback. Traefik forwards only
`/satellite-webhooks` to it; FastAPI exposes exactly the two provider webhook paths
and authenticated `/internal/ready` outside that prefix. Unknown paths, docs and
configuration-push routes are absent. The transcription API retains its existing
port and routing.

Configuration, integration changes and upgrades use `manage-satellite` for the
same lifecycle. Satellite stays enabled for webhooks and readiness even when all
agents are disabled, so PHP can enable a published agent without managing host
services. An unchanged settings save does not restart the service. Changes wait
for idle calls, and an unavailable Asterisk query refuses the restart. FreePBX
restarts do not stop Satellite. Volume ownership is repaired for UID 65532 on
mount. MQTT and the recordings cleanup timer run only with transcription. PostgreSQL
starts when transcription is enabled and remains available for historical reads
after transcription is disabled. Upgrades stop and disable the former
`voice-agent.service` and remove its container before starting Satellite. The
existing `voice-agent-events` volume, private webhook port and route are retained.

Provider signatures are checked over the original bounded request bytes with a
five-minute replay window. A webhook must match the persisted, unexpired admitted
call and its opaque SIP nonce, leg and agent headers. It cannot create an active
call. Pending consumption and provider call IDs are idempotent. Each call has a
setup deadline, configured duration and native fallback. Native transfer targets
clear the Asterisk watchdog before entering the approved FreePBX extension.
Transfer success requires both the caller's ARI release and the native wrapper's
matching channel/token/destination event. The caller is detached from provider
media before continuation. OpenAI header correlation, audio and native transfer
were exercised on staging; Grok's live-provider gate remains outstanding.

The bounded private monitoring outbox contains only metadata, survives restart,
reserves terminal outcome capacity and reports persistent degradation through
private readiness. New admissions are refused when ordinary outbox capacity is
exhausted. A DB outage cannot expand an unbounded queue. Restart recovery touches
only the runner's owned Stasis channels and marks unfinished runs interrupted.

## Reproducible checks

From the NethVoice repository, with a Python 3.12 environment containing Satellite
requirements and dev requirements:

```sh
VOICE_AGENT_TEST_PHP_IMAGE=localhost/nethvoice-freepbx:v01-configuration \
M0_PYTHON=/path/to/python freepbx/tests/agents/run-foundation.sh
```

The harness uses disposable MariaDB only: migrations, immutable versions/tools,
CRUD, safe secrets, revision conflicts, real HTTP authentication/CSRF, real FreePBX
extension classes, restricted runtime accounts, retention and synthetic dump/restore.
It also runs cross-repository contract/provider/runtime security tests. No real
provider keys or call are involved. Run UI type-check, lint, unit tests, browser
tests and production build from `freepbx/agents-ui`. The VisualPlan browser test
loads its actual native draw2d library. Existing transcription tests remain separate.

Run the local consolidation checks without external services:

```sh
python3 -m pytest -q tests/unit/test_satellite_runtime.py tests/unit/test_satellite_lifecycle.py
python3 freepbx/tests/agents/ns8.py
```

The runtime tests spawn disposable components to verify all transcription modes,
graceful shutdown and independent component recovery. Lifecycle
tests cover legacy retirement and preservation of historical transcript storage.
The default build verifies and builds a pinned upstream source archive containing
both runtimes; no local `SATELLITE_IMAGE` override is required. See the
[Satellite packaging notes](../satellite/README.md#shared-voice-agent-runtime).

Provider protocols were checked against the current primary guides:
[OpenAI Realtime SIP](https://developers.openai.com/api/docs/guides/voice-sip) and
[Grok SIP](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech/sip).
OpenAI uses the current SIP guide's `gpt-realtime-2.1` default.
The adapters keep their event/session contracts separate and do not implement
GPT-Live transport events.

Optional private debug transcription uses the additive v4 publication contract;
enable it on the agent's Debug section, save and publish, then open the run from
Activity. Capture is off by default, OpenAI-only and expires within 1–24 hours.
Expired content is removed in repeated bounded batches; old orphaned running
metadata also expires after the fixed seven-day retention period.

Publishing routing or trunk changes applies the PBX configuration, including
other pending administrator changes. Reloads retry a busy FreePBX lock and allow
up to ten minutes per attempt; an administrator can retry a failed synchronization.
Agent configuration conflicts in VisualPlan are checked under the shared agent
configuration lock before native route writes.

Historical routing, content-handling and staging evidence follows.

## Voice-model slice verification — 2026-10-14

Starting clean `voice_agent` revisions: NethVoice
`f94e43625ef94eb2ed129f958cb4279f8de05958`, Satellite
`29220e83f3ae9a32db0c5c24583ad3739a81df90`. Read-only reference revisions:
`2f41116fd2ed890e15439a912977ae1bb7189c5b` and
`08cabfa08c71401dde933f18b21eb01499524f6b`. Root documentation is unchanged.
The old profile's model field and existing catalog/form/adapter patterns were
inspected; its free-text selector and PostgreSQL configuration ownership were not
imported. The first regression demonstrated that the pinned trunk model was absent
from the adapter profile. Browser tests also exposed initialization events that
could reset a saved model; only actual provider changes now reset that selection.

Local checks passed:

- Foundation harness: 72 Python cases plus PHP service, catalog, actual Slim
  auth/CSRF, native trunk/dialplan, migration rerun, restricted-account and disposable
  MariaDB dump/restore checks. Restoration explicitly preserves the model setting.
  The optional standalone Wizard-auth harness was skipped; actual HTTP middleware
  tests ran. Provider model availability, credential precedence, stale revisions,
  unchanged unavailable models and absence of PBX reload on model edits are covered.
- Existing Satellite service/transcription Python suite: 99 passed, one expected
  skip, six existing warnings in the dependency-complete test image. Foundation
  tests ran separately on the host, where PHP is installed. An initial combined
  attempt could not collect legacy dependencies locally, and the Python-only image
  lacks PHP; neither failed environment attempt is counted as a passing full suite.
- UI type-check, lint, formatting, three unit tests, ten browser flows and build
  passed. Browser coverage includes save/reload, empty/error/fallback provenance,
  unavailable saved choices, provider changes, late discovery responses, cleared
  credentials and the mobile layout. Existing VisualPlan flows remain covered.
- Local OpenAI/Grok TCP/WebSocket emulators confirm that OpenAI receives the model
  pinned before a concurrent trunk edit and Grok receives no fake model override.
  Existing PHP transcription/voicemail regressions passed 9/9.
- Source secret scans found zero findings in the PHP agent library, UI source and
  Python runner. The built runner secret scan also found zero findings.

Read-only staging preflight reached node 1 on `makako.sf.nethserver.net` as root,
module `nethvoice57`. FreePBX, voice-agent and existing transcription were active
with zero restarts; Asterisk reported zero active calls/channels. Existing image
IDs remain FreePBX `387d37442fa4a4a58c65e66c30d4303c1aa413e6745502003ab1f9f0570e7f71`,
runner `4f3238dde89cace1de9faf9ab653bee47c181a4dc040b78ad30c6d3b82a6e701` and
transcription `0eb3d2a9a91bd6f2faab9548a3baac9eceef3c8b4d90f63e9b48f90235661f9e`.
No remote configuration, routes, credentials or services were changed. SSH used
`-F /dev/null` after the local system SSH configuration failed its ownership check;
host-key verification was preserved and no SSH configuration file was edited.

Rollout requires explicit authorization and a fresh zero-call check, protected
backups of current settings/image references, and replacement of only FreePBX and
the independent voice-agent runner. Pin the runner image in a runner-only systemd
override: the default unit uses the same image variable as transcription, so
changing that shared variable to the standalone image would break transcription
on its next restart. Verify UI discovery, preservation of saved
models, runtime readiness, route ownership and any separately authorized synthetic
call. No new migration is required. Preserve v1–v4 publications and all unrelated
PBX configuration. For rollback, disable agents using newly selected models before
restoring the recorded images: older runtime code ignores the new model setting.
Retain settings for recovery and explicitly reconcile the desired model before
re-enabling calls; do not silently resume with an older default or restore a whole
database over subsequent operator changes.

Deployment and authenticated live model discovery were subsequently verified on
2026-10-15 as recorded below. No paid provider calls were performed for this slice.
Live Grok, full NS8 upgrade/restore/clone and inherited
dependency triage remain release gates. Local success is not v0.1 certification.

### Built images and security artifacts

| Artifact | Local image ID |
| --- | --- |
| `localhost/nethvoice-freepbx:v01-models-scoped` | `74a6bd304498b8d151bc80af3f4854c7b83606f843c0152a1615585be85d32e1` |
| `localhost/nethvoice-voice-agent:v01-models` | `b4d181e4f05778618609defdb322c291c5bffe08f995afdf00863c92f97f8ad5` |

The standalone runner's canonical Containerfile build passed; the built image
imports and model resolution passed as UID 65532. The canonical UI builder passed.
The scoped FreePBX image pins base image
`69486f1665b798d3c71b708dc01ffbcd7d680132fe63ac9d2df915a1fd9b64ed`
and UI builder image
`b7c64d5e1402085f07a7d794a9e2213c6c480f4c53e3952e6626416219abf9b0`.
Its four COPY layers contain compiled UI assets, the current PHP agent library,
REST route registration and the native handoff dialplan hook. It includes the
already-implemented v4 debug policy and acknowledged native handoff fixes missing
from that older base. The inherited root entrypoint remains necessary for existing
Apache/cron/Asterisk startup orchestration; this slice adds no privileges. No
Containerfile or image dependency source was changed.

Source checksums for PHP, model capabilities, native handoff and the compiled index
match local source/output. Final assets contain no node_modules, environment files
or source maps. The full foundation harness passed against this exact FreePBX image.
A separate canonical full FreePBX rebuild was stopped during its unrelated base
package-download stage after the pinned scoped image was available; it is not
reported as a passing full rebuild or release artifact.

Dive layer checks passed for both images. Trivy 0.75.0 found zero secrets in each.
The runner has three critical vulnerability entries (all in inherited perl-base);
FreePBX has 16 critical entries, 14 unique signatures. Both sets are subsets of
the previously recorded baseline signatures, not security clearance. Scanning
used the still-current database snapshot updated 2026-10-14 07:11 UTC, due for
refresh 2026-10-15 07:11 UTC, after fresh downloads hit temporary-filesystem quota.
CycloneDX SBOMs contain 119 runner and 1,185 FreePBX components; FreePBX's SBOM was
generated with Trivy convert from the complete 1,178-package scan report rather
than repeating image analysis. Reports, SBOMs, layer checks and the pinned build
recipe are retained under ignored `local_testing/artifacts/voice-agent-models/`.

### Model selection staging deployment — 2026-10-15

The user explicitly authorized deployment to `nethvoice57` on Makako, node 1.
FreePBX and the independent runner were replaced at 06:48:34–06:48:52 UTC after
two independent Asterisk checks confirmed zero active calls and channels. Active
source revisions remain `f94e43625ef94eb2ed129f958cb4279f8de05958` and Satellite
`29220e83f3ae9a32db0c5c24583ad3739a81df90`, with the uncommitted model-selection
changes identified by the build receipt. No commit or registry push was performed.

Docker archive import changed the Podman image configuration serialization IDs.
An initial identity check stopped before changing units or services. Comparison
then proved exact equality of all filesystem layer digests (109 FreePBX, nine
runner), runtime configuration objects, OS and architecture with the tested local
images. The resulting pinned running Podman IDs are:

| Container | Podman image ID |
| --- | --- |
| `freepbx` | `bfd215cb072a4ae7506e09480eedbdbe3f092bb56f258051ae6bdb3577fea7fe` |
| `voice-agent` | `0a17ec5201fa4c70f5947b0a4543677558eecb92394358c62b1a7160df12bc77` |

Only the module-owned `freepbx.service.d/90-voice-models.conf` and
`voice-agent.service.d/90-voice-models.conf` image command overrides were installed.
Original command options, mounts and environment files are retained. The shared
environment, password file, runner secret file and agent environment remain
byte-identical. Existing transcription retains the same container and image ID
`0eb3d2a9a91bd6f2faab9548a3baac9eceef3c8b4d90f63e9b48f90235661f9e`.
FreePBX dependency handling also restarted Tancredi and the reports services;
all instance containers returned to running state.

Verification passed against the deployed system:

- The public HTTPS UI returned 200 and its index matched the built image. Assets
  contain no environment files, source maps or node_modules. Native handoff and
  model-contract checksums match the tested source; Receptionist's native
  dialplan context remains present.
- Actual authenticated HTTPS REST requests passed admin access, profile/trunk/tool
  reads, and CSRF denial. OpenAI model discovery returned `provider_api` and all
  four supported models. The existing trunk has no explicit saved model and
  correctly reports its effective default `gpt-realtime-2.1`. Grok discovery
  returned `provider_managed` / `provider-default` without opening a voice session.
- The runner reports ready, ARI connected and monitoring not degraded; it runs as
  UID 65532 with its listener bound only to loopback. FreePBX, runner and existing
  transcription have zero automatic restarts. Asterisk 22.10.0 is running and
  independent post-deployment checks report zero calls/channels.
- Sanitized journal review found one startup `recallonbusy` AMI connection retry,
  no other ERROR lines or Python tracebacks, and no ERROR lines after 06:50 UTC.
  User journals were unavailable in the module context, so this check used the
  host journal filtered to the module UID and the three affected units.
- The eight agent configuration tables, including immutable publications,
  encrypted bindings, drafts and grants, have an identical deterministic dump
  hash before and after deployment. No migration was needed. Wizard, webhook,
  SIP route, certificate and module-configuration fingerprints are unchanged.

Rollback was not used. Protected copies remain in the module's state directory
`v01-models-rollback-20261015/` (directory 0700, files 0600), including a verified
agent-configuration SQL backup, original units and state files, old image IDs,
and prepared `freepbx-rollback.conf` / `voice-agent-rollback.conf` commands. Both
old images are retained with module-local rollback tags. To reverse this deployment,
first reconcile any model changes made since rollout using the model rollback
rule above; independently drain calls, replace the two overrides with those
prepared rollback files, reload the user systemd manager, stop the runner, restart
FreePBX and start the runner, then repeat health and route checks. Do not restore
the configuration backup over later operator edits or change the shared
transcription image binding. These staging overrides must be reconciled before a
future module upgrade so they cannot silently keep an older executable image.

Sanitized deployment, transport-equivalence and verification receipts are retained
under ignored `local_testing/artifacts/voice-agent-models/deployment/`. Backups and
credentials stay on the target; no caller details, call content or provider keys
were collected into workspace evidence. No real OpenAI/Grok call was made during
this deployment; local emulator results and this rollout do not close the remaining
release gates.

## Agent conversation settings and GPT-Live — v5 staging slice

Receptionist and custom agents select their model and compatible voice on the
agent page. Trunks own connection settings and encrypted credentials. The trunk
editor no longer selects or displays a model, and trunk writes reject `model`.
Historical stored trunk values are retained for old publications only; v5 calls
ignore them. `POST /trunks/models` remains authenticated, origin/CSRF protected,
read-only discovery using the selected trunk's effective credential. Its additive
response includes adapter identity, compatible voices, option schemas/defaults,
backend-model availability and capability version 2. Cached/catalog fallbacks
remain visibly distinguished from provider results, including empty results.

New publications use contract v5, with `conversation.model` and
`conversation.options`. Realtime/Grok options are `null`, explicitly meaning no
additional adapter options. GPT-Live options are a strict object containing only
`backend_model`, `backend_instructions`, `reasoning_effort`, `verbosity`,
`service_tier`, and integer `max_output_tokens`. Backend-owned schemas generate
the editor. Defaults are GPT-6 Luna, medium reasoning, low verbosity, default
service tier and 2,048 output tokens (allowed 16–8,192). Backend choices are the
compatible/account-available GPT-6 Luna and GPT-6 Sol models. Supported reasoning
is the intersection with the Live accept schema, excluding standalone-only
settings such as `max`. Provider/model/voice/options validation runs in PHP and
Python; later edits cannot change the detached call-start configuration. Pure
conversation publications do not reload the PBX. Migration 010 adds v5 support
and initializes only the untouched installation seed; existing v1–v4 schemas and
configured publications are not rewritten. Production migration of configured
legacy agents is outside this development reset slice.

The separate Live adapter adapts `satellite.bak/agent/providers/live.py` and its
TCP emulator. It uses signed `live.transport.incoming` SIP correlation and
supports documented `live.call.incoming` deliveries. Realtime and Live events may
arrive for the same pending call; only the selected protocol may claim it. Live
accepts `/v1/live/sessions/{session_id}/accept`, attaches its sideband with
`/attach`, preserves the opaque session ID and uses Live-specific tool/result and
termination events. Managed Responses delegation receives separate backend-task
instructions and only the enabled tools from the pinned per-agent registry.
Hosted tools cannot be configured through options; parallel tool calls remain
off. Native transfers still require both ARI ownership release and the matching
FreePBX confirmation event. Provider storage remains off; optional local text is
bounded and encrypted through the existing retention policy. GPT-Live remains
labelled experimental until project/SIP enablement and authorized live acceptance
are verified. References: [SIP](https://developers.openai.com/api/docs/guides/voice-sip),
[Live accept](https://developers.openai.com/api/reference/resources/live/subresources/sessions/methods/accept),
[delegation](https://developers.openai.com/api/docs/guides/live-delegation).

### Explicit development reset

The user selected clearing development agent data rather than migrating it.
`local_testing/reset-voice-agents.py` is intended to run **inside the confirmed
nethvoice57 runagent context** after the new image is installed. It is read-only
by default; `--apply` performs the explicitly scoped reset. It is not a normal
upgrade hook or a public REST action. The PHP entry point is CLI-only and checks
the designated staging virtual host and explicit reset marker.

The command independently checks Asterisk calls/channels, refuses referenced
custom destinations, creates and verifies protected server-local data/state/unit
backups, stops the runner, rechecks calls, and backs up its private event outbox.
Only agent drafts/publications/records/audit and agent runs/events/transcripts/
pending calls are cleared. Provider bindings and their audit, encrypted secrets,
shared tool manifests, native CDR, users and unrelated PBX configuration remain.
The outbox cleanup is limited to the runner's UUID-named metadata files. It seeds
only Receptionist with stable destination `agent:receptionist`, disabled and
unpublished, with tools/grants off, then applies native dialplan changes and
starts the independent runner. It cannot silently activate an agent or assign a
route. A referenced non-Receptionist destination blocks the reset until resolved.

This maintenance path uses explicit TRUNCATE of allowlisted tables, so the normal
immutable-version UPDATE/DELETE triggers remain intact. DDL is not transactional:
on failure inspect the protected backup and restore only the affected agent data
before resuming; do not imply an automatic SQL rollback. Restore the matching old
images, agent-table inserts and event outbox while the runner is stopped and
calls are drained, then apply native dialplan synchronization. Reconcile any edits
made since reset before restoring. Do not restore whole databases or shared
credentials over newer operator changes. This reset ran on Makako on 2026-10-15;
see the staging verification below.

### Verification and artifacts

Active revisions are FreePBX `f94e43625ef94eb2ed129f958cb4279f8de05958` and Satellite
`29220e83f3ae9a32db0c5c24583ad3739a81df90`, with uncommitted source changes.
Reference revisions are `2f41116fd2ed890e15439a912977ae1bb7189c5b` and
`08cabfa08c71401dde933f18b21eb01499524f6b`. The regression was demonstrated failing
before implementation. Current local results:

- 98 Python foundation cases, including Live HTTP/WebSocket simulation, strict
  PHP/Python contracts, admission isolation, cross-family webhooks, replay,
  bounded payloads, denial and confirmed native transfer.
- Disposable MariaDB migration reruns, immutable publications, actual Wizard
  admin/non-admin authentication and Slim CSRF/envelope checks, provider discovery,
  independent models on a shared trunk, retention, restore, reset scope/native
  CDR preservation and least-privilege identities. The reset driver also denies
  wrong targets/active calls and performs only reads by default.
- UI type checking, lint, formatting, three unit tests and ten browser tests.
  The mobile agent/Live-options view was rendered and visually checked.
- Existing Satellite tests: 99 passed, one expected skip. Existing PHP
  transcription/voicemail regressions: 9/9. Test-only dependency warnings remain.

| Local artifact | Docker image ID |
| --- | --- |
| `localhost/nethvoice-freepbx:v5-agent-models-safe-draft` | `ac53e4f6f3557b0f6b970be295b49791ec1a0d38f54c938cdbe9684d00a3665c` |
| `localhost/nethvoice-voice-agent:v5-agent-models` | `6f57b7a9c22cba51667c67c1592100f960dacecb19e0d02c539ca61669ef3252` |

The canonical runner and canonical UI builder passed. The FreePBX staging overlay
pins the previous tested FreePBX image and new UI builder, replaces only compiled
agent assets, the PHP agent library and native agent dialplan hook, and removes
obsolete agent UI assets.
It retains the existing root startup orchestration for Apache/cron/Asterisk and
adds no privileges. It is not a fresh canonical full FreePBX release rebuild.
Source checksums match both images; the runner imports Live as UID 65532. The full
foundation harness passed using the matching PHP library and native hook. No provider keys,
environment files, node_modules or source maps are deployed in the UI assets.

Trivy 0.75.0 reports zero secrets in both images and all three source areas. Both
images passed Dive CI checks. CycloneDX inventories contain 1,185 FreePBX and 119
runner components. The vulnerability DB is updated 2026-10-15 07:10 UTC; the valid
Java DB snapshot is dated 2026-10-14 01:07 UTC. A failed Java download caused a
temporary-filesystem quota error; the completed scan uses workspace scratch and
the existing valid Java DB. There are 16 FreePBX critical entries (14 unique) and
three runner critical entries (in perl-base). Scanning both prior image baselines
with the same current DB found no additional vulnerability signatures introduced
by this slice. These inherited findings remain release blockers, not security
clearance. Reports, SBOMs, layer analysis, logs, source/image hashes and the staging
recipe are under ignored `local_testing/artifacts/agent-models-v5/`.

Live Realtime/GPT-Live/Grok conversation/transfer/fallback acceptance, full NS8
lifecycle coverage and inherited dependency remediation remain release gates.

### V5 staging deployment and reset — 2026-10-15

The authorized deployment and selected development reset completed on Makako,
node 1, instance `nethvoice57`, virtual host `voice2.makako.sf.nethserver.net`.
Only module-owned FreePBX and standalone runner image overrides changed. The
shared Satellite transcription image binding and transcription container were
preserved. Imported Podman images have verified identical filesystem layers and
configuration to the tested Docker artifacts; their IDs are:

- FreePBX: `ea0cda44f1992b8766a65cecae454b91aade47ef58c5ac7734c0bc598854940e`.
- Runner: `694c68c5005ec3469fb0d580497e1059fe876479cf3b5b4290dc0443c79663be`.

The reset at 08:49 UTC left exactly one disabled, unpublished Receptionist, with
no provider/model selection, tools or grants enabled, and empty agent history.
Eight preservation fingerprints match before/after: provider bindings/audit,
tool manifests, trunks, PJSIP, users, inbound routes and native CDR count. Shared
environment/secret files are byte-identical. Five API fingerprints also match:
Wizard/webhook/SIP routes, certificate and module configuration. Migration 010 is
installed. No unrelated PBX routes were assigned or changed.

Reset verification exposed that draft-only agents had no generated native
context. The native hook now generates a hangup-only context for saved unpublished
agents, preserving safe existing references without making them selectable or
opening Stasis/provider sessions. A failing native regression demonstrated the
gap; the updated native regression, 98-case foundation harness and all nine
transcription tests passed. The final FreePBX image passed a fresh secret/CVE scan,
Dive and SBOM generation with unchanged package findings. The first guarded
attempt checked the dialplan before asynchronous FreePBX startup completed and
restored the preceding v5 image. A bounded dialplan readiness check resolved the
rollout timing; the final image was verified at 09:01 UTC. Independent Asterisk
checks reported zero calls/channels before and after disruptive operations.

Postdeployment verification passed authenticated admin API/CSRF, model discovery
using the existing credential, HTTPS UI and all compiled assets, private readiness
(UID 65532, loopback bind, unauthenticated access denied), public webhook prefix
isolation, fresh agent state and the inactive native Receptionist destination.
Provider discovery returned the four supported Realtime models, GPT-Live and both
supported backend models. This discovery does not certify GPT-Live SIP enablement
or a provider-backed voice call. No paid/provider voice call was performed.

Protected server-local rollback material is retained under:

- `/home/nethvoice57/.config/state/v5-agent-models-rollback-20261015` for prior
  image overrides, configuration and state; final native-hook override backups
  are in its `safe-draft` and `safe-draft-retry` subdirectories.
- `/home/nethvoice57/.config/state/agent-reset-20261015T084930Z` for the verified
  reset data, state, units and private event outbox.

Restore only affected agent data with matching images and native reload, using
the drained-call procedure above. Image rollback alone cannot recover cleared
development data. Sanitized deployment receipts are retained under ignored
`local_testing/artifacts/agent-models-v5/deployment/`. Changes remain uncommitted;
no push or release was performed.

### Default Receptionist instructions — 2026-10-15

Receptionist now starts with editable instructions from
`rest/lib/agents/ReceptionistDefaults.php`: greet briefly, clarify the caller's
intent, speak in the configured language, use only enabled tools and permitted
destinations, avoid invented information and confirm transfers only after tool
success. These instructions grant no permissions. Normal Basic Voice defaults
remain unchanged. Fresh installation and explicit development reset use the same
prompt. Schema initialization fills only the former untouched, blank Receptionist
seed; saved prompts, deliberately cleared prompts and published snapshots remain
unchanged. No schema/publication version change is required.

The regression failed before implementation. The complete foundation harness
passed again (98 Python cases and PHP/MariaDB/native/API/restore/reset/privilege
checks), including new seed, upgrade-preservation, language-default and reset
assertions. Image source hashes match the tested source. The FreePBX staging
image `localhost/nethvoice-freepbx:receptionist-default` has Docker ID
`bfc49d48056726b3397baacdf1cd36b63e1df3fef94405b34618ff8e188b8e2c` and deployed
Podman ID `c07a8f8527f492ebade217fb9c1af92ba8c0c99d11762b68dfc948143945e0eb`.
The runner, compiled UI and transcription image are unchanged. Dive passed;
Trivy found zero secrets and no new vulnerability signatures with the same
2026-10-15 database. The 1,185-component SBOM and inherited critical findings
remain as documented above.

Deployment completed on `nethvoice57` at 09:57 UTC with independent zero-call
gates. Its saved but blank Receptionist draft was filled through the normal
authenticated, CSRF-protected API at revision 3, with an audited `draft_saved`
event and readback verification. It remains disabled and unpublished, and all
other draft settings are preserved. Eight PBX/provider/CDR fingerprints and five
route/certificate/module fingerprints match before and after; private runtime
readiness, UI assets and inactive native destination checks passed. No development
reset or provider voice call was performed for this follow-up.

The bounded system-journal check found transient FreePBX/transcription connection
errors during Asterisk restart, all before the 09:57:55 readiness check. It found
no agent-runtime errors or errors after readiness. User-journal access was
unavailable; verification used the root system journal scoped to the module UID.

Protected image-override and agent-data rollback backups remain on the server at
`/home/nethvoice57/.config/state/receptionist-default-20261015T095737Z`.
To undo only the prompt edit, restore the prior instructions through the agent
API with its current expected revision, preserving any later edits. To undo the
image, drain calls and restore the saved FreePBX override using the preceding
procedure. Receipts are under ignored
`local_testing/artifacts/agent-models-v5/receptionist-default/`.

### Model-specific voice verification — 2026-10-15

Read-only inspection on `nethvoice57` confirms separate built-in voice lists in
the deployed model catalog: 31 for GPT-Live and 10 for each supported Realtime
model. These match the current official
[Live accept contract](https://developers.openai.com/api/reference/resources/live/subresources/sessions/methods/accept)
and [Realtime voice options](https://developers.openai.com/api/docs/guides/realtime-conversations).
Some names are supported by both families. The agent picker already uses the
selected model's catalog entry and clears a selected voice when the next model
does not support it; a shared compatible voice may remain selected.

Added a browser regression checking the complete list for every selectable OpenAI
model and cross-language contract coverage accepting Live's Quartz voice while
rejecting it for Realtime. Five model/settings browser tests and 19 PHP/Python
contract/runtime cases passed. The browser assertions scope options to the open
voice listbox and wait for draft-save completion before navigation. Application
code, catalogs, staging configuration and images were unchanged by this check;
no deployment or provider call was needed. Test changes remain uncommitted.

### GPT-Live call repair and explicit companion selector — 2026-10-15

Target: Makako node 1, `nethvoice57`,
`voice2.makako.sf.nethserver.net`; proxy `nethvoice-proxy4`
(`1.7.3-testing.6`), Asterisk `22.10.0`. User authorization covered repair,
deployment and bounded real GPT-Live tests on this instance. Active source
revisions remain `f94e43625ef94eb2ed129f958cb4279f8de05958` (NethVoice) and
`29220e83f3ae9a32db0c5c24583ad3739a81df90` (Satellite), with uncommitted changes.
Reference checkouts were inspected read-only at
`2f41116fd2ed890e15439a912977ae1bb7189c5b` and
`08cabfa08c71401dde933f18b21eb01499524f6b` respectively.

The initial calls timed out without a Live webhook. After the operator enabled
`live.transport.incoming`, signed events correlated successfully, but Live
acceptance returned HTTP 400 requiring SRTP. Inspection of the installed proxy
showed that the agent's `isTrunk: 1` header classified its destination as RTP-only.
Removing that header from the native agent provider-leg hook lets the existing
proxy offer SRTP to OpenAI. The internal proxy-facing RTP configuration is
unchanged; no proxy configuration or unrelated trunk/route was edited. Native
correlation headers remain intact. An explicit provider-context `h` extension
also prevents the broad provider pattern from redialing during hangup.

The agent page now labels its primary choice **Conversation voice model** and
shows a separate **GPT-Live companion model** dropdown only for Live. Help text
explains the companion's reasoning/tool role and displays the selected voice
model's available voice count, in EN/IT. An authenticated browser inspection of
the actual deployed page verified four Realtime choices plus Live, no companion
models in the primary list, 31 Live voices, 10 Realtime voices, two companion
choices and a hidden companion control for Realtime. Browser changes were kept
in an isolated unsaved draft. The complete 12-test browser suite, UI type/lint/
format/unit checks and production build passed.

Runtime diagnostics expose only bounded protocol/status values and allowlisted
HTTP error categories/schema fields. Raw provider errors, prompts and SIP headers
are not logged. SRTP rejection receives the safe `srtp_required` category.
Regression tests failed before the native fixes; the complete foundation harness
then passed 101 Python cases plus PHP/MariaDB/native/API/restore/reset/privilege
checks. The provider-error suite subsequently passed 18 cases, including four
additional malformed, unknown-field and oversized-body privacy cases. Existing
PHP transcription regressions passed 9/9. No schema migration was needed for
this repair, and immutable publications were not changed.

Deployment used module-owned image overrides and independent zero-call/channel
gates. The final FreePBX image is Docker
`41d33b3eeb7a7918599abaccd8ad05c1114438916c8cd779ec23827016f0d4e8`, deployed as
Podman `d062239b6e2a0bf0e6d35fa9d0d7ea004f561cc931f4f12586b64c8f7ee30cd7`.
The final canonical runner is Docker
`a2d72cef8f88ef59608cc5fab5c9eda3d643d8924d7266182a961e68cd2ff02a`; its narrow
source-verified staging overlay is Podman
`02f984ec67a95b2bef20134724295e3956f67a473073cef0693262ea6fef6a36`.
All 24 runtime Python/JSON files and 62 PHP/contract/UI files match local tested
source/build hashes. The shared transcription image/container was preserved.
Dive analysis completed; Trivy found zero secrets and no additional vulnerability
signatures relative to the same-database baselines. The new CycloneDX SBOMs
contain 1,185 FreePBX and 119 runner components. Previously documented inherited
CVEs remain unresolved; this repair does not constitute a security clearance.

Two real provider-backed SIP tests then connected successfully through the
Receptionist's native destination and stayed connected for their bounded test
windows. Both runs recorded `provider_connected`, `media_connected` and a clean
`completed` outcome without provider errors. The second connected in about
2.5 seconds and measured 1,719 received and 65 transmitted RTP packets while
playing a synthetic test sound. Each test was limited to 45 seconds, dialed no
external telephone number and released its own channels. An initial packet
probe used the wrong channel function; the reported packet counts come from the
corrected PJSIP `CHANNEL(rtcp,rxcount|txcount,audio)` probe. The diagnostic harness
created no audio recording. The operator's existing local transcript capture
setting was enabled and preserved; the runtime retained encrypted test transcripts
under its normal retention policy. Their contents were not read or exported.
Human speech quality and a live extension transfer were
not evaluated; remaining v0.1 release gates are not waived by these tests.

Final checks confirmed healthy FreePBX, runner, transcription, CTI and Tancredi
containers with zero restart counts; runner UID 65532, authenticated loopback
readiness, ARI connectivity, healthy monitoring, valid HTTPS UI/assets and webhook
prefix isolation. Calls and channels returned to zero. Agent drafts, publications,
settings and audit rows matched the protected pre-deployment dump byte for byte.
The current enabled Receptionist publication was preserved. No NS8 configuration
API mutation, development reset, commit or push was performed in this repair.
Module-owned service operations and sanitized receipts are retained under ignored
`local_testing/artifacts/agent-models-v5/model-companion-fix/`.

Rollback remains available in protected server directories:
`state/model-companion-20261015T125647Z` (original FreePBX override),
`state/live-srtp-20261015T131400Z` (pre-SRTP-fix image and agent dump), and
`state/live-diagnostic-20261015T123548Z` (original runner override), beneath
`/home/nethvoice57/.config/`. To roll back, independently verify zero calls and
channels, restore only the appropriate saved override, reload the module user's
systemd configuration, pause the runner before restarting FreePBX, then start it
and verify native dialplan/readiness. Restoring the old provider hook also restores
the known Live SRTP failure. No database restore is needed; do not overwrite later
operator edits with a historical dump.

One early diagnostic client traceback exposed a provider session identifier;
it exposed no credentials or audio. Subsequent diagnostic helpers suppress raw
client exceptions and emit only sanitized fixed fields. A private copy of the
installed proxy configuration was removed after analysis. No such data was added
to git, fixtures, documentation or screenshots.

### Browser-call verification and Live greeting startup — 2026-10-15

The operator subsequently reported silence, then clarified that audio works but
answering is slow in the NethCTI browser phone. Read-only verification on the same
`nethvoice57` target confirmed the installed native destination already executes
`Answer()` before `Stasis()`. The reported call connected to OpenAI and the ARI
bridge in roughly two seconds; its first retained assistant transcript fragment
arrived around twelve seconds. Ten assistant fragments were present, with no
reported setup/provider failure. Transcript arrival is not exact audio playback
timing and does not by itself prove what a caller heard.

During the operator-authorized follow-up call, ten passive samples showed both
PJSIP legs active and not held. At the last sample, the provider leg had received
851 packets and the caller leg had transmitted 850; caller receive and provider
transmit counts also increased throughout. This establishes transport through
Asterisk without certifying speech content or browser playback. No capture,
recording, Janus/proxy change or debug toggle was performed. Existing encrypted
transcript records were processed in server memory only to emit bounded role,
fragment-count and relative-timing metadata; text and identifiers were not
printed or exported. A later attempt to inspect the relay found that the call
had ended, so no relay-to-browser diagnosis is claimed.

The Live adapter now supplies the configured opening greeting and language as
startup `session.input` developer context, following the official
[Live greeting guidance](https://developers.openai.com/api/docs/guides/live-conversations).
The greeting remains pending until the runtime confirms its media bridge. The
subsequent instruction explicitly says caller media is connected and requests
immediate speech. Opening greetings and brief clarification are handled directly
by the voice model; substantive tasks and authorized tools retain the separate
Responses companion. The published prompt, greeting, model, credentials and
permission settings are not rewritten. No dialplan or schema change was needed.

The startup/readiness regression failed before implementation and passed after.
The affected provider/Live/runtime suite passed 52 cases. Direct foundation
pytest passed 103, with three disposable-MariaDB tests skipped because that
invocation did not select a disposable database; the previous complete database
harness results remain separate. The canonical runner image is Docker
`135d6e78ac9ee0ef67108e38898b37dfcef8364b30fd353a22e402a7e19f8156`;
the source-verified staging overlay is Podman
`42ce6e78752a3f267f7a6d2f948fff701e658e63c47c71f1479e92c01a7889b1`.
Dive and Trivy completed, with zero secret findings and no additional
vulnerability signatures relative to the prior runner on the same database.
A new 119-component CycloneDX SBOM is in the ignored incident artifacts;
inherited CVEs remain unresolved.

Two bounded synthetic SIP calls provided continuous silence from the caller to
keep the Live input clock running. Neither dialed an external telephone number.
With the same pinned agent publication, the before test reached provider media
at about 3.1 seconds and its first assistant transcript at 4.9566 seconds; the
after test reached media at about 2.4 seconds and its first assistant transcript
at 4.1256 seconds. Both completed cleanly with packets flowing both ways. These
single samples do not establish a statistically reliable latency improvement;
they do verify the new startup contract against the real provider. Browser speech
onset and consistently fast greetings remain to be confirmed by the operator.
The earlier twelve-second phone result used a different agent publication and
must not be presented as a controlled before/after comparison.

Deployment restarted only the runner after two independent zero-call/channel
gates. FreePBX and the shared transcription container were unchanged. The final
readiness, ARI, monitoring, authentication, loopback binding, HTTPS assets and
public-path isolation checks passed, and calls/channels returned to zero. The
historical 13:14 configuration dump no longer matches: audit metadata shows later
operator draft saves and a publication before this deployment. Those edits were
preserved; this repair performed no agent-configuration/database write. Source
revisions remain the uncommitted work on the active branches recorded above.

Protected runner rollback is available at
`/home/nethvoice57/.config/state/live-greeting-20261015T134639Z/voice-agent-rollback.conf`.
After independently confirming zero calls/channels, restore that override to
`systemd/user/voice-agent.service.d/90-voice-models.conf`, reload the module user's
systemd configuration and restart only `voice-agent.service`; verify readiness.
Do not restore historical agent data over the operator's newer publication.
Sanitized receipts, benchmark results, scans and scripts are under ignored
`local_testing/artifacts/agent-models-v5/silent-call/`. No commit or push occurred.

### Browser silence follow-up — 2026-10-15

The operator's later 44-second browser call was silent. It pinned publication 3,
connected the provider and media bridge about two seconds after admission, and
ended without a recorded provider/runtime error. Existing transcript metadata
showed nonempty assistant fragments from approximately second four and caller
fragments from second seven. This proves neither return-audio delivery nor
browser playback; the earlier synthetic packet checks do not close this defect.
The existing dialplan answers before Stasis, so an absent `Answer()` is excluded.

No retained per-call RTPengine counters were found in the bounded incident log
window. A passive observer was prepared to read the next Receptionist call's
PJSIP packet counters, hold state and negotiated formats, immediately querying
only the correlated SIP sessions on the installed relay. It emits opaque leg
labels and numeric metadata, with no audio capture, raw SIP IDs or addresses.
Sanitized evidence is under ignored
`local_testing/artifacts/agent-models-v5/no-audio-followup/`. The cause remains
unconfirmed; this inspection changed no deployed service or agent configuration.
The bounded five-minute watch expired without observing another test call.

The operator subsequently authorized a coordinated browser-phone retest and
confirmed **audio worked**. The observed call at 16:43:46 UTC used contract 5,
publication 3, `gpt-live-1` and companion `gpt-6-luna`. Provider and media bridge
connected at approximately three seconds. Before handoff, both PJSIP legs had
increasing send/receive counters, neither was held, and both negotiated PCMU.
The provider's exact correlated relay session showed RTP/AVP on the PBX side,
RTP/SAVP on the external side and zero reported relay stream errors. No caller
relay session was found; that lookup alone cannot assess browser playback. Six
incoming lost packets were reported on the caller leg in a later sample; no
return-direction loss was reported in those samples. The operator's listening
confirmation is the evidence for audible playback.

At approximately fifteen seconds ARI confirmed a transfer handoff; the agent run
ended `transferred` without a runtime error. Target answer/conversation was not
verified. The passive observer continued until the correlated channels ended;
final independent active-call/channel counts were zero. FreePBX, the runner,
shared transcription and Janus were running with zero restart counters. The
previously recorded FreePBX/runner/transcription image IDs were unchanged.
The authorized observation used counters and format metadata only: no audio
capture, SIP debug, configuration change, provider API command or service restart
was performed. The existing protected rollback remains available and was unused.
Sanitized receipts use the `coordinated-*` and `live-coordinated` filenames in the
same ignored artifact directory. This successful retest did not reproduce or
establish the cause of the earlier silent call; intermittent audio remains an
unresolved observation, not a proven repair.
