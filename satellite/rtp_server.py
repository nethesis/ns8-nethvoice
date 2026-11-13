import asyncio
import logging
import struct

logger = logging.getLogger("rtp_server")

class RTPStream:
    """
    Represents a single RTP (Real-time Transport Protocol) stream.

    This class encapsulates the components needed to manage an RTP connection,
    including a reader for handling incoming audio data, the remote address
    information for the stream source, and a flag to track the active state.
    It serves as the main abstraction for individual audio streams in the system.
    """
    def __init__(self, remote_addr=None):
        self.reader = RTPStreamReader()
        self.remote_addr = remote_addr
        self.active = True

class RTPStreamReader:
    """
    Buffers and manages incoming RTP audio data.

    This class provides a mechanism for storing incoming audio packets in a buffer,
    allowing for efficient reading of audio data in chunks. It implements flow control
    by limiting the maximum buffer size and provides methods for reading and clearing
    the buffer.
    """
    def __init__(self):
        self._buffer = bytearray()  # Use bytearray instead of bytes for more efficient modifications
        self._max_buffer_size = 51200  # Maximum buffer size in bytes

    def feed_data(self, data):
        """Add received audio data to the buffer"""
        # Avoid growing buffer beyond maximum size
        if len(self._buffer) + len(data) > self._max_buffer_size:
            # Remove old data to make room for new data
            excess = len(self._buffer) + len(data) - self._max_buffer_size
            del self._buffer[:excess]

        # Append new data
        self._buffer.extend(data)

    def read(self, bytes_count=320):
        """Read specified bytes from buffer"""
        if not self._buffer:
            return b''

        # Return at most bytes_count bytes
        data = bytes(self._buffer[:bytes_count])
        # Remove read data from buffer - efficient with bytearray
        del self._buffer[:bytes_count]
        return data

    def clear(self):
        """Clear the buffer entirely"""
        self._buffer.clear()

class RTPServer:
    """
    Main RTP server that manages multiple RTP streams.

    This server creates and manages a UDP socket for receiving and sending RTP packets.
    It maintains a collection of RTP streams, each identified by a port number, and
    provides methods for creating, finding, and ending streams. The server handles
    byte-order conversion between big-endian and little-endian formats if needed.
    """
    def __init__(self, host: str, port: int, swap16: bool = False, rtp_header_size: int = 12):
        self.host = host
        self.port = port
        self.swap16 = swap16
        self.rtp_header_size = rtp_header_size
        self.streams = {}
        self.protocol = None
        self.transport = None

    async def start(self):
        """Start the RTP server"""
        loop = asyncio.get_event_loop()
        self.transport, self.protocol = await loop.create_datagram_endpoint(
            lambda: RTPProtocol(self),
            local_addr=(self.host, self.port)
        )
        logger.info(f"RTP server listening on {self.host}:{self.port}")

    async def stop(self):
        """Stop the RTP server"""
        if self.transport:
            self.transport.close()

        # Close all active streams
        for port in list(self.streams.keys()):
            self.end_stream(port)

    async def create_stream(self, port: int):
        """Create a new stream for the given port"""
        if port in self.streams:
            logger.warning(f"Stream for port {port} already exists")
            return self.streams[port]

        stream = RTPStream()
        self.streams[port] = stream

        logger.info(f"Created new RTP stream for port {port}")
        return stream

    def end_stream(self, port: int):
        """End the stream for the given port"""
        if port not in self.streams:
            logger.warning(f"Attempted to end non-existent stream for port {port}")
            return

        stream = self.streams[port]
        stream.active = False

        try:
            # Clear reader buffer
            stream.reader.clear()
        except Exception as e:
            logger.warning(f"Error closing stream writer: {e}")

        # Remove from streams dictionary
        del self.streams[port]
        logger.info(f"Ended RTP stream for port {port}")

class RTPProtocol(asyncio.DatagramProtocol):
    """
    Implements the asyncio DatagramProtocol to handle RTP packets over UDP.

    This protocol processes incoming UDP datagrams containing RTP packets, associating them
    with the appropriate stream based on the sender's address. It handles packet validation,
    RTP header removal, and optional byte-order conversion before delivering the audio data
    to the target stream reader.
    """
    def __init__(self, server):
        self.server = server
        self.transport = None

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, data, addr):
        """
        Process incoming UDP datagrams containing RTP packets.
        This method handles incoming RTP packets by:
        1. Associating the packet with the correct stream based on address
        2. Validating the packet and stream state
        3. Extracting the audio data by removing the RTP header
        4. Converting byte order if necessary (big-endian to little-endian)
        5. Delivering the audio data to the appropriate stream reader
        Args:
            data (bytes): The raw UDP datagram data containing the RTP packet
            addr (tuple): The sender's address as (ip_address, port_number)
        Returns:
            None
        Note:
            The method will silently return if no matching stream is found,
            if the stream is inactive, or if the RTP packet is invalid.
        """
        source_port = addr[1]

        # Find or associate stream
        target_stream = None
        for port, stream in self.server.streams.items():
            if stream.remote_addr == addr:
                target_stream = stream
                break
            elif stream.remote_addr is None:
                stream.remote_addr = addr
                target_stream = stream
                logger.info(f"Associated stream on port {port} with {addr}")
                break

        if not target_stream:
            return

        # Skip if stream is not active
        if not target_stream.active:
            logger.warning(f"Received RTP packet from inactive stream {addr}")
            return

        # Process RTP packet
        if len(data) <= self.server.rtp_header_size:
            logger.warning(f"Received invalid RTP packet (too small) from {addr}, size: {len(data)}")
            return

        # Strip the RTP header
        audio_data = data[self.server.rtp_header_size:]

        # Convert big-endian to little-endian if needed
        if self.server.swap16:
            try:
                # Only swap if the data length is even (needed for 16-bit audio)
                if len(audio_data) % 2 == 0:
                    # Swap every 2 bytes
                    audio_data = b''.join(
                        struct.pack('<H', struct.unpack('>H', audio_data[i:i+2])[0])
                        for i in range(0, len(audio_data), 2)
                    )
            except Exception as e:
                logger.warning(f"Error swapping audio bytes: {e}")

        # Feed audio data to the stream reader
        target_stream.reader.feed_data(audio_data)
