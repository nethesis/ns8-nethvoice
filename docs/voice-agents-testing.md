# Voice agents testing

Attended transfer requires matching runtime, CTI and gateway images plus live
acceptance. See [configuration, integration status and the synthetic Local
channel probe](voice-agents-attended-transfer.md) before running staging tests.

Use Python **3.12** (images pin 3.12.13), PHP with pdo_mysql/mbstring/sodium,
Docker and the supported Node version from the UI lockfile. No vendor credentials
are needed for local tests. Run the commands from the NethVoice repository root.

```sh
# With an isolated Python 3.12 environment active:
(cd satellite && python -m pip install -r requirements.txt -r requirements-agent.lock -r requirements-dev.txt)
(cd satellite && python -m pytest -o addopts='' tests -q)

# M0_PYTHON can select the same isolated interpreter:
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

Verify the application with both transcription flags off, each flag separately
on, both on, and SIGTERM/SIGINT shutdown. Tests also cover transcription startup
retry, endpoint isolation and cancellation/reaping of per-request workers.

Run `BUILD_IMAGES=satellite bash build-images.sh` to build `nethvoice-satellite`
from the checked-out `satellite/` directory. Use the Satellite and FreePBX images
from the same NethVoice build. The source tag tracks changes to `satellite/` and
`build-images.sh`.
Build the FreePBX image with its isolated UI build stage. Inspect final images
for source maps, development helpers, tests, environment files and dependencies.

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

## Live agent call suite

Use the repository [NethVoice agent E2E skill](../.agents/skills/nethvoice-agent-e2e/SKILL.md)
for real OpenAI calls and Italian and English Deepgram fixtures on the authorized lab.
Run the [Python entry point](../tests/voice-agents-e2e/run.py) from the directory where
you want the generated WAV files. The default profile is the full functional suite.
Use `list` to see the cases or `smoke` for the two-transport conversation check.

To test with module transcription disabled, set `NVAGENT_LAB_DEEPGRAM_KEY` in
the test controller environment and pass `--speech-backend deepgram` to the
runner. That key is used only for the synthetic caller audio and transcription.
Select `--transport live` on a preview instance. The SIP comparison requires
an isolated instance with `VOICE_AGENT_SIP_LAB_ENABLED=true`, a configured
OpenAI signing secret, and a reachable webhook.
