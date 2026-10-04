# Phase 3 implementation status

4 October 2026 — **test deployment completed; release acceptance remains open**.
See the [deployment and acceptance report](phase3-test-report.md).

## Delivered source

| Milestone | Implementation |
|---|---|
| P3.0 | Monitoring contract, bounded gateway and separate private router; Phase 2 human acceptance remains open |
| P3.1 | PostgreSQL schema/migration, asynchronous bounded recorder, stable event IDs, sequence/gap handling, historical queries, restart reconciliation and retention |
| P3.2 | Dedicated Wizard Agents routes, authenticated gateway, inventory/settings, overview, run filters/pagination/detail/tool timeline, English/Italian text and FreePBX links |
| P3.3 | Per-agent default-off capture policy; optional OpenAI Realtime final transcripts, encrypted segments, explicit states/limits, revocation, deletion tombstones and actor/time audit |
| P3.4 | Service/timer and backup verified; isolated restore found a defect, corrected and tested locally; publication and full NS8 restore/clone acceptance remain pending |

The implementation turn did not run tests, browser sessions, provider calls,
remote configuration changes, commits or deployments. A later acceptance
checkpoint is recorded below.
Existing Phase 2 acceptance evidence is not evidence for these changes.

Static syntax checks passed for the Python implementation/action files, PHP
repositories/gateway/authentication changes, JavaScript controllers/services,
shell scripts and locale JSON. The packaged runtime was also assembled from the
pinned base and all 29 Python source files parsed successfully. These checks parse source; they do not execute
call, database, authentication or browser behavior.

## Runtime packaging

The runtime has now been integrated into `Nethesis/satellite` branch `agent`.
`runtime-ref` records the verified upstream source commit. The module wrapper
starts from `ghcr.io/nethesis/satellite:agent`; its import/OpenAPI guard checks
monitoring and application support. Coordinated module publication uses the
resulting immutable wrapper digest. The former Phase 3/4 patches and overlays
have been removed; make runtime changes in Satellite.

## Operational changes

Monitoring has no dependency on MQTT or legacy audio transcription enablement.
PostgreSQL is enabled on configure/update/integration changes, but startup failure
is tolerated by the call service. Backup requires an enabled database to start
and dump successfully; it does not silently skip an enabled history store.

Restore now matches the deployed pgvector PostgreSQL 18 volume path and uses a
unique bootstrap role so dump role creation does not conflict with an already
created Satellite role. SQL errors fail the restore. The restore password is passed through the
process environment, not a Podman command argument. The corrected local hook
disables bootstrap-role login and clears its password; PostgreSQL requires that
role to retain its superuser attribute. The published hook incorrectly attempts
to revoke that attribute and fails restore; republishing the correction remains
a release gate. Older backups with no database dump
remain supported. A missing content key is generated only for older backups;
existing keys are preserved. Clones remove copied PostgreSQL dump files and
reset transcript opt-in in the native policy.

History admission guards leave reads available when full. A policy extension
cannot revive already expired rows or segments. Capture generations and deleted
run tombstones prevent delayed/retried text from reviving revoked content.
Optional provider observations have their own bounded queue so they cannot
consume the voice/tool event queue.

## Acceptance checkpoint — 4 October 2026

The coordinated image workflow completed successfully for repository commit
`e6313215baaf619c7095357e6db70cb7cb2fc2b5`:
[GitHub Actions run 37218895329](https://github.com/nethesis/ns8-nethvoice/actions/runs/37218895329).
It published `ghcr.io/nethesis/nethvoice:agent` at
`sha256:ed9a63777c35d3fc10fba1a640d785ee1bf699665ea3a70e199f1185bd86ff8e`
and the coordinated Satellite image at
`sha256:ab37eb3be709684611c881f3de0dcc1b770b4fe926fdb2e4bbc84beb71d32de6`.
The workflow built and published images and ran the module import check; it did
not run the Phase 3 acceptance scenarios.

Local regression checks passed: the Satellite transcription runner (13/13),
the Agent save-service and VisualPlan graph suites, and the VisualPlan Agent
JavaScript test. PHP syntax checks, Python compilation, shell syntax, and
`git diff --check` also passed. The initial system Python dependency gap was
resolved by running the regression suite in the exact published image:
**118 passed, 1 skipped**. Added **14 isolated monitoring acceptance tests** and
a repeatable runner covering PostgreSQL history, privacy, policy, limits,
recovery, APIs and the repository restore hook. The 100,000-run metadata
pagination check passed. Browser creation failed because no browser is available.

Read-only preflight of `makako` on 4 October found online NS8 node `1`, the
`nethvoice51` module and `nethvoice-proxy1` on that node, Rocky Linux 9.8,
proxy image version `1.7.3-testing.6`,
NethVoice image digest `sha256:80145e5b8c46ff4b62b3fca2426975486a0fa10960c4ce4a577982a64b90e40b`,
and Satellite image digest `sha256:64a420aa0f9a35dd3555e40896817ecf2028de207c3cf009c72f9f0f46a28160`.
The configured services and containers were running with zero restarts.
Asterisk 22.10.0 reported zero active channels and calls. The installed
`nethvoice51` instance is unconfigured for NS8 backups; the existing cluster
repository is available, and the host has 27 GiB free.

After the owner authorized restarts, preserved all 16 installed images and
verified NS8 backup snapshot
`c1b66e220c703d6ebaae1e8b307058b818c2c4a105c58f57bb8b7238f413512e`.
The supported `update-module` action deployed the immutable module/Satellite
digests above and refreshed coordinated dependencies. All 13 containers are
running with zero restarts; monitoring, PostgreSQL, sync and retention timers
are healthy; gateway authorization and negative mutation checks passed.
Transcript capture remains off for both agents.

Isolated lifecycle testing found that the published PostgreSQL restore hook
fails when demoting the bootstrap superuser. The local correction passes dump
restore, cleanup, decryption and disabled-bootstrap-login checks, but has not
been published or deployed. Automatic approval review rejected controlled SIP
tests because live credential use and provider calls lacked explicit approval;
approval was requested. No live endpoint or provider test call was started.

## Release work remaining

Publish and deploy the tested restore correction. Complete approved live
OpenAI SIP transcription, browser layouts/state handling, the ten-concurrent-call
sizing target and a full NS8 restore/clone round trip. Isolated DB failure,
overflow, restart, expiry/deletion, concurrent policy, optional provider errors,
administrator authorization and 100,000-run pagination now have evidence in
[phase3-test-report.md](phase3-test-report.md); live provider capture and call
throughput remain unvalidated. Leave caller listening, exact
email/VAT pronunciation and the real external incoming path to the human
acceptance work already recorded in the Phase 2 reports.

## Rollback procedure

Before rollout, preserve an NS8 backup and the last accepted coordinated module
and Satellite image digests. If rollback is needed, disable optional capture
through the Phase 3 settings, wait for configuration application and drain active
calls. Disable `satellite-monitoring-retention.timer`, then revert the coordinated
images together using the normal NS8 update procedure. Do not delete the
monitoring schema or rotate its content key as part of a code rollback. Phase 2
ignores the additive monitoring data and extra snapshot field; that history is
unavailable in its UI but remains retained for a subsequent Phase 3 upgrade.
Restoring an older backup can reintroduce its retained history, so startup policy
and expiry must finish before the Phase 3 history APIs serve it. This procedure
still requires lifecycle acceptance before release.

Wizard deep links use `#!/agents`, matching the default hash prefix in the pinned [AngularJS 1.8.3 source](https://raw.githubusercontent.com/angular/angular.js/v1.8.3/src/ng/location.js).
