"""
Unit tests for the MQTT client and message validator.
"""
import pytest
import asyncio
import json
from unittest.mock import AsyncMock, patch
from mqtt_client import MQTTClient, MessageValidator


class TestMessageValidator:
    """Tests for the MessageValidator class."""

    def test_validate_events_with_type_field(self):
        """Test validation of event messages with required type field."""
        validator = MessageValidator()
        
        # Valid event message
        payload = {"type": "call_started", "data": {"channel": "123"}}
        assert validator.validate_schema("satellite/events", payload) is True
        
        # Invalid event message - missing type
        payload = {"data": {"channel": "123"}}
        assert validator.validate_schema("satellite/events", payload) is False

    def test_validate_new_stream_message(self):
        """Test validation of newStream messages."""
        validator = MessageValidator()
        
        # Valid newStream message
        payload = {
            "roomName": "test-room",
            "port": 10001,
            "channelId": "channel-123"
        }
        assert validator.validate_schema("satellite/newStream", payload) is True
        
        # Invalid - missing required fields
        payload = {"roomName": "test-room"}
        assert validator.validate_schema("satellite/newStream", payload) is False

    def test_validate_channel_end_message(self):
        """Test validation of channelEnd messages."""
        validator = MessageValidator()
        
        # Valid channelEnd message
        payload = {"channelId": "channel-123"}
        assert validator.validate_schema("satellite/channelEnd", payload) is True
        
        # Invalid - missing channelId
        payload = {"data": "some data"}
        assert validator.validate_schema("satellite/channelEnd", payload) is False

    def test_validate_json_string_payload(self):
        """Test validation with JSON string payload."""
        validator = MessageValidator()
        
        # JSON string that should be parsed
        payload = '{"type": "test_event"}'
        assert validator.validate_schema("satellite/events", payload) is True

    def test_validate_unknown_topic_type(self):
        """Test validation of unknown topic types (should pass by default)."""
        validator = MessageValidator()
        
        payload = {"any": "data"}
        assert validator.validate_schema("satellite/unknown", payload) is True


class TestMQTTClient:
    """Tests for the MQTTClient class."""

    @pytest.mark.asyncio
    async def test_initialization(self):
        """Test MQTT client initialization."""
        client = MQTTClient(
            url="mqtt://localhost:1883",
            topic_prefix="test",
            username="user",
            password="pass"
        )
        
        assert client.url == "mqtt://localhost:1883"
        assert client.topic_prefix == "test"
        assert client.username == "user"
        assert client.password == "pass"
        assert client.connected is False

    @pytest.mark.asyncio
    async def test_connect_success(self):
        """Test successful connection to MQTT broker."""
        client = MQTTClient(
            url="mqtt://localhost:1883",
            topic_prefix="test"
        )
        
        with patch('mqtt_client.Client') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock()
            mock_client.subscribe = AsyncMock()
            mock_client.messages = AsyncMock()
            mock_client_class.return_value = mock_client
            
            await client.connect()
            
            assert client.connected is True
            mock_client_class.assert_called_once()
            
            # Clean up
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_subscribe(self):
        """Test subscribing to a topic."""
        client = MQTTClient(
            url="mqtt://localhost:1883",
            topic_prefix="test"
        )
        
        with patch('mqtt_client.Client') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock()
            mock_client.subscribe = AsyncMock()
            mock_client.messages = AsyncMock()
            mock_client_class.return_value = mock_client
            
            await client.connect()
            result = await client.subscribe("test_topic")
            
            assert result is True
            mock_client.subscribe.assert_called_with("test/test_topic")
            
            # Clean up
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_publish_with_dict_payload(self):
        """Test publishing a message with dictionary payload."""
        client = MQTTClient(
            url="mqtt://localhost:1883",
            topic_prefix="test"
        )
        
        with patch('mqtt_client.Client') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock()
            mock_client.publish = AsyncMock()
            mock_client.subscribe = AsyncMock()
            mock_client.messages = AsyncMock()
            mock_client_class.return_value = mock_client
            
            await client.connect()
            
            payload = {"message": "test"}
            result = await client.publish("test_topic", payload)
            
            assert result is True
            # Check that the payload was converted to JSON
            mock_client.publish.assert_called_once()
            call_args = mock_client.publish.call_args
            assert call_args[0][0] == "test/test_topic"
            assert json.loads(call_args[0][1]) == payload
            
            # Clean up
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_publish_event_topic_without_prefix(self):
        """Test that event topics don't get the prefix."""
        client = MQTTClient(
            url="mqtt://localhost:1883",
            topic_prefix="test"
        )
        
        with patch('mqtt_client.Client') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock()
            mock_client.publish = AsyncMock()
            mock_client.subscribe = AsyncMock()
            mock_client.messages = AsyncMock()
            mock_client_class.return_value = mock_client
            
            await client.connect()
            
            # Event topics should not have prefix
            payload = {"data": "test"}
            await client.publish("intent", payload)
            
            call_args = mock_client.publish.call_args
            assert call_args[0][0] == "intent"  # No prefix
            
            # Clean up
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_publish_when_not_connected(self):
        """Test publishing when not connected returns False."""
        client = MQTTClient(
            url="mqtt://localhost:1883",
            topic_prefix="test"
        )
        
        payload = {"message": "test"}
        result = await client.publish("test_topic", payload)
        
        assert result is False

    @pytest.mark.asyncio
    async def test_disconnect(self):
        """Test disconnecting from MQTT broker."""
        client = MQTTClient(
            url="mqtt://localhost:1883",
            topic_prefix="test"
        )
        
        with patch('mqtt_client.Client') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock()
            mock_client.subscribe = AsyncMock()
            mock_client.messages = AsyncMock()
            mock_client_class.return_value = mock_client
            
            await client.connect()
            assert client.connected is True
            
            await client.disconnect()
            assert client.connected is False

    @pytest.mark.asyncio
    async def test_set_callback(self):
        """Test setting a message callback."""
        client = MQTTClient(
            url="mqtt://localhost:1883",
            topic_prefix="test"
        )
        
        async def test_callback(topic, payload):
            pass
        
        client.set_callback(test_callback)
        assert client.callback == test_callback

    @pytest.mark.asyncio
    async def test_publish_invalid_schema(self):
        """Test that messages with invalid schema are rejected."""
        client = MQTTClient(
            url="mqtt://localhost:1883",
            topic_prefix="test"
        )
        
        with patch('mqtt_client.Client') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock()
            mock_client.publish = AsyncMock()
            mock_client.subscribe = AsyncMock()
            mock_client.messages = AsyncMock()
            mock_client_class.return_value = mock_client
            
            await client.connect()
            
            # Invalid channelEnd message (missing channelId)
            payload = {"invalid": "data"}
            result = await client.publish("channelEnd", payload)
            
            assert result is False
            mock_client.publish.assert_not_called()
            
            # Clean up
            await client.disconnect()

