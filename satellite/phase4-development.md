# Phase 4 implementation

4 October 2026. **Source implemented and locally verified; runtime integrated
into Satellite branch `agent`. Production deployment and business-integration
acceptance remain open.**
The owner selected OpenAI for text execution and will supply the business API
contract. No business service, sandbox endpoint, credential or model has been
invented. See the [API contract](phase4-api-contract.md) and
[test report](phase4-test-report.md).

## Delivered behavior

The Agents area now has Connectors and API access pages. Administrators create
validated drafts, publish immutable versions, grant specific operations to agents,
add/revoke encrypted credentials, configure the support-request preset, create
expiring machine clients, explicitly test writes and inspect/reconcile unknown
effects. Tokens display only at creation and clear on logout. Forms and navigation
are translated in English and Italian. API runs appear in the existing run list
and detail view with kind/client/version metadata, results and cancellation.

Satellite exposes a separate scoped machine API for asynchronous admission,
status, result and cancellation without ARI. The reusable connector dispatcher
also exposes granted public read-only operations to native voice calls. Private
customer voice lookup requires an authenticated customer binding and is deferred.
API and voice keep separate execution context and reserved connector slots.

The OpenAI Responses adapter has an explicit separate credential/model, stateless
continuation, validated tools, bounded output/turns/deadline and structured result.
Support-request authorizes lookup or explicitly requested customer/ticket fields;
model instructions cannot authorize an additional customer or write. No general
workflow engine, shell/SQL tool, file ingestion or voice write protocol was added.

Transactional application state admits requests before 202 and pins resource
versions. Client idempotency and a durable operation ledger prevent repeated
writes across concurrent admission/model call IDs. Dispatched writes never retry;
unknown outcomes retain reconciliation protection. Cancellation does not undo
remote effects. Startup/recovery interrupts lost ownership rather than replaying
business actions. Optional monitoring failures do not authorize or block writes;
control-store/key failure blocks application admission.

## Source and packaging

| Area | Delivered files/boundary |
|---|---|
| Runtime integration | Satellite branch `agent`, verified commit in `runtime-ref` |
| Application control state | Satellite `agent/application/{contracts,crypto,repository,service}.py` |
| Transport/provider/API | Satellite `agent/application/{http,responses,api}.py` |
| Shared tool registry | Satellite registers trusted connector manifests and uses the existing dispatcher |
| Monitoring | Satellite adds execution kind, API ownership, version/client references and schema 2 migration |
| Wizard gateway | `AgentApplicationClient.php` and REST `modules/agents.php`; fixed allowlisted paths, administrator actor and CSRF/origin enforcement |
| Wizard UI | `agentintegrations.js`, connectors/API views, run detail/filters, locale/style/service updates |
| NS8 lifecycle | Independent application content key on create/update/older restore; narrow Traefik machine route; clone excludes PostgreSQL application state |
| Verification | Repeatable disposable PostgreSQL/HTTPS acceptance, PHP gateway, Angular browser and caller-disconnect regression checks |

`build-images.sh` starts the wrapper from `ghcr.io/nethesis/satellite:agent`
and verifies application API imports/OpenAPI paths. Runtime changes and tests
are committed in Satellite, with its verified commit recorded in `runtime-ref`.
The module publication workflow consumes the verified wrapper digest.
See [transfer verification](transfer-test-report.md) for publication evidence.

Application schema 1 is separate from monitoring schema 2 and legacy transcription
state. Whole-database backup already includes new tables; `passwords.env` already
backs up their new key. Clone discards the PostgreSQL dump, so application resources
and machine credentials are deliberately absent in the fresh clone. A repository
helper also tests disable/revoke behavior but is not substituted for the NS8 clone
hook. Actual NS8 restore/clone acceptance has not been performed in this phase.

## Refinements from the plan

- OpenAI Responses is the owner-confirmed text provider; the model remains an
  administrator choice pending account/model compatibility verification.
- Business schemas, mappings, credentials and receipt lookup remain configurable
  until the owner supplies the actual service contract.
- Compression is rejected instead of decompressed, keeping the response bound
  simple. Business APIs must support uncompressed JSON for this increment.
- Connector concurrency is one slot per execution kind per connector, with four
  global slots per kind. This reserves voice capacity during API activity.
- Admission accounts for actual encrypted input/snapshot plus bounded result
  reservation; orphan recovery preserves live owners after a database outage.
- Monitoring schema 2 deliberately trips the old Phase 3 newer-schema guard.
  Rollback keeps data/keys and requires a compatible reader or roll-forward;
  it is not represented as a schema downgrade.

## Remaining acceptance

The source work does not close the end-to-end business integration gate. Supply
the sandbox contract for customer lookup, ticket creation, idempotency/receipt
lookup, response projections and credentials. Configure an approved OpenAI model
and run live read/write, duplicate, cancellation and uncertainty/reconciliation
checks in that sandbox, with attributable operator evidence.

Then run coordinated image CI and installed Wizard/admin authorization checks,
Traefik prefix/private-route isolation, full NS8 backup/restore/clone and concurrent
voice/API sizing. The open Phase 3 restore-correction publication/deployment,
approved provider capture, restore/clone and load checks remain combined-release
gates. Phase 2 human listening, email/VAT pronunciation and actual external
incoming-call acceptance also remain open. Existing unrelated working changes
were preserved. No production application access was enabled by this work.
