# Alpha validation

The cleanup starts from NethVoice `d1e23cae8f286af401397afa290cf5fe94d09d30`
and Satellite `327b714ed977970afe1ac97fd9a5fc9af839c94a`, including the
separately preserved callback and compact-channel-ID fixes. Recovery bundles,
tracked patches, untracked files and previous development notes are retained
outside published documentation.

The rewritten branches incorporate current main: NethVoice
`1da25a1554b5a0c0ab350c7cd01079f9f3fb07d7`, Satellite
`1599a81f9ea96f4aea47d2121252267c10976f5f`. Current executable runtime code
is introduced by Satellite's call-execution commit; the paired NethVoice runtime
pin identifies the complete source archive. Python remains 3.12.13.

| Gate | Evidence |
| --- | --- |
| Fresh baseline, unsupported development DB rejection, interrupted retry | Disposable MariaDB; old objects unchanged on rejection; seed and repeated setup verified |
| Paired PHP/Python, provider emulators, ARI, routing and recovery | 266 runtime tests passed, including real disposable DB integration |
| Server authorization, CSRF, immutable publications, grants and restore | PHP/MariaDB harness passed, including separate runtime accounts |
| Native CDR/CEL identifier bounds | Strict native field limits reject UUID-sized channel IDs; compact Local identities and independent session/run correlation persist |
| UI type/lint/format/unit/build/browser | Passed; seven unit tests and 27 browser cases |
| Transcription | 137 Python tests passed, one skipped; nine PHP segmentation regressions passed |
| NS8 unit regressions | 89 passed, including 14 subtests |
| EN/IT administrator manual | Docusaurus built both locales; existing browser-data-age warnings remain |

Staging validation uses a disposable instance. A protected backup includes databases,
secret/environment files, native PBX state, service overrides and exact images.
The pre-reset databases were restored on an isolated MariaDB server before reset;
old image identities are pinned for rollback. This rehearses the database portion,
not a full NS8 machine recovery. Native CDR and unrelated PBX tables matched their
pre-reset fingerprints after installation and supported configuration recreation.

A fresh Receptionist was disabled/unpublished before its test configuration was
saved and published. Runtime readiness requires authentication, reports v8 with
four tools and no monitoring degradation. Both services run independently of
transcription enablement. Installation repetition preserves the current publication.

## Controlled staging observations

- GPT-Live primary WebSocket: caller-side audio was observed; a synthetic goodbye
  invoked the enabled hangup tool and ended as `ended_by_agent`, leaving no channels.
  First caller-side signal energy was about 3.58 seconds in that trial. This is not
  a human listening or intelligibility measurement.
- OpenAI Realtime SIP: an approved extension transfer recorded both native handoff
  and `transferred`, then left zero channels. The test target was a controlled,
  unregistered native extension with safe native hold fallback, not an employee
  answering a telephone.
- A denied destination was not reached. An independent registry check using the
  real restricted DB account returned one approved directory target and one
  callback candidate, rejected the other extension and performed no ARI action.
- Killing only the runner during one owned call exercised supervisor/recovery.
  The run became `interrupted / runtime_restarted`, with zero remaining channels.
- A deadline trial exposed the native watchdog firing before the runtime because
  its seconds were rounded down. The failing regression and fix keep the runtime
  deadline authoritative and add bounded native-watchdog grace. The corrected
  live trial recorded `fallback / duration_exceeded` and left zero channels.
- Actual native CDR/daily CDR/CEL probes retained compact provider/consult Local
  identities, both CEL halves and independent session correlation under strict
  SQL limits, without provider connections or container replacement.

GPT-Live spoken-name transfer and both GPT-Live/Realtime callback trials did
not establish a confirmed handoff. The controlled provider windows closed after
ten attempts; synthetic CDR and test-extension fixtures were removed. Defaults
were restored, services remained healthy and zero channels remained. Do not count
their ordinary completion as transfer success. Human listening, subjective barge-in, long-duration calls, actual employee-answer
confirmation, Grok live coverage and coexistence under sustained transcription
load remain separate acceptance gates. Never infer these from provider
acceptance, media events or signal-energy measurements.

## Image and source provenance

The downloadable Satellite source is `6ad35f66af1071e088e3905aa92eb596e2068416`,
with archive SHA-256
`9f4566b8800285c494026a74618574d94aff3d911993b207be0a7c624de01fdf`.
Every tracked archive file matched the finalized source. The paired disposable
PHP/MariaDB/runtime harness passed all 266 runtime tests, including restore,
using that archive and the current PHP source. The same harness also passes
with only agent/test dependencies installed and exercises authentication, HTTP,
native dialplan and restricted grants using the full built FreePBX image.

Local full image identities (not published release tags):

| Image | SHA-256 image identity |
| --- | --- |
| Supervised Satellite | `9d57deef19c09a29d5b993023626d273a7d435cc462dc4b5fee68ccbada0e485` |
| FreePBX | `1342b388a6b2c760943d8be489b7984f5fc85c0e7431b0463c89b13399418240` |
| NS8 module | `ba6f79a20a46e786bc98dd3b698453c76ef43661069d8da2efe9318069b91b12` |

The Satellite image matches runtime and transcription source, runs Python
3.12.13 as UID/GID 65532 and excludes diagnostics. The standalone runner image
was also built. The NS8 image's lifecycle files match the source and request 44
TCP ports. FreePBX image checks verified 58 source/asset files, v8-only contracts,
compiled UI assets without source maps or dependency directories, absent reset
helpers and native dialplan regressions using its installed FreePBX library.

The provider observations above used source-verified feature overlays on saved
installed image identities, including the watchdog fix. They do not establish
provider acceptance for every later image rebuild. Deployment-specific image
references, backups and recovery receipts remain in protected verification
material outside published documentation. Local Docker builds omit optional
BuildKit cache mounts where the host has no BuildKit plugin; production build
recipes are unchanged. The module build context excludes private test artifacts.
