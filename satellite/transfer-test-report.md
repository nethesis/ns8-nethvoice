# Named transfer and Wizard verification

4 October 2026. Runtime source is committed and pushed to
[Satellite branch agent](https://github.com/Nethesis/satellite/tree/agent).
The module wrapper now uses `buildah from ghcr.io/nethesis/satellite:agent`.
`runtime-ref` records the upstream source used for this change. Runtime patches
and overlays were removed after integration into Satellite.

## Findings and fixes

Read-only diagnostics on makako found a ready runtime, four named extensions
allowed by the External profile, enabled transfer permissions and an installed
handoff dialplan containing all four routes. There are no queues or IVRs on this
instance. Stored metadata contains zero handoff-started, ambiguous-handoff and
tool-denied events. This is consistent with transfer never reaching ARI; it does
not prove how the model answered the reported call.

The old runtime offered a destination ID parameter without destination names,
and sent only the configured instructions/language. The effective prompt now
adds capabilities from the tools actually offered to that call. Transfer schema
and instructions include visible, permitted extension display names, queue/IVR
names, descriptions and aliases, with an enum of approved IDs. Trusted routing
targets remain private. Existing permission checks and external-profile limits
still apply. FreePBX normalizes native names and explains this behavior in the UI.

Playwright reproduced login losing the Agents return path, plus a persistent
spinner when navigating between Agents pages. Login now restores an allowed
Agents route after normal authentication, and initialization clears the spinner
on both successful requests and errors. The connector/API controller has the
same loading-state correction.

## Verification

| Check | Result |
|---|---|
| Satellite CI unit/runtime suite | 138 passed, 36 skipped; storage cases run separately |
| Isolated application storage/transport/Responses suite | 27 passed locally and in CI |
| Isolated monitoring storage suite | 14 passed in CI |
| Offline signed-webhook and sideband emulator | 13 passed, included in the runtime suite |
| Native names, visibility, routing and transcription PHP runner | 14 passed |
| PHP application gateway | Passed |
| English/Italian connector/API forms | Passed at desktop and mobile sizes; synthetic fixtures |
| Live Wizard with candidate JavaScript overrides | Login return path, navigation, period/filter requests, settings, mobile layout, simulated 503 error visibility and External configuration link passed |
| Live browser error counts | Zero JavaScript errors and zero unexpected Agent HTTP errors |
| Static checks | PHP, JavaScript, Python, shell, locale JSON and whitespace passed |

The live configuration link exposed four named/allowed destinations. No settings
were submitted, no transcripts were opened, and no calls or OpenAI requests were
placed. Run detail navigation is conditional in the browser suite and was not
exercised because the live history list was empty.

The emulator enters the real FastAPI route with signed `realtime.call.incoming`
webhooks and uses local accept/hangup endpoints plus a real local WebSocket.
Simulated model answers arrive as `response.function_call_arguments.done` and
`response.done`, matching the [OpenAI Realtime protocol](https://developers.openai.com/api/docs/guides/realtime-conversations).
Tests exercise named extension, queue and IVR transfers, all built-in read tools,
duplicate delivery, private-route authentication, correlation/replay, disabled or
denied capabilities, external ceilings, malformed/private targets and ARI failure.
ARI is a fake client; the suite verifies continuation and caller preservation,
not physical ringing or a live model's choice.

Repeat the provider suite in a Satellite checkout with `pytest
tests/test_agent_openai_emulator.py`. Repeat the read-only browser test with:

```bash
python satellite/tests/test_agents_live_browser.py \
  --url https://voice.makako.sf.nethserver.net/freepbx/wizard/ --local-ui
```

The browser prompts for the password without storing it. Omit `--local-ui` after
deployment to verify the installed controllers. PostgreSQL acceptance fixtures
must only run against their disposable databases; the helper scripts enforce
isolated host names and explicit acceptance flags.

## Deployment boundary

Makako still runs its earlier module/Satellite images. The candidate controllers
were substituted only in the test browser. Deploy the published module through
the supported NS8 update action before treating this as a live transfer fix.
Business API details, live business/provider acceptance and combined Phase 3/4
release gates remain open as documented in the Phase 4 report.
