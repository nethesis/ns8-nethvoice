# Basic Voice configuration and execution

This slice extends M0 with PHP-owned configuration, native destinations and an
independent Satellite runner. It is not a declaration that the v0.1 live-call
release gates have passed. Provider calls, media and real transfer confirmation
must be verified independently on an approved test route.

## Administrator flow

Open Agent from Wizard’s Apps menu; it opens `/freepbx/agents-ui/` in a new tab after the existing Wizard sign-in. Receptionist is the sole built-in agent and starts inactive. Each agent has its own editable draft and tool bindings. Administrators can also create Basic Voice agents. Receptionist cannot be deleted. Legacy Internal/External configurations are read-only and retain their historical publications. They can be disabled and explicitly retired after native references are removed; no configured agent is automatically deleted or merged.

Create an OpenAI or Grok provider trunk. API keys, Standard Webhooks signing
secrets and optional Grok SIP digest passwords are write-only. Blank credentials
on an edit retain the existing encrypted value. A new API key may be blank when
PHP and the runner have `OPENAI_API_KEY` or `XAI_API_KEY` (`GROK_API_KEY` is an
alias). Explicit encrypted keys take precedence. NS8 refreshes the private runner
credential file on startup and when integrations change; no keys reach the UI. Configure the provider's webhook
using the HTTPS endpoint shown by the UI; saving a trunk does not configure the
provider account. Native Core APIs own PJSIP trunk creation and removal; managed
trunk names start with `VoiceAgentTrunk_` to avoid adopting legacy records.

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
| `/synchronize` | POST | Audited native provisioning/reload retry |
| `/runs`, `/runs/{id}` | GET | Paginated activity and bounded event details |

Profile writes use `{profile: {name, draft}, expected_revision}`; trunk writes use
`{trunk: {...}, expected_revision}`. Create uses revision zero. Publish/delete use
`{expected_revision}`; enable adds `enabled`; synchronization uses `{retry: true}`.
The access response declares `v0.1-configuration`, not a release certification.

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
Neither receives DDL, DELETE, drafts or unrestricted PBX table access. The runner
gets only its private key/token/DB credentials and ARI password in a mode-0600 env
file. Credentials and monitoring outbox storage are included in backup/restore.
The additional private listener requires TCP port demand 40 in the module bundle.

`voice-agent.service` uses the canonical Satellite image as UID 65532, independently
of transcription, with `python -m voice_agent.runner`. It binds to loopback. Traefik
forwards only `/satellite-webhooks` to this listener; FastAPI exposes exactly the two
provider webhook paths and authenticated `/internal/ready` outside that prefix.
Unknown paths, docs and configuration-push routes are absent. Existing transcription
services and their API routing are independent of this listener.

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

Provider protocols were checked against the current primary guides:
[OpenAI Realtime SIP](https://developers.openai.com/api/docs/guides/voice-sip) and
[Grok SIP](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech/sip).
OpenAI uses the current SIP guide's `gpt-realtime-2.1` default.
The adapters keep their event/session contracts separate and do not implement
GPT-Live transport events.

Current UI/call repair evidence and staging limitations are recorded in
[Receptionist verification](voice-agents-receptionist-verification.md). Earlier
evidence remains in [UI and call verification](voice-agents-ui-call-verification.md).
