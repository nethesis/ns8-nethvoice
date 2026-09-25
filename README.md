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

## Service alerts

NethVoice publishes built-in service alerts through the metrics module's
module-provided alert rules interface.
Alert evaluation requires a metrics module that implements that interface.
Earlier metrics versions ignore the published rules and continue collecting metrics.
Notifications use the existing metrics module portal and email configuration.

Every alert has critical severity and a five-minute delay. A service alert fires
when its expected systemd unit is not active or is missing, while the systemd
exporter remains reachable. A separate `NethVoiceSystemdExporterDown` alert reports
scrape failures and suppresses individual service alerts during the outage.
English and Italian annotations identify the service, module, and node.

| Services | When monitored |
| --- | --- |
| systemd exporter | After module creation |
| FreePBX, MariaDB, Janus, Tancredi, Phonebook, CTI UI, Reports API/Redis/UI | After module configuration |
| CTI server and middleware | When the wizard reaches step 10 or requests CTI startup |
| Satellite and MQTT | When call or voicemail transcription is enabled |
| Satellite PostgreSQL | When transcription is enabled or the database unit remains enabled for historical transcripts |

Each service has a distinct `NethVoice<Component>Down` alert name, so recovering
one service does not clear another service's notification. This monitors systemd
unit availability. It does not probe Asterisk inside FreePBX, database response
times, WebSockets, RTP, telephony quality, AI APIs, or services in other modules.
Maintenance jobs and timers are excluded. Custom `SYSTEMD_EXPORTER_UNIT_INCLUDE`
and `SYSTEMD_EXPORTER_UNIT_EXCLUDE` filters must retain the monitored units, since
missing unit metrics also trigger alerts.

The `prometheus-alert-rules` helper owns the `systemd-exporter`, `core-services`,
`cti-services`, and `satellite-services` fields of
`module/<module_id>/metrics_alert_rules`. It publishes changes through
`module/<module_id>/event/metrics-alert-rules-changed`. Metrics assigns module
identity and scopes every query to the publishing instance.

Creation, configuration, integration changes, upgrades, restores, and clones
refresh these fields. Destruction removes them. Unrelated fields are preserved
and unchanged updates do not emit an event. If the bounded CTI readiness lookup
fails, existing CTI rules are retained. Instances without previously published
CTI rules defer them until a subsequent successful refresh or wizard startup
request. Other service rules continue to update.

To refresh the rules manually on an NS8 node, replace `nethvoice1` with the
instance ID and run:

```bash
runagent -m nethvoice1 prometheus-alert-rules update
redis-cli --raw HKEYS module/nethvoice1/metrics_alert_rules
```

Successful publication does not guarantee that metrics accepted the rules.
Check the metrics module journal for validation errors and its Prometheus
`/api/v1/rules` endpoint for loaded `NethVoice` alerts.

### Testing alert rules

From the repository root, run the Python publisher tests and generate the
Prometheus fixtures. Python requires PyYAML.

```bash
python3 -m unittest discover -s tests/unit
python3 tests/prometheus/generate_rule_tests.py /tmp/nethvoice-alert-rule-tests
podman run --rm --network=none --security-opt=label=disable \
  --volume=/tmp/nethvoice-alert-rule-tests:/work:ro --workdir=/work \
  --entrypoint=/bin/promtool quay.io/prometheus/prometheus:v3.5.3 \
  check rules rules.yml
podman run --rm --network=none --security-opt=label=disable \
  --volume=/tmp/nethvoice-alert-rule-tests:/work:ro --workdir=/work \
  --entrypoint=/bin/promtool quay.io/prometheus/prometheus:v3.5.3 \
  test rules tests.yml
```

The rule tests cover the five-minute threshold, all non-active states, missing
units, recovery, exporter outages, and separation between modules and services.
Robot tests also check publication during installation, configuration,
integration changes, and removal.

On a disposable leader node with the compatible metrics module and an already
configured NethVoice instance, enable the live alert suite with
`RUN_METRICS_ALERT_RULES_E2E:True`. It stops Tancredi and the exporter in turn,
waits for each five-minute alert, and restores each service in teardown:

```bash
python3 -m robot --suite '14 Prometheus Alert Rules' \
  --variable NODE_ADDR:test-node.example.org --variable module_id:nethvoice1 \
  --variable RUN_METRICS_ALERT_RULES_E2E:True tests
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
