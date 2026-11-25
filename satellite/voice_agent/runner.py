"""Independent voice runtime with private readiness and exact signed webhook paths."""
import argparse
import asyncio
import hmac
import ipaddress
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
import uvicorn

from .contract import validate_snapshot


def create_app(token: str, runtime=None) -> FastAPI:
    if not token:
        raise ValueError('runtime_token_required')
    @asynccontextmanager
    async def lifespan(app):
        try:
            if runtime:
                await runtime.start()
            yield
        finally:
            if runtime:
                await runtime.stop()
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, redirect_slashes=False, lifespan=lifespan)

    @app.get('/internal/ready')
    def ready(authorization: str = Header(default='')):
        if not authorization.isascii() or not hmac.compare_digest(authorization, 'Bearer ' + token):
            raise HTTPException(status_code=401, detail='unauthorized')
        return {'status': 'ready', 'milestone': 'v0.1-configuration' if runtime else 'M0', 'contract_version': 9, 'supported_contract_versions': [8,9],
                'voice_calls_enabled': bool(runtime and runtime.controller.connected),
                'monitoring_degraded': bool(runtime and runtime.monitoring.degraded)}

    @app.post('/satellite-webhooks/openai')
    @app.post('/satellite-webhooks/grok')
    async def webhook(request: Request):
        provider = request.url.path.rsplit('/', 1)[1]
        if provider not in ('openai', 'grok'):
            raise HTTPException(status_code=404, detail='not_found')
        if runtime is None or not runtime.sip_lab_enabled:
            raise HTTPException(status_code=404, detail='not_found')
        raw = bytearray()
        try:
            async with asyncio.timeout(5):
                async for chunk in request.stream():
                    if len(raw) + len(chunk) > 256 * 1024:
                        raise HTTPException(status_code=413, detail='body_too_large')
                    raw.extend(chunk)
        except TimeoutError:
            raise HTTPException(status_code=408, detail='body_timeout') from None
        try:
            return await runtime.webhook(provider, bytes(raw), request.headers)
        except ConnectionError:
            raise HTTPException(status_code=503, detail='claim_storage_unavailable') from None
        except ValueError:
            raise HTTPException(status_code=403, detail='invalid_webhook') from None

    return app


def settings():
    host = os.getenv('VOICE_AGENT_HTTP_HOST', '127.0.0.1')
    # Traefik forwards only public webhook paths; the actual listener stays private.
    if not ipaddress.ip_address(host).is_loopback:
        raise ValueError('loopback_bind_required')
    port = int(os.getenv('VOICE_AGENT_HTTP_PORT', '8001'))
    if not 1 <= port <= 65535:
        raise ValueError('invalid_port')
    return host, port


def app_from_env():
    runtime = None
    if os.getenv('VOICE_AGENT_ENABLED') == 'true':
        from .ari import AriController
        from .runtime import Runtime
        from .storage import Storage
        runtime = Runtime(Storage(), AriController(os.environ['ASTERISK_URL'],
            os.environ['ARI_USERNAME'], os.environ['SATELLITE_ARI_PASSWORD'], app='voice-agent'))
    return create_app(os.getenv('VOICE_AGENT_RUNTIME_TOKEN', ''), runtime)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check-snapshot', type=Path, help='Validate a synthetic snapshot offline')
    args = parser.parse_args()
    if args.check_snapshot:
        value = validate_snapshot(json.loads(args.check_snapshot.read_text()))
        print(json.dumps({'valid': True, 'contract_version': value['contract_version']}))
        return
    host, port = settings()
    app = app_from_env()
    uvicorn.run(app, host=host, port=port, access_log=False)


if __name__ == '__main__':
    main()
