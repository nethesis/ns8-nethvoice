# Phase 2 Satellite image and service integration

Phase 2 runs the built-in Agent in the existing Satellite process. The Agent
API and its separate `satellite-agent` ARI application remain available when
call and voicemail transcription are disabled. The legacy transcription
pipeline is controlled by `SATELLITE_CALL_TRANSCRIPTION_ENABLED`; MQTT and
recording cleanup start only for transcription. Satellite no longer has a
systemd dependency on MQTT or PostgreSQL.

## Coordinated image build

The upstream `ghcr.io/nethesis/satellite:0.2.4` image contains the Phase 1
transcription process. `build-images.sh` therefore refuses to build the Phase 2
Satellite image unless exactly one of these inputs is supplied:

```sh
SATELLITE_SOURCE_DIR=/path/to/reviewed/satellite \
BUILD_IMAGES=nethvoice-satellite ./build-images.sh
```

or:

```sh
SATELLITE_BASE_IMAGE=registry.example/satellite:reviewed-version \
BUILD_IMAGES=nethvoice-satellite ./build-images.sh
```

The source path must contain the Phase 2 `agent/` package, integrated
`main.py`, `agent/api.py`, and `jsonschema` in `requirements.txt`. Its
Containerfile must copy `agent/` into the final image. The assembled image
must instantiate the Agent runtime, expose its readiness route, and keep the
API server alive independently of optional transcription before it is tagged.
The image input must be a reviewed, versioned tag or digest; a floating base
tag is rejected.

A module-only build (`BUILD_IMAGES=nethvoice`) requires
`SATELLITE_BASE_IMAGE` and writes that exact reviewed reference into the
module's Satellite image label. The build checks that image for the integrated
Agent runtime before building the module. A local Satellite source tree
requires selecting `nethvoice-satellite` in the same build.

When using the Satellite worktree in this repository, build with
`SATELLITE_SOURCE_DIR=.worktrees/satellite-phase2` after its Phase 2 runtime
and dependencies are complete. A normal full image build also requires this
input. `BUILD_IMAGES` can still select other images independently.

## Configuration delivery and restore

`satellite-agent-sync.timer` invokes the FreePBX
`satellite/bin/satellite_agent_sync` CLI once per minute. Its one-shot service
attempts a sync immediately after module configuration and after FreePBX is
restarted during restore. If either FreePBX or Satellite is unavailable, the
timer retries on the next minute. The sync uses the existing local Satellite
API port and token passed to FreePBX through its environment.

Satellite stores only the Agent revision, payload hash, and replay receipts in
the `satellite_agent_state` Podman volume. The volume is deliberately absent
from `state-include.conf`; provider credentials remain in FreePBX and transient
Satellite memory. Restore removes any retained Agent state volume before
configuration so the FreePBX sync rehydrates the restored configuration.

The systemd unit passes `SATELLITE_AGENT_ARI_APP=satellite-agent` and
`SATELLITE_CALL_TRANSCRIPTION_ENABLED` to Satellite. Both the legacy
`satellite` ARI application and the Agent application use the existing
Satellite ARI user credentials, with separate Stasis application names.

## Source changes and validation status

The implementation spans this NS8 repository and the Satellite Git worktree
at `.worktrees/satellite-phase2` (branch `feat/satellite-agent-phase2`, based on
`0.2.4`). The worktree has its own Git status/diff and is excluded from the NS8
repository's tracked files. Both sets of source changes need review and their
coordinated images need building before deployment.

Remote CI checks out the exact Satellite commit in `satellite/runtime-ref`.
It builds and publishes that runtime in a dedicated job, then passes its
registry digest to the module build. The module is published only after all
component images have been published. The pull request build follows the same
ordering. Update the pinned source reference when changing the runtime.

The runtime separates configuration, context and policy, tool manifests and
execution, provider transports, ARI control, and bounded redacted events. These
are the Phase 2 extension boundaries for the later monitoring, integrations,
file context, and workflow milestones; those later features remain in the draft
roadmap.

Native user destinations may select either built-in profile alongside the two
protected system destinations. FreePBX remains the configuration authority.
Snapshots are encrypted in MariaDB for exact retries; a compare-and-set cache
write prevents concurrent builders from assigning two hashes to one revision.
Periodic context refresh preserves the deployed routing hash and observes PBX
manual opening-hours overrides. Calls pin profile and directory policy while
calendar lookups use the latest validated observations and return unknown for
stale or unsupported sources.

Basic handoff uses a generated PBX dispatcher and a random attempt ID. Before
continuation, Asterisk receives a 30-second safety timeout. The dispatcher clears
that timeout and Agent ownership before native routing. An uncertain HTTP
result is observed without repeating continuation or issuing ARI DELETE against
the caller. A still-owned failed handoff ends at the PBX safety timeout; normal
human routing keeps its normal timeout behavior.

The focused validation suites pass: 20 Python tests and 9 PHP suites. Coordinated
images were built from the exact installed bases and deployed through the NS8
`update-module` action to `nethvoice51` on `makako.sf.nethserver.net`.
Live tests covered signed OpenAI Realtime calls, audio, native company/calendar/
directory tools, basic human handoff, default-deny External handoff, HTTP
contracts, and Playwright forms and responsive rendering. See
[the deployment test report](phase2-test-report.md) for evidence and remaining
validation limits. The `agent` branch publishes the coordinated development
images; deployment validation of that build is recorded separately.

The canonical built-in webhook is
`https://<NETHVOICE_HOST>/freepbx/satellite/index.php`; the older
`/satellite/index.php` route remains accepted as a compatibility alias.
The upgraded bundled Satellite module is installed idempotently during FreePBX
initialization so its schema migration runs on existing enabled installations.
Native `ext_stasis` receives application and arguments separately, and internal
call provenance uses the installed Asterisk `CHANNEL(endpoint)` function.
Call and tool observations share one bounded event sink, with a single sequence
per run for the future monitoring interface.
