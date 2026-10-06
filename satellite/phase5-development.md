# Phase 5 implementation

Date: 5 October 2026. Source implementation and local verification are delivered.
Test image overlays are installed on the authorized `nethvoice51` instance at
`voice.makako.sf.nethserver.net`. Live acceptance is partial; see the
[test report](phase5-test-report.md). No registry publication has been performed.

## Delivered behavior

The Wizard has an Agents → Builder catalog, with built-ins, custom drafts,
published agents and reusable blocks. Drawflow 0.0.60 is bundled locally under
its MIT license. The diagram adapter stores our versioned graph format rather
than Drawflow exports. It supports named ports, drag/connect, zoom/fit, undo/redo,
list/form editing, typed bindings, published-version loading and safe text labels.
English and Italian views include narrow-screen layouts. Published connector
operations have a selector, an explicit grant control and output-field choices.
Leaving a dirty graph through browser or Wizard navigation warns before discarding it.

Administrators can use the router, customer-support and payment-secretary
starting graphs, or start with a blank voice/API graph. The block catalog covers
conversation, conditions/mapping, caller identity, PBX catalog/routing, opening
hours, contacts/CDR history, connector operations, payment lookup, confirmation,
consultation and pinned subflows. Drafts are saveable before complete validation;
publication validates graph structure, branch availability, operation schemas,
grants, resources and subflow references. Activation binds a stable FreePBX
workflow destination to a provider trunk and immutable graph version. Partial
activation is retried by the existing synchronization timer.

The Satellite engine executes a bounded DAG. There is no code, SQL or shell node.
Provider tools change per conversation step; completion uses a fresh function
name and validated outcome/data. Voice step switching waits for finished audio.
API conversations use the OpenAI Responses API with a bounded read-only tool
loop through the shared dispatcher. Writes are explicit graph steps. API clients
must allow the workflow ID, operations and customer IDs. Admission and results
retain the existing bearer/idempotency/ownership interface.

Agent handoff keeps the original caller in Stasis and replaces its provider leg.
It preserves original caller provenance, delegated tool scope, remaining deadline,
step budget and parent/child run links. Subflows pin their publication version,
reduce permissions, enforce enablement and separate nested step paths in history.

## Sample configuration

1. In Connections, create encrypted credentials and publish the Freshdesk/Kapa
   presets. Set the actual Freshdesk account origin and Kapa project input. The
   Freshdesk preset uses API-key Basic authentication, scoped contact/ticket
   reads, ticket priority PUT and ticket creation POST. The Kapa preset uses its
   retrieval endpoint; the following conversation step grounds the answer in
   returned documentation. Verify the actual account payloads/custom fields
   before enabling a business workflow.
2. Create a payment source in Data sources. Map resident ID, name, month, amount
   and currency, and optional phone, building/unit and verification code. Preview,
   correct validation errors and publish. CSV/text use UTF-8; XLSX must contain
   values, without formulas or macros. A text extraction pattern uses named
   groups and bounded matching. Google Sheets uses a viewer service account and
   the spreadsheets.readonly scope. Store compact service-account JSON in the
   encrypted credential form, then select its ID and spreadsheet/range.
   A published Google CSV can instead use `google_csv` and `published_url`, without
   a credential. Its download permits only Google publishing/download hosts,
   public resolved addresses and verified TLS, with bounded redirects/size/time.
3. Copy a template and select a configured native provider binding. Configure
   the native PBX fallback, appropriate External profile permissions and native
   tools, connector grants, support extensions, and Freshdesk responder ID → PBX
   extension mapping. Router targets start disabled; enable the intended objects
   and set delegated grants for agent destinations. Selecting a target does not
   grant its tools.
4. Set data/connector/subflow version references, save, validate, publish and
   enable. Voice readiness also depends on PBX synchronization and reload. Route
   test calls to the stable workflow destination through normal PBX routing.

A unique payment phone match permits that resident's selected record. Unknown
or shared-number callers need the matching resident code; a name alone cannot
authorize disclosure. The verification block defaults to exact normalized names;
the secretary template permits spacing differences and at most one character edit,
while requiring an exact code and a unique resident match. Amounts remain exact decimal strings. Verification codes,
phone lookup indexes and other residents' records do not enter the payment prompt.
Five failed verification attempts per caller/resource in ten minutes are allowed.

Both Freshdesk urgency escalation and ticket creation require caller confirmation
of the exact operation/arguments, initially DTMF 1/2 after the readback. Urgency
can only move an observed caller-scoped ticket to priority 4. Ticket/operator
identifiers come from server-scoped records and explicit mappings. Uncertain
writes retain the shared effect ledger and are never replayed automatically.

Consultation initially targets extensions. The caller is held while the agent
privately summarizes the issue and asks the operator for DTMF acceptance. Audio
written from the PBX toward the provider leg is muted during the consultation;
operator speech is excluded from the caller session. Live listening must verify
this media direction and the Local-channel pairing on the target Asterisk build. Decline,
busy, no answer or failure resumes the caller and takes the configured fallback
branch. Accepted recipients are released into native BridgeWait/Bridge handling
using the already answered leg. An uncertain release is observed, never retried.

## Persistence and lifecycle

PostgreSQL schema `agent_workflows` stores drafts, immutable publications,
resources, encrypted originals/normalized rows, ingestion jobs, execution
snapshots and steps. Originals live in PostgreSQL, so the existing full database
backup includes them; a separate upload volume is unnecessary. Existing content
keys in protected module state encrypt resources/results. The existing fresh
clone policy continues to exclude application state.
Clone cleanup temporarily starts MariaDB with the regenerated credentials,
re-encrypts retained trunk/SIP/webhook secrets (including previous webhook keys)
with the new configuration key, clears the old snapshot, disables copied
workflow destinations and stops MariaDB again. Secret rotation is transactional
and accepts an already migrated row on retry. Restore generates a missing
configuration key for older backups while preserving restored keys.

Uploads run in a bounded parser process; imports and Sheets refreshes have
asynchronous jobs. Publication creates a new immutable data version. Existing
graphs keep their pinned snapshot: update the resource reference and publish a
new graph to adopt a refreshed version. Failed refresh keeps the previous valid
snapshot, subject to the workflow's maximum-age rule. Revoke deletes the source
content and prevents further reads. Results expire after 24 hours; control
history is retained for 30 days, while unresolved effects remain protected.

A dedicated MariaDB account has SELECT only on public phonebook records and CDR.
Queries use prepared parameters, bounded rows/time and linked-call matching.
History numbers must come from the trusted caller/company lookup. The private
adapter uses the module's assigned Apache port, loopback and its API token.
Creation, upgrade and restore provision the credential/grants without logging it.

Restarts and restore interrupt unfinished work, settle running step metadata and
mark dispatched effects unknown. They do not resume calls or retry business writes.

## Runtime delivery

The exact source is `runtime-ref` plus `phase5-runtime.patch`, verified by
`phase5-runtime.sha256`. `prepare-runtime.py` materializes it from an upstream
checkout or fetches that fixed commit. `export-runtime-patch.py` regenerates the
review artifact without modifying repository indexes. Development changes are
therefore available outside the ignored worktree.

`build-images.sh` assembles this source into the Satellite wrapper using the
pinned upstream image in `satellite/Containerfile`. The wrapper replaces upstream
Python source, adds the four ingestion dependencies and records source provenance
in `/app/phase5-source.json`. Full and module-only builds check Phase 5 routes,
templates and the exact patch/ref before accepting a runtime image. The upstream
base's container UID is retained for compatibility with restored 0700/0600 state
volumes; NS8 still runs it under rootless Podman.

This patch is an upstream-review deliverable; it has not been pushed to Satellite
or substituted with a published upstream commit. When upstream accepts it, update
`runtime-ref` and retire the patch/overlay in a coordinated release. The local
image is `nethvoice-satellite:phase5-local`. Test-node overlays use
`localhost/nethvoice-{satellite,freepbx}:phase5-20261005`; they are local test
artifacts, not published release images. The FreePBX overlay recompiles all app
scripts/templates and retains the installed vendor assets. It does not substitute
for a complete FreePBX build from its production Containerfile.

## Acceptance still required

The [test report](phase5-test-report.md) distinguishes local evidence from live
checks. The target PBX, OpenAI binding `1`, controlled caller `201`, read-only
Freshdesk access and dummy Kapa endpoint are configured. The seeded test sheet and
live published Google CSV snapshot are ready; use the [Sheets setup guide](google-sheets-setup.md)
for either public CSV or optional private service-account access. The live secretary uses the approved bounded name matcher (version 7). Controlled
SIP calls completed payment lookup for both a known caller number and an unknown
caller verified by name plus exact resident code. The router also
handed the same caller to the secretary, which completed the workflow. Controlled
consultation calls to operator `202` passed acceptance, native-bridge persistence,
decline and caller resumption. Listen to actual calls for private-audio isolation, exact spoken payment
values, acceptance/decline and native handoff. Verify real account projections,
rate limits, assignee mapping, confirmation and uncertain remote-write handling.

The browser evidence uses the actual Angular/Drawflow views with isolated admin
fixtures. Wizard compiler stages were exercised separately; a complete FreePBX
image build and administrator usability walkthrough remain release checks.
Installed gateway authentication/CSRF tests passed. Repository restore code was covered by database dump/
restore and credential provisioning fixtures, not by an NS8 cluster restore.

Protocol references: [OpenAI Realtime](https://developers.openai.com/api/docs/guides/realtime-conversations),
[Responses function calling](https://developers.openai.com/api/docs/guides/function-calling),
[Freshdesk](https://developers.freshdesk.com/api/),
[Kapa retrieval integration](https://docs.kapa.ai/examples/embed-an-ai-assistant-in-your-app-that-answers-questions-and-takes-actions),
[Sheets service accounts](https://developers.google.com/identity/protocols/oauth2/service-account),
[Asterisk ARI channels](https://docs.asterisk.org/Latest_API/API_Documentation/Asterisk_REST_Interface/Channels_REST_API/).
