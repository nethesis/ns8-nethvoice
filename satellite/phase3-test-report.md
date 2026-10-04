# Phase 3 deployment and acceptance

Target: `nethvoice51` on `makako.sf.nethserver.net`, NS8 node 1.
Date: 4 October 2026. **Test deployment completed; release acceptance remains open.**

## Deployed images

The supported cluster `update-module` action completed successfully with
`force: true`, after an independent check reported zero active calls/channels.
The owner authorized the required restarts. All coordinated component images
were refreshed; no proxy image update was requested.

| Component | Verified digest |
|---|---|
| NethVoice module | `sha256:ed9a63777c35d3fc10fba1a640d785ee1bf699665ea3a70e199f1185bd86ff8e` |
| Satellite | `sha256:ab37eb3be709684611c881f3de0dcc1b770b4fe926fdb2e4bbc84beb71d32de6` |
| FreePBX | `sha256:3ba8519794eb3fee796faba9c4b8ced2f63ccd7c364a66145ca3f7e60f5c4459` |

These images came from repository commit
`e6313215baaf619c7095357e6db70cb7cb2fc2b5`,
[Publish images run 37218895329](https://github.com/nethesis/ns8-nethvoice/actions/runs/37218895329).
The FreePBX built-in destination repository matches the checked-in fallback
editing fix: SHA-256
`1d71769822d6bf4818fa9ff0a6f9f62806e990c7b0abbeeb35f282f86450081b`.

## Backup and rollback

Preserved all **16** installed module/dependency images under local rollback
tags. The module image is also preserved in the cluster's rootful image store,
so the supported cluster update action can resolve the rollback reference.
Root-only directory:
`/var/tmp/nethvoice51-phase3-20261004/`.

It contains `images.json`, `rollback-input.json`, `restore-image-tags.py`,
and protected update/backup action results. Rollback requires retagging the
preserved dependencies before invoking `update-module` with `force: false`;
otherwise mutable `agent` tags can select newer components.
No matching update/backup rows were found in the API-server audit database;
the CLI action results, snapshot identity and independently verified installed
state are the available operational evidence.

Created backup definition **7**, enabled it for the manual backup, verified
the snapshot, then disabled its future-dated schedule. The installed NS8
helper skips disabled backup plans even for manual runs; its initial successful
no-op was detected by the independent snapshot check and corrected.

Snapshot:
`c1b66e220c703d6ebaae1e8b307058b818c2c4a105c58f57bb8b7238f413512e`.
Completed at `2026-10-04T18:05:50Z`, **21,827,690 bytes**, **527 files**, zero
reported backup errors. Verified snapshot entries:

- Module environment and secret file; the monitoring content key is present.
- Compressed MariaDB and Satellite PostgreSQL dumps.
- Asterisk database dump.

The snapshot and secrets remain in the existing protected cluster repository.
No secret values or communication content were printed or added to the report.
An NS8 restore into a second module has not been executed.

## Acceptance results

| Check | Result | Evidence and scope |
|---|---|---|
| Existing Satellite runtime suite | PASS | 118 passed, 1 skipped inside the exact published image; tests archived from `runtime-ref`; existing deprecation/mock warnings remain |
| Phase 3 isolated acceptance | PASS | 14 tests against PostgreSQL 18 and the published Satellite image |
| Default-off capture and unsupported provider | PASS | No text persisted for disabled capture; unsupported binding explicitly labeled |
| Encryption and deletion | PASS | Ciphertext storage, successful decryption, idempotent deletion audit and delayed-write tombstone |
| Capture generations and concurrent policy | PASS | Revoked generations rejected; persisted policy matches final concurrent update |
| Retention | PASS | Expired text/runs remain unavailable after extending retention; purge removes expired metadata |
| Restart and persistence | PASS | Ten synthetic run traces, deduplicated events, sequence gaps, previous-epoch active run reconciled as interrupted |
| Queue/storage limits | PASS | Queue stays within 4096 records/4 MiB; loss marks incomplete history; event capacity preserves terminal state and reads |
| Database failure/recovery | PASS | Connection refusal in isolation; event loop remains responsive; queued records drain after recovery |
| Schema compatibility | PASS | A newer migration version is rejected |
| Private API | PASS | Bearer authorization, limits/cursor validation, stale ownership and transcript `no-store` |
| Provider observations | PASS, mocked | Optional transcript-update failure and observation overflow leave the tool/control queue usable |
| 100,000-run fixture | PASS | Two 100-row pages read in approximately 17–18 ms; disjoint pagination; additional run admission rejected |
| PHP/VisualPlan regressions | PASS | Earlier checkpoint: transcription runner 13/13, Agent save services, graph and JavaScript suites |
| Deployed authenticated gateway | PASS | Overview, health, inventory, runs and native policy return 200 and `Cache-Control: no-store` |
| Deployed negative authorization/mutations | PASS | Missing/invalid credentials, foreign origin, cross-site request and missing CSRF return 403; unknown query 400; limit 101 returns 422; stale revision 409; invalid retention 400; native policy/revision unchanged |
| Restore hook, published source | **FAIL** | PostgreSQL 18 rejects `NOSUPERUSER` on the initdb bootstrap role |
| Restore hook, corrected local source | PASS | Same hook with disposable dump/volume: exit 0, zero SQL errors, cleanup completed, one run/two encrypted segments restored and decryptable; bootstrap login disabled and password cleared |
| Browser/UI acceptance | BLOCKED | Computer-use inventory has no browser; creating an in-app browser returned `Browser is not available: iab` |
| Live OpenAI SIP/ASR | PENDING APPROVAL | Automatic approval review rejected extracting extension 201's SIP credential and starting a host-network third-party test container because controlled provider calls were not explicitly authorized |
| NS8 clone/full restore round trip | NOT RUN | Hook-level isolated restore is not a complete NS8 clone/restore acceptance |

The 100,000-run measurement covers metadata pagination, not 10 concurrent live
calls, the one-million-event ceiling or the 2 GiB relation-size ceiling.
Provider tests use synthetic event fixtures; they do not establish live SIP ASR
compatibility. No live test endpoint was started and no new provider call was made.

Repeat the isolated checks with:

```bash
satellite/tests/run-monitoring-acceptance.sh
```

The runner pins the runtime and PostgreSQL images, creates private test
networks/containers/volumes, runs the database/API/provider-fixture checks,
executes the repository restore hook through a Docker compatibility wrapper,
verifies decryption and bootstrap login, and removes its resources on exit.
It does not use production credentials or the live PBX.

## Restore correction and publishing gate

Corrected [23satellite_pg](../imageroot/actions/restore-module/23satellite_pg):
keep PostgreSQL's required bootstrap superuser attribute, disable its login,
clear its password, and explicitly exit the sourced initialization script so
the restore container completes instead of starting a permanent server.
The PostgreSQL restriction is enforced in its
[role implementation](https://github.com/postgres/postgres/blob/master/src/backend/commands/user.c).

**This correction is local and tested; it is not contained in the deployed
published module digest above.** Publish and deploy a corrected module image
before accepting the lifecycle milestone. No live restore was attempted and
the deployed restore hook was not patched outside the image lifecycle.

## Final operational state

At `2026-10-04T18:29:04Z`, all 13 NethVoice containers were running, with zero
container restarts and no failed user units. Satellite and FreePBX systemd
restart counts are zero. Monitoring health is available, with an empty queue,
zero drops and an available content key. PostgreSQL, configuration sync and
retention timers are active. Native desired/acknowledged configuration revision
is **26**, with matching hashes and no sync error.

Metadata retention remains **30 days**, text retention **7 days**, and transcript
capture remains **off for Internal and External**. The proxy's four containers
remain running with zero restarts; its route `sip:10.5.4.1:22002` matches the
effective Asterisk UDP listener. Authenticated gateway checks succeeded through
the configured HTTPS host with normal certificate verification. Asterisk
22.10.0 reports zero active calls/channels.

Human listening, exact email/VAT pronunciation and the real external incoming
path remain the separate Phase 2 acceptance gates. Phase 3 also still needs
browser layouts/state checks, approved live provider capture, concurrent call
sizing, full NS8 restore/clone and publication of the restore correction.
