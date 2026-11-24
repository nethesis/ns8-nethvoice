"""Log in to the public NethVoice CTI and chat as the run-owned colleague."""
import base64
import json
import re
import secrets
import time
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener
from xml.etree import ElementTree as ET


class CTIError(RuntimeError):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise CTIError("CTI unexpectedly redirected its authenticated API")


FRAME = "urn:ietf:params:xml:ns:xmpp-framing"
SASL = "urn:ietf:params:xml:ns:xmpp-sasl"
BIND = "urn:ietf:params:xml:ns:xmpp-bind"
CLIENT = "jabber:client"
FEATURES = "{http://etherx.jabber.org/streams}features"
ASSISTANT = "voice-agent-assistant"


class Colleague:
    def __init__(self, config):
        self.host = config["host"]
        self.domain = config.get("xmpp_domain", "chat.internal")
        if not re.fullmatch(r"[a-zA-Z0-9.-]+(?::[0-9]+)?", self.host):
            raise ValueError("invalid CTI host")
        if not re.fullmatch(r"[a-zA-Z0-9.-]+", self.domain):
            raise ValueError("invalid XMPP domain")
        self.username, self.extension = config["username"], str(config["extension"])
        self.password = config["password"]
        self.http = build_opener(NoRedirect())
        self.token = None
        self.ws = None
        self.original_presence = None
        self.changed_presence = False
        self.references = set()

    def _api(self, path, body=None):
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        req = Request(f"https://{self.host}/api/{path}",
                      None if body is None else json.dumps(body).encode(), headers)
        try:
            with self.http.open(req, timeout=8) as response:
                raw = response.read(512 * 1024)
                return json.loads(raw) if raw.strip() else {}
        except HTTPError as exc:
            raise CTIError(f"CTI {path} returned HTTP {exc.code} for the fixture account") from None
        except URLError:
            raise CTIError(f"CTI {path} unavailable") from None

    def login(self):
        response = self._api("login", dict(username=self.username, password=self.password))
        self.token = response.get("token")
        if not self.token:
            raise CTIError("CTI login did not return the fixture user's token")
        me = self._api("user/me")
        endpoints = me.get("endpoints", {}).get("mainextension", [])
        if me.get("username") != self.username or [str(e.get("id")) for e in endpoints] != [self.extension]:
            self.token = None
            raise CTIError("CTI fixture main extension or logged-in identity mismatch")
        self.original_presence = me.get("presence")

    def presence(self, value, *, effective=False):
        if value not in ("dnd", "online") or not self.token:
            raise CTIError("invalid fixture presence operation")
        # Arm restoration before the request because a lost response may follow a commit.
        self.changed_presence = True
        self._api("user/presence", {"status": value})
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            me = self._api("user/me")
            if me.get("presence") == value and (not effective or me.get("mainPresence") == value):
                return
            time.sleep(0.35)
        raise CTIError(f"colleague {'effective ' if effective else ''}presence did not become {value}")

    def _send(self, tag, attrs=None, children=(), text=None):
        element = ET.Element(tag, attrs or {})
        element.extend(children)
        element.text = text
        self.ws.send(ET.tostring(element, encoding="unicode"))

    def _read(self, timeout):
        try:
            return ET.fromstring(self.ws.recv(timeout=timeout))
        except TimeoutError:
            raise CTIError("timed out awaiting fixture chat frame") from None

    def _open_stream(self):
        self._send("open", {"xmlns": FRAME, "to": self.domain, "version": "1.0"})
        if self._read(8).tag != "{%s}open" % FRAME or self._read(8).tag != FEATURES:
            raise CTIError("XMPP stream features unavailable")

    def connect(self):
        if not self.token or self.ws is not None:
            raise CTIError("log in once before connecting fixture chat")
        from websockets.sync.client import connect
        try:
            self.ws = connect("wss://" + self.host + "/xmpp-websocket", subprotocols=["xmpp"],
                              open_timeout=8, close_timeout=3, max_size=262144)
            self._open_stream()
            payload = base64.b64encode(("\0" + self.username + "\0" + self.token).encode()).decode()
            self._send("auth", {"xmlns": SASL, "mechanism": "PLAIN"}, text=payload)
            if self._read(8).tag != "{%s}success" % SASL:
                raise CTIError("XMPP denied the fixture account; verify CTI chat permission")
            self._open_stream()
            bind_id = secrets.token_hex(8)
            bind = ET.Element("bind", {"xmlns": BIND})
            ET.SubElement(bind, "resource").text = "agent-e2e-" + bind_id
            self._send("iq", {"xmlns": CLIENT, "type": "set", "id": bind_id}, [bind])
            iq = self._read(8)
            jid = iq.findtext("{%s}bind/{%s}jid" % (BIND, BIND), "")
            if (iq.tag != "{%s}iq" % CLIENT or iq.get("type") != "result" or
                    iq.get("id") != bind_id or jid.partition("/")[0] != self.username + "@" + self.domain):
                raise CTIError("XMPP failed to bind the fixture colleague")
            self._send("presence", {"xmlns": CLIENT})
        except BaseException:
            if self.ws is not None:
                self.ws.close()
                self.ws = None
            raise

    def receive(self, timeout=30, *, reconfirm=None):
        """Read a fresh consultation or the DND follow-up for its known reference."""
        if reconfirm is not None and reconfirm not in self.references:
            raise CTIError("cannot await reconfirmation of an unknown consultation")
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            stanza = self._read(max(0.01, deadline - time.monotonic()))
            if (stanza.tag != "{%s}message" % CLIENT or stanza.get("type") != "chat"
                    or stanza.get("from", "").partition("/")[0] != ASSISTANT + "@" + self.domain
                    or stanza.find("{urn:xmpp:delay}delay") is not None):
                continue
            text = stanza.findtext("{%s}body" % CLIENT, "")
            refs = set(re.findall(r"(?<!\w)#([A-F0-9]{8})(?!\w)", text))
            if len(refs) == 1:
                ref = refs.pop()
                if reconfirm is not None:
                    if ref == reconfirm and "leave DND" in text and "accept again" in text:
                        return ref
                elif ref not in self.references:
                    self.references.add(ref)
                    return ref
        if reconfirm is not None:
            raise CTIError("no fresh DND reconfirmation request received")
        raise CTIError("no fresh consultation reference received")

    def reply(self, ref, decision):
        if ref not in self.references or not decision.strip() or "\n" in decision:
            raise CTIError("consultation reply requires an observed reference and a single decision")
        body = ET.Element("body")
        body.text = "#" + ref + " " + decision
        self._send("message", {"xmlns": CLIENT, "type": "chat", "id": secrets.token_hex(12),
                               "to": ASSISTANT + "@" + self.domain}, [body])

    def close(self):
        try:
            if self.ws is not None:
                self.ws.close()
                self.ws = None
        finally:
            if self.changed_presence:
                self.presence(self.original_presence if self.original_presence in ("dnd", "online") else "online")
                self.changed_presence = False
            self.token = None
