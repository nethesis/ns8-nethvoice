## Test Suite Overview

The `test/bats` directory contains Tancredi's end-to-end HTTP test suite.
These tests exercise the public entrypoints, writable runtime directories,
upgrade scripts, and template rendering through the same `/tancredi/api/v1/`
and `/provisioning/` paths used in production.

The suite is not a plain unit-test run. It needs:

- `bats`
- `php`
- `curl`
- a Tancredi configuration file
- writable runtime directories for tokens, uploaded assets, and scope overrides
- an HTTP server exposing `/tancredi/api/v1/` and `/provisioning/`

`test/run.sh` is the supported entrypoint because it assembles those pieces for
you.

## Local Development Mode

For day-to-day development, run:

```bash
./test/run.sh
```

This default `local` mode:

- uses the checked-out repository code directly
- generates a temporary Tancredi config under `var/test-runtime/`
- creates a repo-local writable runtime tree under `var/test-runtime/data/`
- starts PHP's built-in web server with the same public paths used by the suite
- sets `file_reader = native`, so Apache modules are not required

Artifacts from fixture comparisons and the PHP server log are written under
`var/test-runtime/`.

Useful overrides:

- `TANCREDI_PORT` — fixed local HTTP port for the PHP server
- `TANCREDI_TEST_ROOT` — alternate local runtime directory
- `TANCREDI_ARTIFACT_DIR` — alternate artifact directory

Example:

```bash
TANCREDI_PORT=19080 ./test/run.sh
```

## System / CI Mode

To run against the deployed Apache-style layout used in CI, run:

```bash
sudo ./test/run.sh system
```

This mode expects the same prerequisites that `./.github/workflows/bats.yml`
creates:

- `/usr/share/tancredi/` populated with Tancredi code and shipped data
- `/var/lib/tancredi/data/` as the writable runtime tree
- `/etc/tancredi.conf`
- Apache aliases for `/tancredi/api/v1` and `/provisioning`
- `file_reader = apache` if you want to exercise `X-Sendfile`

Use `system` mode when you need to validate the current CI deployment model or
Apache-specific behavior.

## Scenarios

- `05_upgrade.bats` — upgrade scripts and idempotency against writable scope
  overrides
- `10_models.bats` — model CRUD behavior
- `20_phones.bats` — phone CRUD behavior and inheritance output
- `30_defaults.bats` — defaults API behavior
- `40_files_upload.bats` — asset upload/list/delete APIs
- `50_template_rendering.bats` — golden-fixture rendering for Yealink and Snom,
  plus template override precedence
- `55_template_operand_safety.bats` — provisioning rendering safety across
  vendor families when optional operands are blank

## Troubleshooting

- If local mode fails before the suite starts, check `var/test-runtime/php-server.log`.
- If a fixture comparison fails, the rendered file is copied to the artifact
  directory printed by the failing test.
- If you want to debug with the CI-style Apache deployment, use `system` mode
  rather than trying to point `bats` directly at a partially configured host.

