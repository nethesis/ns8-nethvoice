# Phase 4 — External API tools and non-voice execution

Planning date: 4 October 2026. **Source implementation and local verification
completed; live business acceptance and deployment remain open.** See
[implementation](phase4-development.md), [API contract](phase4-api-contract.md),
and [test results](phase4-test-report.md). The detailed sections below preserve
the original delivery plan; the implementation report records refinements.
Phase 4 maps to roadmap
**M2**, following Phase 3 monitoring. This replaces the historical catch-all
Phase 4 scope; file context, workflow authoring and advanced transfer keep their
separate milestones in [PLAN.md](../PLAN.md#101-draft-roadmap-for-the-broader-agent-application).

## 1. Intended outcome and decisions

An administrator configures an approved business API once, grants individual
operations to an agent, tests them, and inspects their execution in Agents.
An authenticated external application can also start a bounded agent run,
retrieve its status/result and request cancellation without a telephone call.
Both entrypoints use the same tool dispatcher and policy enforcement.

Working example, pending owner selection: **customer lookup and support-ticket
creation**. Start with read-only lookup from voice and API runs; allow ticket
creation from explicitly authorized API requests. A sandbox business service
must demonstrate real lookup, duplicate prevention and effect reconciliation.
A mock alone does not satisfy the business-integration acceptance gate.

| Decision | Proposed baseline / unresolved input |
|---|---|
| Product and order | NethVoice only; monitoring → APIs → files → workflows, already confirmed in the roadmap |
| Administration | Extend the existing Agents area and administrator login |
| First business API | Customer lookup/ticket creation proposed; actual service, sandbox and API contract still needed |
| Connector mechanism | Bounded HTTPS/JSON operations; static bearer/API-key credentials initially |
| First non-voice adapter | Owner confirmed OpenAI for text; Responses adapter delivered, model/account live validation still needed |
| First API agent | A seeded, versioned support-request preset with a small configuration form; general agent/workflow authoring remains M4 |
| Consequential actions | API client must explicitly request the approved ticket operation with typed fields; arbitrary model instructions cannot authorize writes |
| Voice writes | Defer until a concrete caller-confirmation protocol is designed; voice read-only integrations are included |
| Runtime | Existing Satellite process, bounded asynchronous tasks; no new broker or worker service |

The owner confirmed OpenAI and will provide the business API details. Configurable
connector infrastructure and the Responses adapter are implemented; P4.0 still
must freeze and verify the actual business schemas, mappings and effect contract.
Do not infer HTTP text capability or model compatibility from existing SIP
bindings, and do not silently reuse a trunk credential for a new purpose.

## 2. Baseline and inherited release gates

Use the Satellite `agent` runtime recorded in `runtime-ref`, together with the
existing Wizard Agents views and REST
gateway. The ignored `.worktrees/satellite-phase2` checkout is useful for
development; delivered changes must also be reproducible from packaged source.

Inspection found these concrete implementation gaps:

| Current boundary | Required change |
|---|---|
| `agent/tools/registry.py` iterates fixed `MANIFESTS`; configuration validates fixed tool IDs | Register built-ins and validated connector operations through one registry; preserve built-in IDs and schemas |
| Tool deduplication is an in-memory task cache | Add a durable operation ledger for external effects, independent of best-effort monitoring |
| `AgentRuntime` owns voice calls and constructs tool contexts | Extract reusable admission/context/deadline services; retain call transitions in the voice controller |
| Provider adapters accept SIP call IDs | Add a separate text execution adapter without fabricated SIP sessions or ARI capabilities |
| Monitoring table defaults `execution_kind` to `voice` | Persist the actual kind and new definition/connector revision references |
| Monitoring reads use `runtime.calls` and fixed agent/provider filters | Resolve ownership by execution kind; include API runs and seeded API-agent IDs in gateway, storage and UI |
| Wizard REST middleware globally requires administrator User/Secretkey headers | Give machine requests a separate authenticated entrypoint; do not weaken or bypass the admin middleware |
| FreePBX owns native profiles and monitoring policy | Add application-owned connector resources and API presets without a competing writer for native profiles |

[Phase 3 acceptance](phase3-test-report.md) remains open. Development can
proceed locally, but the combined release must publish/deploy the tested restore
correction and complete browser, approved live-provider capture, concurrent-call
sizing and full NS8 restore/clone checks. Preserve the separate Phase 2 human
listening, email/VAT pronunciation and external incoming-call acceptance items.
Planning Phase 4 does not mark any of those checks complete.

## 3. Resource ownership and publication

Use an additive application schema, proposed name `agent_application`, in the
existing Satellite PostgreSQL database. Keep execution control separate from
the lossy monitoring recorder. Satellite is the sole writer for new resources;
the administrator gateway forwards bounded, authorized management operations.

| Resource | Owner and version semantics |
|---|---|
| PBX destinations, trunks, directory, native Internal/External profiles | Existing FreePBX repositories and revisioned snapshot, unchanged authority |
| Connectors and operations | Application repository; stable IDs, editable draft, validated immutable published versions |
| Connector grants | Application repository; explicit operation/version grants to native agent IDs or API presets |
| API execution preset | Application repository; seeded definition, provider binding, input/output contracts, prompt and limits; published revision |
| Outbound credentials | Encrypted application secret records, opaque references in definitions; encryption key in protected NS8 secret file |
| Inbound API clients | Application repository; scoped, expiring, revocable credentials, token verifier stored instead of recoverable token |
| API runs and external effect ledger | Transactional application repository; monitoring receives a redacted projection |

Existing native profile tool settings continue to own built-ins. Connector
grants are a distinct namespace owned by the application; do not round-trip them
through the current fixed native tool allowlist. Effective privileges are the
intersection of agent grants, entrypoint/client scope, operation policy and
available capabilities. Customer visibility must follow the configured business
identity rules; caller number and model-supplied customer ID are not proof of
identity. External voice lookup exposes only approved fields under that policy.

Admission pins the native configuration revision, API preset revision if any,
connector/operation versions and grant revision. Publishing affects new runs.
Revocation is a live deny check before every invocation; it overrides pinned
grants. Credential versions remain available while legitimately referenced;
rotation/revocation must have explicit in-flight behavior and never fall back
silently to another credential.

Secret values are write-only in the UI/API, omitted from logs, snapshots and
monitoring. Use the existing protected secret-file/backup pattern for the
application encryption key, never `agent.set_env()`. Missing keys fail new
connector execution closed while existing non-connector voice features remain
usable. Validate publication atomically with optimistic revision checks;
reject deletion of referenced versions and retain audit actor/time/revision.

## 4. Outbound connector contract

Each connector fixes its base origin, allowed network destinations, credential
reference and operations. Each operation specifies ID/version, provider-safe
wire name, method/path, input/output JSON schemas, declarative field mappings,
response projection, read-only/effect classification, timeout and retry policy.
Mappings support field selection and encoded substitution, not executable code.
Grant exact published operations, not an unrestricted HTTP capability.

The HTTP executor must:

- Validate schemas at publish and invoke time; bound schema complexity and reject
  remote schema references. Preserve built-in manifest behavior.
- Resolve URLs and headers exclusively from administrator configuration. Encode
  path/query arguments; prohibit overriding authority, credentials or headers.
- Verify TLS, allow only approved HTTPS origins and ports, disable redirects and
  implicit environment proxies, and enforce destination policy at connection
  time against DNS changes. Deny loopback, link-local/metadata and other special
  ranges; permit private business networks only through explicit administrator
  host/port/CIDR policy. Test IPv4 and IPv6 paths.
- Bound connection/read/total time, concurrency, redirects (zero), downloaded and
  decompressed bytes, JSON depth and projected output. Reject non-JSON responses.
- Send credentials only to their configured origin; project approved response
  fields before returning data to a model. External content cannot change grants,
  endpoints, prompts or execution policy.
- Emit safe status, timing and error codes through the existing dispatcher.
  Response bodies, arguments and credential-bearing URLs stay out of metadata.

Initially support static bearer or named API-key headers. OAuth flows, arbitrary
OpenAPI imports, scripts, SQL, shell, MCP, file upload and callback delivery are
separate scope decisions, not implicit features of this editor.

### Effects, retries and confirmation

Persist a server-generated operation ID, input digest, pinned operation version
and state **before** sending an effectful request. Use that operation ID as the
remote idempotency key when supported. States distinguish prepared, dispatched,
committed, rejected and unknown; store safe reconciliation references.

Deduplicate by business operation identity as well as provider invocation ID.
For the seeded ticket preset, permit one ticket per authenticated client request
identity. A new model tool-call ID must not create a second ticket. Reuse with
different input returns a conflict. Require durable ledger availability for
writes; monitoring unavailability alone need not prevent an otherwise recorded
operation. Database uncertainty after dispatch means unknown, not safe failure.

Read-only retries are bounded and count against the same deadline. Writes are
not automatically retried after uncertain dispatch unless the selected service
has verified idempotency semantics covering the retry window. Reconcile via a
read-only remote lookup when supported; otherwise show operator action required.
Cancellation is not rollback. Never label a timed-out write as undone or repeat
it merely because the model asks again. Output-validation failure after a remote
success must preserve the known effect or uncertainty.

In the proposed API preset, a typed `create_ticket` request and client write
scope authorize exactly that bounded action. Validate customer identity and
ticket fields before dispatch; the model cannot turn lookup into creation.
Administrator test execution requires a separate explicit write action showing
the target service and fields. This phase does not introduce a general approval
engine or unattended voice writes.

## 5. Inbound execution and API contract

Proposed public namespace: `/agents-api/v1`, exposed through the existing HTTPS
ingress to a dedicated Satellite router with its own client-token dependency.
Limit proxy routing to this prefix; never expose private configuration,
monitoring or provider-control routes as part of it. Keep the existing listener
and legacy authentication behavior. Review the concrete proxy configuration in
P4.0 and test both direct-runtime and ingress access controls.

Machine clients have independently revocable credentials and scopes
`runs:create`, `runs:read`, `runs:cancel`, approved preset IDs and operation grants.
Reads/cancellation are limited to runs owned by that client; administrator
visibility uses the existing gateway. Token scopes, not browser credentials or
the shared private Satellite bearer, govern machine access.

| Endpoint | Proposed behavior |
|---|---|
| `POST /runs` | Require `Idempotency-Key`; validate preset/version and typed input; return 202 with durable `run_id`, status URL and pinned version |
| `GET /runs/{id}` | Owned run state, safe error, pinned versions and result availability; 404 for inaccessible/unknown ID |
| `GET /runs/{id}/result` | Authorized bounded result when available; explicit pending/expired states; `Cache-Control: no-store` |
| `POST /runs/{id}/cancel` | Idempotent cancellation request; terminal run remains terminal; response distinguishes requested from completed cancellation |

The caller cannot supply a system prompt, arbitrary tool list, endpoint URL,
credential, permissions or voice context. Validate request size before parsing.
Missing/invalid token returns 401, denied scope 403, input errors 400/422,
idempotency conflicts 409, capacity limits 429, unavailable control storage 503.
Use `Retry-After` where meaningful. Do not advertise webhook notifications or
streaming in the first API contract; clients poll.

`POST` commits admission and deduplication atomically before 202. Concurrent
identical requests return the same run; the same key with different normalized
input conflicts. Return 503 if durable admission cannot be established. A
bounded in-process executor claims admitted records under a runtime epoch/lease
and pins its context before provider execution. The common executor handles
validation, policy, deadlines and cancellation; voice and text adapters keep
their separate interaction loops.

API states: accepted → running → completed/failed/cancelled/interrupted; a
cancellation request is also observable while work drains. An uncertain effect
sets `reconciliation_required` and prevents a successful business outcome.
After restart, settle records owned by the previous epoch as interrupted and
reconcile dispatched effects; do not automatically resume model turns or replay
business actions. New API runs cannot have ARI or handoff capabilities. An
unavailable ARI connection must not prevent an otherwise valid API run.

Runtime checks budgets before every model/tool turn and validates the final
output schema. The result identifies verified business references and incomplete
outcomes; model prose alone is not evidence that a ticket exists.

## 6. UI, monitoring and content lifecycle

Extend Agents with Connectors and API access views, plus the small seeded-preset
configuration form. Provide draft validation/publication, operation grants,
secret replacement, credential expiry/revocation and clear applied revision.
The test view defaults to lookup, shows safe projected results and links to the
run. Warn of an effect only when the user selects a write test. Reuse existing
admin authentication, mutation CSRF/origin checks, English/Italian strings and
responsive/keyboard behavior.

Monitoring must show voice/API kind, client or administrator actor, published
versions, tools, retries, operation IDs, effect certainty and cancellation.
Show API ownership from the execution service instead of testing membership in
`runtime.calls`. Add generic run lifecycle events without double-counting voice
admission/termination. Extend the redaction allowlist narrowly; retain separate
business outcome and transport/tool completion. Generalize gateway filters and
repository queries along with the frontend.

API request/result content is a separate operational resource, not an implicit
voice-transcript opt-in. Proposed policy: encrypted input during execution,
delete input on terminal settlement; encrypted final result available for 24
hours, then unavailable. Do not retain intermediate model/tool content by
default. Metadata remains under the existing configurable 30-day default;
voice transcripts retain their current default-off/7-day policy. Expose result
retention before publishing a preset and apply a byte/storage cap.

Keep content-free admission/effect deduplication records for at least 30 days
and at least the documented client retry window. Unresolved effects must not
expire into permission to repeat the action; preserve bounded tombstones until
reconciled and fail new writes closed if their capacity is exhausted. Document
that new request identities are new authorizations and that deduplication beyond
the advertised window needs the business system's stable external reference.
Result expiry/deletion must not erase effect protection. Authorization and expiry
apply on reads even before physical cleanup.

## 7. Initial operational limits

Proposed starting values, to freeze and measure during P4.0/P4.5:

| Resource | Initial bound |
|---|---|
| Connectors / published operations per connector | 20 / 20 |
| API request / final result | 32 KiB / 64 KiB |
| HTTP response / projected tool output | 256 KiB decompressed / 16 KiB |
| Tool total timeout | 10 seconds default, configurable 1–30 seconds within remaining run deadline |
| API run deadline | 60 seconds default, maximum 120 seconds |
| Per-run model turns / tool calls | 8 / 8, plus provider token budget fixed with the chosen adapter |
| Active API runs / waiting admissions | 4 / 20 per instance |
| Outbound requests | 8 per instance, 2 per connector; separate voice/API budgets prevent API starvation of voice |
| Client admission rate | 30/minute, burst 5, plus instance capacity checks |
| Retained operational payloads | 256 MiB per instance; reject new admission before exceeding the cap |
| Admission/effect ledger | 100,000 records initially; protect unresolved records and reject work at capacity |

All waits and retries consume a total deadline. Health distinguishes connector
failure, execution-store failure and monitoring failure. Demonstrate that API
saturation and slow remote services leave voice handling responsive. Split
processes only if measurements require it; doing so needs an explicit lifecycle
update, not an incidental worker introduced during implementation.

## 8. Delivery sequence and acceptance

| Step | Deliverable | Exit evidence |
|---|---|---|
| P4.0 — Freeze the vertical slice | Select business service/sandbox, typed use case, text provider, identity/write policy, proxy mapping, budgets and API examples; track Phase 3 gates | Reviewed contracts and fixtures; provider/API-specific uncertainties resolved |
| P4.1 — Shared execution and persistence | Dynamic trusted registry, execution contexts, connector/preset repositories, secret service, effect ledger and migrations | Existing voice tool tests pass; revision races, revocation, missing keys and durable deduplication verified |
| P4.2 — Outbound connector | Bounded HTTP executor, lookup and ticket operations, grants, reconciliation | Sandbox lookup/create succeeds; duplicate invocation and ambiguous response do not duplicate effects; network policy tests pass |
| P4.3 — Non-voice API run | Dedicated machine router, scoped clients, durable admission, text adapter, polling and cancellation | A real provider run uses the common dispatcher without ARI; duplicate POST, restart and cancellation behave as specified |
| P4.4 — Administrator experience | Connector/preset/client forms, explicit tests, generic run monitoring and retention | Browser acceptance in English/Italian; secret redaction, result expiry, access isolation and partial-history states pass |
| P4.5 — Coordinated acceptance/release | Reproducible packaged runtime, regression/load/lifecycle checks and operator docs | Combined Phase 3/4 gates passed with immutable image digests, backup/restore evidence and a release report |

Acceptance must cover these failure paths as well as the representative demo:

1. Existing CleverAI routes, native destinations, provider bindings, basic
   handoff, transcription/TTS and monitoring remain compatible.
2. Unauthorized client/agent/operation, revoked credentials/grants, customer
   visibility violations and spoofed voice context fail before external access.
3. DNS rebinding, redirects, private-address bypass, IPv6 edge cases, path/header
   injection, credential forwarding, oversized/compressed responses and invalid
   schemas cannot escape configured policy or limits.
4. Concurrent duplicate API requests, repeated model invocation IDs and distinct
   model IDs for the same ticket yield one business effect. Crashes before send,
   after remote commit and before local acknowledgement retain honest certainty.
5. Timeouts, 429/5xx, malformed remote output, cancellation, grant revocation and
   provider failure produce bounded, visible outcomes without unsafe retries.
6. Control-store loss rejects new API admissions/writes; monitoring loss records
   a gap but cannot erase durable effect protection or block ordinary voice calls.
7. Saturate API limits while exercising the Phase 3 concurrent voice target;
   capture latency/resource measurements, not just successful HTTP responses.
8. Backup/restore preserves definitions, secrets, results within retention and
   deduplication ledgers. Restored in-flight runs settle without automatic replay.
   A clone disables outbound effects and invalidates copied machine credentials
   until explicitly reconfigured; copied operation history must not initiate work.
9. Upgrade/rollback and browser states are tested using the exact packaged images.
   Fixtures and mock providers supplement, rather than replace, sandbox and
   approved live-provider evidence.

Use targeted registry/executor/storage/API tests, disposable HTTP/database
fixtures, gateway integration checks, then browser and end-to-end scenarios.
Add a Phase 4 contract and development/acceptance report during implementation.
Do not treat this planning document as evidence that tests have run.

## 9. Lifecycle and rollout

Deliver runtime changes through the pinned base plus reviewable patch/overlay,
or an immutable upstream revision with the corresponding overlay removed.
Build and test the assembled source used by CI. Extend image compatibility
checks to require the Phase 4 modules and supported schema versions.

Review configure/update/backup/restore/clone hooks, PostgreSQL grants, protected
key persistence, retention tasks and HTTPS routes as one change. Migrations are
additive and repeatable; unsupported newer schemas fail affected features
explicitly. Call handling retains its existing failure isolation.

Roll out with connectors and machine access disabled, validate a read-only
sandbox operation, then enable the scoped API preset and its approved write.
Before rollback, disable admission and new connector invocation, drain/cancel
active API runs, settle or mark uncertain effects and preserve backup/image
digests. Revert coordinated images together; retain additive schemas, keys and
ledgers. Disable the public prefix if the older image cannot serve it. Never
delete deduplication state or replay interrupted runs during rollback.

Phase 4 is complete only when both an existing voice agent uses a granted
business lookup and an API-triggered non-voice agent completes the selected
integration with a trustworthy result, isolated credentials, visible trace and
verified duplicate/failure behavior, alongside the inherited release gates.
