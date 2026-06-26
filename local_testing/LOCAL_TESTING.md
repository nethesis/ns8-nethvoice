# Local REST Testing

The local suite under `local_testing/` is the fast feedback path for NethVoice
REST API work. It starts a disposable Podman pod with MariaDB, FreePBX, and
Tancredi, seeds a known baseline state, and executes a declarative manifest of
authenticated REST calls.

Use this suite when you need to validate REST behavior without provisioning a
full NS8 node. Keep using `test-module.sh` and the Robot suites in `tests/`
when you need full module integration coverage on a real cluster.

## Structure

```text
local_testing/
  run.sh                primary entrypoint for local REST testing
  LOCAL_TESTING.md      this guide
  bin/
    manifest_to_tsv.py  converts JSON manifests into runner input
  lib/
    env.sh              default environment and seeded identities
    log.sh              log helpers and fatal error handling
    podman.sh           pod lifecycle, waits, and logs
    database.sh         FreePBX admin and REST user seeding
    http.sh             REST auth, transport routing, manifest execution
  manifests/
    default.json        migrated local REST sequence from the old script
```

## Commands

Run the default full workflow:

```bash
./local_testing/run.sh
```

Start the stack and seed data without running a manifest:

```bash
./local_testing/run.sh start
```

Run a manifest against an already running stack:

```bash
./local_testing/run.sh run-manifest ./local_testing/manifests/default.json
```

Run a single authenticated request:

```bash
./local_testing/run.sh request GET /freepbx/rest/trunks
```

Remove the local pod and its test volumes:

```bash
./local_testing/run.sh cleanup
```

Inspect logs:

```bash
./local_testing/run.sh logs freepbx
./local_testing/run.sh logs tancredi
./local_testing/run.sh logs
```

## Environment Overrides

The suite keeps the same core overrides that existed in the monolithic script.
Useful examples:

```bash
APACHE_PORT=9080 ./local_testing/run.sh
NETHVOICE_FREEPBX_IMAGE=ghcr.io/nethesis/nethvoice-freepbx:mytag ./local_testing/run.sh
FREEPBX_ADMIN_PASSWORD=changeme ./local_testing/run.sh start
```

The defaults live in `local_testing/lib/env.sh`. Update that file only when the
baseline local test topology changes for everyone.

## Manifest Format

Manifests are JSON so the suite stays dependency-free apart from `python3`,
which is already required by the repository tooling.

Each operation supports these fields:

- `name`: human-readable description printed by the runner
- `method`: HTTP method
- `path`: request path beginning with `/`
- `payload`: optional JSON body
- `expected_status`: list of acceptable HTTP status codes
- `enabled`: optional boolean, defaults to `true`

Example:

```json
{
  "name": "Read trunk list",
  "method": "GET",
  "path": "/freepbx/rest/trunks",
  "expected_status": [200]
}
```

## Transport Rules

Normal FreePBX REST routes are called from the host against the published local
Apache port.

Tancredi and provisioning routes are different: they are executed from inside
the FreePBX container because Tancredi restricts `/tancredi/api/v1/*` to
`127.0.0.1`. Preserve this behavior when extending the suite.

## Extending The Suite

To add new local REST coverage:

1. Add a new operation to a manifest under `local_testing/manifests/`.
2. If the new route needs seed data, extend `local_testing/lib/database.sh` or
   add the prerequisite to the start flow in `local_testing/run.sh`.
3. Use `./local_testing/run.sh run-manifest ...` to validate the new calls.
4. Update this document if you introduce a new command or manifest convention.

If the default manifest becomes too broad, split it into smaller domain files
such as `users.json`, `devices.json`, or `routing.json`, then invoke them with
`run-manifest`.

## Debugging Failures

When a call fails:

1. Re-run the specific request with `./local_testing/run.sh request ...`.
2. Inspect the relevant logs with `./local_testing/run.sh logs freepbx` or
   `./local_testing/run.sh logs tancredi`.
3. If startup fails, inspect `mariadb` first, then `freepbx`, then `tancredi`.
4. If an expected status code changed intentionally, update the manifest rather
   than suppressing the error in the runner.

## Agent Notes

Agents working on NethVoice REST endpoints should prefer this suite before
reaching for the remote Robot stack when:

- the change is local to REST request handling or seeded FreePBX state
- the verification target is a known REST route or wizard flow
- the work does not depend on NS8 actions, events, or cluster coordination

Agents should still use the remote Robot suite for module lifecycle testing or
when a change crosses into NS8-specific orchestration.