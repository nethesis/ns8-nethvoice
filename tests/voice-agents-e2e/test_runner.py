from concurrent.futures import TimeoutError as FutureTimeout
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, call, patch
import wave

from latency import latency_summary, score_greeting
from media import MediaError, MediaPhone, pcm_window
from run import claim_run, cleanup
from scenarios import CALLBACK_SELECTION, CORALLO, REFUSAL, Call, matches, matrix
from speech import prepare, valid_wav


def sample():
    data = io.BytesIO()
    with wave.open(data, "wb") as wav:
        wav.setparams((1, 2, 8000, 0, "NONE", ""))
        wav.writeframes(b"\x01\x02" * 1200)
    return data.getvalue()


class HarnessTests(unittest.TestCase):
    def test_word_timing_requires_the_configured_greeting(self):
        words = [("attendere", .2), ("buongiorno", 2.2), ("dal", 2.5),
                 ("laboratorio", 2.7), ("corello", 3.0)]
        self.assertEqual(score_greeting(words, 10), {"greetings": 1, "onset_ms": 2210})
        unrelated = list(zip("buongiorno la trasferisco al laboratorio corallo".split(),
                             (2.8, 3.2, 3.3, 3.5, 3.7, 4.1)))
        self.assertEqual(score_greeting(unrelated, 0), {"greetings": 0})
        late = list(zip("ciao benvenuti al laboratorio corallo".split(), (2.8, 3.2, 3.4, 3.6, 4.0)))
        self.assertEqual(score_greeting(late, 0), {"greetings": 1, "onset_ms": 3200})
        self.assertEqual(score_greeting(words + words, 10), {"greetings": 2})
        self.assertEqual(score_greeting(words[:2], 0), {"greetings": 0})
        self.assertEqual(score_greeting([("trasferisco", .1), ("laboratorio", .2), ("corallo", .4)], 0),
                         {"greetings": 0})
        self.assertEqual(score_greeting([("corallo", .1)], 0), {"greetings": 0})

    def test_latency_percentile_includes_every_attempt(self):
        rows = [dict(status="passed", greetings=1, onset_ms=3000) for _ in range(38)]
        slow = dict(status="passed", greetings=1, onset_ms=3001)
        self.assertTrue(latency_summary(rows + [slow, slow])["passed"])
        self.assertFalse(latency_summary(rows[:-1] + [slow] * 3)["passed"])
        missing = dict(status="failed", observed={"runs": [{"outcome": "fallback"}]})
        result = latency_summary(rows + [missing, missing])
        self.assertFalse(result["passed"])
        self.assertEqual((result["p95_ms"], result["known_fallbacks"]), (3000, 2))
        self.assertIsNone(latency_summary(rows[:-1] + [missing] * 3)["p95_ms"])

    def test_cache_reuse_and_repair(self):
        calls = []
        def generate(phrase):
            calls.append(phrase["text"])
            return sample()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = root / "phrases.json"
            manifest.write_text(json.dumps({k: {"text": k, "model": "test"} for k in ["a", "b"]}))
            clips = prepare(root, generate, manifest)
            self.assertEqual(calls, ["a", "b"])
            self.assertTrue(all(valid_wav(path) for path in clips.values()))
            prepare(root, generate, manifest)
            self.assertEqual(calls, ["a", "b"])
            clips["a"].unlink()
            prepare(root, generate, manifest)
            clips["b"].write_bytes(b"invalid")
            prepare(root, generate, manifest)
            self.assertEqual(calls, ["a", "b", "a", "b"])

    def test_no_partial_wav_on_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = root / "phrases.json"
            manifest.write_text('{"greeting":{"text":"ciao","model":"test"}}')
            def unavailable(phrase):
                raise RuntimeError("provider unavailable")
            with self.assertRaises(RuntimeError):
                prepare(root, unavailable, manifest)
            self.assertEqual(list(root.glob("*.wav")), [])

    def test_profiles_and_italian_matching(self):
        full = set(matrix("functional"))
        self.assertTrue(set(matrix("smoke")) <= full)
        self.assertTrue(full.isdisjoint(matrix("recovery")))
        self.assertEqual(len(full), len(matrix("functional")))
        self.assertTrue(matches("Richiami venerdì.", r"venerdi"))
        self.assertFalse(matches("la parola è zafferano", r"(?s)^(?!.*zafferano).+$"))

    def test_named_greeting_and_queue_refusal(self):
        self.assertTrue(matches("Benvenuta al Laboratorio Corello.", CORALLO))
        self.assertFalse(matches("Benvenuta al laboratorio Rubino.", CORALLO))
        self.assertTrue(matches("Non trovo la coda richiesta. Vuole parlare con Assistenza Collaudo?", REFUSAL))
        self.assertFalse(matches("Intende la coda di assistenza collaudo?", REFUSAL))
        self.assertFalse(matches("La passo alla coda di assistenza collaudo.", REFUSAL))

    def test_callback_waits_for_selection_question(self):
        speech = Mock()
        speech.transcribe.side_effect = ["Giulia Ferri ti ha chiamato.", "Vuoi che ti metta in contatto?"]
        phones = {role: Mock() for role in ("caller", "colleague", "denied")}
        call = Call(Mock(), phones, {}, {}, speech, "live", "callback-inbound", [])
        phones["caller"].listen.return_value = sample()
        pattern = r"(?s)(?=.*\bgiulia\b).*" + CALLBACK_SELECTION
        call.hear_until(phones["caller"], 0, pattern, "selection question")
        self.assertEqual(phones["caller"].listen.call_count, 2)
        self.assertTrue(matches("Giulia Ferri ha chiamato. Voi que tinetta en contato con lai.", pattern))
        self.assertFalse(matches("Giulia Ferri ha chiamato. La metto in contatto con lei.", pattern))

    def test_denied_and_unconfirmed_alternative_queue_rings_fail_independently(self):
        phones = {role: Mock(incoming=0) for role in ("caller", "colleague", "denied")}
        call = Call(Mock(), phones, {}, {}, Mock(), "live", "denied-queue", [])
        counts = {"colleague": 0, "denied": 0}
        call.assert_queue_refusal(counts)
        phones["denied"].incoming = 1
        with self.assertRaisesRegex(AssertionError, "Denied queue reached its member"):
            call.assert_queue_refusal(counts)
        phones["denied"].incoming = 0
        phones["colleague"].incoming = 1
        with self.assertRaisesRegex(AssertionError, "Allowed queue rang before caller confirmation"):
            call.assert_queue_refusal(counts)

    def test_partial_cleanup_preserves_manifest_and_attempts_both_resources(self):
        lab, history = Mock(), Mock()
        history.phone.close.side_effect = RuntimeError("endpoint unavailable")
        history.cleanup.side_effect = RuntimeError("trunk still active")
        with self.assertRaisesRegex(RuntimeError, "carrier phone:.*history trunk:"):
            cleanup(lab, history)
        history.cleanup.assert_called_once()
        lab.cleanup.assert_called_once_with(keep_manifest=True)

    def test_cleanup_refuses_active_run(self):
        with tempfile.TemporaryDirectory() as directory:
            with claim_run(Path(directory)):
                with self.assertRaisesRegex(RuntimeError, "controller is still active"):
                    claim_run(Path(directory))

    def test_media_discard_preserves_cursor_and_header(self):
        with tempfile.TemporaryDirectory() as directory:
            phone = MediaPhone.__new__(MediaPhone)
            phone.erased = 0
            phone.capture = Path(directory) / "received.wav"
            phone.capture.write_bytes(sample())
            before = phone.mark()
            phone.discard()
            self.assertEqual(phone.mark(), before)
            self.assertEqual(pcm_window(phone.capture, 0), (8000, bytes(before)))
            with phone.capture.open("ab") as out:
                out.write(b"next")
            self.assertEqual(pcm_window(phone.capture, before)[1], b"next")

    def test_callback_outcome_requires_recent_caller_evidence(self):
        lab = Mock()
        fixture = {"endpoints": {"colleague": {"username": "8000001"}}}
        call = Call(lab, {"caller": Mock(), "colleague": Mock(), "denied": Mock()},
                    fixture, {}, Mock(), "realtime", "callback", [])
        call.baseline = set()
        lab.activity.return_value = [{"run_id": "a", "outcome": "transferred", "adapter": "realtime"}]
        handoff = dict(event_type="transfer_committed", destination_id="extension:8000001")
        lab.trace.return_value = {"events": [handoff]}
        with self.assertRaisesRegex(AssertionError, "callback lookup"):
            call.outcome("transferred")
        lab.trace.return_value["events"].append(dict(event_type="tool_completed",
                tool_id="pbx.find_recent_callers", result_count=1))
        self.assertEqual(call.outcome("transferred")["run_id"], "a")

    def test_waits_past_tool_progress_announcement(self):
        speech = Mock()
        speech.transcribe.side_effect = ["Verifico se posso collegarti.", "Non trovo il contatto."]
        phones = {role: Mock() for role in ("caller", "colleague", "denied")}
        call = Call(Mock(), phones, {}, {}, speech, "live", "denied", [])
        phones["caller"].listen.return_value = sample()
        heard = call.hear_until(phones["caller"], 32, REFUSAL, "refusal")
        self.assertIn("Non trovo", heard)
        cursors = [args.args[0] for args in phones["caller"].listen.call_args_list]
        self.assertEqual(cursors, [32, 2432])

    def test_colleague_confirmation_requires_an_explicit_unambiguous_question(self):
        phones = {role: Mock() for role in ("caller", "colleague", "denied")}
        call = Call(Mock(), phones, {}, {"confirm": "synthetic.wav"}, Mock(), "live", "chat-dnd", [])
        for text in ("Controllo Giulia Ferri.", "Intende Luca oppure Giulia?",
                     "Giulia ha la segreteria, conferma il messaggio?"):
            call.confirm_destination(text)
        phones["caller"].play.assert_not_called()
        for _ in range(2):
            call.confirm_destination("Posso passarti Giulia Ferri?")
        phones["caller"].play.assert_called_once_with("synthetic.wav")

    def test_ringing_wait_allows_caller_to_answer_confirmation(self):
        phones = {role: Mock() for role in ("caller", "colleague", "denied")}
        speech = Mock()
        speech.transcribe.side_effect = ["Controllo Giulia Ferri.", "Intende parlare con lei?"]
        phones["caller"].listen.return_value = sample()
        case = Call(Mock(), phones, {}, {"confirm": "synthetic.wav"}, speech, "live", "attended-question", [])
        signal = Mock()
        signal.done.return_value = False
        signal.result.side_effect = [FutureTimeout, FutureTimeout, "ringing"]
        wait = Mock()
        with patch("scenarios.ThreadPoolExecutor") as pool:
            executor = pool.return_value.__enter__.return_value
            executor.submit.return_value = signal
            self.assertEqual(case.wait_for_recipient(wait, 10), "ringing")
            executor.submit.assert_called_once_with(wait)
        self.assertEqual(phones["caller"].listen.call_args_list, [call(10, 5), call(2410, 5)])
        phones["caller"].play.assert_called_once_with("synthetic.wav")

    def test_private_capture_starts_at_answer(self):
        phones = {role: Mock() for role in ("caller", "colleague", "denied")}
        case = Call(Mock(), phones, {}, {}, Mock(), "live", "attended-accept", [])
        peer = phones["colleague"]
        peer.mark.return_value = 123
        self.assertEqual(case.answer_ringing_peer(peer), 123)
        self.assertEqual(peer.method_calls, [call.mark(), call.answer(), call.wait("CONFIRMED", 12)])

    def test_complete_utterance_can_be_scored_when_tone_masks_end_of_turn(self):
        phones = {role: Mock() for role in ("caller", "colleague", "denied")}
        speech = Mock()
        speech.transcribe.return_value = "Chiamata per la consegna del pianoforte."
        case = Call(Mock(), phones, {}, {}, speech, "realtime", "attended-accept", [])
        peer = phones["colleague"]
        peer.listen.side_effect = MediaError("timed out waiting for end of received turn")
        peer.received.return_value = sample()
        case.hear_until(peer, 42, r"pianoforte", "private reason")
        peer.received.assert_called_once_with(42)
        self.assertIn("private reason", case.evidence)
