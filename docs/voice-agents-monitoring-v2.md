# Voice agent traces and metrics (monitoring v2)

This additive monitoring slice is independent of published agent contracts v1–v7.
It does not change prompts, models, tool permissions, destinations or routes.
Prometheus export is deferred: collection, the transactional projection and the
read API are separate components so an exporter can reuse the measurements.

## Measurements

Each admitted call records its pinned provider, adapter and model. Local span IDs
link configuration loading, admission, origination, webhook wait, routing context,
provider acceptance/sideband/answer, media bridging, greeting trigger, provider
responses, tools, native transfer, fallback and cleanup. Parent IDs associate tools
and their transfer operations. Timings use a monotonic clock; UTC timestamps are
for correlation and history filters. Adapter observations carry their receipt time,
so queue processing delay is not attributed to provider response latency.

The greeting phase measures the application's trigger, not spoken greeting length.
First output is only recorded when an adapter reports an output-buffer event.
GPT-Live SIP sideband does not provide equivalent evidence, so that measurement can
be unavailable. Neither output nor media connection proves that a caller heard audio.

Only fixed error categories, numeric HTTP/handshake status, approved tool IDs,
typed native destination IDs and result counts are retained. Provider error text,
request headers, prompts, tool arguments/results, caller numbers, candidate tokens
and raw provider identifiers are excluded from the new observations. Optional
transcripts retain their existing separate encrypted opt-in policy.

Usage keeps distinct scopes: per-response input/output/total tokens; cumulative
Live session seconds; and delegated backend tokens. Duplicate response usage and
repeated cumulative updates cannot add usage twice. Missing fields remain missing;
zero is not substituted for an unavailable Live measurement. Final Live usage is
read after bounded session close. Usage completeness covers observed provider
accounting, not invoice reconciliation or actual charges.

## Storage and completeness

Satellite writes events and hourly histogram projections in the same MariaDB
transaction. The unique event ID gates projection updates: retries do not inflate
counts. Histogram bounds in milliseconds are 50, 100, 250, 500, 1000, 2500, 5000,
10000, 20000, 30000, 60000, 120000, 300000, 600000, 1800000, 3600000 and 86400000.
p50/p95 return the first bucket containing the requested rank, with a sample count;
they are approximate upper bounds. Inclusive phases can overlap and must not be summed to estimate call duration. Means use measured durations, not bucket bounds.

Run outcomes, detailed trace completeness and monitoring health are independent.
A confirmed handoff remains `transferred` even if observations were lost. Legacy
runs retain their lifecycle events without invented spans, provider metadata or
usage. Overdue running rows are marked incomplete in the read model; PHP does not
pretend to recover or terminate their telephony channels.

The outbox reserves 256 of 4096 pending slots for final outcomes, usage and gap
markers, with a 16 MiB serialized-payload budget and a 4096-byte record limit. File fsync and database
writes run outside the audio loop. The spool writer remains independent of database
retry, so a database outage does not prevent queued observations reaching disk.
A crash before spooling can lose observations; restart recovery marks unfinished
runs partial. Each call has at most 256 span-detail observations in addition to logical tool/lifecycle audit records. Truncation emits a
gap marker; existing logical tool/outcome counts and usage collection continue.

After a spool write/cleanup failure, new spooling is disabled until restart to
prevent filesystem growth. Direct DB delivery continues with degraded health;
crash durability is reduced and affected runs remain visibly partial.

Runtime health is updated every 15 seconds and becomes stale after 60 seconds.
It includes ARI connectivity, active calls, `spool_writable` availability, pending records/bytes, oldest pending
age, dropped observations, retry count and last successful event write. The existing
`monitoring-degraded` marker remains latched across restart so historical loss is
not silently cleared. Investigate delivery and affected runs before clearing this
marker during maintenance; current queue/heartbeat values distinguish ongoing backlog.

## Retention configuration

`VOICE_AGENT_MONITORING_RETENTION_DAYS` defaults to **90** and accepts integer
values **1–3650**. Invalid values use 90 and produce the fixed warning
`voice_agent_monitoring_retention_invalid`. There is no UI setting.

Set this nonsecret variable in the NS8 module environment using the supported
module environment-management mechanism. Run normal module configuration and
restart FreePBX/Satellite in a maintenance window to apply it to both the read/
maintenance side and runtime side. `configure-voice-agents` preserves explicit
values and forwards the value in the private generated Satellite environment file.
Do not edit the generated file or an immutable agent publication.

The policy applies to existing retained and new run metadata, trace events,
hourly metrics and expired outbox replay. Shortening it takes effect at the next
maintenance pass (hourly, bounded batches). Increasing it cannot recover deleted
history. The old per-row `retention_until` remains for compatibility; current
cleanup uses call start time and the configured policy. API history is bounded by
the current retention window even before physical cleanup. Transcript expiry
remains independently configured at 1–24 hours. The seven-day recent-callback lookback is independent of monitoring retention.
Native PBX CDR and configuration/
publication retention are outside this policy.

## Admin REST and UI

All routes reuse Wizard administrator authentication and same-origin protection
under `/freepbx/rest/agents`. They are read-only and never query Satellite from PHP.

- `GET /runs`: 25 rows per page, ordered by UTC start time and run ID. Filters:
  `from`, `to`, `agent_id`, `provider`, `adapter`, `outcome`, `error_code`, `tool_id`,
  `phase`, `query`, `page`. Search is server-side across agent name/ID and run ID;
  percent/underscore characters are literal data.
- `GET /runs/{id}`: compatible metadata/events/transcripts plus timing, usage,
  pinned provider information, trace status and incomplete-run indication.
- `GET /runs/{id}/trace`: 100 observations per page and an opaque `next_cursor`.
  Pass it as `cursor`; do not inspect or manufacture it.
- `GET /monitoring/summary`: shared date/agent/provider/adapter filters, outcome
  counts/trends, measurement coverage, run/setup/output latency, phase/tool latency,
  tool invocation counts, safe provider errors and latency trends.
- `GET /monitoring/health`: the current heartbeat and a stale flag. This is runtime
  health, not an historical or agent-filtered count.

Dates accept UTC RFC3339 timestamps. Effective windows are aligned to UTC hours;
older starts are clamped to retention and invalid/reversed ranges are rejected.
Summary returns the effective `from`/`to`. Trend resolution is daily up to one year,
then monthly. Statement timeouts are two seconds; query failures return errors,
not fabricated empty results. The default UI uses available retained history.

Activity adds common history filters, counts, trends, approximate percentiles,
phase/tool tables and error drill-downs. List-only search/outcome/error/tool/phase
filters do not change the summary denominator. It refreshes every 30 seconds while
visible; running run details and paginated traces refresh every five seconds.
Run details collapse span starts/ends into a parent-linked timeline. Both EN/IT and
mobile layouts retain the existing Wizard branding and transcript presentation.

## Build, rollout and rollback

Migration 014 is repeatable and additive. The monitoring writer gains rights only
to its new projection/health tables and named run-summary columns. Configuration
and native CDR grants remain unchanged. Backup/restore includes the new tables in
normal database backups. Explicit development-reset maintenance includes derived
monitoring tables; this feature does not execute a reset.

Run the foundation runner with the paired Satellite checkout, actual REST vendor
loader and a disposable MariaDB. Run Satellite tests, UI type/lint/unit/browser
checks, the compiled UI build, module regressions and transcription regressions.
Synthetic provider/ARI fixtures establish instrumentation behavior; they do not
close real audio or provider acceptance gates.

Before publishing the module image, publish the paired Satellite revision and
update `satellite/upstream.env` with its commit and verified archive SHA-256. Local
paired builds can select the new runtime through the existing `SATELLITE_IMAGE`
override. An unchanged source pin would package the previous monitoring runtime.

Before a later Makako `nethvoice70` rollout, identify current images/configuration,
prepare rollback, recheck zero calls/channels and account for shared transcription.
Apply schema/grants before starting the new runtime. Verify authenticated REST,
retention configuration, heartbeat and existing agent/dialplan fingerprints.
For rollback, drain calls and the event spool before reverting both images. Leave
additive database columns/tables installed. Old runtimes cannot replay monitoring-v2
spool entries: do not silently discard them or start an old reader against an
undrained new spool. No agent publication downgrade or route replacement is needed.
