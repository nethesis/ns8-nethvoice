# Phase 3 monitoring contract

Source implementation: 4 October 2026. Schema version **1**. Validation and live
acceptance are pending; this document describes the implemented contract.

## Ownership and access

- NethVoice Wizard owns the `/agents`, `/agents/settings` and
  `/agents/runs/:runId` views. It reuses the existing administrator login.
- FreePBX owns the policy in `satellite_agent_monitoring_policy`, changed only
  through `AgentMonitoringRepository`. Saves increment the existing configuration
  revision; the snapshot includes a `monitoring` object.
- Satellite owns history in PostgreSQL schema `agent_monitoring`. Its monitoring
  router is separate from call control and requires the existing private bearer.
- Browser calls use `/freepbx/rest/agents`; the server supplies the private bearer.
  Every route requires a verified NethVoice administrator. Metadata, transcripts
  and policy have separate scope checks; all three scopes initially belong to
  administrators. Browser mutations also require a session-bound CSRF token.
- Responses use `Cache-Control: no-store`. No transcript, private bearer or
  provider credential is written to browser storage. Transcript text is escaped
  by Angular text binding and is cleared on logout/navigation.

## Browser gateway

All paths below are relative to `/freepbx/rest/agents`.

| Method/path | Request | Response |
|---|---|---|
| `GET /access` | Existing User/Secretkey authentication | `{csrf, scopes}`; CSRF is held only in client memory |
| `GET /overview` | `hours`: integer 1–8760, default 24 | Time-scoped outcomes/tool errors, current active runs, readiness, writer health, recorder history, `history_complete`, native `configuration_sync` |
| `GET /health` | None | Writer availability/error code, queued records/bytes, drops, last write, epoch, content-key availability |
| `GET /agents` | None | Safe built-in inventory and applied policy; no prompts or credentials |
| `GET /policy` | None | `{policy, sync}` from the native repository |
| `PUT /policy` | JSON described below; `X-Agents-CSRF` | `{policy, revision, sync, applied}`; saved policy remains authoritative if synchronization is pending |
| `GET /runs` | Filters described below | `{items, next_cursor}` |
| `GET /runs/{run_id}` | Instance-scoped ID | One retained run, or 404 |
| `GET /runs/{run_id}/events` | `limit`, `cursor` | Ordered `{items, next_cursor}` |
| `GET /runs/{run_id}/transcript` | Transcript scope | `{state, items, generated_audio_warning}`; separately decrypted text |
| `DELETE /runs/{run_id}/transcript` | Transcript scope; `X-Agents-CSRF` | `{state: "deleted"}`; persistent tombstone and actor/time audit record |

`PUT /policy` accepts exactly these fields:

```json
{
  "metadata_retention_days": 30,
  "transcript_retention_days": 7,
  "transcripts": {"internal": false, "external": false},
  "expected_revision": 12
}
```

Days must be integers from 1 to 365. Transcript retention cannot exceed metadata
retention. `expected_revision` is the native desired configuration revision;
concurrent changes return 409. Per-agent `capture_versions` are server-owned
positive integers, incremented whenever an opt-in flag changes. Old queued text
cannot pass a newer capture generation. Enabling applies to new runs; disabling
stops local capture for current runs once configuration is applied. Provider
transcription-disable requests are best effort and separately bounded.

List filters: `agent` (`internal|external`), `provider` (`openai|grok`), `outcome`,
`correlation` (exact run, session or CDR reference), `after`/`before` (UTC Unix
seconds), `tool_error` (boolean), `limit` (1–100, default 50), and opaque `cursor`
(maximum 512 characters). Time ranges must be ordered. Runs sort by
`(started DESC, run_id DESC)`; events by `(sequence, event_id)`. The UI displays
local dates and converts date filters to UTC Unix seconds.

The gateway only forwards fixed paths and bounded, scalar allowlisted query
fields. It does not accept a target URL or browser-provided Satellite headers.
Upstream responses are capped at 2 MiB. Errors have safe codes:
`invalid_request`, `invalid_query`, `forbidden`, `run_not_found`,
`configuration_conflict`, `monitoring_unavailable` (HTTP 400/422/403/404/409/503).
The existing authentication middleware rejects invalid administrator credentials
before a handler executes. A run removed by retention is indistinguishable from
an unknown run.

## Private runtime API

Read paths and transcript deletion match the gateway under
`/api/agent/v1/monitoring`. All require `Authorization: Bearer <API_TOKEN>`.
Transcript deletion additionally requires `X-Monitoring-Actor`, populated from
the verified administrator by the gateway. Policy is applied through the existing
revisioned configuration API, not a second runtime policy writer.

`POST /api/agent/v1/monitoring/retention` triggers expiry cleanup. The NS8 timer
executes the container-local `python -m agent.monitoring.retention` client;
credentials come from its environment and do not enter command arguments.
There are no public run creation, cancellation, replay or transfer operations.

## Records and outcome semantics

A run stores `execution_kind: voice`, run/session IDs, built-in agent, provider,
opaque voice/CDR and destination references, runtime epoch, configuration revision
and hash, start/end, status/reason, history completeness, last sequence, capture
generation, transcript state, optional measured usage and expiry. It does not
store the configuration payload, caller phone number, tool arguments or results.
Voice references are nullable so later execution types can extend this schema.

Metadata events retain the EventSink's redacted allowlist, stable event ID,
schema version, sequence and UTC timestamp. Tool starts, completions, rejections,
errors, invocation IDs, duration and safe codes are read from this timeline;
there is no independent invocation writer. Observed tool success does not prove
answer provenance or conversation success.

Outcomes: `active`, `completed`, `handed_off`, `fallback`, `failed`, `interrupted`,
`unknown`. Completed means ordinary runtime termination, not business success.
Handoff means the Agent released ownership, not that the human conversation
succeeded. Restart reconciles only previously active runs from older epochs as
interrupted with unknown end time; retained terminal outcomes remain terminal. An active stored row
without current runtime ownership is presented and filtered as unknown.

Overview continues to expose current ownership/readiness when history is down;
historical counts are then unavailable, not zero. Query failure returns 503.
History reads wait until the native monitoring policy has been received and
persisted, including after restore. A pending shorter retention cannot expose
rows under the previous database policy. Counters state their selected period. Sequence gaps, dropped observations and
interrupted traces prevent a claim of complete history. Provider observation
loss is also visible as a run gap. Epoch health retains the last gap and loss
count; a recovered recorder emits a bounded service-level gap observation.

## Optional conversation content

Capture defaults to **off** for both existing and new agents. OpenAI Realtime SIP
sideband capture uses optional `session.update` input transcription and final
caller/assistant transcript events. The default caller transcription model is
`gpt-4o-mini-transcribe`; it needs live provider validation before release.
No separate audio-upload/MQTT transcription path is introduced. Grok reports
metadata-only capability; opt-in on an unsupported binding does not create text.

Caller ordering is established at item creation/commit, before asynchronous ASR
completion. Assistant text describes generated speech; interruption labels do
not prove which words a caller actually heard. Conversation states:
`disabled`, `unsupported`, `unavailable`, `pending`, `available`, `partial`,
`truncated`, `capture_stopped`, `expired`, `deleted`.

Finalized text uses AES-256-GCM with a random nonce and run/item/content-index
associated data. Only ciphertext enters the recorder queue and PostgreSQL.
`SATELLITE_MONITORING_CONTENT_KEY` is a base64 32-byte secret generated in
`passwords.env`, preserved on upgrade and backup/restore. A missing/wrong key
makes text unavailable or partial; it does not affect calls. This implementation
reuses the existing Satellite PostgreSQL role and credentials in a separate
schema; splitting the legacy database credential into roles is deferred.

Deletion locks the run, removes its segments, records actor/time, and preserves
a tombstone until metadata expiry. In-flight text cannot recreate deleted text.
Local/provider capture is stopped for a currently owned deleted run. Disabling
an agent's opt-in preserves already retained text until its expiry or deletion.
Lengthening retention never revives rows/segments already expired, even before
the scheduled purge physically removes them. Restored backups can contain data
from the backup date; startup reapplies policy and expires it before history is
available. Previously deleted data is absent from subsequent backups; older
backup copies retain their own lifecycle.

## Operational limits and lifecycle

- Recorder queue: 4096 records and 4 MiB serialized payload; maximum 64 KiB record (8 KiB for metadata events).
  Database writes happen in worker threads, batches of 25, with SQL timeouts and
  a batch deadline. Backlog drains without waiting for the next one-second heartbeat.
- Provider observations have a separate 64-record queue (final text capped at
  16 KiB per segment), so transcripts cannot fill the tool/control event queue.
- Per run: 256 KiB text and 1000 segments; truncation is explicit. Metadata fields
  are individually capped/redacted. UI event accumulation is limited to 2000;
  server event pagination remains available.
- History: 100,000 runs, 1,000,000 events and a 2 GiB relation-size admission guard.
  These are initial implementation guards, not a measured capacity promise or
  a filesystem quota. Full storage drops new observations while existing history
  remains readable and terminal updates are attempted. Relation files may retain
  allocated space after deletions; PostgreSQL maintenance remains operational work.
- UI polls current ownership every five seconds, pauses when hidden, and never
  refreshes private conversation text automatically.
- PostgreSQL starts independently of legacy call/voicemail transcription. Its
  startup failure does not prevent Satellite call handling from starting.
- Expiry is enforced on queries immediately; a recorder cleanup runs each minute
  and NS8 schedules an hourly retention job. Cleanup is bounded for old run rows.
- Shutdown flush has a five-second deadline; runtime stop has a container grace
  period. This is bounded best effort recording, not a zero-loss audit guarantee.
- NS8 backup includes the PostgreSQL dump and secret file. Restore uses the same
  pgvector PostgreSQL 18 image/data layout as the live service and stops on SQL
  errors. Clone does not import source PostgreSQL history and resets capture opt-in.

## Sources and acceptance status

Provider protocol follows the official [Realtime transcription guide](https://developers.openai.com/api/docs/guides/realtime-transcription)
and [Realtime conversations guide](https://developers.openai.com/api/docs/guides/realtime-conversations).
OpenAI capability is implemented from those contracts; live SIP/ASR acceptance
has not been executed for Phase 3. See [the implementation report](phase3-development.md)
for outstanding validation and release work.

Restore role handling follows the official [PostgreSQL 18 pg_dumpall notes](https://www.postgresql.org/docs/18/app-pg-dumpall.html): a distinct bootstrap role avoids the source-role collision, and `psql -X` ignores client startup files.
