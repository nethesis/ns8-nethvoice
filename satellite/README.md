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
The upstream image must contain both entrypoints and their dependencies. The
build imports both entrypoints before packaging and fails if either is missing.
The previously pinned upstream `ghcr.io/nethesis/satellite:0.2.4` contains only
transcription. Until an agent-capable upstream release is pinned, set
`SATELLITE_IMAGE` explicitly when building this development branch, for example:

```sh
SATELLITE_IMAGE=docker-daemon:localhost/satellite:voice-agent-dev \
BUILD_IMAGES=satellite IMAGETAG=consolidated ./build-images.sh
```

Use an agent-capable image from the Satellite source checkout; the example refers
to a local development image, not a published upstream release. The NethVoice
wrapper runs as UID/GID 65532 regardless of the base image's default identity.

The launcher forwards shutdown to both component process groups, waits up to
25 seconds, and kills remaining processes. If either component exits unexpectedly
(including status zero), it stops the other and exits nonzero so systemd restarts
the container. The existing transcription HTTP port and the private voice-agent
webhook port remain separate loopback listeners inside that one container.

NS8's `manage-satellite` helper controls the shared service for configuration,
integration changes and upgrades. It retires the old `voice-agent` container
without removing its event volume. Disabling transcription keeps voice agents
running, stops MQTT and recordings cleanup, and preserves PostgreSQL for reads
of historical transcripts. Runtime credentials are filtered into `satellite.env`;
unrelated module secrets are not passed to Satellite.

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
