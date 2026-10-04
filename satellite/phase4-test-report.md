# Phase 4 local verification

4 October 2026. **Local source checks pass; release/live integration acceptance
remains open.** No production database, OpenAI credential or business endpoint was
used. Application tests use disposable PostgreSQL, an ephemeral local HTTPS
server and deterministic provider/business fixtures. Browser services are fixture
implementations; screenshots contain synthetic values only.

Runtime packaging has since moved to Satellite branch `agent`; see the
[transfer report](transfer-test-report.md) for subsequent upstream tests,
publication and live read-only browser checks. The original source assembly
results below describe the earlier local verification.

## Results

| Check | Result and scope |
|---|---|
| Packaged source assembly | PASS — archive `runtime-ref`, apply Phase 3/4 patches, copy overlay; same assembly as the image build |
| Phase 4 application suite | PASS — 27 checks using PostgreSQL 18; admission, effects, revocation, cancellation, recovery, quotas, encryption, scopes, transport and Responses fixture |
| Full inherited runtime suite plus voice regression | PASS — 119 passed, 1 skipped, 281 baseline deprecation/mock warnings; 49.27 seconds |
| Caller hangup during connector loading | PASS — separately rerun after final fixture adjustment; no call ownership/provider originate remains |
| Runtime import/OpenAPI guard | PASS — application module and `/agents-api/v1/runs` resolve in cached image dependencies |
| Phase 3 monitoring acceptance | PASS — 14 checks, including 100,000-run pagination (0.019 seconds), policy/expiry/recovery and newer schema rejection |
| PHP existing transcription/module checks | PASS — 13/13 transcription runner plus save-services checks; expected fake-database error logs |
| PHP application gateway | PASS — allowlist, placeholder rendering (including Slim regex braces), path/header rejection |
| English/Italian browser forms | PASS — real Angular 1.8.3/translate 2.13 templates/controllers at desktop 1280 and mobile 390; form payloads, credential token clearing, page errors and horizontal overflow |
| Static checks | PASS — Python compilation, PHP syntax, JavaScript syntax, locale JSON and whitespace checks |

The full runtime suite ran against the cached Satellite dependency image
`sha256:ab37eb3be709684611c881f3de0dcc1b770b4fe926fdb2e4bbc84beb71d32de6`
with the new assembled source mounted read-only. This is not a new published
Phase 4 image. The isolated database image is
`pgvector/pgvector@sha256:2fd905ba95f99a51be207d0ff0b8d5b8538cbce7e9083b3ccfa65b93bb28b938`.

## Verified application scenarios

Concurrent same-key admission returns one run; a changed body conflicts. Different
model invocation IDs share one ticket effect. Ambiguous writes and malformed
success responses remain unknown and never retry. Receipt reconciliation performs
one GET, commits a validated receipt and does not repeat the POST. Cancellation
preserves effect evidence, including administrator cancellation/audit attribution.

Separate client tokens enforce scopes/customer IDs and owned results. Private
administrator requests require the internal bearer and actor; unconfirmed write
tests are denied before outbound calls. Secrets are immutable, purpose-bound
encrypted and revocable. Live grant/version revocation prevents connector calls.
Exact tool-version selection when two versions are granted, multi-line preset
instructions, no-ARI execution, result expiry, restart and orphan recovery, encrypted-snapshot
capacity accounting, bounded audit history and default-disabled clone state pass.
The NS8 clone itself is not exercised by the repository helper test.

Network tests cover IPv4/IPv6 policy, all-answer DNS rejection/revalidation, encoded
path mapping, schema/media/body/nesting bounds and response projection. A real
local TLS fixture verifies certificate rejection, a separately trusted test CA,
redirect rejection, oversized/incorrect-media/compressed response rejection. The
intentional invalid-certificate handshake logs a server ConnectionResetError;
the assertion passes and production TLS verification is not relaxed.

The Responses fixture verifies stateless request construction, output/reasoning
replay, call-ID result matching, structured output and observed operation evidence.
It does not prove a selected OpenAI model accepts these requests or meets the
business task. Browser tests compile the actual Angular forms and inspect their
payloads with mocked services; they do not substitute for installed middleware,
CSRF, login or routing acceptance.

## Repeatable checks

From the repository root, with Docker and the pinned dependency images available:

```bash
satellite/tests/run-application-acceptance.sh
php satellite/tests/application_gateway_test.php
```

The current application runner archives a supplied `SATELLITE_SOURCE_DIR` at
`SATELLITE_ACCEPTANCE_REF` (defaults to HEAD in the ignored agent checkout), creates its own network/database and removes
both on exit. It waits for the final TCP listener, avoiding PostgreSQL's temporary
initialization socket. Tests refuse database execution unless the isolated
hostname and explicit test flag are present. Never point them at an installed DB.

For browser checks, install Playwright in an isolated Python environment, and
Angular 1.8.3, angular-translate 2.13.0 and Bootstrap 3.3.7 into a temporary
`node_modules` directory. Use an installed Chrome executable:

```bash
python satellite/tests/test_application_browser.py --libraries /tmp/ui-fixture/node_modules --browser /usr/bin/google-chrome
```

The caller regression imports the inherited `test_agent_voice` fixture; run
`test_application_voice.py` with the assembled runtime's `tests` directory in
`PYTHONPATH`, alongside the inherited suite. Import verification uses
`api.app.openapi()['paths']` because the dependency image's FastAPI uses lazy
included routers.

Evidence: [connectors desktop](test-evidence/phase4-connectors-en-desktop.png),
[connectors mobile](test-evidence/phase4-connectors-it-mobile.png),
[API desktop](test-evidence/phase4-api-en-desktop.png),
[API mobile](test-evidence/phase4-api-it-mobile.png). All eight locale/viewport
screenshots are retained in `test-evidence/`.

## Still open

Actual business API/sandbox definition and acceptance; live approved OpenAI
model/account checks; coordinated image build/publication/deployment; installed
Wizard authentication/CSRF and HTTPS route isolation; concurrent voice/API sizing;
full NS8 backup/restore/clone. Carry forward the Phase 3 and Phase 2 release gates
in [phase4-development.md](phase4-development.md). No live acceptance is inferred
from fixtures and no production service was restarted or enabled in this phase.
