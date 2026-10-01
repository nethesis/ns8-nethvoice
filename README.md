# NethVoice

NethVoice porting to NethServer 8

## Install

Instantiate the module with:

    add-module ghcr.io/nethesis/nethvoice:latest 1

The output of the command will return the instance name.
Output example:

    {"module_id": "nethvoice1", "image_name": "nethvoice", "image_url": "ghcr.io/nethserver/nethvoice:latest"}

## Proxy 

This module is intended to be used with the ns8-nethvoice-proxy module as SIP proxy

## Configure

Module can be configured from cluster-admin NethServer 8 interface.

### Reports rebranding

Reports UI rebranding is managed from the cluster-admin `Rebranding` page. The selected values are propagated through the `get-rebranding` and `set-rebranding` tasks into the `REPORTS_UI_*` environment variables, then exposed to the `reports-ui` container and finally rendered into runtime configuration by `reports/ui/config-gen.sh`.

The current report branding fields are:

- `REPORTS_UI_BRAND_NAME`
- `REPORTS_UI_LOGIN_LOGO_URL`
- `REPORTS_UI_FAVICON_URL`
- `REPORTS_UI_LOGIN_BACKGROUND_URL`
- `REPORTS_UI_LOGIN_BACKGROUND_COLOR`

To make also provisioniong RPS work with Falconieri, you need to manualy set `SUBSCRIPTION_SECRET` and `SUBSCRIPTION_SYSTEMID` into `~/.config/state/environment` 
file and restart freepbx container with `systemctl --user restart freepbx`

Also `PUBLIC_IP` environment variable should be configured

You can access NethVoice wizard at:
```
https://makako.nethesis.it/nethvoice/
```

## Notify for services

After FreePBX configurations have been applied, some containers should be restarted or reloaded.
The `watcher.path` units looks for files named `<action>_<service>` inside the `notify` directory.

If a container wants to signal a restart, it must mount the file using the `volume` option. Eg:
```
--volume=./notify:/notify
```

Then, create a file named `<action>_<service>`, like `reload_nethcti-server`.
The file must be created inside the container. Example:
```
touch /notify/restart_nethcti-server
```

## Phonebook integration

The module defines the `pbookreader` role that allows to call the following API:

- `get-phonebook-credentials`: return the phonebook credentials, including the host, port, username and password

This role can be used by other modules to access the phonebook.

The module is a provider for the `<module_id>/srv/tcp/phonebook` service.
It raises an event named `phonebook-settings-changed` with the following payload:

- `module_id`: the module id
- `node_id`: the node id
- `module_uuid`: the module uuid
- `reason`: the reason for the change

Consumers of the events must then run the `get-phonebook-credentials` action on `module_id` to get the updated phonebook credentials.

## NethCTI Middleware management

The module includes a small CLI helper named `ctictl` to call administrative middleware endpoints defined under `/admin/*`.


- **List available admin APIs**:

```bash
ctictl --list
```

- **Import a CSV into a user's phonebook**:

```bash
ctictl /admin/phonebook/import --file contacts.csv -P username=giacomo
```

- **Trigger a profiles reload (super-admin required)**:

```bash
ctictl /admin/reload/profiles
```

Notes:

- `ctictl` reads the super-admin token from the `NETHVOICE_MIDDLEWARE_SUPER_ADMIN_TOKEN` environment variable, or falls back to a `passwords.env` file if present.
- Use `-v` / `--verbose` to see request/response details and headers.


## Timer logs

These units are silenced to keep the journal small:

- `nethvoice-calendar-sync.service` (every minute)
- `nethvoice-queue-stats-reset.service` (every minute)
- `nethvoice-hotel-alarms.service` (every minute)
- `satellite-recordings-cleanup.service` (every 10 minutes)

Each one sets:

```
StandardOutput=null
StandardError=null
LogLevelMax=warning
```

`StandardOutput` and `StandardError` drop the command output. `LogLevelMax` drops
the `Starting`/`Finished` lines and the `podman` container events. Unit failures are
still logged.

To restore the logs of one unit, add a drop-in. Example for
`nethvoice-calendar-sync.service` on instance `nethvoice1`:

```bash
runagent -m nethvoice1
mkdir -p ~/.config/systemd/user/nethvoice-calendar-sync.service.d
cat > ~/.config/systemd/user/nethvoice-calendar-sync.service.d/override.conf <<'EOF'
[Service]
StandardOutput=journal
StandardError=inherit
LogLevelMax=
EOF
systemctl --user daemon-reload
```

Read them with:

```bash
journalctl --user -u nethvoice-calendar-sync.service -f
```

To silence the unit again, remove the drop-in directory and run `systemctl --user
daemon-reload`.

The drop-in is lost when the module is updated or reinstalled.

## Hostname regression tests

The Robot suite covers [NethVoice #995](https://github.com/nethesis/ns8-nethvoice/pull/995) and [issue #8190](https://github.com/NethServer/dev/issues/8190). Run the existing **Test module** workflow on the PR branch to include browser tests. Its ordinary suite runs before the FIAS jobs, which use the same disposable infrastructure. For a local runner, enable `RUN_UI_TESTS=true` and run the whole `tests/` suite so installation and cleanup are included. A Robot `--dryrun` validates syntax and keyword resolution only.

The dependency suite installs the pinned [proxy #222](https://github.com/nethesis/ns8-nethvoice-proxy/pull/222) image **before** the NethVoice candidate. `PROXY_IMAGE_URL` can select a replacement build containing that fix. `LEGACY_NETHVOICE_IMAGE` defaults to `ghcr.io/nethesis/nethvoice:1.7.9` for the genuine backup fixture. Use only disposable nodes: the suite installs and removes applications, creates a local backup destination, writes phone fixtures and changes provisioning markers.

| Coverage | Robot test location |
| --- | --- |
| Initial setup and Settings use real browser inputs, reject empty/identical/case-equivalent hosts, save lowercase hostnames, and preserve route identities and dispatcher sets | `tests/05_ui.robot` |
| Direct configuration rejects matching hosts before persisted configuration or HTTP/SIP routes change | `tests/10_nethvoice_actions/00_configure_module_validation.robot` |
| Mixed-case action input is persisted in lowercase and omitted `lets_encrypt` preserves existing route and certificate settings | `tests/10_nethvoice_actions/10_configure_integrations.robot` |
| Legacy mixed-case or absent provisioning markers preserve real Tancredi tokens, without renewal or RPS attempts | `tests/10_nethvoice_actions/14_hostname_provisioning.robot` |
| A genuine hostname change writes the marker before the first-access token, updates the provisioning URL host, preserves the steady-state token, and later saves/restarts do not renew again | `tests/10_nethvoice_actions/14_hostname_provisioning.robot` |
| An unmodified legacy module creates a Restic backup containing mixed-case hosts, a database sentinel and Tancredi tokens. The candidate restores that snapshot and verifies persisted state, routes, repeated saves and service readiness | `tests/20_hostname_restore.robot` |

Provisioning tests use a locally administered MAC with no supported RPS vendor. This prevents contacting real phone registration services. Only token fingerprints leave the node. The ordering assertion temporarily adds a timestamp column to the disposable `admin` table and compares the marker insertion time with the new token file's timestamp, then removes the column. Successful RPS URL updates remain pending: the existing test helpers do not provide an authorized RPS receiver. The token-renewal test does not claim successful RPS registration.

### Manual device QA

Use paired proxy/NethVoice builds and test domains with working DNS and certificates. Record the exact image references, application versions and result for each step. Automated route, token and readiness checks do not replace these device checks.

1. After initial setup with `Voice.Example.org` and `CTI.Example.org`, generate a QR code in CTI and scan it with the current mobile app. Verify registration completes, reproducing the original #8190 scenario. Make an extension call and an inbound trunk call, and verify audio in both directions.
2. Restore a genuine backup created with mixed-case hostnames, then generate and scan a fresh CTI QR code. Repeat mobile registration, extension-call and inbound-trunk-call checks after restore.
3. With an authorized physical test phone and RPS account, verify case-only changes and a missing legacy marker preserve provisioning token fingerprints without renewal or RPS updates. For a genuine hostname change, observe the marker before the renewal request, verify the RPS URL has the new host and renewed token, and verify subsequent saves/restarts do not reset it again. Check that the phone provisions and registers successfully. Keep tokens, QR contents and subscription credentials out of artifacts.

Report executed Robot results with the CI run and its `tests-logs-*` artifacts. Report skipped, blocked or unexecuted cases separately from passes, and keep the device and RPS checks pending until they are actually observed.

## Uninstall

To uninstall the instance:

    remove-module --no-preserve nethvoice1

## Building images locally

Use `build-images.sh` to build the module images with Buildah:

```bash
bash build-images.sh
```

To rebuild only selected images during development, set `BUILD_IMAGES` to a
comma-separated list of full image names or short names:

```bash
BUILD_IMAGES=freepbx,janus REPOBASE=localhost/ns8-nethvoice bash build-images.sh
```

The script writes build timings to `build-timings.tsv` by default. Override the
path with `BUILD_TIMING_FILE` when comparing repeated runs.

### Local build variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `REPOBASE` | `ghcr.io/nethesis` | Registry/repository prefix used for the built images. Use a local prefix such as `localhost/ns8-nethvoice` when testing locally. |
| `IMAGETAG` | `latest` locally, current ref name in workflows | Tag applied to the built images. Slashes are normalized to dashes. |
| `BUILD_IMAGES` | empty | Comma-separated list of image names to build. Both full names (`nethvoice-freepbx`) and short names (`freepbx`) are accepted. Empty means build everything. |
| `BUILD_TIMING_FILE` | `build-timings.tsv` | Output file written at the end of the run with one timing row per image. |

Package-manager cache mounts are enabled inside the Containerfiles where they
already exist. The consolidated branch does not use Buildah registry layer cache
in either local builds or GitHub Actions.

### Rebuilding selected images

Use `BUILD_IMAGES` to limit a local iteration to the image you are changing:

```bash
BUILD_IMAGES=freepbx,janus \
REPOBASE=localhost/ns8-nethvoice \
IMAGETAG=dev-test \
bash build-images.sh
```

Local builds stay serial by default to avoid Buildah containers-storage
contention when multiple builds share the same storage root. Fast feedback comes
from building only the affected images, from the existing dependency/layer reuse
inside each Containerfile, and from the remote matrix workflow described below.

### Remote workflow layout

The repository uses one reusable workflow, `.github/workflows/build-images.yml`,
and two callers:

- `.github/workflows/publish-images.yml` for branch pushes and manual dispatches
- `.github/workflows/create-testing-pr-image.yml` for same-repository pull
  requests

Both callers build the same ordered matrix groups with `max-parallel: 3`:

1. `freepbx`
2. `app-support` (`tancredi,cti-server,phonebook,sftp`)
3. `reports` (`reports-api,reports-ui`)
4. `wrappers` (`mariadb,cti-middleware,cti-ui,satellite`)
5. `janus`
6. `module` (`nethvoice`)

The reusable workflow accepts:

| Input/secret | Meaning |
| --- | --- |
| `imagetag` | Tag to publish, normalized before use |
| `build-images` | Comma-separated image list for the selected matrix group |
| `runner-version` | Runner label, defaults to `ubuntu-latest` |
| `secrets.netrcb64` | Optional Base64-encoded `.netrc` used for authenticated downloads |

GitHub Actions also keeps `ui/node_modules` in `actions/cache`, keyed by
`ui/yarn.lock`. When a UI dependency changes, commit the updated lockfile so the
workflow cache key changes with it.

### Adding or updating an external resource

When a build depends on an external resource such as a wrapper image, Git
checkout, tarball, or installer:

1. Prefer immutable references: a version tag, commit SHA, or checksum-verified
   URL.
2. Avoid committing `latest`, branch names, or temporary development tags as the
   default source.
3. If the resource is downloaded through a checksum helper, update both the URL
   and the checksum source together.
4. If the resource is a wrapper/base image assembled in `build-images.sh`, keep
   the stable tag change in the script and test only the affected image group.
5. If the resource affects a specific Containerfile stage, rebuild only that
   image locally first, then let the GitHub Actions matrix rebuild the matching
   group.

### Adding a new build dependency

For system packages, language packages, or tools downloaded during the build:

1. Add the dependency in the narrowest relevant Containerfile stage.
2. Keep manifest files (`package.json`, `package-lock.json`, `yarn.lock`, and
   similar files) copied before the application source when possible, so
   dependency installation can still reuse unchanged layers.
3. Use the existing package-manager command style already present in that image
   (`npm ci`, distro package manager, Composer, and so on).
4. Rebuild the affected image locally with `BUILD_IMAGES=...`.
5. If the dependency affects the UI workflow cache, update and commit the
   matching lockfile so the remote cache key changes too.
6. After pushing, verify the corresponding GitHub Actions matrix group still
   succeeds.

### Working temporarily with a development tag

If you must test a branch-like or temporary development tag for an external
component, keep it out of mergeable defaults:

1. Make the change only in a disposable local checkout or a dedicated temporary
   branch.
2. For wrapper images, refresh the local source image first so Buildah does not
   reuse an older local copy:

   ```bash
   buildah pull ghcr.io/nethesis/nethvoice-cti:issue_8009
   ```

   If you need a complete reset, remove the affected local image from
   containers-storage and rebuild only the impacted image group.
3. Use a temporary `IMAGETAG` for the produced test images.
4. Before opening or updating a reviewable PR, replace the temporary reference
   with a stable version tag or SHA, or revert the change entirely.
5. Remember that GitHub-hosted runners start from clean storage, so stale
   branch-like image tags are primarily a local-development concern on the
   consolidated branch.

## Running tests locally

This module uses the NS8 standard testing infrastructure. For instructions on how to run the test suite locally, refer to the [Running tests locally](https://github.com/NethServer/ns8-github-actions/blob/v1/README.md#running-tests-locally) section of the ns8-github-actions repository.

## Music

This project incorporates a number of royalty-free, creative commons licensed music files. These files are distributed under the Creative Commons Attribution-ShareAlike 3.0 license through explicit permission from their authors. The license can be found at: http://creativecommons.org/licenses/by-sa/3.0/

* [macroform-cold_day] - Paul Shuler (Macroform), paulshuler@gmail.com

* [macroform-robot_dity] - Paul Shuler (Macroform), paulshuler@gmail.com

* [macroform-the_simplicity] - Paul Shuler (Macroform), paulshuler@gmail.com

* [manolo_camp-morning_coffee] - Manolo Camp, beatbastard@gmx.net

* [reno_project-system] - Reno Project, renoproject@hotmail.com
