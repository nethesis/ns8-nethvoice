# Phase 2 deployment and testing

This records the earlier node-local development deployment. The subsequent
published `agent` image deployment and acceptance results are in
[the CI acceptance report](phase2-ci-test-report.md).

## Target and deployment

- Date: 3 October 2026.
- Host: `makako.sf.nethserver.net`; instance: **nethvoice51**.
- Web UI: `https://voice.makako.sf.nethserver.net/freepbx/admin/config.php?display=satellite_agents`.
- Final coordinated development images: `localhost:55051/nethvoice`,
  `nethvoice-freepbx`, and `nethvoice-satellite`, all tagged
  **phase2-20261003-1251**.
- Deployment used the supported NS8 `update-module` action, with an independent
  zero-channel/zero-call check before each update. Other component images retain
  the installed `cleverai` version. FreePBX and Satellite are active with
  `NRestarts=0` following the final update.
- Built from the exact installed image bases, preserving installed dependencies;
  the new validator is `jsonschema==4.23.0`. Image import checks passed. This is a
  node-local development deployment; no public release or image publication was made.

## Results

| Test | Result | Evidence |
|---|---|---|
| Focused Python runtime suites | PASS | 20 tests: core, providers, voice; includes shared call/tool event ordering |
| Focused PHP suites | PASS | 9 suites: storage/schema/trunks, validation/encryption, provisioning, dialplan, services, Visualplan |
| Existing transcription regression runner | PASS | 13/13, including 4 Agent suites and 9 recording/transcription regressions |
| Visualplan block JavaScript regression | PASS | `agent_block_test.js` exited 0 |
| Coordinated image build/import | PASS | Runtime instantiated; readiness exposed through OpenAPI; asynchronous server lifecycle verified |
| Native schema upgrade | PASS | Satellite 0.2.0 installed; new profile/state/rules storage used successfully on the existing instance |
| SIP baseline | PASS | Controlled registered endpoints 201 and 202 established an answered direct PBX call |
| OpenAI Internal voice call | PASS | Signed public webhook, Realtime accept/sideband, caller/provider correlation, and audio bridge reached `CONVERSING` |
| Company, calendar and directory tools | PASS | Live OpenAI requests produced redacted `tool.start` / successful `tool.end` events for all three tools |
| Native manual schedule override | PASS | FreePBX API set closed override; production calendar evaluator returned `known`, `is_open=false`, timezone Europe/Rome, without scheduled opening/closing claims |
| Basic human handoff | PASS | OpenAI called `telephony.handoff`; extension 202 answered; original caller channel survived; Agent/provider legs disappeared |
| External profile | PASS | Real OpenAI session reached `CONVERSING`; opening-hours tool completed |
| External handoff policy | PASS | Private handoff request on the owned External call returned 403; caller remained `CONVERSING` |
| HTTP and webhook contracts | PASS | All 13 checks passed again on the final cleaned deployment; see below |
| Final build live smoke and monitoring sequence | PASS | Call started/conversing and company tool start/end had sequence 1,2,3,4 in one run |
| Playwright administration | PASS | Wizard login, trunk/profile saves, provider/runtime fields, masked secret, native schedule selection, duration validation, destination create/switch/delete |
| Protected destinations | PASS | Both system rows had zero mutation controls; local repository deletion rejection passed without changing configuration |
| Playwright Visualplan | PASS | Production graph and canvas loaded with visible Agent palette; no JavaScript errors |
| Responsive administration | PASS | Destination page at 1440/768/390 px; all four tabs also checked at 390 px without horizontal page overflow |
| Agent restart / periodic rehydration | PASS | Failed closed until periodic sync; automatically returned to ready/configured/ARI connected at revision 19, with no sync error |
| Cleanup | PASS | Zero active calls/channels; clients, temporary routes/calendar/rules, synthetic profile context, audio and captured SIP credentials removed |

### Live HTTP checks

- Missing and invalid private API authentication: 401.
- Readiness true; four tool manifests advertised.
- Identical configuration retry: 200; lower revision: 409; hash mismatch: 400.
- Unknown call: 404.
- Public webhook GET: 405; unsigned POST: 401; oversized POST: 413.
- Correctly signed unowned event: ignored without creating a call.
- Tampered original signed body: 401.

## Call evidence

The controlled Internal handoff run was `MdbT4dSuBYAS-VpPc0zz7mOG9n2iaC4e`.
Caller channel `PJSIP/201-00000002`, linked ID `1791024226.4`, remained in the
human bridge with `PJSIP/202-00000004` after terminal outcome `handed_off`.
There were no Local or AgentTrunk channels remaining in that human bridge.
CDR showed two answered segments for that caller: Stasis, 165 billed seconds;
native Dial, 64 billed seconds. CEL included 3 bridge enters, 3 bridge exits,
2 hangups, 2 channel ends, and a linked-ID end.

External linked ID `1791024474.9` had an answered Stasis segment, 75 billed seconds.
The final build's live smoke run `QJ6USOXKCdtcjDrnQPDhgVxcP7rwxfdS` verified a
single ordered call/tool sequence with a successful company tool invocation.

Synthetic received-audio evidence: 232.02 seconds at 8 kHz, peak amplitude
14,460, 48,458 samples above amplitude 1,000. RTP flowed in both directions.
This verifies received audio and tool execution; no automated semantic scoring
of spoken responses was performed. Temporary WAV files were removed.

## Fixes found during testing

1. Preserve the supplied canonical `/freepbx/satellite/index.php` webhook and
   accept `/satellite/index.php` as a compatibility alias.
2. Use the native `ext_stasis(application, arguments)` constructor. Passing
   everything as the application added a trailing empty argument and prevented admission.
3. Use Asterisk `CHANNEL(endpoint)` for authenticated internal provenance;
   `CHANNEL(pjsip,endpoint)` is unsupported on the installed Asterisk.
4. Reinstall the bundled Satellite module idempotently during FreePBX startup
   to run migrations on an already-enabled installation.
5. Start an initially disabled Satellite service after the convenient PBX
   restart, avoiding overlapping first-start and restart operations.
6. Share the event sink between the runtime and default tool registry so each
   run has one observation sequence.
7. Adjust image import validation for the installed FastAPI router representation.

The SIP test harness needed a persistent null-audio clock and the installed
`audio conf_con` / `audio conf_dis` commands. The initial test-number attempt
was blocked by the existing CTI calling context, which excludes Miscapps.
Agent tests therefore used native Asterisk origination to the controlled PJSIP
endpoint followed by the production Agent destination. No calling permissions
were broadened.

## Final configuration and cleanup

This section records the state at the end of Phase 2 deployment testing.
Subsequently, the requested sample company was configured in both profiles and
its company tool enabled. See the
[sample company acceptance case](sample-company-test-case.md) for current data,
permissions and verification results.

The user-supplied OpenAI project/signing binding is retained as **OpenAI Phase2**,
with both profiles selecting it. API keys and signing secrets are excluded from
this report. Profile prompts, language and other settings were restored from the
pre-test snapshot; synthetic business facts, directory visibility and calendar
mappings were removed. All permissions are `deny` and tools disabled.
Company details, real opening-hours services and approved human targets should
be configured before business use.

Final configuration revision **19** is acknowledged with hash
`56dd102a9522aee7895ae1dffc7cb99392b9c9bd1f5e8c74925bbd4bbefb3ec9`.
Readiness is true, ARI connected, sync error empty and active Agent calls zero.
Persisted Agent state contains only revision, payload hash and replay receipts.

The protected Internal and External system destinations remain available.
No permanent inbound/PSTN route was assigned during testing.

Rollback artifacts are protected on the host under
`/var/tmp/nethvoice51-phase2-20261003/rollback`: original module state,
MariaDB dump, AstDB and pre-test profiles. Original image aliases are retained
under `localhost/phase2-rollback/*:before-20261003`.
The loopback-only registry on port 55051 is retained for this development deployment.

## Limits and existing warnings

- Grok has local adapter/policy coverage, but no live Grok binding was supplied;
  its provider calls were not tested.
- PSTN/public SIP ingress and NethVoice Proxy traversal were not tested; live
  Agent calls used controlled direct PBX endpoints.
- Full NS8 backup restoration was not executed. Restart and fresh configuration
  rehydration are the tested recovery path.
- Existing FreePBX unsigned-module/default-ARI notices and missing upstream
  `/admin/images/` assets remain. Phase 2 pages showed no JavaScript exceptions.
- The optional legacy Satellite PostgreSQL service is disabled on this instance;
  legacy Satellite/Middleware database initialization logs connection failures.
  Built-in Agent readiness and calls work independently of it with transcription disabled.
- Successful terminal handoff emitted a cancellation/ambiguity tool observation
  during cleanup; the authoritative call outcome and PBX evidence were `handed_off`.
  Later monitoring should display the terminal call outcome alongside tool observations.
- Automatic approval review rejected a live delete request against a protected
  system destination. That destructive negative test was not executed; read-only
  UI checks and local deletion-rejection coverage were used instead.

## Commands and screenshots

Validation commands:

```sh
# Satellite worktree, isolated validation environment
python -m pytest -o addopts='' -q tests/test_agent_core.py tests/test_agent_providers.py tests/test_agent_voice.py
# Main repository
php freepbx/var/www/html/freepbx/admin/modules/satellite/tests/run_transcription_tests.php
node freepbx/var/www/html/freepbx/admin/modules/visualplan/tests/agent_block_test.js
```

[Desktop screenshot](test-evidence/phase2-destinations-desktop.png) ·
[Mobile screenshot](test-evidence/phase2-destinations-mobile.png)
