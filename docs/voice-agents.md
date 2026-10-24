# Voice agents alpha

This implementation supports fresh installations of publication contract **v8** only.
Install the matching FreePBX and Satellite images together. An installation containing
an earlier development schema is rejected with `unsupported_development_database`
before Agents schema or seed changes. There is no automatic conversion or erase.
Take a protected backup and use an explicitly reviewed test-instance reset, or install
on a new instance. Never use the alpha installer to upgrade a development database.

## Architecture and ownership

The standalone Vue application at `/freepbx/agents-ui/` uses the existing Wizard
administrator identity. PHP REST at `/freepbx/rest/agents` enforces authorization,
same-origin checks, identity-bound CSRF and optimistic revisions. `rest/lib/agents/`
owns configuration and publication in `asterisk`; FreePBX's Satellite module owns
native trunks, destinations, fallback wrappers and generated dialplan. It loads the
library directly without calling its own HTTP API.

Satellite's Python `voice_agent` package reads published snapshots using a restricted
configuration account. A separate account writes runs, events and encrypted debug
transcripts to `asteriskcdrdb`. Native CDR/CEL and existing transcription retain their
owners. Neither a configuration-push API nor a second agent configuration store exists.
Provider adapters remain separate; all call control uses owned Asterisk ARI channels.

## Configuration and activation

Fresh installation seeds one disabled, unpublished **Receptionist**. Administrators
can also create independent Basic Voice agents. Configure an OpenAI or Grok trunk,
then choose the conversation model, voice, language, greeting, instructions and
maximum duration on each agent page. Trunks carry credential references and native
provider configuration, never conversation-model settings. Credentials are encrypted
and write-only. Blank edits preserve an existing secret; an explicitly configured
key takes precedence over the module integration's environment credential.

Save a draft, then **Publish** to activate the agent. No separate activation endpoint
or switch exists. Only a published, synchronized agent with a ready native trunk is
routable. VisualPlan selects its stable native destination and controls the fallback
output; an unconnected fallback uses Hangup. New agent opens the editor in a new tab.
VisualPlan fallback changes preserve unrelated unpublished edits and validate cycles.
Calls pin their snapshot and tool versions; edits never alter an active call.

The current tools are `pbx.find_destinations` v1, `pbx.transfer` v2,
`pbx.find_recent_callers` v1 and `telephony.hangup` v1. The catalog's filename remains
`tools-v5.json`; its version numbers and wire names have not been renumbered.
Each agent owns its own enabled bindings, configuration and grants.

| Setting | Fresh default |
| --- | --- |
| Directory discovery and transfer | Enabled |
| Direct extensions | Disabled, empty explicit allowlist |
| Queues | Enabled, empty denylist |
| IVRs | Disabled; the current editor does not expose IVR activation |
| Recent callbacks | Enabled, seven-day window, separate extension denylist |
| Agent-controlled hangup | Disabled; optional bounded goodbye playback |
| Debug transcripts | Disabled; encrypted text, 1–24 hour retention when enabled |

Directory names and descriptions are untrusted data. Deleted targets fail closed;
renames preserve stable permissions. Native IVR branches describe native behavior
and never grant a direct transfer. An enabled callback can reach an extension that
is denied for direct transfer only with short-lived evidence bound to this caller,
agent, publication and live session. Lookup uses the PBX's inbound caller identity,
not a number supplied by a model or caller. Caller ID is spoofable and is not strong
authentication. CDR queries are bounded and use narrow read-only views.

Transfer success requires both Stasis release and the native acknowledgement for the
owned channel, destination and one-use token. A tool acknowledgement alone is not
success. Optional call ending rechecks ownership and has a hard playback deadline;
a failed or uncertain hangup never claims success or falls back into another route.

## Transport and monitoring

OpenAI Realtime and Grok use SIP plus their separate provider sidebands. GPT-Live
uses a primary provider WebSocket and Asterisk's private `chan_websocket` media;
there is no transport selector or automatic SIP failover. The runtime admits a
validated snapshot before opening any paid provider session. Signed SIP webhooks
are accepted only at `/satellite-webhooks/openai` and `/satellite-webhooks/grok`,
with original-byte verification, replay bounds and pending-call correlation.
The private readiness endpoint requires authentication and binds to loopback.

Activity provides paginated history, parent-linked traces, approximate latency
percentiles, usage and safe outcome/error codes. Monitoring format 2 is the only
supported format. Missing or interrupted traces remain partial, including after
restart; confirmed transfers may still have incomplete delivery. Bounded durable
outboxes retry idempotently. Audio is never persisted by the Live bridge. Automated
first-audio measurements do not prove intelligible speech or human playback.

Metadata retention defaults to 90 days. `VOICE_AGENT_MONITORING_RETENTION_DAYS`
accepts 1–3650 days, is passed through module configuration and requires the normal
service restart. The hourly maintenance timer purges bounded batches. Native CDR
retention is separate. Debug transcripts use independent encrypted storage and
per-agent opt-in retention; they do not enable general call recording.

## Installation, backup and recovery

`Schema::install` serializes setup with a MariaDB advisory lock. It writes a fixed
`alpha-v8` installation identity before repeatable DDL, then installs final
`schema/configuration.sql` and `schema/execution.sql`. This identity is not a
migration history. Current tool definitions and the Receptionist draft are inserted
from canonical PHP/JSON defaults in a transaction. Retrying an interrupted or
completed setup preserves edited drafts, secrets, activation and immutable versions.
Publication and catalog triggers prevent updates and deletes.

NS8 provisions private runtime credentials from `passwords.env`, regenerates the
runner environment and grants two separate loopback DB identities their narrow
views and columns. Backup/restore must retain MariaDB configuration/execution data,
secretbox keys, provider secrets, environment and native PBX state together. Clone
credentials are independent. Restore reruns setup without reseeding operator edits.

Before a staging reset or image replacement, record exact source/image provenance,
protect database/secrets/routes/override backups, independently verify zero calls
and channels, and stop the runner. Remove only reviewed Agents-owned state and
native objects through their owning APIs. Never truncate native CDR or transcription.
Rollback requires the saved images **and matching pre-reset data**; an old runtime
cannot read this fresh baseline. Rehearse restoration on disposable storage before
claiming rollback has passed. Deployment receipts and sensitive recovery material
belong outside published documentation.

## Verification and limits

See [testing](voice-agents-testing.md), [v8 contract](voice-agents-contract-v8.md)
and [validation record](voice-agents-validation.md). These checks do not replace
live acceptance. Duplication, caller admission policies, richer graph workflows and
custom connectors remain roadmap work; this cleanup adds no product features.
