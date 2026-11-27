---
name: nethvoice-agent-e2e
description: Exercise NethVoice voice agents end to end on an authorized NS8 lab using registered SIP phones, Deepgram caller audio, OpenAI conversations, attended transfers, and correlated Agents Activity.
---

# Test NethVoice voice agents

Run the Python runner in this checkout. Resolve its absolute path relative to this skill as `../../../tests/voice-agents-e2e/run.py`. **Preserve the user's launch directory** when invoking Python. The runner places reusable synthetic WAVs directly in that directory and checks every clip before calling.

The default target is `voice2.makako.sf.nethserver.net`, module `nethvoice70` on the SSH node `root@makako.sf.nethserver.net`. Override all three with `--domain`, `--module` and `--host` for a different authorized lab. Use the trusted host key. Preflight verifies the FreePBX domain, configured OpenAI trunk, module topology, and active call count. Use the configured Satellite loopback speech API, or set `NVAGENT_LAB_DEEPGRAM_KEY` on the controller and pass `--speech-backend deepgram` with module transcription disabled. Select `--transport live` for preview calls. SIP calls require the explicit lab switch and webhook. The four chat scenarios require NethVoice chat and its public XMPP route. Preflight reports the module’s chat flag. A disabled flag blocks those cases while the remaining calls run.

## Run

For an authorized live functional test, invoke `python3 "$runner"`. This creates temporary extensions, queues, routes and agents, reloads the lab PBX and places synthetic calls. It transcribes received test audio through Satellite. Reports may include a short excerpt of synthetic speech when a match fails. Use the installed `nethvoice-admin` skill's pinned SIP endpoint helper, either on `PYTHONPATH` or via `--sip-helper /path/to/scripts/sip_endpoint.py`. The controller needs SSH, Python 3.10+, ffmpeg and the Python `websockets.sync` client for chat. The target module needs its normal NS8, FreePBX, CTI and rootless Podman tooling.

| Invocation | Purpose |
|---|---|
| `python3 "$runner" audio` | Generate missing clips and repair damaged cached WAVs. |
| `python3 "$runner" preflight` | Inspect target identity and readiness before fixture creation. |
| `python3 "$runner" list` | Display the exact transport/scenario combinations in each profile. |
| `python3 "$runner" smoke` | Calibrate both SIP audio directions, then test conversations on both OpenAI transports. |
| `python3 "$runner" functional --case name --transport live` | Repeat one scenario using new fixtures and a new report. |
| `python3 "$runner" latency` | Place 40 silent calls to the primary GPT-Live WebSocket agent, alternating 20 default-VAD calls and 20 with VAD disabled on the same disposable loopback carrier. |
| `python3 "$runner" latency --calls-per-mode 2` | Compare two calls per mode on a particular CI build. Keep a separate run directory for each build. |
| `python3 "$runner" recovery` | Exercise Satellite interruption during calls and after handoff. Run only in the requested dedicated recovery window. |
| `python3 "$runner" cleanup --run-dir "$original_run_dir"` | Resume teardown of a previous stopped run on the same host and module. |

The functional suite covers bilingual conversation, caller recognition, interruptions, silence and hangup, permitted and denied routing, callbacks backed by real call history, attended transfers, chat, voicemail, publication changes and deadlines. It checks speech at the receiving SIP endpoint, native transfer or queue evidence, and Agents Activity. The reports identify which transport and assertion failed.

Use the full functional run when no profile is specified. Preserve the first report when repeating a failed case. The JSON report in the printed private run directory lists admissions, expected speech facts, outcomes, timing, and teardown errors. Report blocked, unexecuted and failed cases explicitly. The CTI adapter records the temporary colleague’s ID and verifies that its profile and settings are empty before setup. During teardown it verifies that identity and removes only the profile association and settings created by the fixture. Unexpected rows stop cleanup and retain its ownership journal. A blocked prerequisite makes the full run unsuccessful. Check cleanup before leaving the lab. Generated WAVs stay in the launch directory. Endpoint captures are temporary. Never publish the ownership manifest, credentials, raw captures, or an unreviewed private report.

The latency profile observes 15 seconds after each SIP answer. It aligns the caller's recording with PJSUA's local confirmation event and uses Deepgram word timestamps to find the configured Italian welcome. Test calls pass the batch gate when each caller hears exactly one welcome, Activity records completion, and at least 95% hear its onset within 3 seconds. The private report includes each mode, caller-heard onset, median, p95, worst, known fallbacks and missing measurements. A missing or repeated greeting fails the batch. Deepgram receives only synthetic caller audio. No raw recordings or API keys enter the report.
