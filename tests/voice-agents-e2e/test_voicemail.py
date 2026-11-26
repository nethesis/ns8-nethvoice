import io
import math
import struct
import unittest
import wave
from unittest.mock import Mock

from scenarios import Call, REMEMBER_PHRASE, matches, voicemail_beep_ended


def prompt(hz, duration, *, rate=8000, tail=0.1):
    samples = [0] * (rate // 50)
    samples.extend(round(1800 * math.sin(2 * math.pi * hz * t / rate))
                   for t in range(round(duration * rate)))
    samples.extend([0] * round(tail * rate))
    audio = io.BytesIO()
    with wave.open(audio, "wb") as wav:
        wav.setparams((1, 2, rate, 0, "NONE", ""))
        wav.writeframes(struct.pack(f"<{len(samples)}h", *samples))
    return audio.getvalue()


class VoicemailBeepTests(unittest.TestCase):
    def test_asterisk_beep_ends_at_media_sample_rates(self):
        for rate in (8000, 16000, 44100):
            with self.subTest(rate=rate):
                self.assertTrue(voicemail_beep_ended(prompt(700, 0.425, rate=rate)))

    def test_other_sounds_and_incomplete_beep_do_not_open_recording_window(self):
        for frequency, duration, tail in ((440, 0.425, 0.1), (700, 0.10, 0.1),
                                          (700, 1.0, 0.1), (700, 0.38, 0)):
            with self.subTest(frequency=frequency, duration=duration, tail=tail):
                self.assertFalse(voicemail_beep_ended(prompt(frequency, duration, tail=tail)))

    def test_recording_waits_for_the_beep_and_requires_one_new_message(self):
        call = object.__new__(Call)
        call.case = "voicemail-yes"
        call.evidence = []
        call.mail_count = 3
        call.caller = Mock()
        call.caller.mark.return_value = 100
        first = prompt(440, 0.425)
        call.caller.listen.side_effect = [first, prompt(700, 0.425)]
        call.hear_until = Mock()
        call.outcome = Mock()
        call.lab = Mock()
        call.lab.mailbox_count.return_value = 4

        def play(phone, key):
            if key == "vm_message":
                self.assertEqual(phone.listen.call_count, 2)
                phone.hangup.assert_not_called()
            else:
                self.assertEqual(key, "vm_yes")

        call.play = Mock(side_effect=play)
        call.recipient_alternative(0)
        cursors = [op.args[0] for op in call.caller.listen.call_args_list]
        self.assertEqual(cursors, [100, 100 + len(first) - 44])
        self.assertEqual([op.args[1] for op in call.play.call_args_list], ["vm_yes", "vm_message", "vm_message"])
        call.caller.hangup.assert_called_once_with()
        self.assertIn("one new message saved in the colleague's mailbox", call.evidence)

    def test_refusal_and_follow_up_use_one_caller_turn(self):
        call = object.__new__(Call)
        call.case = "voicemail-no"
        call.evidence = []
        call.mail_count = 3
        call.caller = Mock()
        call.caller.mark.return_value = 100
        call.hear_until = Mock()
        call.play = Mock()
        call.finish = Mock()
        call.lab = Mock()
        call.lab.mailbox_count.return_value = 3

        call.recipient_alternative(0)

        call.play.assert_called_once_with(call.caller, "vm_no")
        call.hear_until.assert_called_with(call.caller, 100, REMEMBER_PHRASE, "returned to agent", timeout=25)
        call.finish.assert_called_once_with()
        self.assertIn("mailbox unchanged after explicit refusal", call.evidence)
        self.assertTrue(matches("Il girasole cresce in giardino.", REMEMBER_PHRASE))
        self.assertTrue(matches("Il girazone cresce in giardino.", REMEMBER_PHRASE))
        self.assertFalse(matches("Girasole.", REMEMBER_PHRASE))
        self.assertFalse(matches("Va bene, arrivederci.", REMEMBER_PHRASE))
