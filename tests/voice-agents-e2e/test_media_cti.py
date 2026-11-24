import io
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock
import wave
from xml.etree import ElementTree as ET

from cti import CLIENT, Colleague, CTIError
from media import MediaError, pcm_window, speech_edges, wav_bytes


class MediaTests(unittest.TestCase):
    def test_split_live_wav_before_header_finalized(self):
        samples = struct.pack("<160h", *([800] * 160))
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder, "received.wav")
            encoded = bytearray(wav_bytes(8000, samples + bytes(640)))
            # Active PJSUA capture headers may advertise zero/incomplete lengths.
            encoded[40:44] = bytes(4)
            path.write_bytes(encoded)
            rate, data = pcm_window(path, 0)
            self.assertEqual(speech_edges(rate, data), (0, len(samples)))
            _, tail = pcm_window(path, len(samples))
            self.assertEqual(tail, bytes(640))
            with wave.open(io.BytesIO(wav_bytes(rate, tail))) as segment:
                self.assertEqual(segment.getnframes(), 320)
            with self.assertRaises(MediaError):
                wav_bytes(rate, b"")

    def test_cti_filters_sender_and_delayed_references(self):
        user = Colleague(dict(username="coll", host="pbx.test", password="synthetic", extension=123))
        user.ws = Mock()
        valid = '<message xmlns="jabber:client" from="voice-agent-assistant@chat.internal/res" type="chat"><body>#ABC12345 Attendi</body></message>'
        user.ws.recv.side_effect = [
            valid.replace("voice-agent-assistant", "another"),
            valid.replace("</body>", '</body><delay xmlns="urn:xmpp:delay"/>'),
            valid
        ]
        self.assertEqual(user.receive(), "ABC12345")
        with self.assertRaises(CTIError):
            user.reply("DEADBEEF", "Accetto")
        user.reply("ABC12345", "Accetto & collegami")
        frame = ET.fromstring(user.ws.send.call_args.args[0])
        self.assertEqual(frame.attrib["to"], "voice-agent-assistant@chat.internal")
        self.assertEqual(frame.findtext("{%s}body" % CLIENT), "#ABC12345 Accetto & collegami")

    def test_identity_mismatch_prevents_presence_changes(self):
        c = Colleague(dict(username="coll", host="pbx.test", password="synthetic", extension=123))
        c._api = Mock(side_effect=[{"token":"jwt"},{"username":"coll","endpoints":{"mainextension":[{"id":"456"}]}}])
        with self.assertRaises(CTIError):
            c.login()
        with self.assertRaises(CTIError):
            c.presence("dnd")
        self.assertEqual(c._api.call_count, 2)

    def test_reconfirmation_requires_fresh_dnd_request_for_original_reference(self):
        user = Colleague(dict(username="coll", host="pbx.test", password="synthetic", extension=123))
        user.ws = Mock()
        message = '<message xmlns="jabber:client" from="voice-agent-assistant@chat.internal/res" type="chat"><body>{}</body></message>'
        request = message.format("#ABC12345 Please leave DND, then send #ABC12345 accept again.")
        user.ws.recv.side_effect = [
            message.format("#ABC12345 Una chiamata in attesa"),
            message.format("#ABC12345 Please wait"),
            request.replace("ABC12345", "DEADBEEF"),
            request.replace("</body>", '</body><delay xmlns="urn:xmpp:delay"/>'),
            request,
        ]
        self.assertEqual(user.receive(), "ABC12345")
        self.assertEqual(user.receive(reconfirm="ABC12345"), "ABC12345")
        self.assertEqual(user.ws.recv.call_count, 5)

    def test_online_reconfirmation_requires_effective_online_presence(self):
        c = Colleague(dict(username="coll", host="pbx.test", password="synthetic", extension=123))
        c.token = "jwt"
        c._api = Mock(side_effect=[{}, {"presence": "online", "mainPresence": "offline"},
                                  {"presence": "online", "mainPresence": "online"}])
        c.presence("online", effective=True)
        self.assertEqual(c._api.call_count, 3)

    def test_restore_uses_configured_presence_while_phone_is_busy(self):
        c = Colleague(dict(username="coll", host="pbx.test", password="synthetic", extension=123))
        me = {"username": "coll", "endpoints": {"mainextension": [{"id": "123"}]},
              "presence": "online", "mainPresence": "busy"}
        c._api = Mock(side_effect=[{"token": "jwt"}, me, {}, dict(me, presence="dnd"), {}, me])
        c.login()
        c.presence("dnd")
        c.close()
        self.assertEqual(c._api.call_args_list[-2].args, ("user/presence", {"status": "online"}))
        self.assertIsNone(c.token)
