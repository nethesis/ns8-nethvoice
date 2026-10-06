# Workflow API contract — schema 1

Administrator routes pass through the existing authenticated Wizard REST gateway
at `/freepbx/rest/agents/application/workflows`. Mutation requests use the existing
CSRF token. The corresponding private Satellite prefix is
`/api/agent/v1/application/workflows`, with the module bearer token and a safe
`X-Agents-Actor`. All replies disable caching. Browser code never selects a backend
host or supplies credentials inside graph JSON.

## Administrator routes

| Method | Suffix | Body/result |
|---|---|---|
| GET | `/inventory` | Built-in/custom agents, definitions, versions, data sources, provider binding names, block manifests and safe published operation schemas |
| GET | `/catalog` | Block manifests, copyable templates and Freshdesk/Kapa connector presets |
| PUT | `/definitions/{agent\|subflow}/{id}` | `{definition, expected_revision}` → `{revision}`; 0 creates a draft |
| GET | `/definitions/{kind}/{id}/versions/{version}` | `{definition}` for an immutable publication |
| POST | `/validate` | `{definition}` → `{valid, tools}`; structural and live reference checks |
| POST | `/definitions/{kind}/{id}/publish` | `{expected_revision}` → `{version, revision, execution_hash}` plus PBX sync status for an agent |
| POST | `/definitions/{kind}/{id}/activate` | `{version, enabled, expected_revision}` → activation plus PBX sync status for a voice agent |
| POST | `/test` | `{definition, fixtures, input, caller, tables?, destinations?}` → labelled mock result and bounded trace; never performs external effects |
| GET | `/runs/{id}` | Pinned graph, status, safe step metadata, subflow paths and effect states; result content excluded |
| POST | `/runs/{id}/cancel` | Requests cancellation; current voice run returns through its PBX fallback |
| PUT | `/data/{id}` | `{settings, expected_revision}` → `{revision}` |
| POST | `/data/preview` | `{settings, content?}` → safe rows/count/errors. `content` is base64 for files; private Sheets uses its viewer credential, `google_csv` reads the selected published Google CSV |
| POST | `/data/{id}/publish` | `{expected_revision, content}` → queued ingestion job |
| POST | `/data/{id}/refresh` | `{expected_revision}` → queued Sheets refresh job |
| GET | `/jobs/{id}` | Queued/processing/ready/failed/interrupted, safe result or error code; uploaded content excluded |
| DELETE | `/data/{id}/versions/{version}` | Revokes and deletes encrypted source content; references become unavailable |

IDs use `[a-z][a-z0-9_-]{0,47}`; `internal`, `external` and `support-request` are
reserved agent IDs. Draft writes, publication and activation use optimistic
revision checks. Definition/graph size is 128 KiB; uploads are at most 10 MiB,
with a 14 MiB JSON request ceiling for base64 transfer.

Saving a draft does not change the active workflow or reload the PBX.
Publication selects the new active version and keeps the current enabled state.
Agent publication reconciles its PBX binding immediately. When a binding changes,
the gateway marks the configuration for reload and starts `retrieveHelper.sh`.
Activation also applies the binding and starts the reload. Failed binding sync
returns `pbx_sync.pending`; the existing one-minute timer retries reconciliation.

## Canonical definitions and bindings

Required top-level fields are `schema_version`, `agent_id`, `name`, `description`,
`entrypoints`, `nodes`, `edges`, `input_schema`, `output_schema`, `limits`, `layout`,
`provider_binding_ref`, `fallback`, `permissions` and `tool_grants`. Optional
`voice_settings` overrides model, voice/language; `text_provider` explicitly names
an API model and encrypted credential ID. Resource/operation references live in
the typed node configurations rather than a second top-level resource list.

Each node has `id`, `type`, `version`, `name`, `config` and `inputs`. Each edge is
`{source, outcome, target}`. Input bindings are a literal `{value: ...}` or a
restricted selection `{node: "source_id", path: "row.amount"}`. An optional branch
binding adds `optional: true` and `default`. Merge alternatives selects exactly
one non-null object supplied by such branch bindings; other inputs default to
null. There are no expressions or scripts.
Publication checks connector/subflow schemas as well as the block manifests.

Connector references are `{connector_id, version, operation_id}` and their
canonical grant ID is `connector.<id>.<operation>.v<version>`. Resource/subflow
references are `{resource_id, version}`. All versions are immutable. Selecting a
published operation in the editor does not enable its grant automatically.

Initial limits: 100 nodes, 200 edges, 200 executions of steps across nested
subflows/agent handoffs, subflow and agent-handoff depth 4, 64 KiB active context,
and at most five model responses per conversation block. Overall definition
execution timeout is 10–3600 seconds; a voice call also inherits its provider
profile deadline. Per-operation timeouts remain bounded by the shared transport.
Each response may request at most ten functions; writes are excluded from
conversation tools and require deterministic effect/confirmation nodes.
Subflow execution uses the remaining parent deadline. Its nested engine also
applies the child graph deadline; the default ten-second operation timeout does
not wrap the entire reusable graph. Parent permissions, path and deadline are
restored when the child completes, fails or is cancelled.

A mock fixture keyed by node ID has `{outcome, output}`; conversation fixtures
use the conversation's declared output fields. Mock tables contain synthetic
normalized rows, creation time and country-code metadata. Fixtures are validated
against known block outputs/outcomes. Results include `test_mode: "mock"` and
cannot authorize a real business write.

## Machine API compatibility

The existing `/agents-api/v1/runs`, `/runs/{id}`, `/runs/{id}/result` and
`/runs/{id}/cancel` routes accept custom published API workflows as well as the
existing `support-request` preset. A custom admission body is:

```json
{"agent_id":"api-echo","version":1,"input":{"message":"hello"}}
```

Use the existing bearer client and `Idempotency-Key`. The client definition's
`presets` list includes permitted custom API agent IDs. Its operation references,
customer IDs and `operations:write` scope also constrain execution. Voice-only
nodes cannot be published into an API graph. API text-provider configuration is
explicit and independent of a SIP provider binding.

If a graph can write, admission may include `approved_actions`, a bounded list
of `{operation: <reference>, arguments: <exact object>}`. The workflow's confirmation
node and dispatcher check the same digest, expiry and scoped operation. Changing
an argument invalidates the approval. Voice confirmation instead requires the
caller's DTMF after readback. Permission to publish a graph does not authorize a
machine client to execute it.

Reusing the same principal/idempotency key and identical request returns the same
run. A changed request or version conflicts. Only the owning client can read,
retrieve or cancel its run. Terminal results are encrypted and expire after 24
hours. Disabling a definition/client or revoking a referenced resource/connection
prevents further use. In-flight runs retain their pinned graph version.

## Failure and ownership

Safe errors include `revision_conflict`, `graph_cycle`, `unknown_block_version`,
`unavailable_branch_output`, `unknown_output_field`, `input_type_mismatch`,
`operation_ungranted`, `subflow_disabled`, `data_unavailable`,
`write_confirmation_required`, `urgency_rule_denied`, `caller_scope_mismatch`,
`conversation_turn_budget` and `workflow_store_unavailable`. Structural errors
can include `node_id` for selection in the inspector. No raw SQL/provider errors,
credential values, caller payment rows or private ticket text enter error metadata.

Control records are authoritative independently of monitoring delivery. A run's
safe steps include node ID/type, sequence, subflow path, status/outcome, duration
and error. Nested paths prevent a reused node ID from coloring the wrong parent
node. Provider/private consultation content is not stored as ordinary metadata.

Restart/restore interrupts unfinished owners and marks dispatched effects
unknown. Unknown writes and uncertain call releases are never automatically
replayed. The existing reconciliation surface remains available for effects.
