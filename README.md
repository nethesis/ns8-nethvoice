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

## Asterisk Prometheus metrics

Asterisk includes `res_prometheus` and serves metrics on its existing local HTTP
listener at `http://127.0.0.1:${ASTERISK_WS_PORT}/metrics`. The port is allocated
per instance; read `ASTERISK_WS_PORT` from the module's environment.

The Basic Auth username is `prometheus`. Before starting FreePBX, NS8 generates
`ASTERISK_PROMETHEUS_PASSWORD` in the module's `passwords.env` if it is missing.
The password survives restarts, updates and backups; cloning generates a new
password. Startup also handles backups made before this credential existed.
The container regenerates `/etc/asterisk/prometheus.conf` from this secret on
every start. For standalone FreePBX containers, supply
`ASTERISK_PROMETHEUS_PASSWORD` using letters, digits, underscores or hyphens;
metrics are disabled when it is absent.

Run Prometheus on the same node and configure a scrape job using the instance's
allocated port, for example:

```yaml
scrape_configs:
  - job_name: nethvoice1-asterisk
    metrics_path: /metrics
    basic_auth:
      username: prometheus
      password_file: /etc/prometheus/nethvoice1.password
    static_configs:
      - targets: ['127.0.0.1:20030'] # Replace with ASTERISK_WS_PORT
```

Securely copy the value of `ASTERISK_PROMETHEUS_PASSWORD` into the password file,
readable only by Prometheus. Its network namespace must be able to reach the
node's loopback listener. From the module shell, this command prompts for the
password and prints the metrics:

```bash
curl --user prometheus "http://127.0.0.1:${ASTERISK_WS_PORT}/metrics"
```

Asterisk shares HTTP routes with its existing HTTPS/WSS listener, so `/metrics`
also requires authentication there. No additional port or Traefik route is
created.

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


## Chat

The NethVoice chat (NethServer/dev#7648) is switched on from the Integrations page, or with
`set-integrations` and `{"chat_enabled": true}`. It adds two units running the `nethvoice-ejabberd`
image (see `ejabberd/README.md`): `chat-server` (ejabberd: XMPP over WebSocket, file uploads) and
`chat-gateway` (push notifications, mobile app web services). Both listen on loopback only.

- Ports: `CHAT_C2S_PORT`, `CHAT_HTTP_PORT`, `CHAT_COMPONENT_PORT`, `CHAT_GW_PORT`, four TCP ports of the module range.
- Traefik routes on the CTI host: `/xmpp-websocket`, `/upload`, `/chat-gw`; `/chat-gw` also on the PBX host, the domain the mobile app logs in with. Removed when the chat is off.
- Volumes: `chat-data` (ejabberd database), `chat-upload` (attachments), `chat-gw` (gateway database).
  The backup takes consistent snapshots of the two databases (`state/chat.db`, `state/chat-gw.db`) and the upload volume.
- Secret: `CHAT_COMPONENT_SECRET` in `passwords.env`.
- Erlang runs without epmd or a distribution port: `ejabberdctl` reaches the server through a Unix socket in the container.
- CTI groups: every CTI operator group is a group chat (`cti-<name>` room) kept by the gateway every 2 minutes.
  Its members are the group's operators only: seeing a group in the operators panel (`all_groups`, `grp_`) does
  not make a member. Members join and leave with the CTI; a deleted group's room is destroyed; a renamed group
  gets a new room.
- Settings, on the Integrations page or in `set-integrations` (defaults in brackets): `chat_retention_days` (365,
  3650 means forever) days kept for messages and uploads, `chat_upload_quota_mb` (200) upload space per user,
  `chat_upload_max_file_mb` (25) largest upload. `CHAT_DEBUG` (unset) turns on verbose logs of the chat programs.

  ```
  api-cli run module/nethvoice1/set-integrations --data '{"chat_enabled": true, "chat_retention_days": 180}'
  ```

## Timer logs

These units are silenced to keep the journal small:

- `nethvoice-calendar-sync.service` (every minute)
- `nethvoice-queue-stats-reset.service` (every minute)
- `nethvoice-hotel-alarms.service` (every minute)
- `satellite-recordings-cleanup.service` (every 10 minutes)
- `chat-retention.service` (daily)

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

## Uninstall

To uninstall the instance:

    remove-module --no-preserve nethvoice1

## Building images locally

This repository now has two testing paths:

- `test-module.sh` for the full Robot Framework integration suite against a
    real NS8 node
- `local_testing/run.sh` for fast, local REST API validation with Podman

### Local REST API testing

Use the local suite when you need a quick feedback loop for FreePBX and
Tancredi REST endpoints without provisioning a full NS8 environment.

Prerequisites:

- `podman`
- `python3`
- network access to pull the published test images, unless you override them
    with locally built tags

Run the default local REST suite:

        ./local_testing/run.sh

Useful local commands:

        ./local_testing/run.sh start
        ./local_testing/run.sh run-manifest ./local_testing/manifests/default.json
        ./local_testing/run.sh request GET /freepbx/rest/trunks
        ./local_testing/run.sh cleanup

The local suite starts MariaDB, FreePBX, and Tancredi in a disposable Podman
pod, seeds a known baseline of local REST users, computes the REST auth headers,
and executes a declarative manifest of API calls.

For the local suite structure, manifest format, extension workflow, and
debugging tips, see `local_testing/LOCAL_TESTING.md`.

### Full NS8 integration testing

Test the module using the `test-module.sh` script:

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
| `SATELLITE_IMAGE` | Digest-pinned Satellite PR #56 image | Optional Satellite base override for development. Replace the PR default with a versioned release before merging; see [packaging](satellite/README.md). |
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

## Release procedure

The same procedure applies to the [ns8-nethvoice-proxy](https://github.com/NethServer/ns8-nethvoice-proxy) module.

The release is managed with the [gh-ns8](https://github.com/NethServer/gh-ns8) extension for the GitHub CLI:

```bash
gh extension install NethServer/gh-ns8
```

Run every command from the repository root. The examples below release version `1.7.10`.

### 1. Check the repository status

```bash
gh ns8 module-release check
```

The output lists the open issues and the merged PRs since the latest release:

- PRs without a linked issue, merged into `main`
- Verified issues with all PRs merged into `main`: ready to release
- Verified issues with PRs still open: ready to release as soon as the PRs are merged
- Issues in progress or testing with PRs merged into `main`: release blockers
- Issues in progress or testing with PRs still open: they do not block the release

A new version can be released only when there are no release blockers.

### 2. Create the release

```bash
gh ns8 module-release create --with-linked-issues 1.7.10
```

### 3. Add the external components `HEAD` to the release notes

Edit the release message and append the latest commit of `nethesis/nethcti-server` (branch `ns8`).
The following script prints the section to paste into the release notes (it requires Bash 4 or later):

```sh
#!/bin/bash

# Associative array to store repositories, branches, and their corresponding GitHub URLs
declare -A repositories=(
    ["nethesis/nethcti-server"]="ns8"
)

# Function to get the last commit SHA for a given repository and branch
get_last_commit_sha() {
    repo=$1
    branch=$2
    last_commit_sha=$(gh api repos/"$repo"/commits/"$branch" --jq '.sha')
    echo -n "* https://github.com/$repo/commit/$last_commit_sha"
}

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is not installed. Please install it first."
    exit 1
fi

# Process each repository and branch in the associative array
echo "### External components \`HEAD\`"
for repo in "${!repositories[@]}"; do
    branch=${repositories[$repo]}
    get_last_commit_sha "$repo" "$branch"
    echo
done
```

### 4. Clean up intermediate testing releases

```bash
gh ns8 module-release clean 1.7.10
```

### 5. Comment the linked issues

```bash
gh ns8 module-release comment 1.7.10
```

The command adds a comment with the released version to every linked issue.
It can be used for testing releases too.

Finally, open the links printed in the terminal, close the issues and remove the `verified` label.

## Music

This project incorporates a number of royalty-free, creative commons licensed music files. These files are distributed under the Creative Commons Attribution-ShareAlike 3.0 license through explicit permission from their authors. The license can be found at: http://creativecommons.org/licenses/by-sa/3.0/

* [macroform-cold_day] - Paul Shuler (Macroform), paulshuler@gmail.com

* [macroform-robot_dity] - Paul Shuler (Macroform), paulshuler@gmail.com

* [macroform-the_simplicity] - Paul Shuler (Macroform), paulshuler@gmail.com

* [manolo_camp-morning_coffee] - Manolo Camp, beatbastard@gmx.net

* [reno_project-system] - Reno Project, renoproject@hotmail.com

## Voice agents alpha

Voice agents support fresh v8 installations and opt-in v9 consultations with matching NethVoice/Satellite
images. Configuration is PHP/MariaDB-owned and activation happens on publication.
See [architecture, installation and operations](docs/voice-agents.md) and
[validation and acceptance gaps](docs/voice-agents-validation.md).
