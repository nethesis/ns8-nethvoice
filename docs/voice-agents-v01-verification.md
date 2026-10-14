# v0.1 configuration verification — 2026-10-14

This records implementation and staging evidence. It does not certify the live
voice-call release gates.

## Source provenance

| Tree | Observed starting revision |
| --- | --- |
| Active NethVoice, voice_agent | `61fe1e9beee992d347eba27de119f57266d7ebd3` |
| Active Satellite, voice_agent | `3445e245aefca1ff1458685198b240ce8199de77` |
| Read-only NethVoice reference | `2f41116fd2ed890e15439a912977ae1bb7189c5b` |
| Read-only Satellite reference | `08cabfa08c71401dde933f18b21eb01499524f6b` |

Satellite implementation is committed and pushed as
`2b6ad713b9212f6a216c78ed3036dff6c0d0db30`. NethVoice source changes are the
configuration library/migrations, REST routes, native module bridge/dialplan,
VisualPlan projection and picker, Agents UI, tests and NS8 runner integration.
Root AGENTS.md, PLAN.md and README.md were not modified or committed. The reference
worktrees were not edited. No old branch was merged or bulk cherry-picked.

## Local evidence

- Disposable MariaDB: migration reruns, seed preservation, revision conflicts,
  immutable publications/tools, encrypted PHP/Python credential compatibility,
  real HTTP authentication/CSRF, native PJSIP provisioner tests, real FreePBX
  extension classes, separate restricted runtime accounts, retention and a
  synthetic dump/restore passed. Thirty cross-repository foundation cases passed.
- Satellite: 127 tests passed, three expected skips without the disposable DB.
  The configured harness runs the two database cases against real MariaDB. A
  test image also ran the runtime/transcription suite as UID 65532 without network;
  PHP parity remains in the separate cross-repository harness.
- UI: type-check, lint, formatting, three unit tests, five browser flows and
  production build passed. The native VisualPlan test loads actual draw2d code
  and covers built-in selection, draft rejection, native connection identity,
  New/Edit links and undo. Staged static assets also rendered with synthetic data.
- Existing Satellite PHP transcription/voicemail regressions: 9/9 passed. An
  exploratory run of unrelated gateway tests found two existing HT841 TLS fixture
  failures; their test, renderer and template sources are unchanged from HEAD.
- Canonical FreePBX, Satellite, independent runner and NS8 module bundle builds
  passed. FreePBX assets contain built output, without node_modules or source maps.
  The full FreePBX image retains its existing root exception for PBX/service
  initialization; the independent runner executes as UID 65532.

The first live backend draft-deletion check failed because the REST BMO bootstrap
had not loaded `functions.inc.php`. CLI tests had loaded it eagerly. The native
reference checker now explicitly loads its hooks and a regression tests lazy BMO
loading. Temporary diagnostic headers/session data are absent from the final
source; only structural failure logging remains, without exception messages or
request data.

## Staging scope and rollback

Target: node 1 on `makako.sf.nethserver.net`, module `nethvoice57`, virtual host
`voice2.makako.sf.nethserver.net`. Access and build/deployment were authorized by
the user's implementation/deployment instructions. Every service replacement
checks directly for zero Asterisk active calls and channels. No real provider
call, SIP/RTP probe, capture, debug communication logging or provider account
write was performed.

The existing SIP route ownership was verified: voice2 maps to nethvoice57's UDP
transport at `sip:10.5.4.1:24005`. SIP routes/numbers/trunks and other module instances
were not changed. A dedicated HTTP route forwards `/satellite-webhooks` only to
loopback port 20043. Unknown/public-private paths return 404; unsigned OpenAI and
Grok requests return 403 without creating a run.

Deployment is a scoped development override: the tested component images replace
the existing FreePBX and Satellite unit image references. New source-owned helper,
runner/retention units and configure/update hooks were installed for nethvoice57;
the event volume was added to its backup include. The installed M0 module bundle
was not broadly updated, avoiding unrelated service/route reconfiguration. The
new bundle declares TCP demand 40. An administrator-scoped installed allocate-ports
action appended one port for this development instance; the helper then stores
that assigned port through the normal agent environment API. No Redis writes were
used. An initial backup-include path lookup was corrected from the config root to
its observed `etc/state-include.conf` before changing service state.

M0 component images are retained as `localhost/nethvoice-freepbx:v01-rollback` and
`localhost/nethvoice-satellite:v01-rollback`. A fresh, validated compressed database
backup and prior env/secrets/state-include files stay in module state `v01-rollback/`
with directory mode 0700 and files mode 0600. The older pre-M0 rollback tags and
backup were preserved. No server database dump or credential file left the host.

For rollback: disable/stop the independent runtime and retention timer; delete only
`nethvoice57-voice-agent-webhooks` through the installed Traefik delete-route action,
without certificate cleanup; restore the two existing image references from the
v01-rollback tags and restart their matching units at zero active calls. Restore
only the added source-owned artifacts/state-include as needed. Leave the new
additive tables unused; do not drop configuration, immutable versions or keys.
The extra owned port can remain reserved. The node deallocate action removes an
entire module allocation and must not be used to remove this single port. If image
rollback cannot recover data, use the protected backup through the supported NS8
restore procedure with separate authorization. A real NS8 restore/clone has not
been tested; the recorded round trip is synthetic MariaDB only.

## Image security and remaining gates

Dive analyzed both component images (approximately 99.2% Satellite and 97.8%
FreePBX layer efficiency). Trivy 0.75.0 and Dive 0.13.1 release checksums were
verified. Both component scans found no secret material. Satellite reports four
critical, 256 high, 382 medium, 227 low and 21 unknown findings; FreePBX reports
16 critical, 435 high, 1,317 medium, 1,201 low and 13 unknown findings. There were
no reported findings for the newly added runtime dependencies. Satellite's critical
libxml2/perl-base package versions also occur in the M0 image. These are scanner
findings, not a claim of exploitability or a production clearance. Remediation of
inherited image dependencies remains a release risk.

CycloneDX SBOMs and scan reports are retained locally under the ignored
`local_testing/artifacts/voice-agent-v01/` directory. Initial scan attempts hit the
/tmp quota/download deadlines; the completed scans used workspace temporary
storage and a longer bounded timeout. No release tag or SBOM publication is claimed.

Remaining acceptance: separately authorized, bounded OpenAI/Grok voice calls,
provider SIP header propagation, real audio/greeting, permission denial and approved
extension transfer confirmation, setup/runtime failure fallback, and native
backup/restore/clone. Provider credentials must be entered through the write-only
UI. A reserved SIP test route and approved transfer/fallback extension are required
before live test traffic. Do not call v0.1 functional based on the synthetic checks.

Final staging results:

- Migration version five reruns and actual authenticated catalog/profile/activity
  reads passed. Draft create/edit/delete, CSRF rejection, stale-revision conflicts,
  incomplete-publication rejection and synthetic cleanup passed after the BMO fix.
- FreePBX image `888f262792d381067179e292d8bb4058ff114b38eef82a87f4180a9d4c31219b`
  and Satellite/runtime image
  `8fe5b824d3a453dfe01a8af44a2a975e9c973ec7005e854e4ff1974b7693fb7f`
  are running. All three units/containers have zero unexpected restarts.
- Authenticated private readiness confirms ARI connectivity and no monitoring
  degradation. The observed socket is loopback-only, UID is 65532 and the existing
  outbox volume is mode 0700. Database role denials and zero run creation passed.
- Existing transcription's actual RTP listener and MQTT connection passed.
  Asterisk registers both `satellite` and `voice-agent`, version 22.10.0, with zero
  active channels/calls. The SIP route and dedicated HTTP webhook route remain as
  recorded above. HTTPS served the UI with certificate verification enabled.
- The staged anonymous sign-in and compiled built-in editor rendered successfully
  using intercepted synthetic API data, without capturing actual admin/caller data.
  Both rollback image identities and the protected backup were verified again.
