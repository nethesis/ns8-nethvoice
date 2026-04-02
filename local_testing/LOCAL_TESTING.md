# Local REST Testing

The local suite under `local_testing/` is the fast feedback path for NethVoice
REST API work. It starts a disposable Podman pod with MariaDB, FreePBX, and
Tancredi, seeds a known baseline state, and executes a declarative manifest of
authenticated REST calls.

Use this suite when you need to validate REST behavior without provisioning a
full NS8 node. Keep using `test-module.sh` and the Robot suites in `tests/`
when you need full module integration coverage on a real cluster.

## Workflow

### collect fixture from a production machine

ssh into machine and go in nethvoice instance with `runagent -m nethvoiceX`, then collect fixture 

```bash
CASE=prod-sample
OUT="/tmp/${CASE}"

mkdir -p "${OUT}"

podman exec mariadb sh -lc \
  'mysqldump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction --routines --triggers --events --add-drop-database --databases asterisk --skip-comments --skip-dump-date' \
  > "${OUT}/dump.sql"

podman exec freepbx tar -C /etc -czf - asterisk \
  > "${OUT}/etc-asterisk.tar.gz"

tar -C /tmp -czf "/tmp/${CASE}.tar.gz" "${CASE}"

rm "${OUT}/dump.sql"
rm "${OUT}/etc-asterisk.tar.gz"
echo "Created:"
echo "  /tmp/${CASE}.tar.gz"
```

### explode fixture 

now on your development workstation, in the repository root, copy the remote archive, delete it from remote machine and explode the tarball  

```bash
scp makako.sf.nethserver.net:/tmp/prod-sample.tar.gz local_testing/
ssh makako.sf.nethserver.net 'rm -f /tmp/prod-sample.tar.gz'
CASE=prod-$(date +%s)
mkdir -p local_testing/fixtures/${CASE}
tar xzpf local_testing/prod-sample.tar.gz -C local_testing/fixtures/${CASE} --strip-component=1
rm -f local_testing/prod-sample.tar.gz
echo "Fixture ${CASE} created!"
```

### Generating config and testing differences

Cleanup the stack if it is needed 
```bash
./local_testing/run.sh cleanup
```

check the diff
```bash
./local_testing/run.sh test-fixture ${CASE}
```

## Structure

```text
local_testing/
  run.sh                primary entrypoint for local REST testing
  LOCAL_TESTING.md      this guide
  fixtures/             saved dump.sql + etc-asterisk.tar.gz cases
  bin/
    manifest_to_tsv.py  converts JSON manifests into runner input
  lib/
    env.sh              default environment and seeded identities
    log.sh              log helpers and fatal error handling
    podman.sh           pod lifecycle, waits, and logs
    database.sh         FreePBX admin and REST user seeding
    http.sh             REST auth, transport routing, manifest execution
    fixtures.sh         fixture capture, dump restore, and diff helpers
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

Create a fixture case after running a manifest on a clean stack:

```bash
./local_testing/run.sh create-fixture myfixture ./local_testing/manifests/default.json
```

Create a baseline fixture without running any API calls:

```bash
./local_testing/run.sh create-fixture baseline
```

Compare the running FreePBX container against a saved fixture:

```bash
./local_testing/run.sh diff-fixture trunks
```

Rebuild a clean stack from a saved dump, regenerate config, and diff it against the fixture:

```bash
./local_testing/run.sh test-fixture trunks
```

List available fixture cases:

```bash
./local_testing/run.sh list-fixtures
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

By default, the image tag follows the current Git branch name, sanitized so it
is valid as a container tag. If the repository is in a detached `HEAD` state,
the suite falls back to `latest`. You can still override individual image
references or set `IMAGETAG` explicitly.

Useful examples:

```bash
APACHE_PORT=9080 ./local_testing/run.sh
IMAGETAG=mybranch ./local_testing/run.sh
NETHVOICE_FREEPBX_IMAGE=ghcr.io/nethesis/nethvoice-freepbx:mytag ./local_testing/run.sh
FREEPBX_ADMIN_PASSWORD=changeme ./local_testing/run.sh start
```

The defaults live in `local_testing/lib/env.sh`. Update that file only when the
baseline local test topology changes for everyone.

Set a custom fixture library location:

```bash
FIXTURES_DIR=/tmp/nethvoice-fixtures ./local_testing/run.sh list-fixtures
```

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

## Fixture Library

Fixture cases live under `local_testing/fixtures/<case>/` by default.

Each case contains:

- `dump.sql`: a `mysqldump` export of the `asterisk` database
- `etc-asterisk.tar.gz`: a tarball of the generated `/etc/asterisk` tree, excluding the volatile `backup/` subdirectory

The intended workflow is:

1. Start from a clean local stack.
2. Run the API workflow that mutates FreePBX state, usually through a manifest.
3. Wait for `need_reload=false` so the generated config is stable.
4. Save the matching `dump.sql` and `etc-asterisk.tar.gz` pair with `create-fixture`.
5. Re-run the same case later with `test-fixture`, which restores the dump into MariaDB, reapplies the current local-testing environment values to the imported database, runs `fwconsole reload`, and diffs the generated `/etc/asterisk` tree against the saved fixture without calling the API.

`diff-fixture` is the lighter check for an already running stack. It compares the live container tree against the saved tarball and prints a recursive unified diff when files differ.

Before diffing, the suite normalizes known volatile content on both the saved
fixture and the live `/etc/asterisk` tree:

- removes `keys/`
- removes `recallonbusy.cfg`
- removes files whose name contains `custom`
- removes files whose name has any suffix after `.conf` such as `manager.conf.bak`, `extensions_additional.conf_test`, or `.conf...`
- rewrites `manager_additional.conf` to `secret=${NETHCTI_AMI_PASSWORD}`
- rewrites `manager.conf` to `port = ${ASTMANAGERPORT}`
- rewrites `manager.conf` to `secret = ${AMPMGRPASS}`
- rewrites the line after `[secret]` in `proxycti` to `${NETHCTI_AMI_PASSWORD}`
- rewrites `res_odbc_additional.conf` to `password=>${CDRDBPASS}`

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

If you are working on generated Asterisk config rather than HTTP responses, prefer creating a dedicated fixture case and validating it with `test-fixture` before reaching for the slower Robot suite.

## Debugging Failures

When a call fails:

1. Re-run the specific request with `./local_testing/run.sh request ...`.
2. Inspect the relevant logs with `./local_testing/run.sh logs freepbx` or
   `./local_testing/run.sh logs tancredi`.
3. If startup fails, inspect `mariadb` first, then `freepbx`, then `tancredi`.
4. If an expected status code changed intentionally, update the manifest rather
   than suppressing the error in the runner.

When a fixture comparison fails:

1. Re-run `./local_testing/run.sh diff-fixture <case>` against the current stack to inspect the live diff.
2. If the generated config changed intentionally, recreate the fixture with `create-fixture` from the updated workflow.
3. If `test-fixture` fails before diffing, inspect `freepbx` logs first because the regeneration path depends on `fwconsole reload`.

## Agent Notes

Agents working on NethVoice REST endpoints should prefer this suite before
reaching for the remote Robot stack when:

- the change is local to REST request handling or seeded FreePBX state
- the verification target is a known REST route or wizard flow
- the work does not depend on NS8 actions, events, or cluster coordination

Agents should still use the remote Robot suite for module lifecycle testing or
when a change crosses into NS8-specific orchestration.