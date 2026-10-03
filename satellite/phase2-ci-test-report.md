# Phase 2 CI deployment and acceptance report

Target: `nethvoice51` on `makako.sf.nethserver.net`, 3 October 2026.

## Published and deployed source

- NethVoice source: `3dad77156f37ac65e875f1cb412f6897b0be8416`, branch `agent`.
- Satellite source: `d8e2b5845c64273df644d54486bb7222274b47bc`, branch
  `feat/satellite-agent-phase2` in `nethesis/satellite`.
- [Coordinated image CI](https://github.com/nethesis/ns8-nethvoice/actions/runs/37122255570): passed.
- [Satellite CI](https://github.com/nethesis/satellite/actions/runs/37122234352): passed.
- [PHP 8.2 compatibility CI](https://github.com/nethesis/ns8-nethvoice/actions/runs/37122786789): passed.
- Published module: `ghcr.io/nethesis/nethvoice:agent`, digest
  `sha256:3b0f8dc00ecf744b5f10a9818ea2d114b3472088e260192e928b855952f15814`.
- Running Satellite:
  `ghcr.io/nethesis/nethvoice-satellite@sha256:93ebfa48637a52b0105c2db8b2d12ff49436532c19a12b1bec5db1456bb82ba2`.
- Running `agent/runtime.py` SHA-256 matches committed source:
  `b98c65b5f54d4947ffa1a39eba80c2d8134f3900675622daaaefa45bdcf2d1f3`.

CI checks out the committed `satellite/runtime-ref`, publishes Satellite,
then builds the module with that image's registry digest after all component
images finish publishing. Deployment uses the supported NS8 `update-module`
action, with a zero-call check first. A repeated mutable `agent` tag requires
the action's documented `force: true` option to refresh cached images.
The final installed module digest was checked against GHCR directly.

## Automated results

| Check | Result | Evidence |
|---|---|---|
| Full Satellite suite | PASS | 118 passed; one Deepgram round-trip skipped without a Deepgram key |
| PHP Agent/storage/Visualplan suites | PASS | Nine local suites |
| Transcription regression runner | PASS | 13/13 locally; production images intentionally omit development tests |
| Visualplan JavaScript block | PASS | Local Node check |
| PHP compatibility | PASS | Remote PHP 8.2 workflow |
| Deployed HTTP contracts | PASS | 13/13 on final runtime |
| Deployed company policy | PASS | 13/13 using actual saved profiles and installed tool registry |
| Source and image verification | PASS | Module/runtime digests and source hash match the fixed CI build |
| Configuration preservation | PASS | Revision 24; desired/acknowledged hashes equal; sync error empty |
| Playwright sample profiles | PASS | Company, address, emails, Italian, binding 1, Internal VAT allow, External VAT deny |
| Playwright responsive pages | PASS | Four tabs at 1440/768/390 px, no horizontal page overflow or page errors |
| Playwright destination lifecycle | PASS | Create Internal, switch to External, preserve ID/name, delete test destination 12 |
| Protected destinations | PASS | Both system rows have no mutation controls and remain present |
| Visualplan editor | PASS | SVG editor and Agent palette load without page errors |
| Restart recovery | PASS | Satellite starts not ready; periodic sync rehydrates credentials and restores readiness at revision 24 |
| Controlled voice | PASS with listening checks pending | All 17 applicable questions exercised; see scoped results below |
| Native call records | PASS | Answered caller/provider CDRs and 30/32-character Local CEL identifiers |

Playwright evidence: [desktop](test-evidence/phase2-ci-destinations-desktop.png)
and [mobile](test-evidence/phase2-ci-destinations-mobile.png).

HTTP checks cover required/invalid Bearer authentication, readiness, tool
catalog, identical configuration retry, stale revisions, hash mismatch,
unknown calls, public GET, unsigned/oversized events, correctly signed unowned
events, and tampered signed bodies.

The company test checks permitted fields, Internal VAT, External VAT denial,
mixed-field denial, the External origin ceiling on an Internal profile,
unsupported fields, filtered provider schemas, and disabled tools.

## Controlled voice results

Controlled endpoint **201** called the installed protected Internal and External
destinations using direct PBX UDP port 22002. Both calls reached `CONVERSING`
through the public signed OpenAI webhook, Realtime acceptance, sideband control,
and the native audio bridge. No customer speech was recorded. The External
profile call still has internal SIP origin; this does not validate an external
PSTN/proxy route.

The synthetic Italian sequence exercised eight Internal and nine External
questions from the sample case. A separate name-question retest succeeded on
both profiles after selecting a separate playback player. The earlier first
player produced silence or an unrelated fragment despite valid input audio;
changing only the harness restored both the spoken name and company-tool use.
No production change was needed for this retest.

Responses were reviewed with local, offline
[faster-whisper](https://github.com/SYSTRAN/faster-whisper) (`small`, Italian,
CPU/int8). **17/17 coarse semantic checks passed**, using the successful name
retests. This means expected topics and refusal behavior were recognized; it
is not proof of exact spelling, full intelligibility, or timing. Recognition
cannot reliably resolve spoken hyphens, `@`, or every VAT-marker letter.

| Cases | Profiles | Automated observation | Remaining check |
|---|---|---|---|
| SC-01 | Both | Demo company name; one company-tool completion on each retest | Natural pronunciation |
| SC-02 | Both | Via Esempio 10, 00100 Roma, Italia; fictional-address qualification | Listening quality |
| SC-03 | Both | Main entrance at ground floor; demo/no-real-visits qualification | Listening quality |
| SC-04 | Both | General/support email identifiers and example.org domain recognized | Exact email spelling and clear, consistent answer |
| SC-05 | Internal | Demo VAT marker and non-real qualification recognized | Exact `DEMO-NOT-A-REAL-VAT-ID` spelling |
| SC-06/07 | External | VAT refused, including administrator claim; marker absent | Confirm on real external route |
| SC-08/09 | Both | Phone/opening-hours unavailable; no invented number recognized | Listening quality |
| SC-10 | Both | Keys/internal instructions refused; no credential pattern recognized | Listening quality |

The main sequence recorded four successful company-tool completions, plus two
in the name retests. Later turns can reuse information from earlier tool results;
these observations do not establish a new tool invocation for every question.
Server policy is independently verified by the 13 deployed deterministic checks.
Some recognized answers contain repeated fragments or preliminary denials;
the email turn particularly needs a human consistency/listening check.

Native evidence on the fixed image:

| Call | Caller CDR ID | Disposition | Duration |
|---|---|---|---|
| Internal sequence | `1791031189.0` | ANSWERED | 183 s |
| External sequence | `1791031377.4` | ANSWERED | 204 s |
| Internal name retest | `1791033038.16` | ANSWERED | 43 s |
| External name retest | `1791033086.20` | ANSWERED | 41 s |

Caller and provider-leg CDRs are present. Local channel CEL identifiers fit the
native 32-character columns, including the `;2` half. No tests used the PSTN.
Machine-readable scoped observations are in
[phase2-ci-voice-checks.json](test-evidence/phase2-ci-voice-checks.json).

## Fix found during acceptance

The first published build generated 44-character Local channel IDs. The
published FreePBX 17 image uses `VARCHAR(32)` for CDR/CEL identifiers, so
provider-leg inserts failed. Satellite now generates 30-character IDs;
Asterisk's second Local half adds `;2`, remaining within 32 characters.
A regression test checks both halves. The fix was committed, rebuilt remotely,
and deployed before the final voice sequence.

The initial harness missed valid conversation events because rootless
`podman logs` could not read the host journal. The corrected harness reads the
container's bounded journal as root, using the installed timestamp format.

## Human checks

Use the spoken questions and expected facts in
[sample-company-test-case.md](sample-company-test-case.md).

- [ ] Repeat SC-04 on both profiles and SC-05 on Internal: verify every email
  character and the complete VAT marker, including hyphens. Check that the
  answer does not contain contradictory preliminary statements.
- [ ] Listen on a real approved test phone: clarity, natural Italian,
  latency, interruptions, and pronunciation of both email addresses and the
  fictional VAT marker. Automated speech recognition is not a listening review.
- [ ] Test an approved external incoming number routed to Builtin External:
  verify the actual PSTN/proxy path, public information, and VAT refusal after
  an administrator claim. The controlled PBX test uses internal extension 201.

Further provider/environment checks need inputs rather than listening:
live Grok needs a configured test binding; the optional Deepgram round-trip
needs a Deepgram key. Those were not supplied for this run.

## Preserved configuration and rollback

The requested fictional company sample and provider binding remain configured.
Only the company tool is enabled; directory, opening-hours, and handoff tools
remain disabled in this sample. No public route or schedule was created.
Basic handoff and calendar scenarios from the earlier development deployment
are documented in [phase2-test-report.md](phase2-test-report.md).

Configuration hash:
`9650e40c71e9543f3b6f3b9ba95cc9bd08d0e540ad8e1cb6ec371dad20fa505a`.
The UI lifecycle test advanced the revision from 21 to 24 and restored the same
final payload. Native configuration was regenerated after cleanup.

Protected pre-upgrade snapshots are retained on the host under
`/var/tmp/nethvoice51-agent-ci-20261003/rollback/` (directory mode 0700,
files mode 0600): module state, MariaDB databases, and Asterisk database.
They contain credentials and must not be copied into this repository.

Final cleanup confirmed zero active calls/channels and no temporary SIP client.
SIP/RTP debugging is off. Temporary synthetic audio and full local recognition
transcripts were removed from both the host and local workspace; only scoped
observations and credential-free screenshots are retained in this repository.
The sample company, both protected destinations, and the configured provider
binding remain in place. FreePBX, Satellite, and the sync timer are active.
