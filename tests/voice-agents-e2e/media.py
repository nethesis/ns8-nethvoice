"""Real SIP phones for synthetic calls, using the nethvoice-admin PJSUA harness."""
import base64
import ipaddress
import io
import json
import os
from pathlib import Path
import re
import select
import shutil
import shlex
import struct
import subprocess
import sys
import tempfile
import threading
import time
import wave


class MediaError(RuntimeError):
    pass


def pcm_header(stream):
    header = stream.read(12)
    if len(header) < 12:
        return 0, 0
    if header[:4] != b"RIFF" or header[8:] != b"WAVE":
        raise MediaError("unexpected capture format")
    rate = 0
    while True:
        chunk = stream.read(8)
        if len(chunk) < 8:
            return 0, 0
        kind, length = struct.unpack("<4sI", chunk)
        if kind == b"data":
            if not rate:
                raise MediaError("missing PCM format in capture")
            return rate, stream.tell()
        if length > 65536:
            raise MediaError("unexpected capture header")
        body = stream.read(length + length % 2)
        if len(body) < length:
            return 0, 0
        if kind == b"fmt ":
            fmt, channels, rate, _, _, bits = struct.unpack_from("<HHIIHH", body)
            if (fmt, channels, bits) != (1, 1, 16):
                raise MediaError("capture must be mono linear PCM16")


def pcm_window(path, cursor):
    """Read complete PCM frames that have reached disk before WAV finalization."""
    if cursor < 0:
        raise ValueError("negative capture cursor")
    try:
        stream = path.open("rb")
    except FileNotFoundError:
        return 0, b""
    with stream:
        rate, offset = pcm_header(stream)
        if not rate:
            return 0, b""
        stream.seek(offset + cursor)
        data = stream.read(24 * 1024 * 1024 + 1)
        if len(data) > 24 * 1024 * 1024:
            raise MediaError("capture window too long")
        return rate, data[:len(data) // 2 * 2]


def wav_bytes(rate, data):
    if not rate or not data:
        raise MediaError("no received audio samples")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setparams((1, 2, rate, 0, "NONE", ""))
        writer.writeframes(data)
    return buffer.getvalue()


def speech_edges(rate, data):
    """Return first and last audible 20 ms frame offsets for bounded turn-taking."""
    size = max(1, rate // 50) * 2
    first = last = None
    for offset in range(0, len(data) - size + 1, size):
        samples = struct.unpack_from("<%dh" % (size // 2), data, offset)
        if sum(s * s for s in samples) > len(samples) * 180 ** 2:
            if first is None:
                first = offset
            last = offset + size
    return first, last


class MediaPhone:
    def __init__(self, config, workdir, label):
        from sip_endpoint import Endpoint

        class EndpointWithPlayback(Endpoint):
            def feed(self, line):
                if self.config.get("trunk_ip") and "PJSUA state changed:" in line and "--> RUNNING" in line:
                    self.event("trunk-ready")
                match = re.search(r"Call (\d+) (?:state changed to|is DISCONNECTED)", line)
                if match:
                    self.call_slot = int(match[1])
                if "state changed to CONFIRMED" in line:
                    self.confirmed_at = time.monotonic()
                if "Playback started: /run/nvtest/turn.wav" in line:
                    self.event("play-start")
                elif "Playback stopped" in line:
                    self.event("play-stop")
                super().feed(line)

        self.capture_dir = tempfile.TemporaryDirectory(dir=workdir)
        self.capture = Path(self.capture_dir.name) / "received.wav"
        # The pinned CLI connects only the call and its silent null mic to auto-rec.
        # Dynamic WAV playback connects the file source directly to the call slot.
        self.ep = EndpointWithPlayback(dict(config, record_file=str(self.capture)), workdir, label)
        self.ep.call_slot = None
        self.erased = 0

    def start(self):
        if not self.ep.config.get("trunk_ip"):
            self.ep.start()
            return
        # An IP-identified carrier peer does not register. Constrain both SIP
        # ends to loopback and the RTP listener to the private test IP.
        cfg = self.ep.config
        address = ipaddress.IPv4Address(cfg["trunk_ip"])
        if address not in ipaddress.IPv4Network("127.88.0.0/16"):
            raise MediaError("invalid synthetic trunk IP")
        if not re.fullmatch(r"127[.]0[.]0[.]1:[0-9]{1,5}", cfg["domain"]):
            raise MediaError("synthetic trunk must target local Asterisk")
        if not re.fullmatch(r"[0-9]{9,15}|anonymous", cfg["username"]):
            raise MediaError("invalid synthetic caller identity")
        from sip_endpoint import IMAGE
        options = ["--null-audio", "--no-tcp", "--use-cli", "--no-color", "--max-calls=1",
                   "--auto-rec", "--rec-file=/record_file/received.wav", "--duration=300",
                   "--id=sip:" + cfg["username"] + "@" + str(address),
                   "--ip-addr=" + str(address), "--bound-addr=" + str(address),
                   "--local-port=" + str(int(cfg["sip_port"])), "--rtp-port=" + str(int(cfg["rtp_port"]))]
        if cfg.get("latency_mode"):
            options.append("--add-codec=PCMU/8000")
            if cfg["latency_mode"] == "continuous":
                options.append("--no-vad")
        argv = ["podman", "run", "--rm", "-i", "--network", "host", "--name", self.ep.name,
                "--label", "org.nethvoice.test=" + self.ep.label, "--entrypoint", "/usr/bin/stdbuf",
                "-v", str(self.ep.directory.resolve()) + ":/run/nvtest:ro,Z",
                "-v", str(self.capture.parent.resolve()) + ":/record_file:Z", IMAGE,
                "-oL", "-eL", "/usr/local/bin/pjsua", *options]
        self.ep.process = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                            stderr=subprocess.STDOUT, text=True, bufsize=1)
        self.ep.state["alive"] = True
        threading.Thread(target=self.ep._reader, daemon=True).start()
        self.ep.wait(lambda s: any(e["kind"] == "trunk-ready" for e in s["events"]), 20)

    def close(self):
        (self.ep.directory / "turn.wav").unlink(missing_ok=True)
        try:
            self.ep.close()
        finally:
            self.capture_dir.cleanup()

    def dial(self, number):
        self.ep.action("call", destination=str(number))

    def wait(self, state, timeout=20):
        self.ep.action("wait", state=state, timeout=timeout)

    def answer(self):
        self.ep.action("answer")

    def reject(self):
        self.ep.action("reject")

    def behavior(self, behavior):
        self.ep.action("behavior", behavior=behavior)

    def register(self):
        self.ep.action("register")

    def unregister(self):
        self.ep.action("unregister")

    def hangup(self):
        if self.ep.snapshot()["call"] not in ("IDLE", "DISCONNECTED"):
            self.ep.action("hangup")
            self.wait("DISCONNECTED")

    def status(self):
        state = self.ep.snapshot()
        return {k: state[k] for k in ("registration", "call", "incoming", "generation", "code")}

    def mark(self):
        if not self.capture.exists():
            return 0
        with self.capture.open("rb") as stream:
            rate, offset = pcm_header(stream)
            return max(0, os.fstat(stream.fileno()).st_size - offset) // 2 * 2 if rate else 0

    def greeting_capture(self):
        """Map the caller recorder's sample clock to its local SIP answer event."""
        self.wait("CONFIRMED", 25)
        answer = self.ep.confirmed_at
        previous = self.mark()
        checked = time.monotonic()
        anchor = None
        # Anchor at the first observed WAV buffer flush. A cursor sampled only
        # at answer would include the recorder's partially buffered block.
        while time.monotonic() < answer + 15:
            current = self.mark()
            observed = time.monotonic()
            if current > previous and anchor is None and observed - checked <= .03:
                anchor = (observed, current)
            previous, checked = current, observed
            if self.ep.snapshot()["call"] == "DISCONNECTED":
                break
            time.sleep(.005 if anchor is None else .1)
        if anchor is None:
            raise MediaError("no caller recorder clock after SIP answer")
        rate, _ = pcm_window(self.capture, previous)
        elapsed, offset = anchor[0] - answer, anchor[1]
        start = max(0, offset - round(elapsed * rate) * 2)
        rate, data = pcm_window(self.capture, start)
        origin_ms = round(1000 * (elapsed - (offset - start) / (2 * rate)))
        return {"audio": base64.b64encode(wav_bytes(rate, data)).decode(), "origin_ms": origin_ms}

    def discard(self):
        # Asterisk calls have ended. Keep PJSUA's recorder cursor and WAV header intact
        # while erasing all earlier samples from its private open file.
        if not self.capture.exists():
            return
        with self.capture.open("r+b") as stream:
            rate, offset = pcm_header(stream)
            if not rate:
                return
            end = os.fstat(stream.fileno()).st_size
            start = max(offset, self.erased)
            if end <= start:
                return
            # Linux filesystems normally allow the old audio to be deallocated in place.
            if shutil.which("fallocate"):
                punched = subprocess.run(
                    ["fallocate", "--punch-hole", "--keep-size", "--offset", str(start),
                     "--length", str(end - start), str(self.capture)], capture_output=True, timeout=10)
                if punched.returncode == 0:
                    self.erased = end
                    return
            stream.seek(start)
            zeros = bytes(65536)
            while start < end:
                start += stream.write(zeros[:min(len(zeros), end - start)])
            self.erased = end

    def received(self, cursor):
        return wav_bytes(*pcm_window(self.capture, cursor))

    def _listen(self, cursor, timeout, onset):
        deadline = time.monotonic() + timeout
        rate = 0
        data = bytearray()
        scan_offset = 0
        last = None
        while time.monotonic() < deadline:
            rate, added = pcm_window(self.capture, cursor + len(data))
            if rate:
                data.extend(added)
                _, end = speech_edges(rate, data[scan_offset:])
                if end is not None:
                    last = scan_offset + end
                    if onset:
                        return True
                scan_offset += (len(data) - scan_offset) // (rate // 50 * 2) * (rate // 50 * 2)
                if last and len(data) - last >= rate * 2 * 0.7:
                    return wav_bytes(rate, data)
            time.sleep(0.08)
        # A prompt that continued past the deadline is incomplete evidence.
        raise MediaError("timed out waiting for received speech" if last is None
                         else "timed out waiting for end of received turn")

    def wait_speech(self, cursor, timeout=15):
        return self._listen(cursor, timeout, True)

    def listen(self, cursor, timeout=15):
        return self._listen(cursor, timeout, False)

    def play(self, path):
        self.wait("CONFIRMED", 15)
        # PJSUA 2.17 playwav loops its player. Add more silence than the maximum
        # bounded call so an interrupted controller cannot repeat the utterance.
        with wave.open(str(path), "rb") as source:
            if (source.getnchannels(), source.getsampwidth(), source.getframerate()) != (1, 2, 8000):
                raise MediaError("playback requires mono 8 kHz PCM16 WAV")
            frames = source.readframes(source.getnframes())
            if not 0 < len(frames) <= 8000 * 2 * 60:
                raise MediaError("playback duration outside 0–60 seconds")
        staged = self.ep.directory / "turn.wav"
        with wave.open(str(staged), "wb") as output:
            output.setparams((1, 2, 8000, 0, "NONE", ""))
            output.writeframes(frames)
            output.writeframes(bytes(16000 * int(self.ep.config.get("duration", 120))))
        slot = self.ep.call_slot
        if slot is None:
            raise MediaError("PJSUA confirmed call slot unavailable")
        after = self.ep.sequence
        self.ep.send(f"call playwav start {slot} /run/nvtest/turn.wav")
        self.ep.wait(lambda s: any(e["kind"] == "play-start" and e["seq"] > after for e in s["events"]), 6)
        time.sleep(len(frames) / 16000 + 0.08)
        if self.ep.snapshot()["call"] != "DISCONNECTED":
            after = self.ep.sequence
            self.ep.send(f"call playwav stop {slot}")
            self.ep.wait(lambda s: s["call"] == "DISCONNECTED" or any(
                e["kind"] == "play-stop" and e["seq"] > after for e in s["events"]), 6)


# Bootstrap over the existing SSH session. Module credentials and audio travel
# through stdin. Both scripts and captures live in a private temporary dir.
BOOTSTRAP = """
import base64,fcntl,json,os,re,sys,tempfile
from pathlib import Path
os.umask(0o077)
modules=json.loads(sys.stdin.readline())
label=modules.pop("label")
if not re.fullmatch(r"nvtest-[0-9a-f]{12}-(?:caller|colleague|denied|alternate|carrier)", label):
    raise ValueError("invalid phone label")
with tempfile.TemporaryDirectory(prefix="nv-agent-phone-"+label+"-") as d:
    with Path(d,".nv-agent-phone-owner").open("x") as marker:
        fcntl.flock(marker, fcntl.LOCK_EX)
        json.dump(dict(module=os.environ["MODULE_ID"],domain=os.environ["NETHVOICE_HOST"],label=label),marker)
        marker.flush()
        os.fsync(marker.fileno())
        for name in ("media","sip_endpoint"):
            Path(d,name+".py").write_bytes(base64.b64decode(modules[name],validate=True))
        sys.path.insert(0,d)
        import media
        media.serve(d, label)
"""


def serve(workdir, expected_label=None):
    phone = None
    try:
        for line in sys.stdin:
            request = json.loads(line)
            op = request["op"]
            args = request.get("args", [])
            try:
                if op == "start":
                    config, label = args
                    if phone is not None or (expected_label is not None and label != expected_label):
                        raise MediaError("duplicate or unexpected phone identity")
                    phone = MediaPhone(config, workdir, label)
                    phone.start()
                    result = None
                elif op == "close":
                    phone.close()
                    phone = None
                    print(json.dumps({"result": None}), flush=True)
                    return
                elif op == "play":
                    path = Path(workdir) / "upload.wav"
                    path.write_bytes(base64.b64decode(args[0], validate=True))
                    try:
                        result = phone.play(path)
                    finally:
                        path.unlink(missing_ok=True)
                elif op in ("discard", "dial", "wait", "answer", "reject", "behavior", "hangup",
                            "status", "mark", "greeting_capture", "received", "listen", "wait_speech", "register", "unregister"):
                    result = getattr(phone, op)(*args)
                else:
                    raise MediaError("unknown media operation")
                if isinstance(result, bytes):
                    result = base64.b64encode(result).decode("ascii")
                response = {"result": result}
            except Exception as exc:
                # The dependency's TestError messages are deliberately sanitized.
                from sip_endpoint import TestError
                message = str(exc) if isinstance(exc, (MediaError, TestError)) else type(exc).__name__
                response = {"error": message}
            print(json.dumps(response), flush=True)
    finally:
        if phone is not None:
            phone.close()


class RemotePhone:
    def __init__(self, host, module, config, workdir, label, sip_helper=None):
        if not re.fullmatch(r"[\w.]+(?:@[\w.-]+)?[\w.-]*", host) or not re.fullmatch(r"nethvoice\d+", module):
            raise ValueError("invalid SSH host or module")
        self.host, self.module = host, module
        self.config, self.label = config, label
        self.sip_helper = Path(sip_helper) if sip_helper else None
        self.process = None
        self.lock = threading.Lock()

    def start(self):
        import importlib.util
        helper = self.sip_helper
        if helper is None:
            spec = importlib.util.find_spec("sip_endpoint")
            if not spec or not spec.origin:
                raise MediaError("provide nethvoice-admin scripts/sip_endpoint.py or place it on PYTHONPATH")
            helper = Path(spec.origin)
        modules = {"sip_endpoint": helper.read_bytes(), "media": Path(__file__).read_bytes()}
        command = shlex.join(["runagent", "-m", self.module, "python3", "-u", "-c", BOOTSTRAP])
        self.process = subprocess.Popen(
            ["ssh", "-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8",
             "-o", "StrictHostKeyChecking=yes", "-o", "ServerAliveInterval=10",
             "-o", "ServerAliveCountMax=3", self.host, command],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            payload = {name: base64.b64encode(data).decode("ascii") for name, data in modules.items()}
            self._send(dict(payload, label=self.label))
            self._rpc("start", self.config, self.label, deadline=180)
        except BaseException:
            self._finish()
            raise

    def _send(self, obj):
        self.process.stdin.write((json.dumps(obj) + "\n").encode())
        self.process.stdin.flush()

    def _rpc(self, op, *args, deadline=45):
        with self.lock:
            self._send({"op": op, "args": args})
            if not select.select([self.process.stdout], [], [], deadline)[0]:
                # Never let a subsequent operation consume this command's late response.
                self._finish()
                raise MediaError(f"{self.label}: remote {op} timeout")
            line = self.process.stdout.readline(48 * 1024 * 1024)
            if not line:
                raise MediaError(f"{self.label}: remote media driver exited during {op}")
            response = json.loads(line)
            if "error" in response:
                raise MediaError(f"{self.label}: {op}: " + response["error"])
            return response["result"]

    def _finish(self):
        if self.process:
            try:
                self.process.stdin.close()
            except BrokenPipeError:
                pass
            try:
                self.process.wait(timeout=40)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
            self.process.stdout.close()
            self.process = None

    def close(self):
        if self.process:
            try:
                self._rpc("close", deadline=60)
            finally:
                self._finish()

    def status(self):
        return self._rpc("status")

    @property
    def incoming(self):
        return self.status()["incoming"]

    def dial(self, number):
        self._rpc("dial", str(number))

    def answer(self):
        self._rpc("answer")

    def reject(self):
        self._rpc("reject")

    def behavior(self, behavior):
        self._rpc("behavior", behavior)

    def register(self):
        self._rpc("register")

    def unregister(self):
        self._rpc("unregister")

    def hangup(self):
        self._rpc("hangup")

    def wait(self, state, timeout=20):
        try:
            self._rpc("wait", state, timeout, deadline=timeout + 8)
        except MediaError as exc:
            raise MediaError(f"Expected {state} on {self.label}: {exc}") from None

    def play(self, path):
        self._rpc("play", base64.b64encode(Path(path).read_bytes()).decode("ascii"), deadline=95)

    def greeting_capture(self):
        result = self._rpc("greeting_capture", deadline=50)
        return result["origin_ms"], base64.b64decode(result["audio"], validate=True)

    def discard(self):
        self._rpc("discard")

    def mark(self):
        return self._rpc("mark")

    def listen(self, cursor, timeout=15):
        return base64.b64decode(self._rpc("listen", cursor, timeout, deadline=timeout + 8), validate=True)

    def wait_speech(self, cursor, timeout=15):
        return self._rpc("wait_speech", cursor, timeout, deadline=timeout + 8)

    def received(self, cursor):
        return base64.b64decode(self._rpc("received", cursor), validate=True)
