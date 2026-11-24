"""Generate native CDRs with a loopback carrier that can reach only fixture DIDs."""
import json
from pathlib import Path
import re
import secrets
import time

from media import RemotePhone


class HistoryError(RuntimeError):
    pass


class CarrierPhone(RemotePhone):
    def dial(self, number):
        # Publication can reload dialplan between seeding history and this call.
        self.history.route_inbound(str(number))
        super().dial(number)


class History:
    def __init__(self, lab, sip_helper=None):
        self.lab, self.sip_helper = lab, sip_helper
        self.phone = None
        self.ready = False
        self.helper = Path(__file__).with_name("history_fixture.php").read_text().removeprefix("<?php")

    @property
    def name(self):
        owner = self.lab.state["owner"]
        if not re.fullmatch(r"nvtest-[0-9a-f]{12}", owner):
            raise HistoryError("invalid fixture owner")
        return "nvhist" + owner[7:]

    def address(self):
        seed = int(self.name[-10:], 16)
        return f"127.88.{(seed >> 8) % 254 + 1}.{seed % 254 + 1}", 26000 + seed % 4000

    def _php(self, op, **fields):
        ip, port = self.address()
        payload = dict(owner=self.lab.state["owner"], domain=self.lab.domain, op=op, ip=ip, port=port, **fields)
        data = self.lab._ssh(["podman", "exec", "-i", "freepbx", "php", "-r", self.helper],
                             data=json.dumps(payload))
        return json.loads(data)

    def _ensure_trunk(self):
        if self.ready:
            return
        self._php("create")
        self.lab._reload()
        details = self.lab._cli("pjsip show endpoint " + self.name)
        if self.name + "-in" not in details or self.address()[0] not in details:
            raise HistoryError("owned loopback trunk or its private context unavailable")
        transports = self.lab._cli("pjsip show transport 0.0.0.0-udp")
        bind = re.search(r"(?im)^\s*bind\s*:\s*(?:0\.0\.0\.0|127\.0\.0\.1):(\d+)\s*$", transports)
        if not bind:
            raise HistoryError("Asterisk UDP transport does not expose a known loopback-accessible bind")
        self.asterisk_port = int(bind[1])
        self.ready = True

    def _extension(self, context_suffix, number, application):
        if not re.fullmatch(r"\d{1,15}", number):
            raise HistoryError("invalid private fixture extension")
        context = self.name + context_suffix
        loaded = self.lab._cli(f"dialplan show {number}@{context}")
        if application in loaded:
            return
        if "1. " in loaded:
            raise HistoryError("unexpected application already owns fixture extension")
        added = self.lab._cli(f"dialplan add extension {number},1,{application} into {context}")
        if " added into " not in added:
            raise HistoryError("could not install exact private fixture extension")

    def route_inbound(self, number):
        if number in self.lab.state["routes"].values():
            app = f"Goto(app-miscapps,{number},1)"
        elif number == self.lab.state["extensions"]["colleague"]:
            app = f"Dial(PJSIP/{number},15)"
        else:
            raise HistoryError("inbound trunk destination outside fixture")
        self._extension("-in", number, app)

    def _peer(self, identity):
        if self.phone is not None:
            self.phone.close()
        ip, port = self.address()
        config = dict(username=identity, domain=f"127.0.0.1:{self.asterisk_port}", trunk_ip=ip, sip_port=port,
                      rtp_port=40000 + port % 2000 * 4, duration=300,
                      allowed_destinations=[*self.lab.state["routes"].values(), self.lab.state["extensions"]["colleague"]])
        self.phone = CarrierPhone(self.lab.host, self.lab.module, config, self.lab.workdir, self.lab.state["owner"] + "-carrier", self.sip_helper)
        self.phone.history = self
        self.phone.start()
        return self.phone

    def _confirm_history(self, number, extension, direction):
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if self._php("cdr", number=number, extension=extension, direction=direction)["qualified"]:
                return
            time.sleep(0.4)
        raise HistoryError(f"missing qualifying {direction} CDR for completed fixture call")

    def _outgoing(self, role, phones, number):
        self._extension("-out", number, f"Dial(PJSIP/{number}@{self.name},15)")
        ext = self.lab.state["extensions"][role]
        person = phones[role]
        self.lab._cli(f"channel originate PJSIP/{ext} extension {number}@{self.name}-out")
        person.wait("RINGING", 15)
        person.answer()
        person.wait("CONFIRMED", 10)
        self.phone.wait("RINGING", 15)
        self.phone.answer()
        self.phone.wait("CONFIRMED", 10)
        time.sleep(1.2)
        self.phone.hangup()
        person.wait("DISCONNECTED", 10)
        self._confirm_history(number, ext, "outbound")

    def fixture(self, case, phones):
        self._ensure_trunk()
        # Fresh numeric caller ID for each invocation, also when a scenario is repeated.
        identity = "889" + str(secrets.randbelow(10**9)).zfill(9)
        if case == "anonymous":
            return self._peer("anonymous")
        self._peer(identity)
        if case == "callback-inbound":
            self.phone.dial(self.lab.state["extensions"]["colleague"])
            person = phones["colleague"]
            person.wait("RINGING", 15)
            person.answer()
            self.phone.wait("CONFIRMED", 10)
            person.wait("CONFIRMED", 10)
            time.sleep(1.2)
            self.phone.hangup()
            person.wait("DISCONNECTED", 10)
            self._confirm_history(identity, self.lab.state["extensions"]["colleague"], "inbound")
        elif case in ("callback", "callback-excluded", "callback-other-caller", "callback-multiple"):
            self._outgoing("colleague", phones, identity)
            if case == "callback-multiple":
                self._outgoing("alternate", phones, identity)
            if case == "callback-other-caller":
                # Change source identity while preserving the first one's real CDR.
                return self._peer(str(int(identity) + 1))
        elif case != "callback-empty":
            raise ValueError("unsupported callback case")
        return self.phone

    def close(self):
        if self.phone is not None:
            self.phone.close()
            self.phone = None
        self.cleanup()

    def cleanup(self):
        # Journaled owner fully determines names. This works in a fresh recovery process.
        if not self.lab.manifest.exists():
            return
        stored = self._php("inspect")["existed"]
        # The previous delete may have committed before fwconsole reload returned.
        # Asterisk retains the original endpoint in memory until the reload succeeds.
        loaded = self.lab._cli("pjsip show endpoint " + self.name)
        active = self.name + "-in" in loaded and self.address()[0] in loaded
        if stored or active:
            if re.search(r"(?m)^PJSIP/" + self.name + r"-", self.lab._cli("core show channels concise")):
                raise HistoryError("owned carrier has live calls")
            for suffix in ("-in", "-out"):
                context = self.name + suffix
                if "Context '" + context + "'" in self.lab._cli("dialplan show " + context):
                    self.lab._cli("dialplan remove context " + context)
                    if "Context '" + context + "'" in self.lab._cli("dialplan show " + context):
                        raise HistoryError("owned history context remains")
            if stored:
                self._php("delete")
            self.lab._reload()
            if self._php("inspect")["existed"] or self.name + "-in" in self.lab._cli("pjsip show endpoint " + self.name):
                raise HistoryError("owned history trunk remains")
        self.ready = False
