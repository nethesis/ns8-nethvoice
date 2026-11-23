# Build stage
FROM docker.io/library/python:3.12.13-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    portaudio19-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt /tmp/requirements.txt
COPY requirements-agent.lock /tmp/requirements-agent.lock

# Copy application files
COPY *.py /tmp/
COPY README.md /tmp/

# Install dependencies
RUN pip install --no-cache-dir --no-warn-script-location --user -r /tmp/requirements.txt -r /tmp/requirements-agent.lock

# Final stage
FROM docker.io/library/python:3.12.13-slim

# Install runtime dependencies for PyAudio
RUN apt-get update && apt-get install -y --no-install-recommends \
    libportaudio2 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /usr/local

# Copy application files
COPY --from=builder /tmp/*.py /app/
COPY --from=builder /tmp/README.md /app/
COPY voice_agent /app/voice_agent

# Use an unprivileged runtime identity; NS8 supplies private credentials at startup.
RUN groupadd --gid 65532 satellite && \
    useradd --uid 65532 --gid 65532 --home-dir /var/lib/satellite --create-home \
        --shell /usr/sbin/nologin satellite && \
    mkdir -p /var/lib/voice-agent && chown satellite:satellite /var/lib/voice-agent

# Set environment variables with default values (can be overridden at runtime)
ENV ASTERISK_URL="http://127.0.0.1:8088" \
    ARI_APP="satellite" \
    ARI_USERNAME="satellite" \
    SATELLITE_ARI_PASSWORD="dummypassword" \
    ASTERISK_FORMAT="slin16" \
    RTP_HOST="127.0.0.1" \
    RTP_PORT="10000" \
    RTP_SWAP16="true" \
    RTP_HEADER_SIZE="12" \
    MQTT_URL="mqtt://127.0.0.1:1883" \
    MQTT_TOPIC_PREFIX="satellite" \
    MQTT_USERNAME="satellite" \
    SATELLITE_MQTT_PASSWORD="dummypassword" \
    HTTP_PORT="8000" \
    DEEPGRAM_API_KEY="" \
    LOG_LEVEL="INFO" \
    PYTHONUNBUFFERED="1"

# Expose RTP port and HTTP port
EXPOSE ${RTP_PORT}/udp
EXPOSE ${HTTP_PORT}

USER satellite

# One application owns voice agents and optional transcription startup/shutdown.
CMD ["python", "main.py"]
