# Basic Voice configuration and execution

This slice extends M0 with PHP-owned configuration, native destinations and an
independent Satellite runner. It is not a declaration that the v0.1 live-call
release gates have passed. Provider calls, media and real transfer confirmation
must be verified independently on an approved test route.

## Administrator flow

Open `/freepbx/agents-ui/` after signing in through Wizard. Internal and External
are seeded as disabled built-in agents. Each has its own editable draft and tool
permissions. Administrators can also create Basic Voice agents. Built-ins cannot
be deleted; custom agents with native route references cannot be deleted.

Create an OpenAI or Grok provider trunk. API keys, Standard Webhooks signing
secrets and optional Grok SIP digest passwords are write-only. Blank credentials
on an edit retain the existing encrypted value. Configure the provider's webhook
using the HTTPS endpoint shown by the UI; saving a trunk does not configure the
provider account. Native Core APIs own PJSIP trunk creation and removal; managed
trunk names start with `VoiceAgentTrunk_` to avoid adopting legacy records.

Configure conversation language, provider voice, greeting, instructions, maximum
call duration and fallback extension. Enable either or both tools:

- `directory.find_destinations`: search only the agent's approved extensions.
- `telephony.transfer`: transfer only to an approved, currently existing extension.

Save the draft, publish it and enable the agent. Calls pin the published version;
saved draft changes have no effect until published. Optimistic revision conflicts
preserve local edits and offer an explicit reload. Native synchronization failures
remain visible with a retry action. Prompt/tool changes do not require a PBX reload;
publication of a first destination, changed fallback/binding or enablement does.
Deleting an unpublished draft does not reload Asterisk.

VisualPlan's Agent palette object selects saved agents, including Internal and
External. Only enabled, published and synchronized agents can be added. New agent
opens `/freepbx/agents-ui/#/agents/new` in a new tab; configure/edit opens the saved
agent. The canvas stores a stable native reference and supports undo. Both agent
objects and incoming connection references are validated before any PBX write.
Outgoing graph edges cannot replace the agent's configured fallback.

Activity lists paginated run metadata and bounded event details. No transcript,
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
| `/synchronize` | POST | Audited native provisioning/reload retry |
| `/runs`, `/runs/{id}` | GET | Paginated activity and bounded event details |

Profile writes use `{profile: {name, draft}, expected_revision}`; trunk writes use
`{trunk: {...}, expected_revision}`. Create uses revision zero. Publish/delete use
`{expected_revision}`; enable adds `enabled`; synchronization uses `{retry: true}`.
The access response declares `v0.1-configuration`, not a release certification.

Migrations 002–005 are additive and run once under the schema lock. They seed
disabled built-ins with INSERT IGNORE, add encrypted bindings/audits, extension
views, durable pending-call correlation and immutable version-one tool manifests.
Configuration stays in `asterisk`; execution metadata stays in `asteriskcdrdb`.
The shared v1 published contract implicitly pins tool manifest version one. PHP
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
Transfer success requires an observed matching ARI release, rather than an HTTP
acknowledgement alone. Actual provider header forwarding and ARI release behavior
remain live-test gates.

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
