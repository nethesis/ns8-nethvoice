import asyncio
import logging
import os
import signal
from dotenv import load_dotenv
import threading
import uvicorn
from api import app as api_app
from asterisk_bridge import AsteriskBridge
from mqtt_client import MQTTClient
from rtp_server import RTPServer


# Load environment variables
load_dotenv(dotenv_path=".env")

# Configure logging
log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
log_level = getattr(logging, log_level_str, logging.INFO)
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s'
)
logger = logging.getLogger("main")

# For graceful shutdown
shutdown_event = asyncio.Event()

def signal_handler():
    logger.info("Shutdown signal received")
    shutdown_event.set()

async def realtime_call_transcription():
    # exit if deepgram api key is not set
    if not os.getenv("DEEPGRAM_API_KEY"):
        logger.error("DEEPGRAM_API_KEY is not set")
        return

    # Set up signal handlers for graceful shutdown
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)

    # Check for Google Cloud credentials
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if credentials_path and not os.path.exists(credentials_path):
        logger.error(f"Google Cloud credentials file not found at {credentials_path}")
        return

    # Get configuration from environment variables
    asterisk_url = os.getenv("ASTERISK_URL", "http://localhost:8088")
    asterisk_app = os.getenv("ARI_APP", "asterisk_dialogflow")
    asterisk_username = os.getenv("ARI_USERNAME", "asterisk")
    asterisk_password = os.getenv("SATELLITE_ARI_PASSWORD", "asterisk")

    mqtt_url = os.getenv("MQTT_URL", "mqtt://localhost:1883")
    mqtt_topic_prefix = os.getenv("MQTT_TOPIC_PREFIX", "asterisk-dialogflow")
    mqtt_username = os.getenv("MQTT_USERNAME")
    mqtt_password = os.getenv("SATELLITE_MQTT_PASSWORD")

    # create an RTP server instance
    rtp_host = os.getenv("RTP_HOST", "0.0.0.0")
    rtp_port = int(os.getenv("RTP_PORT", "10000"))
    rtp_swap16 = os.getenv("RTP_SWAP16", "true").lower() == "true"
    rtp_header_size = int(os.getenv("RTP_HEADER_SIZE", "12"))
    rtp_server = RTPServer(host=rtp_host, port=rtp_port, swap16=rtp_swap16, rtp_header_size=rtp_header_size)
    await rtp_server.start()

    # Create instances
    mqtt_client = MQTTClient(
        url=mqtt_url,
        topic_prefix=mqtt_topic_prefix,
        username=mqtt_username,
        password=mqtt_password
    )
    asterisk_bridge = AsteriskBridge(
        url=asterisk_url,
        app=asterisk_app,
        username=asterisk_username,
        password=asterisk_password,
        mqtt_client=mqtt_client,
        rtp_server=rtp_server
    )

    async def handle_mqtt_control(topic, payload):
        """Handle transcription control commands from middleware."""
        if not isinstance(payload, dict):
            return

        action = payload.get("action")
        call_id = payload.get("linkedid") or payload.get("uniqueid")
        if not isinstance(action, str) or not isinstance(call_id, str) or not call_id:
            return

        if action == "start":
            await asterisk_bridge.start_transcription(call_id)
        elif action == "stop":
            await asterisk_bridge.stop_transcription(call_id)

    # Start services
    logger.info("Starting services...")
    mqtt_client.set_callback(handle_mqtt_control)
    await mqtt_client.connect()
    await mqtt_client.subscribe("transcription/control")
    await asterisk_bridge.connect()
    logger.info("All services started")

    # Wait for shutdown signal
    await shutdown_event.wait()

    # Graceful shutdown
    logger.info("Shutting down...")
    # End all active Stasis sessions before disconnecting
    await asterisk_bridge.disconnect()
    await rtp_server.stop()
    await mqtt_client.disconnect()
    logger.info("Shutdown complete")

if __name__ == "__main__":
    # Start API server in a background thread
    server_thread = threading.Thread(
        target=uvicorn.run,
        args=(api_app,),
        kwargs={"host": "0.0.0.0", "port": int(os.getenv("HTTP_PORT", "8000")), "log_level": os.getenv("LOG_LEVEL", "info").lower()},
        daemon=True
    )
    server_thread.start()
    # Run the realtime call transcription pipeline
    asyncio.run(realtime_call_transcription())
