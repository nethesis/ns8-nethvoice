"""Loopback PCMU endpoint for a controlled ARI externalMedia caller."""
import asyncio
import secrets
import struct

from .live_audio import SignalStats


def decode_ulaw(payload):
    values = []
    for value in payload:
        value = ~value & 255
        magnitude = (((value & 15) << 3) + 132) << ((value & 112) >> 4)
        values.append(132 - magnitude if value & 128 else magnitude - 132)
    return struct.pack('<' + 'h' * len(values), *values)


def rtp_payload(packet):
    if len(packet) < 12 or packet[0] >> 6 != 2 or packet[1] & 127 != 0:
        return None
    offset = 12 + 4 * (packet[0] & 15)
    if len(packet) < offset:
        return None
    if packet[0] & 16:
        if len(packet) < offset + 4:
            return None
        offset += 4 + 4 * int.from_bytes(packet[offset + 2:offset + 4], 'big')
    end = len(packet)
    if packet[0] & 32:
        padding = packet[-1]
        if padding == 0 or padding > end - offset:
            return None
        end -= padding
    if not offset < end or end - offset > 8192:
        return None
    return packet[offset:end]


class SyntheticRTP(asyncio.DatagramProtocol):
    def __init__(self):
        self.stats = SignalStats(8000)
        self.peer = None
        self.transport = None
        self.invalid_packets = self.foreign_packets = self.sent_packets = 0
        self.sent_stats = SignalStats(8000)

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, packet, address):
        if address != self.peer:
            self.foreign_packets += 1
            return
        payload = rtp_payload(packet)
        if payload is None:
            self.invalid_packets += 1
        else:
            self.stats.pcm(decode_ulaw(payload))

    async def stream(self, speech, *, duration=35, speech_at=12):
        if not 0 < duration <= 55 or not 0 <= speech_at < duration or len(speech) > 160000:
            raise ValueError('invalid_stimulus_bound')
        sequence, timestamp, ssrc = secrets.randbits(16), secrets.randbits(32), secrets.randbits(32)
        loop = asyncio.get_running_loop()
        started = loop.time()
        for frame in range(int(duration * 50)):
            await asyncio.sleep(max(0, started + frame * .02 - loop.time()))
            position = frame * 160 - int(speech_at * 8000)
            payload = speech[position:position + 160] if 0 <= position < len(speech) else b''
            payload = payload.ljust(160, b'\xff')
            if self.peer is not None:
                self.transport.sendto(struct.pack('!BBHII', 128, 0, sequence, timestamp, ssrc) + payload, self.peer)
                self.sent_packets += 1
                self.sent_stats.pcm(decode_ulaw(payload))
            sequence = (sequence + 1) & 65535
            timestamp = (timestamp + 160) & 0xffffffff

    def measurements(self):
        return {'received': self.stats.snapshot(), 'sent': self.sent_stats.snapshot(),
                'invalid_packets': self.invalid_packets, 'foreign_packets': self.foreign_packets,
                'sent_packets': self.sent_packets}
