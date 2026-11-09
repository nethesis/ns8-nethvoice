import asyncio
import logging
import json
import time
from aiomqtt import Client, MqttError

logger = logging.getLogger("mqtt_client")

class MessageValidator:
    """Simple message validator for MQTT messages"""

    @staticmethod
    def validate_schema(topic_path, payload):
        """Validate that a message payload matches the expected schema for its topic"""
        # Extract the topic type (last part of the path)
        parts = topic_path.split('/')
        if len(parts) < 1:
                return False

        # Get the last part of the path as the topic type
        topic_type = parts[-1]

        # If payload is a string that looks like JSON, try to parse it
        if isinstance(payload, str) and payload.strip().startswith('{') and payload.strip().endswith('}'):
            try:
                payload = json.loads(payload)
                logger.debug(f"Parsed JSON string payload for topic {topic_path}")
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse payload as JSON: {payload}")

        # Define expected schemas for different topics
        if topic_type == 'events':
            # Events must have a type field
            if not isinstance(payload, dict) or 'type' not in payload:
                logger.warning(f"Invalid event message schema: missing 'type' field: {payload}")
                return False
        elif topic_type == 'newStream':
            # newStream messages should have specific fields
            required_fields = ['roomName', 'port', 'channelId']
            if not isinstance(payload, dict):
                logger.warning(f"Invalid newStream message schema: payload is not a dictionary: {payload} (type: {type(payload)})")
                return False

            missing_fields = [field for field in required_fields if field not in payload]
            if missing_fields:
                logger.warning(f"Invalid newStream message schema: missing fields {missing_fields}: {payload}")
                return False

            # Allow the message to pass validation even with warnings
            return True
        elif topic_type == 'channelEnd':
            # channelEnd messages should have a channelId
            if not isinstance(payload, dict):
                logger.warning(f"Invalid channelEnd message schema: payload is not a dictionary: {payload} (type: {type(payload)})")
                return False

            if 'channelId' not in payload:
                logger.warning(f"Invalid channelEnd message schema: missing 'channelId' field: {payload}")
                return False

            # Allow the message to pass validation even with warnings
            return True

        return True

class MQTTClient:
    def __init__(self, url, topic_prefix, reconnect_delay=5, username=None, password=None):
        self.url = url
        self.topic_prefix = topic_prefix
        self.reconnect_delay = reconnect_delay
        self.username = username
        self.password = password
        self.client = None
        self.connected = False
        self.callback = None
        self._task = None
        self._subscriptions = set()
        self._stopping = False
        self.validator = MessageValidator()

    async def connect(self):
        """Connect to the MQTT broker with retry logic"""
        logger.debug(f"ENTER: connect() for MQTT client {self.url}")
        self._stopping = False
        await self._connect_with_retry()

        # Start message processing task
        self._task = asyncio.create_task(self._process_messages())

    async def _connect_with_retry(self):
        """Connect to the MQTT broker with retry until successful"""
        while not self.connected and not self._stopping:
            try:
                # Parse URL
                protocol, rest = self.url.split('://', 1)
                host, port = rest.split(':', 1)
                port = int(port)

                # Create a persistent client connection
                self.client = Client(
                    hostname=host,
                    port=port,
                    username=self.username,
                    password=self.password
                )
                await self.client.__aenter__()
                self.connected = True

                # Subscribe to all previously registered topics
                for topic in self._subscriptions:
                    await self.client.subscribe(topic)
                    logger.info(f"Subscribed to topic: {topic}")

                logger.info(f"Connected to MQTT broker at {self.url}")
                return True
            except Exception as e:
                logger.warning(f"Failed to connect to MQTT broker: {e}, retrying in {self.reconnect_delay} seconds")
                if hasattr(self, 'client') and self.client:
                    try:
                            await self.client.__aexit__(None, None, None)
                    except:
                            pass
                    self.client = None
                await asyncio.sleep(self.reconnect_delay)

        return False

    async def disconnect(self):
        """Disconnect from the MQTT broker"""
        logger.debug(f"disconnect() MQTT client {self.url}")
        self._stopping = True
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        if self.client:
                try:
                    await self.client.__aexit__(None, None, None)
                except:
                    pass
                self.client = None

        self.connected = False

    async def subscribe(self, topic):
        """Subscribe to an MQTT topic"""
        logger.debug(f"Subscribe(topic={topic}) for MQTT client {self.url}")
        full_topic = f"{self.topic_prefix}/{topic}" if self.topic_prefix else topic
        self._subscriptions.add(full_topic)

        if self.connected and self.client:
                try:
                    await self.client.subscribe(full_topic)
                    logger.info(f"Subscribed to topic: {full_topic}")
                except Exception as e:
                    logger.error(f"Failed to subscribe to topic {full_topic}: {e}")
                    return False

        return True

    async def publish(self, topic, payload):
        """Publish a message to an MQTT topic"""
        if not self.connected or not self.client:
            logger.warning("Cannot publish message: not connected to MQTT broker")
            return False

        # Special handling for event-based topics (intent, transcript, response, error)
        # These should not have the topic prefix
        event_topics = ["intent", "transcript", "response", "error"]
        if topic in event_topics:
            full_topic = topic
        else:
            # For all other topics, apply the prefix
            full_topic = f"{self.topic_prefix}/{topic}" if self.topic_prefix else topic

        # Validate message schema
        if not self.validator.validate_schema(full_topic, payload):
            logger.warning(f"Invalid message schema for topic {full_topic}")
            return False

        # Convert dict to JSON
        if isinstance(payload, dict):
            payload = json.dumps(payload)

        try:
            await self.client.publish(full_topic, payload)
            logger.debug(f"Published message to {full_topic}: {payload[:100]}...")
            return True
        except Exception as e:
            logger.error(f"Failed to publish message to {full_topic}: {e}")
            self.connected = False
            # Try to reconnect
            asyncio.create_task(self._connect_with_retry())
            return False

    def set_callback(self, callback):
        """Set a callback function to be called when a message is received"""
        self.callback = callback

    async def _process_messages(self):
        """Process incoming MQTT messages"""
        while not self._stopping:
            try:
                # Only process messages if connected and we have a client
                if self.connected and self.client and self.callback:
                    async for message in self.client.messages:
                        if self._stopping:
                            break

                        try:
                            # Parse payload
                            payload_str = message.payload.decode()
                            try:
                                # Try to parse as JSON
                                payload = json.loads(payload_str)
                                logger.info(f"Received JSON message on topic {message.topic}: {payload}")
                            except json.JSONDecodeError:
                                # Not JSON, use raw string
                                payload = payload_str
                                logger.info(f"Received non-JSON message on topic {message.topic}")

                            # Call the callback
                            if self.callback:
                                try:
                                    # Validate schema before calling callback
                                    if self.validator.validate_schema(str(message.topic), payload):
                                        await self.callback(str(message.topic), payload)
                                    else:
                                        logger.warning(f"Skipping invalid message on topic {message.topic}")
                                except Exception as e:
                                    logger.error(f"Error in message callback: {e}")
                        except Exception as e:
                            logger.error(f"Error processing MQTT message: {e}")
                else:
                    # Wait a bit before checking again
                    await asyncio.sleep(1)

            except asyncio.CancelledError:
                # Task was cancelled, exit gracefully
                self.connected = False
                break
            except Exception as e:
                logger.error(f"Unexpected error in MQTT message processing: {e}")
                self.connected = False

                # Don't attempt reconnect if we're stopping
                if self._stopping:
                    break

                # Wait before reconnecting
                await asyncio.sleep(self.reconnect_delay)

                # Try to reconnect
                await self._connect_with_retry()

