# Phase 5 verification

Date: 5 October 2026. The visual builder, block library, workflow runtime,
sample graphs and NS8/FreePBX integration are implemented. Test overlays are
installed on the owner-authorized `nethvoice51` instance at
`voice.makako.sf.nethserver.net`. Live acceptance remains partial. No release
image, upstream commit or registry publication was made.

## Reproducible source

The Satellite source is upstream commit
`77592a76e9e17dac063aacb1731e57d26fc6eac2` plus
[`phase5-runtime.patch`](phase5-runtime.patch). Its SHA-256 is
`098c55138d68e412ea36f1cf70c6b1bb759cf6296959085342865638e2875745`.
`prepare-runtime.py` checks the checksum and patch applicability before assembling
source; the wrapper records the same provenance in `/app/phase5-source.json`.
The delivery does not depend on retaining the ignored development worktree.

## Local checks

| Check | Result and scope |
|---|---|
| Workflow contracts, execution, provider and voice tests plus existing native-agent regressions | **72 passed**, 101.42 seconds; 15 dependency deprecation warnings. Includes 37 Phase 5 tests and 35 existing tests. |
| PostgreSQL repository and complete database dump/restore | Passed. Draft conflicts, immutable publications, encrypted originals/results, asynchronous ingestion, source revocation, pinned subflows, scoped/idempotent API execution, disabling revoked workflows; restored unfinished work interrupts and dispatched effects remain unknown without replay. |
| Isolated MariaDB/FreePBX fixtures | Passed. Additive schema upgrade, stable destinations, reconciliation, API-only disablement, identity/fallback protections, public company phonebook and linked answered CDR scope, prepared inputs and SELECT-only grants. |
| Existing Phase 4 application acceptance | **27 passed** in the built wrapper with a disposable PostgreSQL database. Cross-client result/run access retains its original 404 behavior even without a workflow service. |
| Existing PHP transcription fixtures | **14 passed**. Fixture-only warnings require no live database. |
| PHP, shell and diff checks | Changed PHP files parse; changed shell scripts parse; `git diff --check` passes. |
| VisualPlan regression | PHP graph/render checks and the actual browser regression pass. |
| AngularJS/Drawflow browser checks | Actual views, controller, schema forms and editor adapter pass with isolated administrator fixtures in English/Italian at widths 1440 and 390. Save, validation, list editing, undo, safe labels, teardown/logout and 100-node rendering exercised. No browser errors or horizontal overflow; three large-graph renders each below three seconds. |
| Wizard compiler | Grunt compiles all application scripts and HTML templates. The FreePBX overlay retains installed vendor assets; a full production Containerfile build remains a release gate. |
| Container import/provenance guard | Workflow routes, all three template schemas and source provenance verified in the assembled wrapper. |

Example commands, from the repository root:

```sh
satellite/prepare-runtime.py /tmp/phase5-source --source /path/to/satellite
PYTHONPATH=/tmp/phase5-source python -m pytest -o addopts='' -q \
  satellite/tests/test_workflows.py satellite/tests/test_workflow_voice.py \
  satellite/tests/test_workflow_provider.py
SATELLITE_SOURCE_DIR=/path/to/satellite PHASE5_PYTHON=/path/to/venv/bin/python \
  satellite/tests/run-workflows-database.sh
satellite/tests/run-workflows-pbx.sh
PYTHONPATH=/tmp/phase5-source PHASE5_UI_LIBRARIES=/path/to/ui/node_modules \
  python satellite/tests/test_workflows_browser.py
```

These checks require the runtime dependencies; database fixtures require Docker,
PHP PDO MySQL and cached test images. Browser fixtures require Playwright, Chrome,
AngularJS, angular-translate and Bootstrap. The executable tests and fixtures are
in [`tests`](tests); they use synthetic data rather than business credentials.

Browser evidence:
[English desktop](test-evidence/phase5-editor-en-1440.png),
[English narrow](test-evidence/phase5-editor-en-390.png),
[Italian desktop](test-evidence/phase5-editor-it-1440.png),
[Italian narrow](test-evidence/phase5-editor-it-390.png).

## Authorized live checks

Caller `201` and operator `202` were explicitly authorized. Synthetic caller IDs
and generated fictional speech were used; incoming audio was not recorded and
transcript capture was not enabled for these tests. No unrelated extensions or
PSTN destinations were called. Freshdesk was explicitly restricted to read-only
checks. Credentials were read internally from protected state and never included
in source artifacts or reports.

| Check | Evidence / boundary |
|---|---|
| Installed Wizard gateway | Authenticated access/inventory 200; anonymous request 403; missing CSRF 403; invalid graph 422. |
| Freshdesk | Real authenticated GET succeeded; ticket list/projection shape checked without printing customer records. No ticket creation or priority change. |
| Kapa | Dummy HTTPS endpoint through the actual bounded connector transport returns one synthetic documentation item. This does not establish a real Kapa integration. |
| Published Google CSV | The owner-provided URL imports six seeded fictional rows through verified TLS and bounded Google redirects. Encrypted payment snapshot version 2 is pinned by the secretary; hourly refresh is configured. No Google credential is needed for this published source. |
| Known payment caller | Real OpenAI/SIP workflow: unique caller-number identity, month collection, scoped payment lookup and answer complete successfully. Human listening to confirm the exact spoken amount remains open. |
| Unknown payment caller | Exact-name speech attempts denied the mismatched name safely. With approved bounded matching verified in published version 7, the live unknown-caller workflow collects name/code, verifies the unique resident, collects the month, finds the payment and completes its answer. Exact-code, invalid-code and ambiguous-name denial also pass deterministic tests. |
| Consultation acceptance | Controlled 201 → 202 call accepts DTMF 1 and reaches native Bridge. The answered caller stays Up in Bridge for 35 seconds, beyond the consultation holding timeout, before controlled cleanup. |
| Consultation decline | DTMF 2 returns to the caller, executes the configured resumed conversation and completes with no orphan channels. |
| Consultation unavailable | Unavailable/self-busy and missing acceptance take the unavailable branch, resume the caller and complete. Busy/no-answer, hangup and race variations also have isolated voice coverage. |
| Agent handoff | Live router selects the payment agent and reaches `handed_off`; the child secretary completes identity, month, lookup and answer. Source/emulator tests also cover retaining the original caller and reduced permissions across replacement provider legs. |

The protected test configuration contains the enabled router and payment
secretary, provider binding `1`, encrypted read-only Freshdesk credentials and a
dummy Kapa connector. The full customer-support template is saved as a draft;
it is intentionally not enabled against the read-only live connector. Writable
operations, customer/assignee mapping and a controlled Freshdesk caller must be
configured for its full business acceptance.

The router parent and completed payment child have a persisted parent/child run
link. Final runtime readiness reports `ready: true`. The scratch consultation/
collection workflow is disabled after testing. Final cleanup verified zero active
channels/calls and removed owned SIP clients and their protected temporary
configuration/audio directories.

The test SIP harness requires continuous silent RTP (`--no-vad`) so Realtime VAD
can finish a collected turn. Workflow voice VAD uses a one-second pause. Safe
conversation diagnostics count responses/completions without recording their
arguments or identity values. Automatic approval review rejected an identity-value
debug read; it was replaced with terminal-step metadata. A separate rejection of
relaxed name matching was resolved by the owner's explicit approval.

## Test deployment and rollback

Verified test image IDs:

- Satellite: `1d2e8f493ef7a5d4adaf874448eee9a51fc9b4e0c0c65f0104f4d19814ecb9bf`.
- FreePBX overlay tag: `8e5b687a9a44f13daa7e342e1c5861b1233706e9d117f79ffb3c156d621b109f`.
- Installed compiled Wizard script SHA-256:
  `eb56806599c5593f14e8b10f18bdfc03ab1c891f242b23e5343dc17d4899747c`.

Local test tags are `localhost/nethvoice-satellite:phase5-20261005` and
`localhost/nethvoice-freepbx:phase5-20261005`. User-unit launch overrides select
these tags; the module's configured registry image references remain intact.
Satellite updates and the initial FreePBX deployment passed a zero-call gate.
FreePBX startup also recreated its dependent reports/Tancredi containers. Installed
compiled Wizard assets were updated and checked against the overlay artifacts.

Protected staging is `$AGENT_STATE_DIR/phase5-20261005`. It includes the original
image manifest, FreePBX source snapshot tag, launch overrides and database backups
(`satellite-before.dump`, `asterisk-before.sql`, `passwords-before.env`). These
files contain private application state and must remain protected. Deployment
was performed through `runagent -m nethvoice51`.

The staged `deploy.py rollback` helper checks zero calls and unchanged launch
overrides, restores the original Satellite image and the pre-test FreePBX source
snapshot, then restarts the services. It retains subsequent data and additive
schema; it is an image rollback, not a tested full NS8 restore. Disable/reconcile
Phase 5 custom destinations through the current supported interface before
running an image rollback. Do not restore the older dumps over newer business
state without a separate recovery decision. Rollback was prepared but not run.

## Acceptance still open

- Human listening for exact payment values and private consultation audio
  isolation. Known and unknown residents passed generated-speech SIP calls.
- Router live PBX destination selection and real external-origin behavior. Managed-agent selection/handoff passed.
- Full support workflow with a controlled contact, assignee/extension mapping,
  caller confirmations and writable Freshdesk sandbox. Live writes remain outside
  the owner-authorized read-only tests.
- Real Kapa contract/account verification; the dummy API is the selected test setup.
- Administrator walkthrough building all samples entirely through the installed
  UI, full production FreePBX/module build and upstream publication.
- Complete NS8 restore and realistic concurrent-call/load acceptance.

Local fixtures and successful controlled calls do not close these separate gates.
