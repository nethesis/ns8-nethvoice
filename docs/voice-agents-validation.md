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
pin identifies the published base image; CI tests its matching source revision.
Python remains 3.12.13.

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

The earlier source-build validation used Satellite source `6ad35f66af1071e088e3905aa92eb596e2068416`,
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

## CleverAI local integration — 2026-10-26

Starting revisions: NethVoice `c2729414d6ca2c5e264416b33ee66b22b8a544e3`,
Satellite `6ad35f66af1071e088e3905aa92eb596e2068416`, both on `voice_agents`.
The existing PRs were open and their remote heads matched these revisions.
Pre-existing NethVoice changes were saved as a patch before editing and preserved,
including the shared `retrieveHelper.sh` reload request and deletion of the old
agent-specific checker. No commits, pushes, builds, deployment or provider calls
were performed. Satellite runtime code, publication schemas and runtime pin were
not changed.

Automated checks passed:

- Disposable MariaDB/PHP foundation harness, including fresh-install rejection,
  interrupted setup, repeated setup, immutable snapshots, restore and least-privilege
  accounts. The CleverAI service regression also covers credential omission without
  an encryption key or environment discovery, both directions of trunk compatibility,
  forbidden local settings, Save activation/reload failure/retry, native readiness,
  VisualPlan fallback/cycles, stable identities, revisions and in-use deletion guards.
- Native dialplan generation using FreePBX extension classes from the existing alpha
  image: four inherited SIP headers, PBX caller/DID sources, empty-DID fallback,
  managed-trunk Dial with the existing 20-second connection timeout, failure fallback,
  ANSWER/CANCEL termination guard, unconnected fallback and absence of Stasis/agent
  events. Fallback uses a pinned resolved native destination across reloads.
- 266 Satellite foundation tests, paired runner contract and native CDR/CEL checks.
  CleverAI has no runtime publication or binding visibility and creates no synthetic
  run. Existing local OpenAI/Grok runtime behavior remains covered.
- UI type checking, lint, formatting and seven unit tests; nine focused browser
  cases covering CleverAI trunk/create/edit/delete, local publishing and EN/IT
  monitoring. Four NS8 agent-review tests and all nine native transcription
  regressions passed.

The optional full Wizard HTTP authentication harness was skipped because
`M0_REST_AUTOLOAD` was not selected; existing access-envelope/CSRF checks passed.
The initial system-Python run lacked runtime dependencies; the successful harness
used the existing Python 3.12 test environment. Existing dependency deprecation
warnings remain. No new dependencies were added.

**External acceptance still required:** no real CleverAI call, wire-level SIP/audio
check, human audio acceptance or external webhook provisioning was performed.
The full experimental dialplan was not available locally. `agent:<agent_id>` is
only the proposed stable `X-OS-Extension` identity; CleverAI's required registration
or accepted value, and its handling of empty caller headers, remain unconfirmed.
The generated failure/hangup paths are checked automatically, not proven against
CleverAI/Asterisk live calls. Transfers back to NethVoice remain deferred.

Changes are confined to the PHP service/native projection/dialplan, Agents UI and
translations, the runtime binding view's external-execution filter, focused tests
and maintained guides/validation notes. There are no table or publication-contract
migrations and no development database conversion or erasure. To revert this local
work, remove only the CleverAI additions while retaining the separately preserved
pre-existing changes; do not reset the working trees wholesale. Local logs and the
pre-existing patch are under `/tmp/cleverai-*` and are not release artifacts.


## Published Satellite base — 2026-10-26

NethVoice now consumes `ghcr.io/nethesis/satellite:pr-56`, verified in GHCR and
pinned to `sha256:e7b765730884612500658824857c02b4ff7f2191d40768b40ebbd81fb1d7479b`.
The image's source label is `407c73f266ab528267e28251beefdc1fc41e44ac`, the PR merge
revision; its Git tree matches head `6ad35f66af1071e088e3905aa92eb596e2068416`.
NethVoice CI checks out the exact image source revision for paired tests.

Both entrypoints imported successfully in the downloaded image under Python
3.12.13. Build-script smoke checks passed for the pinned default, local override,
launcher/user setup and import-failure rejection. Shell syntax, CI YAML and diff
checks passed. No full image build, hosted CI, deployment or provider calls ran.
The source-archive results above remain historical evidence.

**Merge gate:** replace the development PR image with a versioned Satellite
release; update its digest and the matching CI source revision together.


## Shared Python lifecycle — 2026-10-26

The refactor starts from NethVoice `c2729414d6ca2c5e264416b33ee66b22b8a544e3`
and Satellite `6ad35f66af1071e088e3905aa92eb596e2068416`, both on `voice_agents`.
Both PRs were open with matching remote heads. Existing uncommitted work,
including the preceding action/build cleanup and CleverAI changes, was preserved.

`main.py` now owns the application lifecycle and both private HTTP servers on one
event loop. `transcription.py` owns optional pipeline startup/retry/cleanup;
`voice_agent/` retains call handling and its separate ARI application. Both current
transcription flags, endpoint paths, authentication, credentials, schema and stored
volumes remain in place. No persistent data was converted or removed. The obsolete
NethVoice subprocess launcher and its supervisor-specific tests were removed.
Normal MQTT/ARI failures recover within transcription. Shutdown cancels connector
starts and connection tasks, closes transcription-owned media/RTP resources, drains
HTTP requests and kills/reaps expired enrichment/ffmpeg workers. PostgreSQL connection
attempts are bounded and startup schema work runs off the shared event loop.

Python 3.12 validation:

- Satellite runtime foundation: **261 passed, 5 skipped** (database-backed cases
  require the disposable integration harness).
- Satellite transcription/application: **156 passed, 1 skipped** (real Deepgram round-trip
  requires provider credentials); existing aiohttp BasicAuth deprecation warnings remain.
- Connector cleanup checks after adding concurrent-close coverage: **7 passed**.
- NethVoice packaging and lifecycle checks: **28 passed**.
- Actual SIGTERM/SIGINT shutdown and HTTP auth/path isolation passed for all four
  transcription-flag combinations. A synthetic active agent call/runtime survived
  transcription startup failure and recovery. Real disposable worker processes
  were reaped on timeout, request cancellation and API shutdown.
- Current source started/stopped in both modes as UID 65532 using the existing
  published image's dependencies, with a read-only test source mount and no network.
  This validates dependency compatibility; it is not a rebuilt/published image.
- Shell syntax and both repository diff checks passed.

The pinned PR #56 image predates the shared lifecycle. NethVoice deliberately
rejects it at the import check. **Publish the updated Satellite image, refresh the
image digest and CI source revision together, and replace the PR image with a
versioned release before merge.** A local updated image can use `SATELLITE_IMAGE`.

No commits, pushes, full image builds, deployment, real PBX/provider calls or
human audio acceptance were performed. A fatal process failure now affects both
components and is recovered by systemd; ordinary connection errors stay local.
The earlier subprocess-supervisor and image observations above are historical.


## Authorized commit/push verification — 2026-10-26

The user subsequently authorized committing and pushing the local changes.
Satellite was pushed at `f39996479009a8e9a0ff05d05ea6d0379f9d03f3`; its
[PR image workflow](https://github.com/nethesis/satellite/actions/runs/40342741463)
passed and published the shared lifecycle. The verified image is
`ghcr.io/nethesis/satellite:pr-56@sha256:3e8df2c59bdb2b9ec58fac850fafc430721490a890d10c78dd595f455ad1a36a`.
Its label pins source `66253bf9345b4be369a24b07692b522a3c02998f`; that PR merge tree
matches the committed Satellite tree. NethVoice now pins this digest and checks
out the same source revision for cross-repository tests, resolving the earlier
old-image packaging limitation. A versioned release remains required before merge.

Pre-push validation passed: 418 Satellite tests (six credential/database cases
skipped); the full disposable PHP/MariaDB harness including 266 runtime tests,
HTTP authentication/CSRF, native dialplan and restore/least-privilege checks;
88 NS8 unit tests plus 14 subtests; nine PHP transcription regressions; UI type,
lint, formatting, seven unit tests, production build and all 29 browser tests.
The browser rerun used writable Chrome configuration and a short temporary path
to avoid host sandbox/socket-path launch failures. No product changes were needed.
No deployment or real provider/audio acceptance was performed.
