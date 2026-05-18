# AGENTS.md — FreePBX satellite module

## Scope

Applies to everything under this directory.

This module has two live responsibilities:

1. `functions.inc.php` generates the Asterisk dialplan hooks for Satellite call
   transcription and the `satellite` Stasis entrypoint.
2. `bin/satellite_transcript` turns MixMonitor leg files into labeled uploads
   for the local Satellite HTTP API.

Most edits here affect live call handling, recording lifecycle, or transcript
upload behavior.

## Read First

- `functions.inc.php`
- `bin/satellite_transcript`
- `tests/attended_transfer_segments_test.php`
- `Satellite.class.php`
- `module.xml`
- repository root: `AGENTS.md`, `COMPONENTS.md`, `freepbx/README.md`

## Current Source Of Truth

- `satellite_get_config()` is a no-op; `satellite_get_config_late()` does the
  real dialplan work.
- Dialplan is active only for the `asterisk` engine and when
  `SATELLITE_CALL_TRANSCRIPTION_ENABLED == 'True'`.
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
- `Satellite.class.php` is mostly TTS/admin code, not the call-transcription
  pipeline.

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
- **Multi-party calls are silently skipped.** Before running the segmentation
  pipeline the helper calls `detect_multiparty_call($celRows, $cdrRows)`. The
  call is treated as multi-party (and no upload happens) when:
  - any CDR row for the linkedid has `lastapp = 'ConfBridge'` (conference), or
  - any CEL row for the linkedid has
    `eventtype IN ('BLINDTRANSFER', 'ATTENDEDTRANSFER')` (transfer).
  In that case the helper just logs the skip reason and falls through to the
  normal cleanup branch, so the leg WAVs are deleted and the satellite API is
  never called. Queue calls (even with several agents tried) do not match
  either marker, so they are still transcribed normally. This is a deliberate
  release-time cap: until segmentation is fully reliable for all
  transfer/conference topologies, we prefer no transcript over a wrong one.
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
  in-tree Satellite transcription regressions.
- Current regression files are:
  `tests/attended_transfer_segments_test.php`,
  `tests/external_attended_transfer_segments_test.php`,
  `tests/double_attended_transfer_segments_test.php`, and
  `tests/four_way_two_transfers_test.php`,
  `tests/multiparty_skip_test.php`, and
  `tests/upload_fields_test.php`.
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
