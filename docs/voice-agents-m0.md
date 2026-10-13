# M0 implementation and verification record

Date: 2026-10-13. Implementation branches: `voice_agent` in both active worktrees.
The workspace AGENTS.md, PLAN.md and README.md are unchanged. This is an
implementation record, not a v0.1 release declaration.

## Source baseline

| Checkout | Observed branch/state | HEAD |
| --- | --- | --- |
| `ns8-nethvoice` | `voice_agent`, initially clean | `dd416d3cf0c97afd04083dbac56c966ece1d8ffa` |
| `satellite` | `voice_agent`, initially clean | `b95156efabe255fa79ab83e2506ddcde458f857d` |
| `ns8-nethvoice.bak` | `agent`, read-only reference | `2f41116fd2ed890e15439a912977ae1bb7189c5b` |
| `satellite.bak` | detached HEAD; pre-existing unresolved merges, read-only | `08cabfa08c71401dde933f18b21eb01499524f6b` |

The reference Satellite provider/controller/runtime paths inspected have no local
diff from that HEAD. Its conflicted main.py, api.py and README were not reused.
Neither reference checkout was modified. No complete former PR was cherry-picked.

## Reuse inventory

| Inspected legacy source | Dependencies / decision |
| --- | --- |
| `satellite/htdocs/agents/src/App.vue`, `main.ts`, `assets/main.css`, `stores/ui.ts`, `i18n.ts` | Reused layout, Pinia state, Nethesis theme, Poppins, FontAwesome and EN/IT translations in `freepbx/agents-ui`; only the M0 Agents workspace is routed |
| UI `api.ts`, `jsonValidity.ts`, `tests/auth.test.ts` | Reused Wizard header authentication, CSRF client behavior and private-cache invalidation; removed Satellite workflow proxy helpers and old inventory models |
| UI package/lock, Vite, ESLint, TypeScript and Playwright configuration | Reused dependency lock; changed public base and dedicated browser-test port; fresh Node image build verified |
| UI workflow canvas, editor/views, Vue Flow and browser/model tests | Inspected; remain in the reference until matching PHP-owned v0.1/v0.2 services exist; no graph editor, data sources, arbitrary tool editor or workflow API is shipped in M0 |
| `AgentTrunkProvisioner.php` | FreePBX Core/PJSIP operations; defer minimal native extraction to v0.1.1 |
| Legacy `functions.inc.php`, destination repository/workflow destination helpers | Native destination hooks, safe fallback and trusted target generation; defer to v0.1.2; current transcription hooks stay intact |
| `AgentSchema.php`, validation/profile repositories | Additive MariaDB migration style and identifier ideas; create a new PHP REST-owned namespace rather than adopting former module business tables |
| REST `modules/agents.php` and authentication middleware | Reuse administrator contract and same-origin/CSRF boundary; replace all old configuration-push/proxy routes with only the M0 access envelope |
| Satellite `agent/providers/realtime.py`, `live.py`, `webhook.py` and provider tests | Bounded transport and raw-body verification candidates; not imported into the M0 runner; vendor-specific protocols must be adapted separately in v0.1 |
| Satellite `agent/asterisk/controller.py`, runtime and core tests | ARI bounds, queue ownership, call state and negative fixtures inspected; defer live session/transfer ownership to v0.1 |
| Satellite workflow/monitoring/application repositories | PostgreSQL configuration ownership and configuration-push interfaces are superseded; do not reuse their persistence unchanged |

The copied frontend retains its GPL license. New PHP source carries GPL-3.0-or-later
SPDX notices; Satellite remains under its existing repository license.

## Implemented behavior

- Versioned strict Basic Voice snapshot, shared PHP/Python fixtures and ID semantics.
- Additive MariaDB configuration, draft, immutable version, audit, published view,
  bounded monitoring run/event tables; serialized, repeatable migration hook.
- Standalone private runner and read-only published repository; no agent calls or
  provider connections. Default transcription entrypoint remains `main.py`.
- Tested private HTTP bind for both the optional runner and transcription API.
  The canonical Satellite image now runs as UID/GID 65532; its 99-test suite also
  passes under that identity. FreePBX retains container-root initialization because
  it must prepare persistent volumes and start its multi-service supervisor;
  Asterisk/Apache use their configured service users inside NS8’s rootless container.
- Relocated Vue shell at `/freepbx/agents-ui/`, server-verified Wizard admin access,
  same-origin and CSRF foundations; unavailable functions cannot be navigated to.
- FreePBX Node build stage copies only compiled UI output. Apache has a slash
  redirect and no conflicting rewrite; REST rewrites apply only inside `rest/`.

See [contract v1](voice-agents-contract-v1.md) for ownership, IDs and exact grants.
No agent CRUD, tools execution, ARI transfers, webhooks or live provider calls are
claimed. Those remain v0.1 work.

## Local verification

- Disposable MariaDB 10.11.19: PHP migration twice, preserved versions, update/delete
  trigger denial, enabled-only published view, least-privilege reader/writer grants,
  denied cross-database writes and idempotent bounded monitoring events passed.
- Six foundation Python tests passed with real MariaDB, including PHP/Python
  accept/reject parity and read-only published repository loading.
- Transcription/runtime suite: 99 passed, one existing opt-in database test skipped;
  includes synthetic transcription startup/subscription/shutdown and private bind.
- Existing FreePBX Satellite transcription/voicemail regressions: 9/9 passed.
- Wizard authentication against actual PSR7 middleware: missing credentials,
  wrong keys, non-admin role denied; authenticated admin attribute passed.
- Identity-bound CSRF and same-origin PHP checks passed; PHP syntax and Git diff
  whitespace checks are recorded again before completion.
- Vue type-check, lint, 3 unit tests, 2 mocked browser tests and production build
  passed. Browser rendering inspected; no unsupported navigation or creation controls.
- Fresh Node 24.15.0 image builder passed using the lockfile. No dependency audit
  vulnerabilities were reported by npm ci; the known large bundle warning remains.
- Standalone Python 3.12.13 runner image built and passed offline fixture validation
  and real authenticated readiness; `/proc/net/tcp` confirmed loopback bind.
- Disposable Apache packaging image served the compiled UI with HTTP 200; no
  TypeScript source, source maps or node_modules were installed under the UI path.

The canonical FreePBX build exposed a pre-existing `/var/run` directory/symlink
collision under BuildKit. The builder now omits empty runtime directories from
its filesystem overlay, and the final image creates the Asterisk runtime directory
through the existing `/var/run` symlink. A cached full rebuild verifies the fix.

Full canonical FreePBX/Satellite images and live staging verification are recorded
below when completed. Local mocks do not count as a real provider/telephony test.

## Reproduce

From the workspace root, create an isolated Python 3.12 environment with Satellite
`requirements-agent.txt` and `requirements-dev.txt`, then:

```sh
M0_PYTHON=/path/to/python ns8-nethvoice/freepbx/tests/agents/run-foundation.sh
```

This harness starts a uniquely named loopback-only disposable MariaDB container
and removes it on exit. It refuses a database that already contains `asterisk`.
Set `M0_REST_AUTOLOAD` to an installed Slim/PSR7 Composer autoloader to additionally
run the Wizard middleware authentication harness. The authentication test was also
run independently inside the existing FreePBX image with the disposable DB.

Run UI scripts from `freepbx/agents-ui` and the existing PHP transcription runner
from `freepbx/var/www/html/freepbx/admin/modules/satellite/tests`. The canonical
FreePBX Containerfile needs BuildKit for its existing cache mounts. The Node stage
can be built on its own with `--target agents-ui-builder`.

## Makako staging and rollback

Authorized target: `makako.sf.nethserver.net`, node 1, root SSH with key authentication,
module `nethvoice57`, virtual host `voice2.makako.sf.nethserver.net`. Discovery proved
that exact module/domain mapping; `nethvoice58` is separate and is outside this work.
The installed module image remains the pre-existing `agent` test module. M0 is a
scoped local component-image deployment, not publication of a new NS8 module release.

Before deployment:

- Module image digest: `sha256:8202b1754e5897e8c40abf17045a046dbc9f9c2516444c3323022e44f3545d9f`.
- FreePBX digest: `sha256:789eddfb9d8e5d6168ea776c4c1f09b7bf668a868a26cddc9e706b57c63b6e4d`;
  image ID `4698e3e38ceecb8233dd5df08705307131f022d0b2cd75caea475f061075b1f9`.
- Satellite digest: `sha256:ecbaab39d20ee005997299ad2d995520a728f49b01e4728ba411107a71b61598`;
  image ID `2fd93a76ac9832c34bc556a8be6ced680e677db326fe992fbc37e91789c069b5`.
- FreePBX and Satellite units active. Asterisk directly reported zero active channels
  and calls. No incoming route references a legacy agent destination. Additional
  native destination reference checks precede deployment.
- The owned SIP route points to `sip:10.5.4.1:24005`, matching the observed UDP
  transport. TCP uses 20025; comparing the UDP route to that TCP value would be
  incorrect. No SIP route, trunk, endpoint or test number was changed.
- New UI route returned HTTP 404 and no installed index existed. No M0 schema existed.
- User explicitly authorized building and deploying M0 to this module. No provider
  call or external business action was authorized or performed.

Rollback preparation retains both old images under `localhost/*:m0-rollback` in
this module's Podman context and stores a protected database backup in the module
state. No backup contents or credentials leave the host. Image tag identity and
compressed backup integrity must pass before restart. No audio is collected.

Deployment uses the installed unit's existing image references: import the tested
local component images into `nethvoice57`, replace only the FreePBX/Satellite image
tags, and restart only those discovered units after an independent zero-call check.
The inherited legacy configuration-push timer must be stopped/disabled for M0;
its prior enabled/active state is retained for rollback. Module update actions were
inspected: they extract/reconfigure the full module and can restart unrelated
services, so they are not used for this scoped image test.

To roll back, after confirming no active calls, restore each existing component
image reference from its saved `m0-rollback` tag and restart its matching unit.
Restore the legacy sync timer to its recorded state. M0 tables are additive and
can remain unused; do not drop them as rollback. If the normal PBX startup/update
changed existing database data and image rollback is insufficient, restore the
protected pre-deploy backup through the supported database restore procedure
under a maintenance window. Backup/restore/clone acceptance remains a later gate;
a backup integrity check is not a completed restore test.

## Deployed M0 result

Gate M0 passed on the designated instance. Both canonical component images are
loaded and running on `nethvoice57`. At deployment time, no Git commit, push or
public registry release had been performed.

| Component | Deployed image ID | Manifest digest |
| --- | --- | --- |
| FreePBX | `a0294ae92c8a282cf18507a3298c2ea0f29784f899de6f9af4ad7f0900de2435` | `sha256:bae5449d13ad9f05375125ca0ffb8c96fa865eac20f9cc785aa5da52f562b681` |
| Satellite | `7272245a3d530eeeafe6b487583fc6fe8e45888cfbecc8c6f45364d9aba3da15` | `sha256:b7c13646aa2540e61c007ff272b5093543cd16aee69dc851edcb1408bad8dfcb` |

Canonical Docker manifest lists (including build attestations): FreePBX
`sha256:6a413dbab3e0d9c546dec3b725dc1c8a4ba74a0ad2ce14e300a0657ab62c6848`;
Satellite `sha256:551fb2150ac98428e7aa3ca48c0f5452935373b52e97e32baf0795ef2eb82afe`.
Archives were verified against their complete SHA-256 checksums before import.

Staging verification:

- HTTPS `/freepbx/agents-ui/`: HTTP 200; anonymous Wizard sign-in prompt rendered.
- Compiled UI with synthetic, mocked access: Agents heading and M0 empty workspace
  rendered at the live path; screenshot visually inspected. This is a mock UI
  acceptance check, not a real agent execution.
- Actual PHP backend: real administrator credentials derived only in server memory
  authenticated `/agents/access`; M0/empty capabilities/CSRF envelope passed.
  The same request without credentials was denied with HTTP 403. No credentials,
  session token, username or CSRF value were printed or saved.
- Actual staging MariaDB: the PHP schema installer ran twice again successfully;
  schema version 1 was confirmed. Existing databases remained in place.
- FreePBX and Satellite: active/running, successful unit result, zero service
  restarts. Asterisk directly reported zero active calls/channels before the
  disruptive steps and after deployment.
- Existing transcription: authenticated static models endpoint responded, actual
  HTTP socket was loopback-only, RTP listener and MQTT connection were confirmed,
  and the `satellite` ARI app was registered again after the PBX restart.
- Independent M0 runner: authenticated readiness passed on the staging host in an
  isolated temporary container without transcription configuration; the container
  and its temporary private token file were removed after verification.
- The normal FreePBX notification hooks also refreshed the related Tancredi and
  Reports containers in this same module; their existing images remain in use.
  No other module instance was updated.
- Legacy configuration-push timer: stopped/disabled; its previous state is retained
  for rollback. Other module instances and proxy/SIP routes were not modified.
- Rollback: old component image identities reverified, protected database backup
  passed `gzip -t`, mode 600. Rollback was unused and remains available in module
  state `m0-rollback/`; no restore test is claimed.

Temporary public image transfer files and disposable local test containers are
removed at completion. The local development dependency directories remain ignored
for subsequent work. Existing transcription test warnings and the UI bundle-size
warning remain; no paid provider call, live voice-agent call, transfer, backup
restore or clone acceptance was performed. Those are future milestone gates.
