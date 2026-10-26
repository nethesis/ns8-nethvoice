# Satellite

Satellite is a Python application that creates a bridge between Asterisk PBX and Deepgram speech recognition services. It connects to Asterisk ARI (Asterisk REST Interface) and waits for channels to enter stasis. When a channel enters stasis with the application name "satellite", it creates a snoop channel and sends external media to its RTP server address. The RTP server distinguishes various channels from the UDP source port, captures the audio, and forwards it to Deepgram for real-time speech-to-text transcription. Transcription results are then published to an MQTT broker for further processing. If OpenAI API key is provided, it will be used to generate a summary of the transcriptions.

https://github.com/nethesis/satellite

## Shared voice-agent runtime

The published Satellite image runs `python /app/main.py` in the existing
`satellite.service` container. One event loop owns startup, signals and shutdown.
Voice-agent routing stays in `voice_agent/`; optional transcription stays in
`transcription.py`, `asterisk_bridge.py`, `mqtt_client.py` and `api.py`.
Transcription and its HTTP API start only when
`SATELLITE_CALL_TRANSCRIPTION_ENABLED` or
`SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED` is `True` (case insensitive).

The two HTTP apps keep their existing loopback ports and authentication. Only
exact signed webhook paths on the voice-agent listener are forwarded publicly;
transcription endpoints are not mounted on that listener. Each component retains
its own ARI connection and Stasis application (`voice-agent` versus `ARI_APP`).
Transcription startup and MQTT/ARI reconnection failures recover locally without
restarting agent calls. Shutdown stops both listeners, cancels transcription
connection/connector tasks, closes RTP streams and terminates/reaps per-request
transcription workers. PostgreSQL startup work runs outside the shared event loop.
The process no longer supervises or restarts component subprocesses. A fatal
process failure still affects both components; systemd restarts the application.

The build consumes the published Satellite PR #56 image pinned in `build-images.sh`
to `sha256:3e8df2c59bdb2b9ec58fac850fafc430721490a890d10c78dd595f455ad1a36a`.
Its source revision is `66253bf9345b4be369a24b07692b522a3c02998f`; NethVoice CI
checks out that exact revision for paired tests. The import check requires the
shared application lifecycle. `SATELLITE_IMAGE` remains a development base override.
**Replace the PR image with a versioned Satellite release before merging, updating
the digest and matching CI source revision together.**
No source download/build fallback or local source overlay is used by NethVoice.
The application runs as UID/GID 65532; configuration, credentials and volumes keep
their existing ownership and locations.

Satellite stays enabled for agent webhooks and readiness even when no agent is
enabled. An inactive built-in agent never admits a call. Keeping the listener
available allows PHP-owned publication and enablement without giving PHP host
service-management privileges. MQTT, recordings cleanup and transcription itself
remain conditional on the transcription flags; PostgreSQL stays available for
historical reads after transcription is disabled.

The `configure-module/94voice_agents` and `set-integrations/50manage_service`
action steps compare the unit, selected environment, filtered credentials and
image identity before making changes. An unchanged settings save leaves the
service and calls untouched. A changed configuration waits for no active calls;
an unavailable Asterisk query refuses the restart. FreePBX restarts do not stop
Satellite, which reconnects through ARI. Runtime account provisioning runs on
configuration changes instead of every Satellite start.

Upgrades disable and remove the former `voice-agent` container while retaining
its event volume. The `:U` mount repairs legacy volume ownership for UID 65532;
`:Z` preserves its private SELinux label. Credentials are filtered into
`satellite.env`, without unrelated module secrets.

## Voicemail transcription

Voicemail transcription is enabled by setting the environment variable `SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED` to `True` (also on NS8 interface)
`DEEPGRAM_API_KEY` should be set to a valid Deepgram API key

The extension should have:
- voicemail enabled
- voicemail email configured
- voicemail email attachment enabled

The voicemail transcription is added to the voicemail message body and saved by Satellite in its transcription database

## Call transcription

Call transcription is enabled by setting the environment variable `SATELLITE_CALL_TRANSCRIPTION_ENABLED` to `True` (also on NS8 interface)
`DEEPGRAM_API_KEY` should be set to a valid Deepgram API key
`OPENAI_API_KEY` should be set to a valid OpenAI API key (For the call summary, optional)

Calls are transcribed in real time and the transcription is published to an MQTT broker for further processing.

On topic `satellite/transcription` real time transcription is published.
Example:

```
satellite/transcription {"uniqueid": "1750153516.571", "transcription": "Prova", "timestamp": 17.1, "speaker_name": "Foo 1", "speaker_number": "201", "is_final": false}
satellite/transcription {"uniqueid": "1750153516.571", "transcription": "Prova", "timestamp": 17.1, "speaker_name": "Foo 1", "speaker_number": "201", "is_final": true}
```

On topic `satellite/final` final transcription and summary are published.
Example:
```
satellite/final {"uniqueid": "1750153516.571", "raw_transcription": "\nFoo 1: Prova\nprova prova\nfunzioni allora\n"}
satellite/final {"uniqueid": "1750153516.571", "clean_transcription": "Foo 1: Prova  \nProva prova  \nFunzioni allora  "}
satellite/final {"uniqueid": "1750153516.571", "summary": "- Foo 1: \"Prova\"\n- \"prova prova\"\n- \"funzioni allora\""}
```

## Environment variables

`ASTERISK_URL`: http://127.0.0.1:${ASTERISK_WS_PORT}

`ARI_APP`: ${SATELLITE_ARI_APP}

`ARI_USERNAME`: ${SATELLITE_ARI_USERNAME}

`RTP_PORT`: ${SATELLITE_RTP_PORT}

`MQTT_URL`: mqtt://127.0.0.1:${SATELLITE_MQTT_PORT}

`MQTT_TOPIC_PREFIX`: satellite

`LOG_LEVEL`: ${SATELLITE_LOG_LEVEL}

`MQTT_USERNAME`: ${SATELLITE_MQTT_USERNAME}

`DEEPGRAM_API_KEY`: ${SATELLITE_DEEPGRAM_API_KEY}

`OPENAI_API_KEY`: ${SATELLITE_OPENAI_API_KEY}

`HTTP_PORT`: ${SATELLITE_HTTP_PORT}

`PGVECTOR_HOST`: 127.0.0.1

`PGVECTOR_PORT`: ${SATELLITE_PGSQL_PORT}

`PGVECTOR_DATABASE`: ${SATELLITE_PGSQL_DB}

`PGVECTOR_USER`: ${SATELLITE_PGSQL_USER}

`PGVECTOR_PASSWORD`: ${SATELLITE_PGSQL_PASSWORD}


## NethServer 8 variables

`SATELLITE_RTP_PORT`: 

`SATELLITE_ARI_USERNAME`: satellite

`SATELLITE_HTTP_PORT`:

`SATELLITE_MQTT_PORT`:

`SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED`:

`SATELLITE_MQTT_USERNAME`: satellite

`SATELLITE_LOG_LEVEL`: verbosity of the satellite container, `WARNING` by default.
`INFO` restores the per-stream, per-channel and per-request lines; `DEBUG` adds more.
The value also sets uvicorn's level, so it governs the HTTP access log too.

`SATELLITE_ARI_APP`: satellite

`NETHVOICE_SATELLITE_IMAGE`:

`SATELLITE_CALL_TRANSCRIPTION_ENABLED`:

`SATELLITE_PGSQL_PORT`: 

`SATELLITE_PGSQL_DB`: satellite

`SATELLITE_PGSQL_USER`: satellite


## Testing real time call transcription

```
export $(grep SATELLITE_MQTT_PASSWORD passwords.env); podman exec -it satellite-mqtt mosquitto_sub -h 127.0.0.1 -p "${SATELLITE_MQTT_PORT:-1883}" -u "$SATELLITE_MQTT_USERNAME" -P "$SATELLITE_MQTT_PASSWORD" -t "#" -v
```

## Testing /api/get_transcription endpoint

```
export $(grep SATELLITE_API_TOKEN passwords.env);curl "http://127.0.0.1:${SATELLITE_HTTP_PORT}/api/get_transcription" --show-error --request POST --form "multichannel=false" --form "encoding=linear16" --form "sample_rate=8000" --form "channels=1" --form "persist=false" --form "summary=false" --header "Authorization: Bearer ${SATELLITE_API_TOKEN}" --form "file=@test.wav;type=audio/wav"
```

## Voice agents alpha

Use the matching v8 runtime and fresh database baseline. See the maintained
[voice agents guide](../docs/voice-agents.md). Configuration and tool permissions
belong to each agent; publication activates it. The base image is pinned by
digest in `build-images.sh`; CI tests its matching source revision.
