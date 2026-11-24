"""Deepgram speech through the configured Satellite loopback API."""
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
import wave

PHRASES = Path(__file__).with_name("phrases.json")

# Run inside Satellite so its configured credential stays on the PBX.
REMOTE = """
import json, os, sys, uuid
from urllib.request import Request, urlopen
from urllib.parse import urlencode
op, lang = sys.argv[1:]
payload = sys.stdin.buffer.read()
if op == "get_speech":
    body = urlencode(json.loads(payload)).encode()
    content_type = "application/x-www-form-urlencoded"
    query = ""
else:
    boundary = uuid.uuid4().hex
    body = (("--" + boundary + '\\r\\nContent-Disposition: form-data; name="file"; filename="turn.wav"\\r\\nContent-Type: audio/wav\\r\\n\\r\\n').encode()
            + payload + ("\\r\\n--" + boundary + "--\\r\\n").encode())
    content_type = "multipart/form-data; boundary=" + boundary
    query = "?" + urlencode({"language": lang, "persist": "false"})
url = "http://127.0.0.1:" + os.environ["HTTP_PORT"] + "/api/" + op + query
headers = {"Content-Type": content_type}
if os.environ.get("API_TOKEN"):
    headers["Authorization"] = "Bearer " + os.environ["API_TOKEN"]
with urlopen(Request(url, data=body, headers=headers), timeout=90) as response:
    sys.stdout.buffer.write(response.read())
"""


class SatelliteSpeech:
    def __init__(self, host, module, domain):
        self.host, self.module, self.domain = host, module, domain

    def request(self, op, body, language="it"):
        guard = 'test "$NETHVOICE_HOST" = "$1" || exit 78; shift; exec "$@"'
        remote = ["runagent", "-m", self.module, "sh", "-c", guard, "guard",
                  self.domain, "podman", "exec", "-i", "satellite", "python3",
                  "-c", REMOTE, op, language]
        done = subprocess.run(
            ["ssh", "-T", "-oBatchMode=yes", "-oStrictHostKeyChecking=yes",
             "-oConnectTimeout=8", "--", self.host, shlex.join(remote)],
            input=body, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=110,
        )
        if done.returncode:
            raise RuntimeError(f"Satellite {op} failed on {self.module} (exit {done.returncode})")
        return done.stdout

    def synthesize(self, phrase):
        return self.request("get_speech", json.dumps(phrase).encode())

    def transcribe(self, wav, language):
        return json.loads(self.request("get_transcription", wav, language))["transcript"]


def valid_wav(path):
    try:
        with wave.open(str(path), "rb") as wav:
            frames = wav.getnframes()
            if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (1, 2, 8000):
                return False
            if not 0 < frames <= 60 * 8000:
                return False
            payload = wav.readframes(frames)
            return len(payload) == frames * 2 and any(payload)
    except (OSError, EOFError, wave.Error):
        return False


def prepare(directory, synthesize, manifest=PHRASES):
    clips = {}
    for name, phrase in json.loads(manifest.read_text()).items():
        fingerprint = hashlib.sha256(json.dumps(
            [phrase, "pcm_s16le/8000/1"], sort_keys=True).encode()).hexdigest()[:12]
        path = directory / f"nvagent-e2e-{name}-{fingerprint}.wav"
        if not valid_wav(path):
            audio = synthesize(phrase)
            with tempfile.TemporaryDirectory(dir=directory, prefix=".nvagent-e2e-") as staging:
                tmp = Path(staging) / "clip.wav"
                subprocess.run(
                    ["ffmpeg", "-nostdin", "-v", "error", "-i", "pipe:0", "-ar", "8000",
                     "-ac", "1", "-c:a", "pcm_s16le", "-f", "wav", "-y", str(tmp)],
                    input=audio, check=True, timeout=30)
                if not valid_wav(str(tmp)):
                    raise ValueError(f"Deepgram returned unusable audio for {name}")
                os.replace(tmp, path)
        clips[name] = path
    return clips
