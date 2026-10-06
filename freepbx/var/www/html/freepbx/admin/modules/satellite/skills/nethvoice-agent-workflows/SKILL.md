---
name: nethvoice-agent-workflows
description: Create agent trunks, configure NethVoice Satellite workflows from user requirements, and test their behavior. Use for the visual agent builder and its call-router, support or payment workflows. Test with mocks first; obtain user confirmation before final OpenAI end-to-end tests.
---

# NethVoice agent workflows

Deliver a configured agent, evidence for its tested behavior, and instructions
that let the user repeat the test and find its results. Work on the requested
PBX and workflow only. Use the existing administrator interfaces; do not edit
database rows, generated SIP trunks or generated dialplan directly.

Read [workflow operations](references/workflow-operations.md) when you need page
paths, API contracts, mock fixtures or expected results. Treat installed block
manifests and the current source as the authority for fields and capabilities.
Use the related NethVoice testing/admin skill, when available, for live SSH/SIP
operations. This skill's OpenAI test gate still applies.

## Create the provider trunk

Ask for missing setup data in small batches. Reuse data and authorization already
supplied for this task. Do not ask the user to repeat credentials.

- PBX URL and module ID, administrator access, workflow name and entrypoint.
- Provider and runtime owner. These workflows require the built-in Satellite
  runtime; a CleverAI-owned trunk cannot execute this graph.
- For OpenAI voice: project ID, project API key and webhook signing secret.
  Ask whether the project webhook is configured; use the exact URL shown by
  the PBX Webhooks page. Do not invent a webhook URL or create a new cloud project.
- For another supported provider, obtain its actual trunk fields from the form.
  Do not substitute an OpenAI project ID for a provider-specific phone number.
- Data source, service URLs, integration credentials and required field mappings.
  Use a small representative sample to resolve data questions.

Prefer an existing credential ID or entry through the password/credential form.
If the user supplies a secret, use it through the supported secret interface and
do not repeat it. Keep secrets out of graph JSON, commands, logs and reports.
If secure input or administrator access is missing, explain the exact setup
step the user must perform. Continue work that does not require that access.

Inspect existing agent trunks. Reuse the intended compatible trunk, or create
one from the user's credentials and provider data through **Agent Trunks**.
Set the built-in runtime owner. Store the webhook signing secret through
**Webhooks**. Keep the trunk/binding ID for the workflow's provider selection.
Do not replace unrelated trunks or routes. Apply the supported configuration
sync and check local configuration status. A local check does not prove that
the API key or remote webhook works. Do not contact OpenAI to test them yet.

## Define and configure behavior

Converse with the user about the behavior, rather than asking them to author
graph JSON. Establish the following details that affect their workflow:

- What starts it, which callers can use it, and what a successful call does.
- Data to retrieve, lookup keys, required freshness and handling of missing or
  ambiguous records. Determine who may receive private information.
- What the agent asks and says, language, permitted tools and destinations.
- Changes to external systems, exact confirmation rules and failure behavior.
- Fallback destination, opening hours and transfer behavior where relevant.

Summarize the proposed behavior and the remaining decisions. Use a small Mermaid
diagram if it clarifies branches. Resolve required policy decisions before you
enable their dependent actions. Continue drafting independent parts meanwhile.

Create a draft from the closest template or a blank graph. Configure typed inputs,
named outcomes, prompts, grants and fallback branches. Read published operation
schemas; selecting a connector does not grant it. Keep writes in explicit action
nodes, with confirmation of the exact arguments. Do not offer arbitrary SQL,
code or shell blocks.

For common workflows:

- **Router:** obtain the allowed PBX objects and agents. New targets start
  disabled. Configure per-type defaults, per-object overrides and delegated tools.
- **Support:** map caller/company lookup, answered-call history, Freshdesk contact
  and tickets, responder IDs to PBX extensions, and Kapa documentation. Keep the
  user's read-only limit if one exists. Both ticket creation and urgency changes
  require caller confirmation. Require operator acceptance for consultation;
  decline or no answer must return to the caller.
- **Payment:** map resident, phone, month, amount, currency and verification code.
  A unique caller-number match may identify a resident if the user permits it.
  Unknown/shared numbers need the configured verification. Names alone do not
  authorize disclosure. Agree any similar-name rule; preserve exact codes and
  reject ambiguous matches. Read the stored amount without recalculating it.

Preview and publish required data/connector versions. Pin those versions in the
graph. For Sheets, distinguish a published Google CSV URL from private access
with a viewer service account. Save the draft, validate it and record its revision.
Fix validation failures; do not invent missing integration mappings. Verify the
saved configuration, not only the request you intended to send.

Saving a draft does not change the active version or reload the PBX. Publishing
selects the new active version and keeps the current enabled state. Agent
publication reconciles the PBX binding and starts a dialplan reload when it
changes. Check returned PBX sync status before a call. Pending binding sync is
retried by the one-minute timer; do not treat publication alone as readiness.

If the stored graph validates through the private API but Wizard reports an
invalid draft or schema, check the gateway's JSON round trip. Empty node config,
inputs and schema properties must remain objects; lists must remain arrays.
Repair the gateway instead of changing valid graph fields. Reload the editor
after that repair, then verify save, validation and publication again.

## Test without OpenAI first

Use **Run mock** or the workflow `/test` endpoint with synthetic fixtures.
The test must not use OpenAI, including Responses, Realtime, credential probes
or TTS to generate caller speech. Do not dial a live provider-backed destination
as an offline test. Mock connector reads/writes and PBX effects as well.

Test each required success branch and its important failure/denial branches.
Use the operation schemas for fixture outputs. Supply normalized table fixtures
for deterministic payment checks. The current editor form supplies conversation
fixtures only; use the authenticated test API for table and other block fixtures.
Missing fixtures are not evidence that the integration works.

Record `test_mode: mock`, terminal status, relevant node outcomes and unmet checks.
Verify that wrong/ambiguous identity cannot disclose a payment, denied writes
cannot execute, and failed transfers reach the intended fallback. Use isolated
provider emulators for protocol checks when needed; they are still not a live test.
Mock output is shown in the test response/editor, not a persisted live run page.

## Ask before the final OpenAI test

After offline checks pass, show their result and ask for explicit confirmation
of the final end-to-end OpenAI test. State the PBX, workflow/version, provider,
caller/operator endpoints, call count or duration bound, data used, expected
result and permitted external writes. Explain that this test sends call data to
OpenAI and can incur charges. Keep a read-only test read-only.

Wait for the answer. Silence is not consent. An earlier setup authorization or
a past version's live test does not approve this test. If the user already
explicitly approved this same final test scope after seeing its offline results,
honor that approval without asking again. If they decline, deliver the offline
result and manual instructions; do not run the live test.

For an approved voice test, publish the validated graph, enable its version and
wait for PBX sync/readiness. Use only the authorized test route and endpoints.
If the user selected another provider, keep that provider; do not switch to
OpenAI for testing. Obtain the same concrete approval for its final live test.
Check call state before changes that can affect active calls. Verify both caller
audio and run metadata: a completed trace alone does not prove correct speech or
private consultation audio. Observe uncertain writes/transfers; do not replay them.
Stop at the approved test bound and report failures before further live attempts
outside that scope. Stop owned test calls/clients and remove their temporary
credentials. Leave no new recording or debug capture enabled.

## Give repeatable user instructions

End with the workflow ID, published version, trunk/binding and data references,
what passed, and what remains untested. Give concrete instructions to place the
test call or submit the API input, what to say, and any DTMF confirmation needed.
Give the expected reply/transfer and exact expected terminal/node outcomes.

Use the user's actual HTTPS PBX origin in links. Link the editor, run history,
and, after a real test, the actual run detail and pinned graph trace. For handoff,
give both parent and child runs. Do not fabricate a run ID or mark a mock as live.
Explain where to check fallback/error codes and which result proves each claim.
Do not promise a transcript if capture was off. List any remaining mapping,
credential, data or acceptance input with the next concrete step.

When this branch changes agent setup or testing, update the affected sections of
`satellite/README.md` and this skill together. Use mostly short, active sentences
in the human instructions. Keep unrelated documentation unchanged.
