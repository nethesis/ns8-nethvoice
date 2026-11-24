"""Live scenarios. Each assertion uses the receiving endpoint or the PBX's own evidence."""
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from contextlib import ExitStack
from functools import partial
import io
import math
import re
import struct
import time
import unicodedata
import wave

from media import MediaError


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def matches(text, pattern):
    normalized = unicodedata.normalize("NFKD", text.casefold())
    return re.search(pattern, "".join(c for c in normalized if not unicodedata.combining(c))) is not None


REFUSAL = (r"\bnessun|\bnon\b.{0,55}(?:trov|posso|riesco|risult|dispon|consent|"
           r"autorizz|permess|rubrica|abilitat|presente|access|vedo)|impossibil|indisponibil|vietat")

# Deepgram also hears the synthetic lab name as “Corello” on narrowband SIP audio.
CORALLO = r"\bcorallo\b|\blaboratorio corello\b"
CALLBACK_SELECTION = (
    r"(?:\b(?:chi|quale|vuoi|vuole|posso|desider[ai]|preferisc[ei]|conferm[ai]|"
    r"intende(?:vi)?|intendi|procedo|collego|passo)\b[^.!?]{0,100}\?"
    # Deepgram can omit the question mark or hear “vuoi che” as “voi que”.
    r"|\b(?:vuoi che|vuole che|volete che|voi que)\b[^.!?]{0,60}\b(?:contat{1,2}o|richiam\w*)\b)"
)
COLLEAGUE_NAME = r"\b(?:giulia|julia|ferri|ferry)\b"

# Every name here is dispatched below. The second transport repeats its riskiest handoffs.
BOTH = ("conversation", "name", "callback", "attended-accept", "chat-dnd", "voicemail-yes", "voicemail-no")
FULL = ("english", "known-name", "hangup-disabled", "anonymous", "barge-in", "silence", "queue",
        "denied", "denied-queue", "unknown", "ambiguous", "callback-empty",
        "callback-excluded", "callback-multiple", "callback-inbound", "callback-other-caller",
        "attended-decline", "attended-question", "chat-busy", "chat-no-answer",
        "chat-expired", "publication", "deadline", "fallback")
RECOVERY = ("restart-during-call", "restart-after-transfer")


def matrix(profile):
    if profile == "recovery":
        return [("live", name) for name in RECOVERY]
    primary = ("conversation",) if profile == "smoke" else BOTH
    cases = [(transport, name) for name in primary for transport in ("realtime", "live")]
    if profile == "functional":
        cases.extend(("live", name) for name in FULL)
    return cases


def voicemail_beep_ended(audio):
    """Recognize Asterisk's 425 ms, 700 Hz beep followed by non-tone audio."""
    with wave.open(io.BytesIO(audio)) as wav:
        rate = wav.getframerate()
        require(wav.getnchannels() == 1 and wav.getsampwidth() == 2, "Expected mono PCM16 caller audio")
        samples = struct.iter_unpack("<h", wav.readframes(wav.getnframes()))
        # Goertzel power at the prompt frequency, normalized by total frame energy.
        size = rate // 25
        coeff = 2 * math.cos(2 * math.pi * 700 / rate)
        tone_frames = 0
        while True:
            prev = prev2 = energy = 0
            for _ in range(size):
                sample = next(samples, None)
                if sample is None:
                    return False
                value = sample[0]
                prev2, prev = prev, value + coeff * prev - prev2
                energy += value * value
            power = prev * prev + prev2 * prev2 - coeff * prev * prev2
            if energy > size * 140 ** 2 and 2 * power > 0.75 * size * energy:
                tone_frames += 1
            else:
                if 8 <= tone_frames <= 12:
                    return True
                tone_frames = 0


class Call:
    def __init__(self, lab, phones, fixture, clips, speech, transport, case, evidence):
        self.lab, self.phones, self.fixture = lab, phones, fixture
        self.clips, self.speech, self.transport = clips, speech, transport
        self.case, self.evidence = case, evidence
        self.caller, self.peer = phones["caller"], phones["colleague"]
        self.language = "en" if case == "english" else "it"
        self.invites = {role: phone.incoming for role, phone in phones.items()}
        self.denied_count = self.invites["denied"]
        self.pending = []
        self.dial_attempted = False
        self.confirmed_colleague = False
        self.history = None

    def diagnostic(self):
        facts = {}
        for role, phone in self.phones.items():
            state = phone.status()
            facts[role] = {"sip": state["call"], "new_invites": state["incoming"] - self.invites[role]}
        if hasattr(self, "baseline"):
            facts["runs"] = []
            for row in self.lab.activity(self.transport):
                if row["run_id"] in self.baseline or row.get("parent_run_id"):
                    continue
                events = self.lab.trace(row["run_id"], self.transport)["events"]
                facts["runs"].append({"run": row["run_id"], "outcome": row["outcome"], "error": row.get("error_code"),
                    "first_output_ms": row.get("first_output_ms"),
                    "tools": [{k: ev.get(k) for k in ("event_type", "tool_id", "result_count", "destination_id")}
                              for ev in events if ev["event_type"] in ("tool_completed", "transfer_committed")],
                    "consultation": [ev["event_type"] for ev in events if ev["event_type"].startswith("consultation_")],
                    "errors": [{"event": ev["event_type"], "code": ev.get("error_code"),
                                **{k: ev[k] for k in ("phase", "status", "duration_ms", "http_status", "provider_code")
                                   if ev.get(k) is not None}}
                               for ev in events if ev.get("error_code") or ev.get("status") == "failed"]})
        return facts

    def number(self, role):
        return self.fixture["endpoints"][role]["username"]

    def configure(self, **overrides):
        options = dict(language=self.language, greeting=(
            "Welcome to Coral Laboratory." if self.language == "en" else "Benvenuti al laboratorio Corallo."),
            instructions=("Follow the caller's request and repeat requested words. End a call only upon request."
                          if self.language == "en" else
                          "Segui la richiesta del chiamante. Ripeti le parole richieste. "
                          "Per trasferire usa la rubrica e gli strumenti disponibili. "
                          "Non inventare recapiti. Se serve un chiarimento, chiedilo. "
                          "Termina la chiamata soltanto su richiesta."))
        options.update(overrides)
        return self.lab.configure(self.transport, **options)

    def start(self, route, caller=None, marker=None):
        if caller is not None:
            self.caller = caller
        self.baseline = {r["run_id"] for r in self.lab.activity(self.transport)}
        mark = self.caller.mark()
        self.dial_attempted = True
        self.caller.dial(route)
        self.caller.wait("CONFIRMED", 25)
        self.evidence.append("caller SIP confirmed")
        self.expect(self.caller.listen(mark, 25), marker or ("coral" if self.language == "en" else CORALLO),
                    "configured greeting")

    def expect(self, audio, pattern, label):
        # Score captured windows after time-critical handoffs and the 60-second consultation.
        self.pending.append((audio, pattern, label))

    def confirm_colleague(self, text):
        # Answer an explicit question about the requested person once. A voicemail
        # offer, a choice between people, or a progress announcement needs a different turn.
        if (not self.confirmed_colleague and matches(text, COLLEAGUE_NAME)
                and matches(text, r"(?:intendev[ai]|intendi|intende|conferm[ai]|si riferisce|e lei)\b.{0,90}\?")
                and not matches(text, r"segreteria|messaggio|oppure|\bluca\b|\briva\b")):
            self.play(self.caller, "confirm")
            self.confirmed_colleague = True
            self.evidence.append("caller confirmed the named recipient when asked")

    @staticmethod
    def audio_end(cursor, audio):
        with wave.open(io.BytesIO(audio)) as wav:
            return cursor + wav.getnframes() * wav.getsampwidth() * wav.getnchannels()

    def hear_until(self, phone, cursor, pattern, label, timeout=45, confirm_recipient=False):
        """Listen past progress announcements while the agent runs PBX tools."""
        deadline = time.monotonic() + timeout
        observed = ""
        while time.monotonic() < deadline:
            try:
                chunk = phone.listen(cursor, max(1, int(deadline - time.monotonic())))
            except MediaError as exc:
                if "timed out waiting for end of received turn" in str(exc):
                    # Media can contain a sustained tone after intelligible speech.
                    # Score the captured window without requiring a silent tail.
                    chunk = phone.received(cursor)
                elif observed:
                    raise AssertionError(f"Expected {label}; last heard {observed[-160:]!r}") from exc
                else:
                    raise
            cursor = self.audio_end(cursor, chunk)
            observed += " " + self.speech.transcribe(chunk, self.language)
            if matches(observed, pattern):
                self.evidence.append(label)
                return observed
            if confirm_recipient:
                self.confirm_colleague(observed)
        raise AssertionError(f"Expected {label}; last heard {observed[-160:]!r}")

    def wait_for_recipient(self, wait, cursor):
        """Answer a caller-side confirmation while waiting on the other leg."""
        observed = ""
        with ThreadPoolExecutor(max_workers=1) as pool:
            signal = pool.submit(wait)
            while not self.confirmed_colleague:
                try:
                    return signal.result(timeout=1)
                except FutureTimeout:
                    if signal.done():
                        return signal.result()
                try:
                    chunk = self.caller.listen(cursor, 5)
                except MediaError as exc:
                    if "timed out waiting for" not in str(exc):
                        raise
                    continue
                cursor = self.audio_end(cursor, chunk)
                observed = (observed + " " + self.speech.transcribe(chunk, self.language))[-300:]
                if not signal.done():
                    self.confirm_colleague(observed)
            return signal.result()

    def score(self):
        transcripts = {}
        for audio, pattern, label in self.pending:
            if audio not in transcripts:
                transcripts[audio] = self.speech.transcribe(audio, self.language)
            text = transcripts[audio]
            if not matches(text, pattern):
                excerpt = " ".join(text.split())[:160]
                raise AssertionError(f"Expected {label} ({pattern}); received {excerpt!r}")
            self.evidence.append(label)
        self.pending.clear()

    def play(self, phone, key):
        phone.play(self.clips[key])
        self.evidence.append("played " + key)

    def turn(self, phone, key, pattern, label):
        start = phone.mark()
        self.play(phone, key)
        self.expect(phone.listen(start, 25), pattern, label)

    def outcome(self, expected, error=None):
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            rows = [r for r in self.lab.activity(self.transport)
                    if r["run_id"] not in self.baseline and not r.get("parent_run_id")]
            require(len(rows) <= 1, "Ambiguous Activity correlation for the owned agent")
            if rows and rows[0]["outcome"] != "running":
                row = rows[0]
                require(row["outcome"] == expected, f"Expected {expected}, observed {row['outcome']}")
                require(row["adapter"] in (("realtime",) if self.transport == "realtime" else ("live_ws","live")),
                        "Activity recorded a different transport")
                if error:
                    require(row["error_code"] == error, f"Expected Activity error {error}")
                if self.case.startswith("callback"):
                    trace = self.lab.trace(row["run_id"], self.transport)["events"]
                    counts = [int(event["result_count"]) for event in trace
                              if event["event_type"] == "tool_completed"
                              and event["tool_id"] == "pbx.find_recent_callers"
                              and event.get("result_count") is not None]
                    wanted = 2 if self.case == "callback-multiple" else int(expected == "transferred")
                    require(wanted in counts, f"Expected callback lookup returning {wanted}, observed {counts}")
                    if not wanted:
                        require(all(n == 0 for n in counts), "An ineligible callback candidate was exposed")
                    if expected == "transferred":
                        require(any(e["event_type"] == "transfer_committed" and
                                    e["destination_id"] == "extension:" + self.number("colleague") for e in trace),
                                "Missing native callback handoff to the eligible recipient")
                if self.case.startswith(("attended-", "chat-")) or self.case == "restart-after-transfer":
                    trace = self.lab.trace(row["run_id"], self.transport)
                    events = {ev["event_type"] for ev in trace["events"]}
                    require("consultation_held" in events, "Missing native consultation hold")
                    if self.case.startswith("chat-"):
                        require("consultation_chat" in events, "Missing chat consultation trace")
                    if self.case == "chat-expired":
                        require(any(ev["event_type"] == "consultation_timed_out" and
                                    ev["error_code"] == "consultation_chat_timeout" for ev in trace["events"]),
                                "Missing consultation chat deadline event")
                    if expected == "transferred":
                        require("consultation_transferred" in events, "Missing confirmed attended handoff")
                    require(self.lab.child_runs(row["run_id"], self.transport), "Missing linked private consultation")
                self.evidence.append(f"Activity {row['run_id']} {expected}")
                return row
            time.sleep(0.4)
        raise AssertionError(f"No terminal Activity run for {expected}")

    def finish(self):
        self.caller.hangup()
        return self.outcome("completed")

    def exchange(self, peer):
        for sender, receiver, key, word in ((self.caller, peer, "caller_marker", "tulipano"),
                                            (peer, self.caller, "colleague_marker", "castagna")):
            start = receiver.mark()
            self.play(sender, key)
            self.expect(receiver.listen(start, 10), word, f"bridged marker {word}")

    def answer_ringing_peer(self, peer):
        mark = peer.mark()
        peer.answer()
        peer.wait("CONFIRMED", 12)
        return mark

    def accept(self, peer, timeout=25):
        peer.wait("RINGING", timeout)
        self.answer_ringing_peer(peer)

    def transferred(self):
        self.exchange(self.peer)
        if self.case in ("name", "queue") or self.case.startswith("callback"):
            caller = self.history.name if self.case.startswith("callback") else self.number("caller")
            require(self.lab.bridge(caller, self.number("colleague")), "Missing native bridge between fixture legs")
            self.evidence.append("native basic bridge contained caller and recipient")
        row = self.outcome("transferred")
        if self.case in ("name", "queue"):
            target = ("queue:" + self.fixture["queue"] if self.case == "queue"
                      else "extension:" + self.number("colleague"))
            events = self.lab.trace(row["run_id"], self.transport)["events"]
            require(any(ev["event_type"] == "transfer_committed" and ev["destination_id"] == target
                        for ev in events), f"Missing native handoff to {target}")
        self.caller.hangup()
        return row

    def conversation(self):
        case = self.case
        self.start(self.configure(hangup=case != "hangup-disabled"))
        if case == "barge-in":
            mark = self.caller.mark()
            self.play(self.caller, "long")
            self.caller.wait_speech(mark, 12)
            self.play(self.caller, "interrupt")
            # Counting audio received during the interruption belongs to the prior turn.
            after_input = self.caller.mark()
            self.expect(self.caller.listen(after_input, 20), "limone", "barge-in response")
            self.expect(self.caller.received(mark),
                        r"(?s)^(?!.*(?:cinquanta|\b50\b)).*(?:\b[123]\b|uno|due|tre).*limone",
                        "counting started and stopped before fifty when interrupted")
            self.finish()
        elif case == "silence":
            time.sleep(5)
            require(self.caller.status()["call"] == "CONFIRMED", "Call dropped during silence")
            self.turn(self.caller, "hello", r"\bsi\b|sent[oi]|ascolt|aiut", "agent heard caller after silence")
            self.finish()
        elif case == "hangup-disabled":
            self.turn(self.caller, "bye", r"\w+", "agent responded to the request to end the call")
            self.turn(self.caller, "hello", r"\bsi\b|sent[oi]|ascolt|aiut", "continued conversation")
            self.finish()
        else:
            if self.language == "it":
                self.turn(self.caller, "remember", "girasole", "first turn")
                self.turn(self.caller, "recall", "girasole", "second turn recalled the word")
            else:
                self.turn(self.caller, "hello_en", "sunflower", "English response")
            mark = self.caller.mark()
            self.play(self.caller, "bye_en" if self.language == "en" else "bye")
            self.caller.wait("DISCONNECTED", 25)
            self.expect(self.caller.received(mark), "goodbye|bye|great day|welcome" if self.language == "en"
                        else "arrivederci|giornata|grazie|presto|salut", "audible goodbye")
            self.outcome("ended_by_agent")

    def routing(self):
        case = self.case
        uses_queue = case in ("queue", "denied-queue")
        queues = self.lab.queue_inventory() if uses_queue else None
        options = {"queues": uses_queue}
        if case == "ambiguous":
            options["instructions"] = ("Cerca nella rubrica per ruolo. Se ci sono due persone del collaudo, "
                                       "presenta la scelta e chiedi al chiamante di specificare il nome.")
        if case == "denied-queue":
            options["instructions"] = ("Cerca la coda richiesta nella rubrica. Se non è disponibile, "
                                       "dillo al chiamante. Puoi proporre una coda consentita e trasferire "
                                       "solo dopo che il chiamante ha confermato l’alternativa.")
        route = self.configure(**options)
        if uses_queue:
            require(self.lab.queue_inventory() == queues, "Queue inventory changed before call")
        self.start(route)
        cursor = self.lab.queue_cursor() if case == 'queue' else None
        counts = {role: phone.incoming for role, phone in self.phones.items()}
        start = self.caller.mark()
        self.play(self.caller, case.replace("-", "_"))
        if case in ("name", "queue"):
            if case == "name":
                self.wait_for_recipient(partial(self.peer.wait, "RINGING", 40), start)
                self.answer_ringing_peer(self.peer)
            else:
                self.accept(self.peer)
            if case == "queue":
                deadline = time.monotonic() + 10
                while not self.lab.queue_connected(self.number("colleague"), cursor):
                    require(time.monotonic() < deadline, "No queue CONNECT to colleague")
                    time.sleep(0.4)
            self.transferred()
        else:
            pattern = ("quale|chi|nome|specific|intende|dettagli" if case == "ambiguous" else
                       REFUSAL)
            try:
                self.hear_until(self.caller, start, pattern, "clarification or refusal")
            finally:
                if case == "denied-queue":
                    self.assert_queue_refusal(counts)
            row = self.finish()
            if case == "denied-queue":
                events = self.lab.trace(row["run_id"], self.transport)["events"]
                require(not any(event["event_type"] == "transfer_committed" for event in events),
                        "Queue handoff committed without caller consent")
                self.evidence.append("no denied or unconfirmed alternative queue handoff")
            if case == "ambiguous":
                events = self.lab.trace(row["run_id"], self.transport)["events"]
                require(any(ev["event_type"] == "tool_completed" and ev["tool_id"] == "pbx.find_destinations"
                            and int(ev.get("result_count") or 0) >= 2 for ev in events),
                        "Ambiguous search did not return two candidate people")
            for role, phone in self.phones.items():
                require(phone.incoming == counts[role], f"Unexpected recipient INVITE on {role}")

        if uses_queue:
            require(self.lab.queue_inventory() == queues, "Queue inventory changed during call")

    def assert_queue_refusal(self, counts):
        require(self.phones["denied"].incoming == counts["denied"], "Denied queue reached its member")
        require(self.peer.incoming == counts["colleague"], "Allowed queue rang before caller confirmation")

    def callback(self):
        case = self.case
        # The lab adapter creates native history through an isolated trunk. Each identity
        # has its own history so earlier calls cannot make a negative case pass.
        external = self.history.fixture(case, self.phones)
        before = self.peer.incoming
        alternate = self.phones["alternate"].incoming
        recipient_counts = {role: phone.incoming for role, phone in self.phones.items()}
        self.start(self.configure(direct=False, exclude_callback=case == "callback-excluded"), external)
        start = self.caller.mark()
        self.play(self.caller, "recent")
        if case in ("callback-excluded", "callback-empty", "callback-other-caller"):
            self.hear_until(self.caller, start, REFUSAL, "empty permitted callback list")
            self.finish()
            require(all(phone.incoming == recipient_counts[role] for role, phone in self.phones.items()),
                    "Negative callback rang a recipient")
            return
        choices = rf"(?s)(?=.*{COLLEAGUE_NAME})"
        if case == "callback-multiple":
            choices += r"(?=.*\b(?:luca|riva)\b)"
        self.hear_until(self.caller, start, choices + ".*" + CALLBACK_SELECTION, "eligible contacts offered with a selection question")
        require(self.peer.incoming == before and self.phones["alternate"].incoming == alternate,
                "A contact rang before callback confirmation")
        self.play(self.caller, "confirm")
        self.accept(self.peer)
        self.transferred()
        require(self.phones["alternate"].incoming == alternate, "Unselected callback recipient rang")

    def consultation(self):
        case = self.case
        chat = case.startswith("chat")
        voicemail = case.startswith("voicemail")
        self.recipient_invites = self.peer.incoming
        route = self.configure(attended=True, chat=chat, instructions=(
            "Gestisci le richieste di trasferimento con consultazione. Se il chiamante indica "
            "il nome del collega e il motivo della chiamata, cerca il collega e avvia il "
            "trasferimento assistito. Chiedi chiarimenti solo se la destinazione è ambigua "
            "o mancano informazioni. Attendi la risposta del collega e riferisci l’esito. "
            "Se è disponibile la segreteria, chiedi al chiamante se vuole lasciare un messaggio."))
        if chat or voicemail:
            self.lab.ensure_cti_login()
            self.prepare_recipient()
        self.start(route)
        # Supply both facts in the same turn before the model commits to a transfer.
        held = self.caller.mark()
        self.play(self.caller, "consult_request")
        if chat or voicemail:
            self.recipient_alternative(held)
            return
        self.wait_for_recipient(partial(self.peer.wait, "RINGING", 40), held)
        mark = self.answer_ringing_peer(self.peer)
        self.hear_until(self.peer, mark, r"\bpianoforte\b",
                        "private call reason reached colleague", timeout=20)
        # A colleague-only token tests isolation without asking the agent to invent an opening detail.
        self.play(self.peer, "private")
        if case == "attended-question":
            mark = self.caller.mark()
            self.play(self.peer, "question")
            self.hear_until(self.caller, mark, r"\bcolore\b", "clarification reached caller", timeout=20)
            mark = self.peer.mark()
            self.play(self.caller, "answer")
            self.hear_until(self.peer, mark, r"\bverde\b", "answer reached colleague", timeout=20)
        caller_audio = self.caller.received(held)
        self.expect(caller_audio, r"attend|attes|colleg|contatt|verific|giulia|linea",
                    "audible consultation announcement on caller leg")
        self.expect(caller_audio, r"(?s)^(?!.*zafferano).+$", "private marker stayed off caller leg")
        if case == "attended-decline":
            mark = self.caller.mark()
            self.play(self.peer, "decline")
            self.peer.wait("DISCONNECTED", 12)
            self.hear_until(self.caller, mark, r"\bvenerdi\b", "attributed refusal message", timeout=15)
            self.finish()
        else:
            self.play(self.peer, "accept")
            self.outcome("transferred")
            if case == "restart-after-transfer":
                self.lab.restart_satellite()
            self.exchange(self.peer)
            self.caller.hangup()

    def prepare_recipient(self):
        from cti import Colleague
        config = self.fixture.get("cti")
        if not config:
            raise RuntimeError("No dedicated CTI colleague configuration")
        self.cti = Colleague(config)
        self.stack.callback(self.cti.close)
        self.cti.login()
        self.evidence.append("public CTI login matched the fixture main extension")
        if self.case.startswith("voicemail"):
            self.cti.presence("dnd", effective=True)
            self.mail_count = self.lab.mailbox_count()
            self.stack.callback(self.peer.register)
            self.peer.unregister()
            return
        self.cti.connect()
        self.evidence.append("authenticated XMPP session bound to the fixture colleague")
        if self.case in ("chat-dnd", "chat-expired"):
            self.cti.presence("dnd", effective=True)
        if self.case == "chat-busy":
            self.stack.callback(self.peer.behavior, "ignore")
            self.peer.behavior("reject")

    def recipient_alternative(self, held):
        case = self.case
        if case.startswith("voicemail"):
            self.hear_until(self.caller, held, r"segreteria|lasciar.{0,18}messaggio", "voicemail offer", timeout=50, confirm_recipient=True)
            cursor = self.caller.mark()
            self.play(self.caller, "vm_yes" if case.endswith("yes") else "vm_no")
            if case.endswith("yes"):
                self.outcome("transferred")
                deadline = time.monotonic() + 35
                while True:
                    remaining = deadline - time.monotonic()
                    require(remaining > 0, "No recording beep on the caller leg")
                    audio = self.caller.listen(cursor, max(1, math.ceil(remaining)))
                    if voicemail_beep_ended(audio):
                        break
                    cursor = self.audio_end(cursor, audio)
                self.evidence.append("caller heard the end of the Asterisk voicemail beep")
                # Give the mailbox several seconds of voiced media before hanging up.
                self.play(self.caller, "vm_message")
                self.play(self.caller, "vm_message")
                self.caller.hangup()
                deadline = time.monotonic() + 15
                count = self.lab.mailbox_count()
                while count == self.mail_count:
                    require(time.monotonic() < deadline, "No new message in fixture mailbox")
                    time.sleep(1)
                    count = self.lab.mailbox_count()
                require(count == self.mail_count + 1, "Expected exactly one new message in fixture mailbox")
                self.evidence.append("one new message saved in the colleague's mailbox")
            else:
                self.turn(self.caller, "remember", "girasole", "returned to agent")
                self.finish()
                require(self.lab.mailbox_count() == self.mail_count, "Message left despite refusal")
        else:
            ref = self.wait_for_recipient(partial(self.cti.receive, 55), held)
            self.evidence.append("received fresh consultation reference from assistant over XMPP")
            if case in ("chat-dnd", "chat-expired"):
                require(self.peer.incoming == self.recipient_invites, "DND colleague rang")
            else:
                require(self.peer.incoming > self.recipient_invites, "Phone consultation was never attempted")
            if case == "chat-busy":
                self.peer.behavior("ignore")
            if case == "chat-expired":
                time.sleep(61)
                self.cti.presence("online")
            self.cti.reply(ref, "Accetto la chiamata.")
            self.evidence.append("colleague sent the referenced acceptance over XMPP")
            if case == "chat-dnd":
                self.cti.receive(20, reconfirm=ref)
                require(self.peer.incoming == self.recipient_invites, "DND acceptance rang a handset")
                self.cti.presence("online", effective=True)
                self.cti.reply(ref, "Ora sono disponibile, accetto la chiamata.")
                self.evidence.append("DND handset stayed silent and colleague reconfirmed after returning online")
            if case == "chat-expired":
                self.turn(self.caller, "remember", "girasole", "resumed after chat timeout")
                self.finish()
                require(self.peer.incoming == self.recipient_invites, "Late acceptance rang a handset")
            else:
                self.accept(self.peer)
                self.transferred()

    def run(self):
        with ExitStack() as self.stack:
            self.steps()

    def steps(self):
        case = self.case
        if case in ("conversation", "english", "hangup-disabled", "barge-in", "silence"):
            self.conversation()
        elif case in ("name", "queue", "denied", "denied-queue", "unknown", "ambiguous"):
            self.routing()
        elif case.startswith("callback"):
            self.callback()
        elif case.startswith(("attended", "chat", "voicemail")) or case == "restart-after-transfer":
            self.consultation()
        elif case in ("deadline", "fallback"):
            route = self.configure(duration=30, fallback=case == "fallback")
            self.start(route)
            if case == "fallback":
                peer = self.phones["alternate"]
                self.accept(peer, 45)
                self.exchange(peer)
                self.caller.hangup()
            else:
                self.caller.wait("DISCONNECTED", 45)
            self.outcome("fallback", "duration_exceeded")
        elif case == "publication":
            route = self.configure()
            self.start(route)
            old = self.caller
            previous = self.baseline
            route = self.configure(greeting="Benvenuti al laboratorio Rubino.")
            self.start(route, self.phones["alternate"], "rubino")
            # Runs overlap. Identify the new publication by its later admission.
            self.caller.hangup()
            new = self.outcome("completed")
            self.baseline = previous | {new["run_id"]}
            self.caller = old
            self.turn(old, "recall_greeting", CORALLO, "active call retained original greeting")
            old_row = self.finish()
            require(old_row["workflow_version"] != new["workflow_version"], "Both calls used the same publication")
        elif case == "known-name":
            route = self.configure(greeting="Benvenuti al laboratorio Corallo. Saluta il chiamante con il suo nome, se disponibile.")
            self.start(route)
            self.expect(self.pending[-1][0], r"\banna\b", "caller recognized by first name")
            self.finish()
        elif case == "anonymous":
            self.start(self.configure(), self.history.fixture("anonymous", self.phones))
            self.expect(self.pending[-1][0], r"(?s)^(?!.*(?:anna|bianchi)).+$", "neutral anonymous greeting")
            self.finish()
        elif case == "restart-during-call":
            self.start(self.configure())
            self.lab.restart_satellite()
            self.outcome("interrupted", "runtime_stopped")
            self.caller.hangup()
            self.start(self.configure())
            self.finish()
        else:
            raise ValueError(f"Unknown scenario {case}")
        require(self.phones["denied"].incoming == self.denied_count, "Denied endpoint received an INVITE")
        self.score()
