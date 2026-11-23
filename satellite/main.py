"""Satellite application: voice agents and optional transcription on one event loop."""
import asyncio
from contextlib import nullcontext
import ipaddress
import logging
import os
import signal

from dotenv import load_dotenv
import uvicorn

from voice_agent.runner import app_from_env, settings


logger = logging.getLogger(__name__)


def api_server_settings():
    host = os.getenv("HTTP_HOST", "127.0.0.1")
    if not ipaddress.ip_address(host).is_loopback:
        raise ValueError("loopback_bind_required")
    return {"host": host, "port": int(os.getenv("HTTP_PORT", "8000")),
            "log_level": os.getenv("LOG_LEVEL", "info").lower()}


async def run(shutdown_event=None):
    shutdown_event = shutdown_event or asyncio.Event()
    flags = [os.getenv(name) for name in (
        "SATELLITE_CALL_TRANSCRIPTION_ENABLED", "SATELLITE_VOICEMAIL_TRANSCRIPTION_ENABLED")]
    transcription_enabled = all(flag is None for flag in flags) or any(
        flag is not None and flag.lower() == "true" for flag in flags)
    servers = {}

    async def serve(name, app, **config):
        if shutdown_event.is_set():
            return
        server = uvicorn.Server(uvicorn.Config(
            app, **config, lifespan="on", timeout_graceful_shutdown=10))
        # This application owns signals for both listeners.
        server.capture_signals = nullcontext
        servers[name] = server
        try:
            await server.serve()
        except SystemExit as error:
            raise RuntimeError(f"HTTP server exited with status {error.code}") from error
        finally:
            del servers[name]

    async def serve_api():
        from api import app
        await serve("transcription-api", app, **api_server_settings())

    async def serve_voice_agents():
        host, port = settings()
        api_server = servers.get("transcription-api")
        if api_server is not None and (ipaddress.ip_address(host), port) == (
                ipaddress.ip_address(api_server.config.host), api_server.config.port):
            raise ValueError("http_listener_collision")
        await serve("voice-agents", app_from_env(), host=host, port=port, access_log=False,
                    log_level=os.getenv("LOG_LEVEL", "info").lower())

    async def run_transcription():
        from transcription import run as transcribe
        await transcribe(shutdown_event)

    loop = asyncio.get_running_loop()
    for signum in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(signum, shutdown_event.set)

    tasks = []
    if transcription_enabled:
        tasks.append(asyncio.create_task(serve_api(), name="transcription-api"))
        tasks.append(asyncio.create_task(run_transcription(), name="transcription"))
    if os.getenv("VOICE_AGENT_ENABLED") == "true":
        tasks.append(asyncio.create_task(serve_voice_agents(), name="voice-agents"))
    stopping = asyncio.create_task(shutdown_event.wait())
    try:
        if not tasks:
            await stopping
            return
        running = set(tasks)
        while not shutdown_event.is_set():
            done, _ = await asyncio.wait(running | {stopping}, return_when=asyncio.FIRST_COMPLETED)
            if shutdown_event.is_set():
                break
            running.difference_update(done)
            for task in done:
                try:
                    task.result()
                except (Exception, asyncio.CancelledError):
                    logger.exception("%s failed", task.get_name())
                else:
                    logger.error("%s stopped unexpectedly", task.get_name())
            if not running:
                raise RuntimeError("All configured Satellite components stopped")
    finally:
        shutdown_event.set()
        for server in servers.values():
            server.should_exit = True
        stopping.cancel()
        await asyncio.gather(*tasks, stopping, return_exceptions=True)
        for signum in (signal.SIGINT, signal.SIGTERM):
            loop.remove_signal_handler(signum)


def main():
    load_dotenv(dotenv_path=".env")
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper(),
                        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    asyncio.run(run())


if __name__ == "__main__":
    main()
