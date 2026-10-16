# Dependent service recovery

A failed systemd dependency job does not automatically retry when its parent recovers. `recover-dependent-services` explicitly maps FreePBX to Tancredi and Reports API to Reports UI. These dependents are configured through service enablement: only loaded, enabled or runtime-enabled units qualify. Disabled, masked and absent units stay untouched. CTI wizard gates, Hotel and Satellite feature state are outside this mapping.

The final parent `ExecStartPost` queues a nonblocking start after existing readiness checks. It also accepts the parent's `activating/start-post` state because the parent is not yet active at that point. Never use a blocking child start here: the child's `After=` dependency would wait for this same parent job. Existing jobs and active services are left alone. `--job-mode=fail` avoids replacing conflicting transactions. A queue error is logged but ignored by systemd so that it cannot restart healthy Asterisk.

During updates, `78update_mysql` port validation, database preparation and `fwconsole reload --dont-reload-asterisk` still precede the call-aware conditional restart. Preparation is skipped when FreePBX is inactive. Preparation errors prevent restart. After a successful restart, each mapped, enabled dependent is recovered and checked for up to 120 seconds (each systemctl command is limited to 10 seconds or the remaining budget, with a 150-second outer `timeout` guard in `80restart`). An unavailable prerequisite, queue failure or dependent that stays down fails the update. Recovery never restarts prerequisites. Starting an inactive dependent uses the freshly reloaded unit and current image environment, replacing any stale container through the existing `--replace` option.

The restart helper requires a successful Asterisk query with exactly one valid zero-call summary before executing the existing `try-restart` list. Empty, failed, timed-out or malformed queries are unknown, never zero. Active calls and unknown results are retried for up to three hours; expiry fails without restarting. `NETHVOICE_RESTART_TIMEOUT` may shorten this deadline to 1–10800 seconds. This deliberately fails closed if Asterisk cannot be queried, including when FreePBX is down; it does not silently infer zero calls from an inactive unit. No raw channel output is logged.

MariaDB and FreePBX each have a finite 600-second startup budget. FreePBX retains its existing 300-attempt, one-second Asterisk readiness check. This tolerates slower initialization beyond systemd's former default, while persistent failures remain bounded. Parent readiness and dependent recovery remain necessary regardless of this larger budget. The 600-second choice still requires validation on the dedicated test instance.

Run the local regressions with:

```sh
python3 -m unittest discover -s tests/unit -v
bash -n imageroot/bin/restart-services-when-convenient
podman build -t localhost/nethvoice-systemd-test -f tests/systemd/Containerfile tests/systemd
podman run -d --name nethvoice-systemd-test --systemd=always --cgroupns=private \
  -v "$PWD:/workspace:ro" localhost/nethvoice-systemd-test
podman exec -e NETHVOICE_ISOLATED_SYSTEMD_TEST=1 nethvoice-systemd-test \
  python3 /workspace/tests/systemd/test_recovery.py
podman rm -f nethvoice-systemd-test
```

The disposable container runs real systemd as PID 1 with fake workloads, preserving the production dependency ordering, parent service types and recovery post-command. A scope adapter translates user-manager requests to its isolated system manager. It covers dependency failure, parent recovery, pending child jobs, repeated recovery, disabled/masked services, ignored queue errors and use of an updated child definition. It does not validate Podman application images or application readiness. The CI workflow runs both this harness and the Python suite.

For application validation, create a new instance on a compatible fpbx17 baseline and record baseline states/images/ports/routes and an isolated backup or snapshot procedure. Use the unique PR image from its CI comment and record head/merge SHA, run URL and all component digests. Reproduce the baseline dependency failure with a temporary service override, remove it, update only that instance, then repeat the failure/recovery tests and a controlled delay over 90 seconds. Verify disabled/masked behavior, bounded waits, image replacement, authenticated CTI, Tancredi and Reports routes, restart counters and an approved controlled test call. Remove fixtures, calls and forwards, then observe for at least 15 minutes. Do not reboot the node without separate approval or assume image downgrade reverses migrations. Keep the PR draft until the exact CI image passes this validation; publish only sanitized evidence.
