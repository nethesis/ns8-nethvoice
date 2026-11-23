"""Optional transcription pipeline; recovery never restarts voice agents."""
import asyncio
import logging
import os

from asterisk_bridge import AsteriskBridge
from mqtt_client import MQTTClient
from rtp_server import RTPServer

logger = logging.getLogger("transcription")


async def run(shutdown_event):
    ari_app = os.getenv("ARI_APP", "asterisk_dialogflow")
    if ari_app == "voice-agent":
        raise ValueError("transcription_ari_app_must_differ_from_voice_agents")
    if not os.getenv("DEEPGRAM_API_KEY"):
        logger.error("DEEPGRAM_API_KEY is not set; realtime transcription is unavailable")
        await shutdown_event.wait()
        return
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if credentials_path and not os.path.exists(credentials_path):
        logger.error("Google Cloud credentials file not found")
        await shutdown_event.wait()
        return
    while not shutdown_event.is_set():
        rtp = RTPServer(host=os.getenv("RTP_HOST", "0.0.0.0"),
                        port=int(os.getenv("RTP_PORT", "10000")),
                        swap16=os.getenv("RTP_SWAP16", "true").lower() == "true",
                        rtp_header_size=int(os.getenv("RTP_HEADER_SIZE", "12")))
        mqtt = MQTTClient(url=os.getenv("MQTT_URL", "mqtt://localhost:1883"),
                          topic_prefix=os.getenv("MQTT_TOPIC_PREFIX", "asterisk-dialogflow"),
                          username=os.getenv("MQTT_USERNAME"),
                          password=os.getenv("SATELLITE_MQTT_PASSWORD"))
        bridge = AsteriskBridge(url=os.getenv("ASTERISK_URL", "http://localhost:8088"),
                                app=ari_app,
                                username=os.getenv("ARI_USERNAME", "asterisk"),
                                password=os.getenv("SATELLITE_ARI_PASSWORD", "asterisk"),
                                mqtt_client=mqtt, rtp_server=rtp)

        async def control(topic, payload):
            if not isinstance(payload, dict):
                return
            action = payload.get("action")
            call_id = payload.get("linkedid") or payload.get("uniqueid")
            if not isinstance(call_id, str) or not call_id:
                return
            if action == "start":
                await bridge.start_transcription(call_id)
            elif action == "stop":
                await bridge.stop_transcription(call_id)

        async def start():
            await rtp.start()
            mqtt.set_callback(control)
            await mqtt.connect()
            await mqtt.subscribe("transcription/control")
            await bridge.connect()
            logger.info("Transcription services started")
            await shutdown_event.wait()

        startup = asyncio.create_task(start())
        stopping = asyncio.create_task(shutdown_event.wait())
        try:
            done, _ = await asyncio.wait([startup, stopping], return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                task.result()
        except Exception:
            logger.exception("Transcription startup failed; retrying in five seconds")
        finally:
            startup.cancel()
            stopping.cancel()
            await asyncio.gather(startup, stopping, return_exceptions=True)
            try:
                # The bridge bounds individual I/O operations so each resource gets a cleanup attempt.
                await bridge.disconnect()
            except Exception:
                logger.exception("Transcription bridge cleanup failed")
            finally:
                for close in (rtp.stop, mqtt.disconnect):
                    try:
                        async with asyncio.timeout(10):
                            await close()
                    except Exception:
                        logger.exception("Transcription cleanup failed")
        if not shutdown_event.is_set():
            await asyncio.sleep(5)
