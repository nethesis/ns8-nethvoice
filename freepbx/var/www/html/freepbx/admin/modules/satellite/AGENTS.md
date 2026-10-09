# AGENTS.md — FreePBX satellite module

## Scope

Applies to everything under this directory.

This module has three live responsibilities:

1. `functions.inc.php` generates the Asterisk dialplan hooks for Satellite call
   transcription and the `satellite` Stasis entrypoint.
2. `bin/satellite_transcript` turns MixMonitor leg files into labeled uploads
   for the local Satellite HTTP API.
3. Agent configuration, workflow destination reconciliation and agent dialplan
   hooks connect the Wizard workflow builder to the Satellite agent runtime.

Most edits here affect live call handling, recording lifecycle, or transcript
upload behavior.

## Read First

- `functions.inc.php`
- `bin/satellite_transcript`
- `tests/attended_transfer_segments_test.php`
- `Satellite.class.php`
- `module.xml`
- workspace parent: `AGENTS.md`; repository: `COMPONENTS.md`, `freepbx/README.md`
- repository `satellite/agent-api-contract.md`, `monitoring-api-contract.md`,
  `phase4-api-contract.md`, and `workflow-api-contract.md` for affected agent work

## Current Source Of Truth

- `satellite_get_config()` is a no-op; `satellite_get_config_late()` does the
  real dialplan work.
- Transcription dialplan is active only for the `asterisk` engine and when
  `SATELLITE_CALL_TRANSCRIPTION_ENABLED == 'True'`. Agent dialplan generation
  is separate and runs for the `asterisk` engine even with transcription off.
- Current splice targets: `macro-exten-vm`, `ext-queues`,
  `from-queue-exten-only`, `macro-dialout-trunk`, and generated
  `satellite-ext-callrecording`.
- `sub-satellite-record-check` is currently simple: `DumpChan`, skip duplicate
  `HASH(SATELLITE_ACTIVE_RECORDINGS,${UNIQUEID})`, set
  `__SATELLITE_LOCAL_MIXMON_ID`, run `MixMonitor`, return.
- MixMonitor files:
  `/var/run/nethvoice/satellite-r-${UNIQUEID}-${CHANNEL(linkedid)}.wav` and
  `/var/run/nethvoice/satellite-t-${UNIQUEID}-${CHANNEL(linkedid)}.wav`.
- Post-process command:
  `/var/lib/asterisk/bin/satellite_transcript -u ${UNIQUEID} -l ${CHANNEL(linkedid)}`.
- The `satellite` context is only a thin `Stasis('satellite')` wrapper.
- `Satellite.class.php` handles TTS/admin services and native agent configuration,
  managed trunks, profiles, fallback validation and synchronization. The call
  transcription segmentation pipeline remains in `bin/satellite_transcript`.

Treat older docs as stale unless the code reintroduces them. In particular,
there is no current `satellite-recordcheck`, `stoprec`, or broader
`in/out/conf/page/parking` recording-policy tree in `functions.inc.php`.

## `satellite_transcript`

- Dual-purpose file: CLI entrypoint plus library for tests.
- Args: required `-u|--uniqueid`, `-l|--linkedid`; optional
  `-c0|--channel0_name`, `-c1|--channel1_name`. Tests set
  `SATELLITE_TRANSCRIPTION_LIBRARY_MODE` so the file can be loaded without
  executing `main()`.
- The helper requires `sox`, locks per `uniqueid+linkedid`, expects the two
  MixMonitor leg WAVs above, and loads CEL/CDR rows by `linkedid`.
- Main pipeline: resolve recording anchor, build bridge-derived segments,
  normalize Local-channel segments, fall back to CDR when needed, enrich party
  labels, coalesce adjacent transfer slices, render stereo WAVs, upload.
- Transfer-sensitive logic lives mainly in `resolve_recording_context()`,
  `normalize_local_channel_segments()`, and `coalesce_adjacent_segments()`.
- **Voicemail legs are silently skipped.** Before running the segmentation
  pipeline the helper calls `detect_voicemail_leg($cdrRows, $uniqueid)`. The
  leg is skipped (and no upload happens) when the CDR row matching the current
  `uniqueid` has `lastapp = 'VoiceMail'` — voicemail audio is near-empty and
  yields no useful transcript. Only the row matching the current uniqueid is
  checked, so a sibling leg going to voicemail does not skip the main call.
  In that case the helper just logs the skip reason and falls through to the
  normal cleanup branch, so the leg WAVs are deleted and the satellite API is
  never called. Transfers and conferences are transcribed via the segmentation
  pipeline (transfer-segment handling lives in `resolve_recording_context()`,
  `normalize_local_channel_segments()`, and `coalesce_adjacent_segments()`).
- On success the helper deletes the original leg files and temporary segment
  files.
- Debug logging is on by default unless `DEBUG` is `0`, `false`, `no`, or
  `off`.

## `POST /api/get_transcription`

- Target URL:
  `http://127.0.0.1:${SATELLITE_HTTP_PORT}/api/get_transcription`
- Auth: send `Authorization: Bearer <SATELLITE_API_TOKEN>` when
  `SATELLITE_API_TOKEN` is set.
- Request shape: multipart `file` plus the parameters used by the helper,
  especially `uniqueid`, `linkedid`, `channel0_name`, `channel1_name`,
  `persist=true`, `multichannel=true`, `encoding=linear16`, `sample_rate=8000`,
  `channels=2`, and optional `summary=true`.
- Upstream currently accepts WAV and MP3 media types even though one error text
  still says WAV only.
- Response JSON: `{"transcript": <text>, "detected_language": <lang-or-null>}`.

If request fields, auth, or persistence semantics change here, check the
upstream `nethesis/satellite` API implementation too.

## Tests

- Use `tests/run_transcription_tests.php` as the single entrypoint for the
  in-tree Satellite agent and transcription regressions. It discovers PHP tests
  in `tests/` and `tests/agent/`; inspect the runner/current files rather than
  relying on an older fixed list. Agent tests cover crypto/validation, native
  names, dialplan, save services and trunk provisioning.
- These are pure PHP library tests, not end-to-end telephony or HTTP tests.
- Shared setup and assertions now live in `tests/bootstrap.php`; new tests
  should `require_once` it and call `satellite_test_bootstrap(...)` instead of
  duplicating the helper load and assertion functions.
- Coverage now includes fallback recording anchors, Local-channel
  normalization, chained attended transfers, external-call transfers,
  four-way/two-transfer handoffs with stale Local hold legs,
  adjacent-segment merge across Local-to-PJSIP handoff, and upload field
  validation.
- Pattern: build minimal inline CEL/CDR fixtures, include `extra.bridge_id` on
  bridge events, add `HANGUP` / `CHAN_END` when end-time behavior matters, and
  add CDR rows only when the scenario needs clamp or fallback.

## Safe Edits

- Keep dialplan context names, splice targets, and labels exact.
- Keep MixMonitor file names and CLI arguments aligned between
  `functions.inc.php` and `bin/satellite_transcript`.
- Any change to transfer handling should come with a regression fixture.
- Trust code over comments; some comments and older docs are stale.

## Native Agent Configuration and Runtime Boundary

- This module owns `satellite_agent_*` MariaDB tables and generated FreePBX
  trunks/destinations. Python runtime source lives in the separate Satellite
  repository's `agent` branch, not repository `satellite/`.
- Use `AgentTrunkProvisioner` and FreePBX Core's PJSIP API for managed trunks.
  Preserve `AgentTrunk_<id>` identity, trunk ownership and rollback checks.
  `runtime_owner=builtin` uses Satellite; `cleverai` routing remains separate.
- Bump `AgentConfigurationState` within the native mutation transaction. Reuse
  the encrypted snapshot for the same revision; synchronize through
  `AgentConfigurationBuilder` and check matching revision/hash acknowledgement.
  Directory/calendar refreshes must reference that accepted hash.
- Keep `ext_stasis(app, args)` separate and align the agent app with
  `SATELLITE_AGENT_ARI_APP`. Preserve trusted `AGENT_*` variables, inherited
  provider correlation and the generated fallback/handoff contexts.
- The public webhook is `htdocs/index.php`; verify raw bytes and forward the
  signed base64 envelope only to the private loopback Satellite client.
  `htdocs/agent-workflow-data.php` is local/bearer-only and uses the read-only
  `satellite_workflow` account for company contacts and answered-call history.
- Workflow administration goes through repository `freepbx/var/www/html/freepbx/rest/`.
  Keep JSON objects distinct from arrays through the PHP gateway. Publication
  and activation reconcile PBX destinations and trigger reload; draft saving
  must not reload or change the live route.
- Agent Builder pages live in AngularJS `freepbx/wizard-ui/`; the NS8 Vue UI is
  separate. Keep workflow manifests, inspector fields, English/Italian labels,
  contracts and the matching runtime tests aligned.
- See the workspace review handoff before assuming all tests pass: pending
  app-name and clone-volume edits need corresponding regression updates, and
  the Satellite review worktree has a draft-save binding-type mismatch.

## Agent workflow skill and human documentation

- Keep [the agent workflow skill](skills/nethvoice-agent-workflows/SKILL.md) and
  its operation reference updated when trunk fields, credentials, workflow
  schemas, grants, test fixtures, readiness or result-page routes change.
- Update only the affected agent sections in repository `satellite/README.md`
  with the same change. Use mostly ASD STE100-style short, active sentences.
  Add a Mermaid diagram when it makes the procedure easier to understand.
- The skill must ask for missing credentials/data, define behavior with the user,
  and use the supported trunk/workflow configuration interfaces.
- Test with synthetic fixtures without OpenAI first. Then ask for explicit
  confirmation before the final OpenAI end-to-end test. Keep this gate in both
  skill instructions and human test instructions.
- Give repeatable user tests with actual page links and expected replies, node
  outcomes and run statuses. Distinguish mock results from persisted live runs.
- Verify documented paths against the current UI/API. Do not change unrelated
  transcription documentation as part of an agent workflow update.
