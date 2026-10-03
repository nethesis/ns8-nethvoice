# Satellite Agent v1 contract

Phase 2 uses the existing Satellite process and a separate authenticated router
at `/api/agent/v1`. Existing API authentication/listener behavior is preserved.
Agent routes require a nonempty `API_TOKEN` and matching Bearer token.

## Configuration

`PUT /configuration` accepts `{schema_version: 1, revision: <positive int>,
payload_hash: <sha256 hex>, payload: {...}}`. Hash the UTF-8 JSON payload with
recursively sorted object keys, unescaped Unicode/slashes and no whitespace.
Arrays retain order. Empty mappings are JSON objects. Reject older revisions and
conflicting equal revisions; identical equal revisions rehydrate idempotently.
Return `{revision, payload_hash}` after complete validation and atomic activation.
Secrets are transient runtime memory, never included in response/log/state files.

Payload keys:

- `profiles`: object keyed by `internal`/`external`, each containing `trunk_id`
  (string ID or null), `flow`, `model`, `voice`, `language`, `greeting`, `prompt`,
  `permissions` (scope -> allow/deny), `tools` (tool ID -> enabled/disabled),
  `max_call_duration_seconds`, `fallback_destination` (string/null), `company`
  (structured fields), and `calendar_services` (service -> calendar ID).
- `bindings`: array of `{id: <string>, provider: openai|grok,
  runtime_owner: builtin, trunk_name: AgentTrunk_<id>, provider_user,
  provider_host, api_key, webhook_secret}`. Only built-in bindings are exported.
- `destinations`: array of `{id: <int>, agent_type, profile_key: <string|null>,
  fallback_destination: <string|null>}`. CleverAI rows are listed for ownership
  validation but never admitted as built-in calls.
- `directory`: array of `{id: extension:<n>|queue:<n>|ivr:<n>, type, name,
  description, synonyms: [strings], internal_allowed: <bool>,
  external_allowed: <bool>, target: {context, exten, priority: 1}}`.
- `calendars`: object keyed by time-condition ID, values `{timezone,
  rules: [<FreePBX time-group rule strings>], override: auto|open|closed|unknown,
  observed_at: <Unix int>, supported: <bool>}`. Unknown/stale/unsupported sources
  yield an unknown result, never invented hours. Rules use
  `HH:MM-HH:MM|day-of-week range|day-of-month range|month range`.

`PUT /context` refreshes read-only PBX observations using
`{payload_hash, directory, calendars}`. It requires the current configuration
hash and validates the same resource schemas. It does not change configuration
revision/hash; new calls pin its latest context. This allows a periodic sync to
observe opening-hours overrides without invalidating generated dialplan.

`GET /readiness` returns `ready`, `ari_connected`, `configured`, `revision`,
`payload_hash`, bounded nonsecret errors, and active call count.
`GET /catalog/tools` and `/catalog/permissions` return `{tools: [...]}` and
`{permissions: [...]}` respectively.

## Provider events

`POST /provider-events/{openai|grok}` accepts `{binding_id: <string>,
raw_body: <base64 original bytes>, headers: {webhook-id, webhook-timestamp,
webhook-signature}}`. Both PHP and Satellite verify the original provider
signature/timestamp. Satellite matches its pre-existing pending session/leg.
Return `{status: accepted|duplicate|ignored}` only after responsibility is taken.
An event can never create a session without a matching ARI admission.

## Voice admission

Generated destinations set `AGENT_DESTINATION_ID`, `AGENT_TYPE`,
`AGENT_ROUTING_REVISION` (configuration payload hash), trusted
`AGENT_CALL_ORIGIN` and original caller/DID values, then enter
`Stasis(satellite-agent,caller,<destination id>,<agent type>)`.
Uncertain origin uses the external permission/visibility ceiling.
The runtime allocates session/run IDs, a provider-leg nonce, and known Local
channel IDs before origination. Variables include `AGENT_SESSION_ID`,
`AGENT_PROVIDER_LEG_ID`, `AGENT_ROLE=caller`, `AGENT_FLOW`, provider trunk/user/
host and the original caller metadata. The Local endpoint is
`Local/<session-id>@satellite-agent-provider/n`; its ARI side enters the
`satellite-agent` application with `provider,<session-id>` arguments.

Headers: existing X-OS metadata plus `X-OS-Session-ID`,
`X-OS-Provider-Leg-ID`, `X-OS-Agent-Role`; CleverAI retains its linkedid header.
The runtime bridges caller and Local ARI channel after provider/session setup.
On failure it sets `AGENT_EXIT_REASON=fallback` and continues the original
caller in its generated destination immediately after Stasis. Normal completion
sets `completed` and continues through `satellite-agent-end`; ARI DELETE is
reserved for owned provider legs. A basic handoff sets a random attempt ID and
trusted resource ID, then continues through `satellite-agent-handoff`. The PBX
resolves that resource to a generated native target, clears Agent ownership and
its absolute safety timeout before routing. An ambiguous continuation is never
retried. A still-owned caller has at most a 30-second PBX safety timeout; this
bound is cleared on committed handoff and on failure fallback. Cleanup never
hangs up a handed-off caller.

## Common runtime interfaces (implementation integration)

`agent.configuration.ConfigurationStore` exposes `apply(envelope)`, `snapshot`
(payload or None), `revision`, `payload_hash`. `apply` returns the acknowledgement.
`agent.tools.ToolRegistry` exposes `catalog()`, `provider_tools(context)`, and
async `dispatch(wire_name, arguments, invocation_id, context)`. Context includes
`run_id`, `agent_id`, pinned `profile`, `permissions`, `directory`, `calendars`,
`origin`, `voice` and async `handoff(destination_id, reason)` when available.
Directory/company/calendar handlers do not require ARI/provider objects.
`agent.events.EventSink.emit(event_type, **fields)` is bounded and redacts payloads.

`agent.runtime.AgentRuntime` exposes async `start()`, `stop()`, `configure(envelope)`,
`provider_event(provider, envelope)`, `handoff(session_id, body)`, and synchronous
`readiness()`, `call_status(session_id)`. It composes a ConfigurationStore,
ToolRegistry, EventSink, ARI controller and provider factory. `agent.api.create_router`
mounts routes using this object. One event loop owns runtime sessions/locks.

Provider factory `create_adapter(binding)` returns an adapter with async
`accept(provider_call_id, profile, tools)`, `connect(provider_call_id)`,
`send_result(invocation_id, result)`, `respond(instructions=None, response_id=None)`, `close()`,
`hangup(provider_call_id)` and `events()` async iterator. Session update/accept
sequencing stays provider-specific. `verify_webhook(secret, raw_body, headers)`
returns the parsed authenticated object or raises ValueError; it enforces a
300-second timestamp window and supports multiple v1 signatures.

## Tools

IDs / wire names:
`directory.find_destinations` / `nv_find_destinations_v1` (query string),
`company.get_information` / `nv_company_information_v1` (fields string array),
`calendar.get_opening_hours` / `nv_opening_hours_v1` (service_id, ISO date),
`telephony.handoff` / `nv_handoff_v1` (destination_id, reason).
Input/output validation, per-call serialization, operation deduplication and
typed resource permissions are server responsibilities. No advanced-transfer,
custom HTTP, file, or workflow tools are advertised in Phase 2.
