# Transfer guidance and private debug transcription — 2026-10-14

## Diagnosis and behavior

The configured Receptionist had both tools enabled and three current extension
grants. Its two latest runs completed directory searches but never requested a
transfer. A read-only search for the operator's named target returned the approved
extension correctly. This was distinct from a denied or failed native handoff.
There were no saved transcripts from those runs, so the precise conversational
reason cannot be reconstructed.

The runtime now gives each session bounded approved-directory context and explicit
guidance to invoke the transfer tool after identifying the destination. Names are
untrusted data, and only published grants are included. Tools still recheck current
existence and permissions at execution. Directory search is not transfer success.
Run events now distinguish tool requests, completion, denial and bounded directory
result counts without storing raw tool arguments.

On an agent page, Debug → Call transcription enables optional caller/agent text
for new calls after Save draft and Publish. Activity → Open displays the transcript
and tool diagnostics. Capture starts off, supports OpenAI, and has configurable
expiry of 1–24 hours. Unsupported provider capture is rejected at publication.

Published contract v4 pins this policy; v1/v2/v3 publications remain unchanged and
executable. Existing drafts receive an inactive UI default without a database write.
The existing OpenAI adapter's optional transcript support and the old UI's text
rendering pattern were reused. Installation-global legacy monitoring policy and
PostgreSQL ownership were not imported.

Text is encrypted before entering its separate bounded memory queue and database.
The runtime account can insert encrypted content but cannot read or delete it.
Authenticated administrators receive only unexpired, identity-checked text through
PHP. Vue escapes text, including markup. Transcript failures cannot take ownership
of call control. Limits are 64 turns, 4,000 characters per turn and 64 KiB of text
per run. Duplicate provider items are ignored. No audio is saved, and transcript
content is absent from metadata logs/outbox. Optional text may be incomplete and
is not proof of what the caller heard.

Expired content is immediately excluded from API reads; the existing hourly
maintenance timer physically deletes expired rows in bounded batches. Explicit
maintenance can purge a run's content while keeping metadata. Existing backup
retention remains separate from live-database expiry. Input transcription can add
provider charges. The provider event/configuration contract was checked against
the official [OpenAI accept-call reference](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/accept).

## Source, checks and staging

Both active repositories remained on voice_agent, with clean starting trees:
NethVoice `b1e508c12060607b8a0fbc0ebe24feee7ea74cc2` and Satellite
`6334369147622cab93bd031220f61b9ae14e4eeb`. Read-only references remained
`2f41116fd2ed890e15439a912977ae1bb7189c5b` and
`08cabfa08c71401dde933f18b21eb01499524f6b`. Root documentation was untouched.
Deployed source revisions are NethVoice `2da5f40d` and Satellite `d701c05`.

Local evidence:

- Satellite: 159 passed, four expected skips, six warnings.
- Cross-repository foundation: 63 Python cases plus PHP/service/HTTP/native checks
  passed. Real disposable MariaDB verified encryption compatibility, expiry,
  identity checks, content purge, migration reruns, preserved snapshots, restored
  settings and insert-only runtime permissions. The optional standalone Wizard
  auth harness remains skipped; the real Slim HTTP auth/CSRF checks ran.
- UI: type-check, lint, formatting, three unit tests, six browser flows and build
  passed, including default-off capture, editable retention, result counts and
  literal rendering of synthetic script markup.
- Final runtime-source secret scan: zero findings.

Target: node 1, makako.sf.nethserver.net, nethvoice57,
voice2.makako.sf.nethserver.net. Existing deployment permission was used for a
scoped image upgrade. Zero active calls/channels were independently checked before
both service replacements and fixture cleanup. Migration 009 installed schema
version nine and additive monitoring fields/tables; provider credentials and
existing agent publications were preserved.

Running images:

| Container | Image ID |
| --- | --- |
| FreePBX | `387d37442fa4a4a58c65e66c30d4303c1aa413e6745502003ab1f9f0570e7f71` |
| Voice agent | `4f3238dde89cace1de9faf9ab653bee47c181a4dc040b78ad30c6d3b82a6e701` |
| Existing transcription | `0eb3d2a9a91bd6f2faab9548a3baac9eceef3c8b4d90f63e9b48f90235661f9e` |

## Authorized synthetic call and cleanup

The user approved at most two 60-second OpenAI synthetic attempts using a separate
agent, temporary DID and echo-only extension, one-hour text expiry and subsequent
fixture/content deletion. The operator's requested extension was never called.

The first attempt had no provider run or media: the temporary agent's native sync
was in error. A supported service synchronization retry restored readiness; its
VisualPlan route was then saved and verified. The second attempt passed within
23.33 seconds: generic receptionist instructions, a normal named-extension request,
898 received RTP packets, 336 packets containing audio, confirmed native transfer
and terminal transferred outcome, without a safe error code. Both authorized
attempts are accounted for; no further call was originated.

The authenticated staged UI rendered one caller and two agent turns, alongside
native transfer confirmation. The synthetic transcription did not exactly spell
the requested name, illustrating the distinction between ASR text and the model's
audio understanding. Raw content, caller IDs and provider IDs were not printed or
committed. All three encrypted turns were explicitly purged; audio, temporary DID,
extension and test agent were removed/retired. Only aggregate receipts and metadata
history remain. The closed fixture ARI application has no active resources.

Protected before/after fingerprints confirm the operator's Receptionist record,
draft, publications, original DID and requested extension/device are unchanged.
The agent retains its enabled tools and existing grants. Its transcript capture
remains off until the operator enables and publishes it. Final services are active,
containers have zero restarts, readiness is healthy without monitoring degradation,
runtime UID is 65532 and the event directory is mode 0700. Asterisk 22.10.0 has zero
active calls/channels. Existing SIP and webhook routes remain owned by nethvoice57.

Fresh rollback is in module-owned v01-debug-rollback/, mode 0700 with files 0600.
It includes verified compressed pre-upgrade databases, prior private environments,
image identities and aggregate test/cleanup receipts. Retained rollback tags refer
to FreePBX `0113b68fb27731139d68099cd99cc7bd64e624d370004e11f05690fe52d23412`
and runtime `f2be449715d902b39c03991a43681180c44e337c33b0defebaf762150b2ba8ae`.
Rollback was unused. Disable v4 agents and confirm zero calls before restoring
those code images; preserve additive data. Restoring databases requires a separately
scoped maintenance action and consideration of subsequent operator changes.

This closes the tested routing-guidance/debug slice, not every v0.1 gate. Live Grok,
full NS8 upgrade/restore/clone and inherited dependency triage remain outstanding.

## Final image checks

Trivy 0.75.0 scanned the exact deployed image archives: Satellite has four critical
findings and FreePBX 16 critical entries (14 unique), matching the inherited baseline.
Both scans found zero secrets. The final control-plane/UI and runtime source secret
scans also found zero. Both Dive 0.13.1 layer checks passed. CycloneDX SBOMs contain
379 Satellite and 1,185 FreePBX components; the FreePBX SBOM was converted from the
complete Trivy package report rather than waiting for a redundant image analysis.
Reports and SBOMs are retained under ignored local testing artifacts. Initial scan
setup needed an idempotent retry, and an idle SSH connection reset during the long
FreePBX scan; remote completion and all final artifacts were verified independently.
This is evidence of scanning, not clearance of inherited vulnerabilities.
