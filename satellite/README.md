# Satellite

Satellite is a Python application that creates a bridge between Asterisk PBX and Deepgram speech recognition services. It connects to Asterisk ARI (Asterisk REST Interface) and waits for channels to enter stasis. When a channel enters stasis with the application name "satellite", it creates a snoop channel and sends external media to its RTP server address. The RTP server distinguishes various channels from the UDP source port, captures the audio, and forwards it to Deepgram for real-time speech-to-text transcription. Transcription results are then published to an MQTT broker for further processing. If OpenAI API key is provided, it will be used to generate a summary of the transcriptions.

https://github.com/nethesis/satellite

## Shared voice-agent runtime

The NethVoice image build adds `nethvoice_runtime.py` to the upstream Satellite
image and makes it the default command. This launcher runs voice agents and
optional transcription in the same container managed by `satellite.service`.
`voice_agent.runner` is always started; `main.py` is started only when
`SATELLITE_CALL_TRANSCRIPTION_ENABLED` or
`SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED` is `True` (case insensitive).
The default build uses the agent-capable upstream commit pinned in `upstream.env`.
`fetch-source.sh` verifies the archive SHA-256 before extraction, and
`build-base.sh` uses its canonical multi-stage Containerfile. No unpublished
registry tag or local image is required. `SATELLITE_IMAGE` remains an optional
base override for development; both entrypoints must import successfully.
The NethVoice wrapper runs as UID/GID 65532.

The launcher forwards shutdown to both component process groups, waits up to
25 seconds, and kills remaining processes. If one component exits unexpectedly,
it restarts that component after five seconds without interrupting the other.
Podman's init process reaps orphaned workers. Both HTTP listeners remain on
loopback with their existing separate ports and authentication.

Satellite stays enabled for agent webhooks and readiness even when no agent is
enabled. An inactive built-in agent never admits a call. Keeping the listener
available allows PHP-owned publication and enablement without giving PHP host
service-management privileges. MQTT, recordings cleanup and transcription itself
remain conditional on the transcription flags; PostgreSQL stays available for
historical reads after transcription is disabled.

`manage-satellite` compares the unit, selected environment, filtered credentials
and image identity before making changes. An unchanged settings save leaves the
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
belong to each agent; publication activates it. Runtime packaging is pinned by
`upstream.env` and checked by `fetch-source.sh`.
