# Voice agents testing

Use Python **3.12** (images pin 3.12.13), PHP with pdo_mysql/mbstring/sodium,
Docker and the supported Node version from the UI lockfile. No vendor credentials
are needed for local tests. Keep both feature repositories side by side.

```sh
# In satellite, inside an isolated Python 3.12 environment:
python -m pip install -r requirements.txt -r requirements-agent.lock -r requirements-dev.txt
python -m pytest -o addopts='' tests -q --ignore=tests/foundation

# In ns8-nethvoice (M0_PYTHON can select the isolated interpreter):
M0_PYTHON=/path/to/venv/bin/python freepbx/tests/agents/run-foundation.sh
php freepbx/var/www/html/freepbx/admin/modules/satellite/tests/run_transcription_tests.php

cd freepbx/agents-ui
npm ci
npm run type-check
npm run lint
npm run format
npm test
npm run build
npm run test:browser
```

The foundation harness creates only disposable databases. It tests unsupported
development-state rejection before writes, interrupted setup, repeat preservation,
immutable publications/catalog, optimistic concurrency, native destination hooks,
per-agent routing/callback grants, retention, encrypted transcripts, separate DB
accounts and restore. It also runs paired PHP/Python contracts, provider emulators,
ARI ownership and confirmed transfers, compact native CDR/CEL identifiers and
restart recovery. Set `M0_REST_AUTOLOAD` to the installed REST Composer autoloader
to include authentication/CSRF HTTP cases. Set `VOICE_AGENT_EXTENSIONS_FILE` to
the pinned FreePBX `extensions.class.php` for native dialplan checks. Missing
optional integrations are reported explicitly. Do not run against a PBX database.

Build Satellite with both `Containerfile.agent` and `Containerfile`, then update
`satellite/upstream.env` only after verifying the downloadable source archive's
commit and checksum. `satellite/fetch-source.sh` enforces the checksum. Build the
FreePBX image with its isolated UI build stage. Inspect final images for source
maps, development helpers, tests, environment files and dependencies.

Staging uses a disposable instance and bounded synthetic call stimuli. Capture a
protected backup, verify zero calls, install the exact image pair, recreate agent
settings through PHP REST/Service and native PBX APIs, then check approved/denied
transfers, callback evidence, hangup, fallback, restart recovery and monitoring.
Record real-provider protocol/media measurements separately from human audio
checks. Synthetic emulators alone never establish live telephony acceptance.

The foundation harness isolates its fixtures from transcription and needs only
the agent runtime/test requirements. Transcription and its Prometheus metrics
remain covered separately with their own dependencies. Set `TMPDIR` to a private
writable directory when the host temporary filesystem has a quota.
