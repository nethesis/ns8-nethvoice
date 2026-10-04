# Phase 3 implementation status

4 October 2026 — **source implementation present; validation and deployment pending**.

## Delivered source

| Milestone | Implementation |
|---|---|
| P3.0 | Monitoring contract, bounded gateway and separate private router; Phase 2 human acceptance remains open |
| P3.1 | PostgreSQL schema/migration, asynchronous bounded recorder, stable event IDs, sequence/gap handling, historical queries, restart reconciliation and retention |
| P3.2 | Dedicated Wizard Agents routes, authenticated gateway, inventory/settings, overview, run filters/pagination/detail/tool timeline, English/Italian text and FreePBX links |
| P3.3 | Per-agent default-off capture policy; optional OpenAI Realtime final transcripts, encrypted segments, explicit states/limits, revocation, deletion tombstones and actor/time audit |
| P3.4 | Service, retention timer, keys, backup/restore/clone and coordinated build source integration implemented; acceptance execution remains pending |

No tests, browser sessions, provider calls, remote configuration changes,
commits or deployments have been performed for this implementation turn.
Existing Phase 2 acceptance evidence is not evidence for these changes.

Static syntax checks passed for the Python implementation/action files, PHP
repositories/gateway/authentication changes, JavaScript controllers/services,
shell scripts and locale JSON. The packaged runtime was also assembled from the
pinned base and all 29 Python source files parsed successfully. These checks parse source; they do not execute
call, database, authentication or browser behavior.

## Runtime packaging

The NethVoice repository ships its runtime extension alongside the pinned
upstream base in `runtime-ref` (`d8e2b5845c64273df644d54486bb7222274b47bc`):

- `runtime-patches/phase3.patch`: changes to the existing event/configuration,
  provider and runtime seams, private router registration and dependency pin.
- `runtime-overlay/agent/monitoring/`: the authoritative new monitoring package.
- `build-images.sh`: archives that exact base from `SATELLITE_SOURCE_DIR` into a
  temporary build directory, applies the patch, copies the overlay, and builds
  without changing the supplied checkout. Local uncommitted source changes are
  not included by this packaging path.

This makes coordinated CI buildable without first publishing an upstream
Satellite commit. When these changes are integrated upstream, replace the base
reference and remove the corresponding patch/overlay together. Module-only
builds require an immutable Satellite image containing `agent.monitoring.api`;
the existing image compatibility guard now imports that module.

The development runtime worktree `.worktrees/satellite-phase2` also contains
these changes for continued runtime work. It is ignored by the main repository;
the patch and overlay are the source delivered by a main-repository commit.
Regenerate the patch from its tracked-file diff and copy new package files into
the overlay whenever changing that worktree. No external worktree commit is
required for the packaged build.

## Operational changes

Monitoring has no dependency on MQTT or legacy audio transcription enablement.
PostgreSQL is enabled on configure/update/integration changes, but startup failure
is tolerated by the call service. Backup requires an enabled database to start
and dump successfully; it does not silently skip an enabled history store.

Restore now matches the deployed pgvector PostgreSQL 18 volume path and uses a
unique bootstrap role so dump role creation does not conflict with an already
created Satellite role. SQL errors fail the restore. The restore password is passed through the
process environment, not a Podman command argument. The bootstrap role loses
login and elevated privileges afterward. Older backups with no database dump
remain supported. A missing content key is generated only for older backups;
existing keys are preserved. Clones remove copied PostgreSQL dump files and
reset transcript opt-in in the native policy.

History admission guards leave reads available when full. A policy extension
cannot revive already expired rows or segments. Capture generations and deleted
run tombstones prevent delayed/retried text from reviving revoked content.
Optional provider observations have their own bounded queue so they cannot
consume the voice/tool event queue.

## Release work remaining

Execute the acceptance scenarios already specified in
[phase3-plan.md](phase3-plan.md), including controlled OpenAI SIP transcription,
provider-option failure, DB outage/overflow, restart, expiry/deletion/concurrent
policy changes, backup/restore/clone, administrator authorization, Playwright
layouts and the initial 10-call/100,000-run sizing target. Neither throughput nor
provider transcript behavior is validated yet.

After validation, publish the coordinated images, update `nethvoice51`, and
record image digests and acceptance results. Leave caller listening, exact
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
