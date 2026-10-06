# Workflow operations

Use these paths with the actual PBX origin. Check the installed UI and manifests
before applying a contract from a different release. Do not embed test-instance
credentials, extensions or data into a reusable skill.

## Setup and result pages

| Purpose | Path |
|---|---|
| Agent trunks | `/freepbx/admin/config.php?display=satellite_agents&tab=trunks` |
| Webhook URL and signing secret | `/freepbx/admin/config.php?display=satellite_webhooks` |
| Workflow catalog | `/freepbx/wizard/#!/agents/build` |
| Agent editor | `/freepbx/wizard/#!/agents/build/agent/{agent_id}` |
| Reusable block editor | `/freepbx/wizard/#!/agents/build/subflow/{agent_id}` |
| Credentials and connector versions | `/freepbx/wizard/#!/agents/connectors` |
| Data sources | `/freepbx/wizard/#!/agents/data` |
| History and configuration status | `/freepbx/wizard/#!/agents` |
| Live run metadata | `/freepbx/wizard/#!/agents/runs/{run_id}` |
| Pinned graph and node trace | `/freepbx/wizard/#!/agents/graph-runs/{run_id}` |
| API clients | `/freepbx/wizard/#!/agents/api` |

OpenAI voice trunks use a project ID of the form `proj_...`, the project API key,
and built-in runtime ownership. The form generates the OpenAI TLS SIP server
configuration without SIP registration. The signing secret is set on the separate
Webhooks page. Do not request SIP digest credentials for an OpenAI trunk.
Use separate provider projects or numbers for different runtime owners. Do not
reassign a CleverAI project's webhook to Satellite to make a graph work.

A voice graph selects that trunk through `provider_binding_ref`. An API graph
uses its explicit `text_provider` model and encrypted credential reference;
a SIP trunk is not required for an API-only workflow. Graphs do not contain keys.
Restore preserves configuration keys and supplies missing keys for older backups.
Clone rotates native trunk ciphertext into its new key, excludes application
state/history and disables copied workflow destinations. Recreate the missing
definitions/resources before enabling them. Reusable blocks are bounded by
their own graph deadline and the remaining parent deadline.

## Supported API surface

The authenticated administrator prefix is
`/freepbx/rest/agents/application/workflows`. Obtain the existing administrator
session and CSRF token through its normal interface. Do not forge session cookies
or place tokens in shell arguments. Mutations require CSRF.

For an authorized SSH operation, the private Satellite prefix is
`/api/agent/v1/application/workflows`. It requires the module bearer token and
`X-Agents-Actor`. Discover the allocated HTTP port from module state. Keep the
private token inside the process; never print the full module environment.
Use `runagent -m <module>` for NS8 operations. Do not expose a private endpoint.

| Method and suffix | Relevant body or result |
|---|---|
| `GET /inventory` | Definitions, drafts, revisions, published/active versions, bindings, routing objects and safe operation/block schemas |
| `GET /catalog` | Templates, block manifests and connector presets |
| `PUT /definitions/{agent\|subflow}/{id}` | `{definition, expected_revision}`; revision 0 creates a draft |
| `POST /validate` | `{definition}`; checks graph and current references |
| `POST /test` | `{definition, fixtures, input, caller, tables?, destinations?}`; returns `test_mode: mock`, `status`, `result`, `trace` |
| `POST /definitions/{kind}/{id}/publish` | `{expected_revision}`; returns immutable version, new revision and PBX sync for an agent; keeps enabled state and reloads changed PBX bindings |
| `POST /definitions/{kind}/{id}/activate` | `{version, enabled, expected_revision}`; voice activation also reports PBX sync |
| `GET /runs/{id}` | Pinned definition and safe steps; excludes result content |
| `POST /runs/{id}/cancel` | Cancels the requested workflow; a voice call uses its fallback |

Use returned revisions for the next write. On a conflict, reload and compare the
user's draft; do not overwrite it blindly. Re-read the saved draft and published
version to verify provider selection, grants, resource versions and identity rules.
Do not call `/agents-api/v1/runs` for a mock: it executes a real published API run
and may contact OpenAI or integrations.

Repository sources for details:

- `satellite/workflow-api-contract.md`: graph and administrator API contract.
- `satellite/phase4-api-contract.md`: credentials, connectors and machine clients.
- `satellite/monitoring-api-contract.md`: run history and capture policy.
- `satellite/google-sheets-setup.md`: published CSV or private viewer credentials.
- `satellite/tests/test_workflows.py`: normalized synthetic tables and branch tests.
- Module-relative `views/agent/trunks.php` and `views/agent/webhooks.php`: provider fields.
- `freepbx/wizard-ui/app/scripts/app.js`: installed Wizard route definitions.

## Mock fixtures and coverage

A fixture is keyed by the actual node ID, not the block type:

```json
{
  "period": {"outcome": "success", "output": {"period": "2026-10"}},
  "ask_identity": {
    "outcome": "success",
    "output": {"name": "Example Resident", "resident_code": "0042"}
  }
}
```

Use the selected graph's declared outcome and output schemas. Fixtures can replace
connector, PBX or consultation nodes through the API. Keep logic and identity
checks deterministic when those checks are the subject of the test.

For payment tests, `tables` is keyed by resource ID. Each table has normalized
`rows`, `created` (current Unix seconds) and `metadata.country_code`. Generate
rows through the runtime ingestion helper with synthetic CSV and the selected
mapping; do not invent indexes or use an original file as normalized rows.
The editor does not currently expose table or arbitrary-block fixture fields.
Use the test API for those cases. `table_fixture_required` means a test input
is missing, not that the live source is broken. Missing conversation fixtures
produce `conversation_fixture_required`; mock testing never falls back to OpenAI.

| Workflow | Required offline checks | Expected evidence |
|---|---|---|
| Router | Allowed PBX/agent choice, disabled target, ambiguous request and no match | Chosen permitted ID follows its branch; absent/disabled choices cannot route and use fallback |
| Payment | Unique phone, unknown/shared phone with correct code, wrong code, ambiguous name, missing month and stale data | Success finds only the verified resident's exact amount; denial/stale/missing cases cannot disclose another record |
| Support | Existing ticket, new issue, urgency, confirmation decline, missing assignee, documentation failure | Scoped context follows the right branch; denied/unconfirmed actions cannot write |
| Consultation | Accept, decline, busy, no answer and caller disconnect | Accepted outcome hands off; unavailable/declined returns to the configured caller fallback |

For voice mock tests, an explicit `action.confirm` fixture can cover confirmed
and declined branches. This simulates caller confirmation only. It grants no
permission for a real write. Connector/transfer fixture success proves graph
control flow, not remote effects, protocol/media behavior or provider availability.

## Final test request and user handover

After offline checks, ask a concrete question such as:

> Offline payment success and denial checks passed. May I run one OpenAI voice
> test on your selected PBX and published version, from the reserved caller,
> using the synthetic payment row? It will send call data to OpenAI and can incur
> charges. No external business writes are included. Expected: verify the unknown
> resident, read the stored amount, and complete the call.

Replace each descriptive value with the actual agreed PBX, version, endpoints,
time bound and test data. If writes are part of the test, name the exact sandbox
effects and their caller-confirmation steps before asking. If the answer is no,
stop before provider calls and give instructions for a later user-run test.

For a published payment test, tell the user which test route to call, the month,
and the name/code that every caller must supply securely. Expected trace:
`identify: known` or `identify: unknown`, then `verify: verified`; next
`payment: found`, `answer: success`, terminal `completed`. Check the spoken
month, currency and amount against the test row, not only the terminal status.

For a managed-agent router handoff, expect parent `handed_off`, the selected
child agent's run and its own terminal result. For a PBX transfer, verify the
actual endpoint receives the caller. For consultation, the caller must not hear
the private summary; the operator presses DTMF 1 to accept or 2 to decline after
the summary. On decline/no answer, verify the caller resumes the fallback branch.

Link the history and actual run/graph pages. Name expected nodes and errors for
each scenario. If no live run exists, say so and link the editor's mock trace
instead. Transcripts require capture to have been enabled; do not enable capture
just to obtain a result when audio/run metadata suffice.
