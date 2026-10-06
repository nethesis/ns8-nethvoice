# Phase 4 application API contract

This contract defines the application API and administrator controls.
API access starts disabled.

## Administrator setup

Use the existing administrator login at `/freepbx/wizard/#!/agents/connectors`
and `/freepbx/wizard/#!/agents/api`. The Wizard gateway retains administrator
middleware, origin checks and CSRF checks for mutations. Machine credentials
cannot access that gateway. The runtime administrator prefix
`/api/agent/v1/application` is private, uses the internal Satellite bearer, and
requires the gateway's verified actor header; it is not published by Traefik.

1. Add separate immutable credentials for the business service and OpenAI. Their
   values are encrypted, accepted once, and never returned by inventory. Rotate
   by adding a new credential ID, publishing a new referencing version, then
   revoking the old credential after reviewing active consumers.
2. Create a connector draft using the business service's actual HTTPS origin,
   schemas, paths and field mappings; publish it. Publishing freezes a version.
3. Grant exact `{connector_id, version, operation_id}` references to
   `support-request`. The preset's operation list and each client's grants must
   also include those references. The effective set is their intersection.
4. Configure and publish the `support-request` preset: `provider` is
   `openai_responses`; specify a Responses model supporting tools and structured
   output, the separate credential ID, instructions, operations, deadline,
   output-token budget and result retention. No SIP credential or model is reused.
5. Create an expiring machine client with scopes, exact operation references and
   explicit authorized customer IDs. Copy its token once to the calling system.
   Revoking a client denies new requests and stops its active execution.
6. Enable application access. Use an administrator test run to inspect the
   integration. Ticket tests require an explicit write confirmation. They invoke
   the real service and may create a real ticket when configured against it.

Native voice profiles remain owned by FreePBX. Connector and preset resources,
grants, clients, effects and API results are owned by Satellite/PostgreSQL.

## Connector definition

Required connector keys are `name`, `origin`, `secret_ref`, `auth`,
`private_networks`, and `operations`. `auth` is either `{"type":"bearer"}` or
`{"type":"api_key","header":"X-Api-Key"}`. Credentials are resolved only
server-side. A connector is limited to 20 operations; at most 20 connectors exist.

An operation declares `id`, `description`, `method`, `path`, `input_schema`,
`output_schema`, `query`, `body`, `projection`, `read_only`, `public_voice`,
`timeout_seconds`, and `identity_field`. Only GET/read-only and POST/write are
supported. A fixed path can include URL-encoded input placeholders, such as
`/customers/{customer_id}`. Query/body mappings map remote field names to input
property names. Projection maps exposed field names to remote dotted JSON paths;
only projected, schema-validated data reaches the model or stored result.

Example shape for the proposed lookup, **not an actual business API contract**:

```json
{
  "id": "lookup",
  "description": "Look up an authorized customer",
  "method": "GET",
  "path": "/customers/{customer_id}",
  "input_schema": {
    "type": "object",
    "properties": {"customer_id": {"type": "string", "minLength": 1, "maxLength": 128}},
    "required": ["customer_id"], "additionalProperties": false
  },
  "output_schema": {
    "type": "object",
    "properties": {"id": {"type": "string", "maxLength": 128}},
    "required": ["id"], "additionalProperties": false
  },
  "query": {}, "body": {}, "projection": {"id": "id"},
  "read_only": true, "public_voice": false,
  "timeout_seconds": 10, "identity_field": "customer_id"
}
```

For support-request ticket creation the operation's required inputs must accept
`customer_id`, `summary`, and `description`; `identity_field` must be
`customer_id`. The server permits only the values explicitly submitted by the
client. A model cannot change the customer or ticket content to authorize another
write. A write may declare `idempotency_header: "Idempotency-Key"`; the server
sends its durable operation ID as the remote key. Verify the business service's
actual deduplication contract before enabling writes.

An optional write `reconcile` value has `operation`, `argument`, and
`result_field`. It references a read-only operation in the same connector, accepts
the original operation ID as its lookup argument, and exposes a receipt field.
An administrator reconciliation only performs that GET; a truthy validated
receipt marks the effect committed. Missing receipts keep it unknown. Without a
lookup contract, the UI reports that operator action is required. This interface
cannot force an unknown effect to success or automatically reissue it.

Voice grants support only read-only `public_voice: true` operations with no
customer `identity_field`. Private customer lookup from a telephone caller is
not enabled without an authenticated customer binding. External-origin calls
also inherit the external agent's grant ceiling. Optional connector loading has
a 500 ms admission limit; failure does not prevent native voice admission.

## Network and data policy

Origins allow HTTPS on ports 443 or 8443, without user information, path, query
or fragment. Redirects, proxies, arbitrary URLs/headers, shell/SQL execution and
remote schema references are disallowed. TLS certificates are verified. Every
connection checks all DNS answers and connects to checked addresses, with DNS
caching disabled. Loopback, link-local, multicast, reserved, mapped IPv6 and
metadata addresses are denied. RFC1918/ULA addresses require explicit connector
CIDRs, limited to prefixes of /16 or narrower for IPv4 and /48 for IPv6.

Schemas are JSON Schema without references or regular expressions,
maximum 16 KiB, 512 nodes and depth 16. Responses accept JSON media types, are
limited to 256 KiB and depth 24, and reject compressed content and nonfinite
numbers. Projected tool results are limited to 16 KiB. Inputs remain untrusted
even when returned by a configured service; the dispatcher enforces policy.

## Machine entrypoint

Traefik publishes only `https://<nethvoice-host>/agents-api/v1` to Satellite,
with HTTPS redirection and no prefix stripping. Clients use
`Authorization: Bearer <one-time-client-token>`. No administrator User/Secretkey
headers, query parameters, or webhook credentials apply here. Responses use
`Cache-Control: no-store`; errors expose stable codes, not internal exceptions.

| Method/path below `/agents-api/v1` | Scope | Behavior |
|---|---|---|
| POST `/runs` | `runs:create` | Durable admission followed by asynchronous execution; 202 |
| GET `/runs/{run_id}` | `runs:read` | Owned run status, pinned versions and effect metadata |
| GET `/runs/{run_id}/result` | `runs:read` | `pending`, `available`, `expired`, or `unavailable` result state |
| POST `/runs/{run_id}/cancel` | `runs:cancel` | Request cancellation; does not undo business effects |

Ticket creation additionally requires `operations:write`. A different client's
run returns 404. Tokens are random, stored as SHA-256 verifiers, expire within
one year, and can be revoked. Clients specify up to 100 customer IDs. There is
no wildcard customer grant in this increment.

POST `/runs` requires JSON, at most 32 KiB, and an `Idempotency-Key` of 1–128
printable nonspace ASCII characters. Example lookup body:

```json
{"preset_id":"support-request","version":1,"input":{"action":"lookup","customer_id":"customer-1"}}
```

Explicit ticket request:

```json
{"preset_id":"support-request","version":1,"input":{"action":"create_ticket","customer_id":"customer-1","summary":"A support request","description":"Details supplied by the authorized caller"}}
```

No extra keys are accepted. Customer IDs are at most 128 characters, summary
200, description 4,000. Ticket summary and description must be nonempty. Reuse
the same key for the same logical request; concurrent repetitions return the
original run. Changing the body with the same key returns 409. Deduplication
metadata is retained for 30 days; do not rely on a key after that period. Even an
existing admission is returned only after current configuration/grants pass
admission checks; revocation may deny subsequent polling or resubmission.

The 202 object contains `run_id`, `status`, timestamps, cancellation and
reconciliation flags, `preset_version`, pinned `versions`, `status_url`, and
`result_available`. Status is `accepted`, `running`, `completed`, `failed`,
`cancelled`, or `interrupted`. A completed result contains a model summary,
dispatcher-observed operation outcomes, and token usage. Remote business IDs come
from validated tool outcomes; the summary alone is not evidence of an effect.

400 means invalid input; 401 invalid/revoked/expired token; 403 denied scope or
operation; 404 missing/not-owned resource; 409 revision/idempotency conflict;
413 oversized body; 429 admission/rate/storage capacity; 503 disabled/unavailable
control store, missing content key, or execution failure. 429/503 include
`Retry-After: 2`; retry admission with the same key, not a new logical write.

## Execution, effects and limits

The same registry/dispatcher handles connector calls from voice and API context.
API execution has no ARI session or telephony capabilities. It pins the preset,
connector versions and native revision at admission, then checks live client,
secret, version and grant revocation before invocations. Monitoring is optional;
the transactional application store and content key are mandatory for admission.

There are four active API workers and 20 waiting admissions, four HTTP slots for
each execution kind, and one HTTP slot per connector per kind. Voice and API
reserve separate slots. Admission is limited to 30 requests/minute/client with
burst five. Deadlines are 1–120 seconds; operations 1–30 seconds. Responses
execution allows eight provider turns/eight tool calls, a shared 256–8,192 output
token budget, and 64 KiB request history. Cumulative reported usage above 32,768
tokens stops execution after the response; it is not a prepaid billing ceiling.

Read-only failures may retry once within the original deadline. Writes never
retry. A durable effect is prepared and marked dispatched before network I/O;
the seeded preset deduplicates ticket effects by run/business identity, independent
of model call IDs. Valid receipts commit; definitive remote rejection rejects;
timeout, disconnect, cancellation during dispatch, invalid success data or crash
leaves an unknown effect requiring reconciliation. Cancellation/restart never
replays a dispatched action. Recovery interrupts previous-process admissions and
settles same-process orphans after control-store recovery, preserving active owners.

Input/snapshot are encrypted and removed at terminal settlement. Results retain
for 1–24 hours; effect receipts retain at most 24 hours. Status/idempotency metadata
retains 30 days; unresolved effects retain protection until resolved. Application
content is capped at 256 MiB, with actual admission content counted and 128 KiB
reserved per active run for results/receipts. Run/effect/audit records are capped
at 100,000; configuration content at 1 MiB, versions at 1,000, secrets/clients at
100 each. Capacity failures require operator review or retention cleanup.

## Provider and lifecycle

The adapter posts to OpenAI Responses using `store:false`, stateless output
replay including encrypted reasoning, `function_call_output` with matching
`call_id`, and a JSON-schema final summary. These choices follow OpenAI's
[function calling](https://developers.openai.com/api/docs/guides/function-calling),
[structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
and [Responses migration](https://developers.openai.com/api/docs/guides/migrate-to-responses)
contracts checked during implementation. Model compatibility and live responses
must still be verified with the selected account/model.

`SATELLITE_APPLICATION_CONTENT_KEY` is an independent 32-byte base64 AES-GCM key
in NS8 `passwords.env`, generated on create/update and for older restores.
Backups include it and the existing whole-PostgreSQL dump. Restore preserves
clients/configuration and must therefore review enabled access and source-instance
ownership before use. Clone explicitly discards the dump: application resources,
credentials, clients/results/effects are not copied; the fresh database starts
access disabled. Native FreePBX configuration remains subject to its existing
resynchronization. Full NS8 restore/clone acceptance is still pending.

Monitoring migrates to schema 2; application control state uses separate schema 1.
Rolling back to the Phase 3 schema-1 reader makes monitoring unavailable because
of its deliberate newer-schema guard; do not drop data or regenerate encryption
keys to bypass it. Keep the database and matching keys, disable API access, and
roll forward to a compatible runtime. No automatic write replay is supported.
