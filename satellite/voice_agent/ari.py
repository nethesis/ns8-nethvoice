"""A small, separate ARI connection for the satellite-agent Stasis app.

The controller transports events and explicit channel operations. Call policy and
ownership decisions belong to :mod:`voice_agent.runtime`.
"""

import asyncio
import json
import logging
import re
import secrets
from urllib.parse import quote

import aiohttp


LOG = logging.getLogger(__name__)


class AriHTTPError(RuntimeError):
    def __init__(self, method, path, status):
        super().__init__(f"Agent ARI {method} {path}: HTTP {status}")
        self.http_status = status


def new_channel_id():
    """112 random bits, with room for Asterisk's Local-channel ``;2`` suffix.

    Native CDR/CEL (and dependent PBX tables) store uniqueid/linkedid in
    VARCHAR(32). Session, run and provider identifiers have separate contracts.
    """
    return 'va' + secrets.token_hex(14)


def validate_channel_id(channel_id):
    # Reject before creation; never truncate or remap an identity used by ARI.
    if not isinstance(channel_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,30}', channel_id):
        raise ValueError('invalid_channel_id')


class AriController:
    def __init__(self, url, username, password, app="satellite-agent", on_event=None,
                 on_disconnect=None):
        self.url = url.rstrip("/")
        self.auth = aiohttp.BasicAuth(username, password)
        self.app = app
        self.on_event = on_event
        self.on_disconnect = on_disconnect
        self.connected = False
        self._session = None
        self._ws = None
        self._task = None
        self._stopping = False
        self._queue = asyncio.Queue(maxsize=256)
        self._worker = None
        self._generation = 0

    async def start(self):
        if self._task is not None:
            return
        self._stopping = False
        self._session = aiohttp.ClientSession(auth=self.auth)
        self._worker = asyncio.create_task(self._events(), name="agent-ari-events")
        self._task = asyncio.create_task(self._run(), name="agent-ari-connection")

    async def stop(self):
        self._stopping = True
        if self._ws is not None:
            await self._ws.close()
        for task in (self._task, self._worker):
            if task is not None:
                task.cancel()
        await asyncio.gather(*(task for task in (self._task, self._worker) if task),
                             return_exceptions=True)
        self._task = self._worker = self._ws = None
        self.connected = False
        if self._session is not None:
            await self._session.close()
            self._session = None

    async def _run(self):
        delay = 1
        while not self._stopping:
            recovery = None
            try:
                url = self.url.replace("http://", "ws://", 1).replace("https://", "wss://", 1)
                async with self._session.ws_connect(
                    f"{url}/ari/events", params={"app": self.app}, heartbeat=30
                ) as ws:
                    self._ws = ws
                    self.connected = True
                    self._generation += 1
                    delay = 1
                    # A reconnect can leave Stasis channels from the previous owner.
                    # The runtime reconciles only channels with Agent ownership vars.
                    if self.on_event:
                        recovery = asyncio.create_task(self._recover())
                    async for message in ws:
                        if message.type == aiohttp.WSMsgType.TEXT:
                            try:
                                event = json.loads(message.data)
                                self._queue.put_nowait((self._generation, event))
                            except (ValueError, asyncio.QueueFull):
                                LOG.warning("Agent ARI event rejected or queue full")
                                await ws.close()
                                break
                        elif message.type in (aiohttp.WSMsgType.ERROR, aiohttp.WSMsgType.CLOSED):
                            break
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                LOG.warning("Agent ARI connection failed: %s", type(exc).__name__)
            finally:
                self._ws = None
                was_connected = self.connected
                self.connected = False
                if recovery is not None:
                    recovery.cancel()
                    await asyncio.gather(recovery, return_exceptions=True)
                if was_connected and not self._stopping:
                    # A final StasisEnd and its native acknowledgement may
                    # already be queued when the peer closes the socket.
                    try:
                        await asyncio.wait_for(self._queue.join(), timeout=1)
                    except TimeoutError:
                        pass
                self._generation += 1
                if was_connected and not self._stopping and self.on_disconnect:
                    await self.on_disconnect()
            if not self._stopping:
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)

    async def _recover(self):
        try:
            await asyncio.wait_for(self.on_event({"type": "AgentAriConnected"}), timeout=10)
        except Exception as exc:
            LOG.warning("Agent ARI ownership recovery failed: %s", type(exc).__name__)

    async def _events(self):
        while True:
            generation, event = await self._queue.get()
            try:
                if generation == self._generation and self.on_event:
                    await self.on_event(event)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                LOG.warning("Agent ARI event handler failed: %s", type(exc).__name__)
            finally:
                self._queue.task_done()

    async def request(self, method, path, *, params=None, json_body=None):
        # The event socket can be down while the REST endpoint still serves cleanup.
        if self._session is None or self._session.closed:
            raise ConnectionError("Agent ARI unavailable")
        async with self._session.request(method, f"{self.url}/ari{path}",
                                         params=params, json=json_body,
                                         timeout=aiohttp.ClientTimeout(total=10)) as response:
            if response.status >= 400:
                raise AriHTTPError(method, path, response.status)
            if response.status == 204:
                return None
            return await response.json()

    async def get_variable(self, channel_id, name):
        try:
            result = await self.request("GET", f"/channels/{quote(channel_id, safe='')}/variable",
                                        params={"variable": name})
            return result.get("value") if isinstance(result, dict) else None
        except RuntimeError as exc:
            if "HTTP 404" in str(exc):
                return None
            raise

    async def set_variable(self, channel_id, name, value):
        await self.request("POST", f"/channels/{quote(channel_id, safe='')}/variable",
                           params={"variable": name, "value": str(value)})

    async def subscribe_channel(self, channel_id):
        await self.request('POST', f'/applications/{quote(self.app, safe="")}/subscription',
                           params={'eventSource': 'channel:' + channel_id})

    async def unsubscribe_channel(self, channel_id):
        await self.request('DELETE', f'/applications/{quote(self.app, safe="")}/subscription',
                           params={'eventSource': 'channel:' + channel_id})

    async def originate_local(self, session_id, channel_id, variables):
        validate_channel_id(channel_id)
        return await self.request("POST", "/channels", params={
            "endpoint": f"Local/{session_id}@voice-agent-provider/n",
            "app": self.app,
            "appArgs": f"provider,{session_id}",
            "channelId": channel_id,
            "timeout": 20,
        }, json_body={"variables": variables})

    async def create_media_channel(self, session_id, channel_id, agent_id):
        """Owned, private incoming chan_websocket channel; never a supplied URL."""
        validate_channel_id(channel_id)
        return await self.request('POST', '/channels/externalMedia', params={
            'app': self.app, 'channelId': channel_id, 'data': 'media,' + session_id,
            'external_host': 'INCOMING', 'connection_type': 'server',
            'format': 'ulaw', 'transport': 'websocket', 'encapsulation': 'none',
            'transport_data': 'f(json)'}, json_body={'variables': {
                'AGENT_SESSION_ID': session_id, 'VOICE_AGENT_ID': agent_id,
                'VOICE_AGENT_TRANSPORT': 'live_ws'}})

    async def connect_media_channel(self, channel_id):
        from .media import AsteriskWebSocketMedia
        connection_id = await self.get_variable(channel_id, 'MEDIA_WEBSOCKET_CONNECTION_ID')
        if not isinstance(connection_id, str):
            raise ValueError('media_identity_invalid')
        media = AsteriskWebSocketMedia(channel_id, connection_id)
        base = self.url.replace('http://', 'ws://', 1).replace('https://', 'wss://', 1)
        return await media.connect(self._session, base)

    async def answer(self, channel_id):
        await self.request("POST", f"/channels/{quote(channel_id, safe='')}/answer")

    async def create_bridge(self, bridge_id):
        return await self.request("POST", "/bridges", params={"type": "mixing", "bridgeId": bridge_id})

    async def add_to_bridge(self, bridge_id, channel_ids):
        await self.request("POST", f"/bridges/{quote(bridge_id, safe='')}/addChannel",
                           params={"channel": ",".join(channel_ids)})

    async def remove_from_bridge(self, bridge_id, channel_ids):
        await self.request("POST", f"/bridges/{quote(bridge_id, safe='')}/removeChannel",
                           params={"channel": ",".join(channel_ids)})

    async def moh(self, channel_id, enabled):
        await self.request("POST" if enabled else "DELETE", f"/channels/{quote(channel_id, safe='')}/moh")

    async def mute(self, channel_id, enabled, direction='out'):
        if direction not in ('in', 'out', 'both'):
            raise ValueError('invalid audio direction')
        await self.request('POST' if enabled else 'DELETE', f"/channels/{quote(channel_id, safe='')}/mute", params={'direction':direction})

    async def originate_consult(self, session_id, attempt_id, channel_id, extension, seconds, *, originator=None, caller_id=None):
        validate_channel_id(channel_id)
        if not str(extension).isdigit():
            raise ValueError("invalid consultation extension")
        params={
            "endpoint": f"Local/{extension}@voice-agent-consult/n", "app": self.app,
            "appArgs": f"consult,{session_id},{attempt_id}", "channelId": channel_id,
            "timeout": seconds}
        if originator:
            params['originator']=originator
        if caller_id:
            params['callerId']=caller_id
        return await self.request("POST", "/channels", params=params, json_body={"variables": {"__AGENT_ROLE": "consult",
                "__AGENT_SESSION_ID": session_id, "__AGENT_CONSULT_ATTEMPT": attempt_id}})

    async def native_handoff(self, consultation, colleague):
        c = consultation
        caller = c.caller.caller_id
        if not re.fullmatch(r'[a-f0-9]{32}', c.id):
            raise ValueError('invalid_attempt')
        peer = await self.request('GET', '/channels/' + quote(colleague, safe=''))
        if peer.get('state') != 'Up' or not re.fullmatch(r'Local/[0-9]{1,20}@voice-agent-consult-[a-f0-9]+;1',peer.get('name','')):
            raise ValueError('invalid_answered_leg')
        for identifier in (caller,colleague):
            await self.subscribe_channel(identifier)
            c.subscriptions.add(identifier)
            await self.set_variable(identifier,'VOICE_AGENT_HANDOFF_TOKEN',c.id)
            await self.set_variable(identifier,'VOICE_AGENT_HANDOFF_SELF',identifier)
        await self.set_variable(caller,'VOICE_AGENT_HANDOFF_PEER',peer['name'])
        await self.set_variable(caller,'AGENT_SESSION_ID',c.caller.session_id)
        await self.set_variable(caller,'VOICE_AGENT_HANDOFF_PEER_ID',colleague)
        await self.set_variable(colleague,'VOICE_AGENT_HANDOFF_PEER_ID',caller)
        c.native_started = True
        await self.continue_channel(colleague,{'context':'voice-agent-handoff-wait','extension':'s','priority':1})
        c.caller_release_requested = True
        await self.continue_channel(caller,{'context':'voice-agent-handoff','extension':'s','priority':1})

    async def handoff_state(self, c, colleague):
        bridges = await self.list_bridges()
        if any(b.get('bridge_class') == 'basic' and {c.caller.caller_id,colleague} <= set(b.get('channels',[])) for b in bridges):
            return 'bridged'
        caller = await self.request('GET','/channels/'+quote(c.caller.caller_id,safe=''))
        dialplan = caller.get('dialplan') or {}
        if (not c.caller_release_requested and dialplan.get('app_name') == 'Stasis'
                and str(dialplan.get('app_data','')).startswith('voice-agent,')
                and await self.get_variable(c.caller.caller_id,'VOICE_AGENT_HANDOFF_TOKEN') == c.id):
            return 'caller_owned'
        return 'released'

    async def destroy_bridge(self, bridge_id):
        try:
            await self.request("DELETE", f"/bridges/{quote(bridge_id, safe='')}")
        except RuntimeError as exc:
            if "HTTP 404" not in str(exc):
                raise

    async def continue_channel(self, channel_id, target=None):
        params = (dict(target) if target else {})
        if "exten" in params:
            params["extension"] = params.pop("exten")
        await self.request("POST", f"/channels/{quote(channel_id, safe='')}/continue", params=params)

    async def caller_in_stasis(self, channel_id, agent_id):
        channel = await self.request('GET', '/channels/' + quote(channel_id, safe=''))
        dialplan = channel.get('dialplan') or {}
        return (dialplan.get('context') == 'voice-agent-' + agent_id
                and dialplan.get('app_name') == 'Stasis'
                and dialplan.get('app_data') == f'{self.app},caller,{agent_id}')

    async def hangup_owned(self, channel_id):
        application = await self.request('GET', '/applications/' + quote(self.app, safe=''))
        channels = application.get('channel_ids') if isinstance(application, dict) else None
        if not isinstance(channels, list) or channel_id not in channels:
            return False
        await self.hangup(channel_id)
        return True

    async def hangup(self, channel_id):
        try:
            await self.request("DELETE", f"/channels/{quote(channel_id, safe='')}")
        except RuntimeError as exc:
            if "HTTP 404" not in str(exc):
                raise

    async def list_channels(self):
        return await self.request("GET", "/channels")

    async def list_bridges(self):
        return await self.request("GET", "/bridges")
