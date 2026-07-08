"""
Unit tests for the RTP server and stream components.
"""
import pytest
import asyncio
import struct
from unittest.mock import Mock, AsyncMock, patch
from rtp_server import RTPServer, RTPStream, RTPStreamReader, RTPProtocol


class TestRTPStreamReader:
    """Tests for the RTPStreamReader class."""

    def test_initialization(self):
        """Test RTPStreamReader initialization."""
        reader = RTPStreamReader()
        assert len(reader._buffer) == 0
        assert reader._max_buffer_size == 51200

    def test_feed_data(self):
        """Test adding data to the buffer."""
        reader = RTPStreamReader()
        data = b'test audio data'
        
        reader.feed_data(data)
        assert len(reader._buffer) == len(data)

    def test_read_data(self):
        """Test reading data from the buffer."""
        reader = RTPStreamReader()
        data = b'test audio data'
        
        reader.feed_data(data)
        read_data = reader.read(4)
        
        assert read_data == b'test'
        assert len(reader._buffer) == len(data) - 4

    def test_read_empty_buffer(self):
        """Test reading from an empty buffer."""
        reader = RTPStreamReader()
        read_data = reader.read(10)
        
        assert read_data == b''

    def test_buffer_overflow_handling(self):
        """Test that buffer overflow is handled correctly."""
        reader = RTPStreamReader()
        
        # Fill buffer to max size
        large_data = b'x' * reader._max_buffer_size
        reader.feed_data(large_data)
        assert len(reader._buffer) == reader._max_buffer_size
        
        # Add more data - should remove old data
        extra_data = b'y' * 100
        reader.feed_data(extra_data)
        
        # Buffer should still be at max size
        assert len(reader._buffer) == reader._max_buffer_size
        # The newest data should be at the end
        assert reader._buffer[-100:] == extra_data

    def test_clear_buffer(self):
        """Test clearing the buffer."""
        reader = RTPStreamReader()
        reader.feed_data(b'test data')
        
        reader.clear()
        assert len(reader._buffer) == 0


class TestRTPStream:
    """Tests for the RTPStream class."""

    def test_initialization(self):
        """Test RTPStream initialization."""
        stream = RTPStream()
        
        assert isinstance(stream.reader, RTPStreamReader)
        assert stream.remote_addr is None
        assert stream.active is True

    def test_initialization_with_remote_addr(self):
        """Test RTPStream initialization with remote address."""
        addr = ("192.168.1.1", 5000)
        stream = RTPStream(remote_addr=addr)
        
        assert stream.remote_addr == addr


class TestRTPServer:
    """Tests for the RTPServer class."""

    def test_initialization(self):
        """Test RTPServer initialization."""
        server = RTPServer(
            host="0.0.0.0",
            port=10000,
            swap16=True,
            rtp_header_size=12
        )
        
        assert server.host == "0.0.0.0"
        assert server.port == 10000
        assert server.swap16 is True
        assert server.rtp_header_size == 12
        assert server.streams == {}

    @pytest.mark.asyncio
    async def test_start_server(self):
        """Test starting the RTP server."""
        server = RTPServer(host="127.0.0.1", port=10000)
        
        with patch('asyncio.get_event_loop') as mock_get_loop:
            mock_loop = AsyncMock()
            mock_transport = Mock()
            mock_protocol = Mock()
            mock_loop.create_datagram_endpoint = AsyncMock(
                return_value=(mock_transport, mock_protocol)
            )
            mock_get_loop.return_value = mock_loop
            
            await server.start()
            
            assert server.transport == mock_transport
            assert server.protocol == mock_protocol

    @pytest.mark.asyncio
    async def test_stop_server(self):
        """Test stopping the RTP server."""
        server = RTPServer(host="127.0.0.1", port=10000)
        
        # Mock transport
        mock_transport = Mock()
        server.transport = mock_transport
        
        # Add a stream
        server.streams[5000] = RTPStream()
        
        await server.stop()
        
        mock_transport.close.assert_called_once()
        assert len(server.streams) == 0

    @pytest.mark.asyncio
    async def test_create_stream(self):
        """Test creating a new stream."""
        server = RTPServer(host="127.0.0.1", port=10000)
        
        stream = await server.create_stream(5000)
        
        assert isinstance(stream, RTPStream)
        assert 5000 in server.streams
        assert server.streams[5000] == stream

    @pytest.mark.asyncio
    async def test_create_duplicate_stream(self):
        """Test creating a stream that already exists."""
        server = RTPServer(host="127.0.0.1", port=10000)
        
        stream1 = await server.create_stream(5000)
        stream2 = await server.create_stream(5000)
        
        # Should return the existing stream
        assert stream1 == stream2
        assert len(server.streams) == 1

    def test_end_stream(self):
        """Test ending a stream."""
        server = RTPServer(host="127.0.0.1", port=10000)
        
        # Create a stream
        stream = RTPStream()
        server.streams[5000] = stream
        
        server.end_stream(5000)
        
        assert stream.active is False
        assert 5000 not in server.streams

    def test_end_nonexistent_stream(self):
        """Test ending a stream that doesn't exist."""
        server = RTPServer(host="127.0.0.1", port=10000)
        
        # Should not raise an error
        server.end_stream(5000)


class TestRTPProtocol:
    """Tests for the RTPProtocol class."""

    def test_initialization(self):
        """Test RTPProtocol initialization."""
        server = RTPServer(host="127.0.0.1", port=10000)
        protocol = RTPProtocol(server)
        
        assert protocol.server == server
        assert protocol.transport is None

    def test_connection_made(self):
        """Test connection_made callback."""
        server = RTPServer(host="127.0.0.1", port=10000)
        protocol = RTPProtocol(server)
        
        mock_transport = Mock()
        protocol.connection_made(mock_transport)
        
        assert protocol.transport == mock_transport

    def test_datagram_received_no_stream(self):
        """Test receiving datagram when no stream exists."""
        server = RTPServer(host="127.0.0.1", port=10000)
        protocol = RTPProtocol(server)
        
        # Create RTP packet
        rtp_header = b'\x00' * 12
        audio_data = b'test audio'
        packet = rtp_header + audio_data
        
        addr = ("192.168.1.1", 5000)
        
        # Should not raise an error, just return silently
        protocol.datagram_received(packet, addr)

    def test_datagram_received_with_stream(self):
        """Test receiving datagram with an existing stream."""
        server = RTPServer(host="127.0.0.1", port=10000, rtp_header_size=12)
        protocol = RTPProtocol(server)
        
        # Create a stream
        stream = RTPStream()
        server.streams[10001] = stream
        
        # Create RTP packet
        rtp_header = b'\x00' * 12
        audio_data = b'test audio data'
        packet = rtp_header + audio_data
        
        addr = ("192.168.1.1", 5000)
        
        protocol.datagram_received(packet, addr)
        
        # Check that stream was associated with address
        assert stream.remote_addr == addr
        # Check that audio data was fed to reader (header stripped)
        assert len(stream.reader._buffer) == len(audio_data)

    def test_datagram_received_byte_swapping(self):
        """Test byte swapping when swap16 is enabled."""
        server = RTPServer(host="127.0.0.1", port=10000, swap16=True, rtp_header_size=12)
        protocol = RTPProtocol(server)
        
        # Create a stream
        stream = RTPStream()
        addr = ("192.168.1.1", 5000)
        stream.remote_addr = addr
        server.streams[10001] = stream
        
        # Create RTP packet with big-endian 16-bit samples
        rtp_header = b'\x00' * 12
        # Two 16-bit samples in big-endian: 0x1234 and 0x5678
        audio_data = struct.pack('>HH', 0x1234, 0x5678)
        packet = rtp_header + audio_data
        
        protocol.datagram_received(packet, addr)
        
        # Check that data was swapped to little-endian
        swapped_data = struct.pack('<HH', 0x1234, 0x5678)
        assert bytes(stream.reader._buffer) == swapped_data

    def test_datagram_received_invalid_packet_size(self):
        """Test receiving packet smaller than RTP header."""
        server = RTPServer(host="127.0.0.1", port=10000, rtp_header_size=12)
        protocol = RTPProtocol(server)
        
        # Create a stream
        stream = RTPStream()
        addr = ("192.168.1.1", 5000)
        stream.remote_addr = addr
        server.streams[10001] = stream
        
        # Create invalid packet (smaller than header)
        packet = b'\x00' * 8
        
        protocol.datagram_received(packet, addr)
        
        # Buffer should be empty (packet was rejected)
        assert len(stream.reader._buffer) == 0

    def test_datagram_received_inactive_stream(self):
        """Test receiving datagram for an inactive stream."""
        server = RTPServer(host="127.0.0.1", port=10000, rtp_header_size=12)
        protocol = RTPProtocol(server)
        
        # Create an inactive stream
        stream = RTPStream()
        stream.active = False
        addr = ("192.168.1.1", 5000)
        stream.remote_addr = addr
        server.streams[10001] = stream
        
        # Create RTP packet
        rtp_header = b'\x00' * 12
        audio_data = b'test audio data'
        packet = rtp_header + audio_data
        
        protocol.datagram_received(packet, addr)
        
        # Buffer should be empty (packet was rejected)
        assert len(stream.reader._buffer) == 0

