import asyncio
import logging
import aiohttp
import json
import os
from deepgram_connector import DeepgramConnector

logger = logging.getLogger("asterisk_bridge")

# Satellite names its helper channels and bridges <prefix><original channel ID>
HELPER_CHANNEL_PREFIXES = ('snoop-in-', 'snoop-out-', 'ext-media-in-', 'ext-media-out-')
HELPER_BRIDGE_PREFIXES = ('bridge-in-', 'bridge-out-')
# Seconds between two sweeps of orphaned helper channels and bridges
SWEEP_INTERVAL = 60


def _original_channel_id(resource_id, prefixes):
    """Return the original channel ID of a helper channel or bridge, or None."""
    for prefix in prefixes:
        if resource_id.startswith(prefix):
            return resource_id[len(prefix):]
    return None


class AriError(Exception):
    """Asterisk answered an ARI request with an error status"""


class AsteriskBridge:
    """
    Manages the interface between Asterisk PBX and speech recognition services.

    This class connects to the Asterisk REST Interface (ARI) using WebSockets
    to monitor and control call channels. For each channel entering the Stasis
    application, it:

    1. Creates a snoop channel to capture audio
    2. Sets up an external media endpoint for RTP streaming
    3. Creates a bridge between the snoop channel and external media endpoint
    4. Establishes a connection to Deepgram for speech-to-text transcription
    5. Routes transcriptions to MQTT for external processing

    The class handles various Asterisk events including channel start/end,
    hangups, and bridge events, ensuring proper resource management throughout
    the call lifecycle.
    """

    def __init__(self, url, app, username, password, mqtt_client, rtp_server):
        self.url = url
        self.app = app
        self.auth = aiohttp.BasicAuth(username, password)
        self.mqtt_client = mqtt_client
        self.rtp_server = rtp_server
        self.channels = {}
        self.ws = None
        self.session = None
        self.is_shutting_down = False
        self.max_reconnect_delay = 30  # Maximum seconds between reconnection attempts
        self.pending_transcription_requests = set()
        # Original channels still owed a continue that did not reach Asterisk
        self.pending_continues = set()
        self.sweep_task = None

    def _build_connector(self, channel_id):
        """Create a new Deepgram connector instance for a channel."""
        channel = self.channels[channel_id]
        return DeepgramConnector(
            deepgram_api_key=os.getenv("DEEPGRAM_API_KEY"),
            rtp_stream_in=channel['rtp_stream_in'],
            rtp_stream_out=channel['rtp_stream_out'],
            mqtt_client=self.mqtt_client,
            uniqueid=channel.get('linkedid') or channel_id,
            language=channel['language'],
            speaker_name_in=channel['speaker_name_in'],
            speaker_number_in=channel['speaker_number_in'],
            speaker_name_out=channel['speaker_name_out'],
            speaker_number_out=channel['speaker_number_out'],
            call_elapsed_at_start=channel.get('call_elapsed_at_start'),
            call_start_epoch=channel.get('call_start_epoch')
        )

    def _find_channels_for_callid(self, call_id):
        """Resolve a call identifier (linkedid or uniqueid) to active channel IDs."""
        if call_id in self.channels:
            return [call_id]
        return [cid for cid, cdata in self.channels.items() if cdata.get('linkedid') == call_id]

    def _extract_call_start_epoch(self, linkedid):
        """
        Extract call start epoch seconds from linkedid (e.g. 1771864831.1430).
        Returns None when format is not parseable.
        """
        if not isinstance(linkedid, str) or linkedid == "":
            return None
        try:
            epoch_part = linkedid.split(".", 1)[0]
            epoch_value = int(epoch_part)
            if epoch_value > 0:
                return float(epoch_value)
        except Exception:
            return None
        return None

    async def _get_answered_elapsed_seconds(self, channel_id):
        """
        Return elapsed seconds since call answer for this channel, if available.
        Falls back to None when Asterisk does not expose the variable.
        """
        variable_candidates = [
            "CHANNEL(answeredtime)",
            "ANSWEREDTIME",
        ]
        for variable in variable_candidates:
            value = await self._get_channel_variable(channel_id, variable)
            if value is None:
                continue
            try:
                elapsed = float(value)
                if elapsed >= 0:
                    return elapsed
            except (TypeError, ValueError):
                continue
        return None

    async def _get_channel_variable(self, channel_id, variable):
        """
        Read an ARI channel variable, returning None when it does not exist.
        Missing variables are expected in some call phases and should not be noisy.
        """
        url = f"{self.url}/ari/channels/{channel_id}/variable"
        async with self.session.request(
            "GET",
            url,
            params={"variable": variable},
        ) as response:
            if response.status == 404:
                logger.debug(
                    f"ARI variable not found for channel {channel_id}: {variable}"
                )
                return None

            if response.status >= 400:
                error_text = await response.text()
                logger.error(
                    f"ARI variable request failed ({response.status}) "
                    f"for channel {channel_id}, variable {variable}: {error_text}"
                )
                return None

            data = await response.json()
            return data.get("value")

    async def connect(self):
        """Connect to Asterisk ARI and setup WebSocket for events"""
        logger.debug(f"Connect to Asterisk ARI at {self.url}")
        self.is_shutting_down = False
        self.session = aiohttp.ClientSession(auth=self.auth)

        # Connect to ARI WebSocket
        await self._connect_websocket()
        logger.info(f"Connected to Asterisk ARI at {self.url}")
        self.sweep_task = asyncio.create_task(self._sweep_loop())

    async def _connect_websocket(self):
        """Connect to Asterisk ARI WebSocket"""
        ws_url = f"{self.url.replace('http', 'ws')}/ari/events?app={self.app}&api_key={self.auth.login}:{self.auth.password}"
        self.ws = await self.session.ws_connect(ws_url)
        # Start event loop
        asyncio.create_task(self._process_ari_events())

    async def disconnect(self):
        """Disconnect from Asterisk ARI"""
        logger.debug(f"Disconnect from Asterisk ARI")
        self.is_shutting_down = True
        if self.sweep_task:
            self.sweep_task.cancel()
        for channel_id in list(self.channels.keys()):
            await self.close_channel(channel_id)
        if self.ws:
            await self.ws.close()
        if self.session:
            await self.session.close()

    async def _process_ari_events(self):
        """Process events from Asterisk ARI WebSocket"""
        try:
            async for msg in self.ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    # A failed event must not drop the WebSocket: the events
                    # sent while reconnecting would be lost.
                    try:
                        await self._handle_ari_event(json.loads(msg.data))
                    except Exception as e:
                        logger.error(f"Error handling ARI event: {e}")
                elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                    logger.warning("WebSocket connection closed or error occurred")
                    break
        except Exception as e:
            logger.error(f"Error in WebSocket event loop: {e}")
        finally:
            # If we're not in a clean shutdown, attempt to reconnect
            if not self.is_shutting_down:
                logger.info("Unexpected WebSocket disconnection, will attempt to reconnect")
                await self._reconnect()

    async def _reconnect(self):
        """Attempt to reconnect to Asterisk with exponential backoff"""
        delay = 1  # Start with 1 second delay
        while not self.is_shutting_down:
            try:
                logger.info(f"Attempting to reconnect in {delay} seconds...")
                await asyncio.sleep(delay)
                await self._connect_websocket()
                logger.info("Successfully reconnected to Asterisk ARI")
                return
            except Exception as e:
                logger.error(f"Failed to reconnect: {e}")
                # Exponential backoff with maximum delay
                delay = min(delay * 2, self.max_reconnect_delay)

    async def _handle_ari_event(self, event):
        """Handle events from Asterisk ARI"""
        #logger.debug(f"ENTER: _handle_ari_event(type={event.get('type', 'unknown')})")
        event_type = event.get('type')
        if event_type == 'StasisStart':
            await self._handle_stasis_start(event)
        elif event_type == 'ChannelDestroyed':
            await self._handle_channel_hangup(event)
        elif event_type == 'StasisEnd':
            await self._handle_stasis_end(event)
        elif event_type == 'ChannelLeftBridge':
            await self._handle_channel_left_bridge(event)

    async def _handle_stasis_start(self, event):
        """
        Set up the channel that entered Stasis. If the call it belongs to is
        gone or the setup fails, leave no helper channel behind and return
        the call to the dialplan.
        """
        channel_id = event['channel']['id']
        original_channel_id = _original_channel_id(channel_id, HELPER_CHANNEL_PREFIXES)
        if original_channel_id is not None and original_channel_id not in self.channels:
            logger.info(f"Channel {channel_id} has no active call, hanging it up")
            await self._hangup_channel(channel_id)
            return
        try:
            await self._setup_channel(event)
        except Exception as e:
            original_channel_id = original_channel_id or channel_id
            logger.warning(f"Failed to set up channel {original_channel_id}: {e}")
            await self._release_call(original_channel_id)

    async def _release_call(self, channel_id):
        """
        Close a call. If its original channel still waits in Stasis, or the
        call is not tracked, return the original channel to the dialplan.
        """
        call = self.channels.get(channel_id)
        waiting = call is None or call.get('waiting', False)
        await self.close_channel(channel_id)
        if waiting:
            await self._continue_channel(channel_id)

    async def _continue_channel(self, channel_id):
        """
        Return a channel to the dialplan. If the request gets no answer from
        Asterisk, the sweep retries it.
        """
        try:
            await self._ari_request('POST', f"/channels/{channel_id}/continue", params={})
            logger.info(f"Channel {channel_id} returned to dialplan")
        except AriError:
            pass  # the channel is gone or no longer in Stasis
        except Exception as e:
            logger.warning(f"Failed to return channel {channel_id} to dialplan, will retry: {e}")
            self.pending_continues.add(channel_id)
            return
        self.pending_continues.discard(channel_id)

    async def _setup_channel(self, event):
        """
        Launched when a Stasis start event is received
        - create the bridge to the rtp server
        - create the deepgram connector
        - start the deepgram connector
        - return control to dialplan
        """
        channel = event['channel']
        channel_id = channel['id']
        #logger.debug(f"ENTER: _handle_stasis_start(channel_id={channel_id})")
        #logger.debug(f"Channel data: {channel}")
        if channel_id in self.channels:
            logger.debug(f"Channel {channel_id} already in channels")
            await self._continue_channel(channel_id)
            return

        if not channel_id.startswith("snoop-") and not channel_id.startswith("ext-media-"):
            # Normal channel entered Stasis, so any earlier continue reached it
            self.pending_continues.discard(channel_id)
            # waiting: the channel waits in Stasis until it is continued
            self.channels[channel_id] = {'waiting': True}
            self.channels[channel_id]['language'] = channel.get('language', 'en')
            self.channels[channel_id]['caller_name'] = channel['caller'].get('name', 'caller')
            self.channels[channel_id]['caller_number'] = channel['caller'].get('number', 'unknown')
            self.channels[channel_id]['connected_name'] = channel['connected'].get('name', 'connected')
            self.channels[channel_id]['connected_number'] = channel['connected'].get('number', 'unknown')
            linkedid = channel.get('linkedid')
            if not linkedid:
                linkedid = await self._get_channel_variable(channel_id, "CHANNEL(linkedid)")
            self.channels[channel_id]['linkedid'] = linkedid or channel_id
            self.channels[channel_id]['call_start_epoch'] = self._extract_call_start_epoch(
                self.channels[channel_id]['linkedid']
            )
            self.channels[channel_id]['transcription_requested'] = (
                channel_id in self.pending_transcription_requests
                or self.channels[channel_id]['linkedid'] in self.pending_transcription_requests
            )
            self.channels[channel_id]['connector_started'] = False
            self.channels[channel_id]['connector_starting'] = False
            self.pending_transcription_requests.discard(channel_id)
            logger.debug(f"Channel {channel_id} entered Satellite. Details: {channel}")
            # Create a snoop channel for in and one for out
            for direction in ['in', 'out']:
                snoop_data = await self._ari_request(
                    'POST',
                    f"/channels/{channel_id}/snoop",
                    params={
                    'spy': direction,
                    'app': self.app,
                    'subscribeAll': 'yes',
                    'snoopId': f'snoop-{direction}-{channel_id}'
                    }
                )
                snoop_channel_id = snoop_data['id']
                self.channels[channel_id][f'snoop_channel_{direction}'] = snoop_channel_id
                logger.debug(f"Snoop channel {snoop_channel_id} created")
            try:
                # Get connected info using ARI
                connected_number = await self._get_channel_variable(channel_id, "CALLERIDNUMINTERNAL")
                if connected_number:
                    self.channels[channel_id]['connected_number'] = connected_number
                    logger.debug(f"Updated connected number for channel {channel_id}: {connected_number}")
                connected_name = await self._get_channel_variable(channel_id, "CALLERIDNAMEINTERNAL")
                if connected_name:
                    self.channels[channel_id]['connected_name'] = connected_name
                    logger.debug(f"Updated connected name for channel {channel_id}: {connected_name}")
            except Exception as e:
                logger.debug(f"connected info not updated for channel {channel_id}: {e}")
        if channel_id.startswith("snoop-"):
            # Snoop channel entered Stasis, create an external media channel for it
            snoop_channel_id = channel_id
            for id,values in self.channels.items():
                if values.get('snoop_channel_in') == snoop_channel_id or values.get('snoop_channel_out') == snoop_channel_id:
                    # Find the original channel that created this snoop channel
                    original_channel_id = id
                    break
            direction = 'in' if 'snoop-in' in snoop_channel_id else 'out'
            ext_media_response = await self._ari_request(
                'POST',
                f"/channels/externalMedia",
                params={
                'app': self.app,
                'external_host': f"{self.rtp_server.host}:{self.rtp_server.port}",
                'format': 'slin16',
                'channelId': f'ext-media-{direction}-{original_channel_id}',
                }
            )
            #logger.debug(f"External media channel created: {ext_media_response}")
            self.channels[original_channel_id][f'external_media_channel_{direction}'] = ext_media_response['id']
            self.channels[original_channel_id][f'rtp_source_port_{direction}'] = ext_media_response['channelvars']['UNICASTRTP_LOCAL_PORT']

        if channel_id.startswith("ext-media-"):
            # External media channel entered Stasis
            for id,values in self.channels.items():
                if values.get('external_media_channel_in') == channel_id or values.get('external_media_channel_out') == channel_id:
                    # Find the original channel that created this external media channel
                    original_channel_id = id
                    break
            direction = 'in' if 'ext-media-in' in channel_id else 'out'
            snoop_channel_id = self.channels[original_channel_id][f'snoop_channel_{direction}']
            external_media_channel_id = channel_id
            # Create bridge
            bridge_data = await self._ari_request(
                'POST',
                "/bridges",
                params={
                'type': 'mixing',
                'bridgeId': f'bridge-{direction}-{original_channel_id}',
                }
            )
            bridge_id = bridge_data['id']
            self.channels[original_channel_id][f'bridge_{direction}'] = bridge_id
            # Add channels to the bridge
            logger.debug(f"Adding channel {snoop_channel_id} to bridge {bridge_id}")
            await self._ari_request(
                'POST',
                f"/bridges/{bridge_id}/addChannel",
                params={'channel': snoop_channel_id}
            )
            logger.debug(f"Adding channel {external_media_channel_id} to bridge {bridge_id}")
            await self._ari_request(
                'POST',
                f"/bridges/{bridge_id}/addChannel",
                params={'channel': external_media_channel_id}
            )

            # if both bridge are created, start the deepgram connector
            if 'bridge_in' in self.channels[original_channel_id] and 'bridge_out' in self.channels[original_channel_id]:
                call = self.channels[original_channel_id]
                try:
                    # get external media channel port and create a stream
                    rtp_stream_in = await self.rtp_server.create_stream(self.channels[original_channel_id]['rtp_source_port_in'])
                    rtp_stream_out = await self.rtp_server.create_stream(self.channels[original_channel_id]['rtp_source_port_out'])

                    # Wait a moment for RTP association to happen
                    await asyncio.sleep(0.1)

                    # Assign speaker names from channel info
                    speaker_name_in = self.channels[original_channel_id]['caller_name']
                    speaker_number_in = self.channels[original_channel_id]['caller_number']
                    speaker_name_out = self.channels[original_channel_id]['connected_name']
                    speaker_number_out = self.channels[original_channel_id]['connected_number']

                    # Check if Asterisk swapped the RTP ports by looking at the remote_addr
                    # If stream_in receives from port_out, ports ARE swapped -> swap speaker names
                    if rtp_stream_in.remote_addr:
                        source_port = rtp_stream_in.remote_addr[1]
                        if source_port == int(self.channels[original_channel_id]['rtp_source_port_out']):
                            speaker_name_in, speaker_name_out = speaker_name_out, speaker_name_in
                            speaker_number_in, speaker_number_out = speaker_number_out, speaker_number_in

                    self.channels[original_channel_id]['rtp_stream_in'] = rtp_stream_in
                    self.channels[original_channel_id]['rtp_stream_out'] = rtp_stream_out
                    self.channels[original_channel_id]['speaker_name_in'] = speaker_name_in
                    self.channels[original_channel_id]['speaker_number_in'] = speaker_number_in
                    self.channels[original_channel_id]['speaker_name_out'] = speaker_name_out
                    self.channels[original_channel_id]['speaker_number_out'] = speaker_number_out

                    # Start the connector only if a realtime transcription was requested.
                    if self.channels[original_channel_id].get('transcription_requested'):
                        asyncio.create_task(self._start_connector(original_channel_id))
                except Exception as e:
                    logger.error(f"Failed to start connector for channel {original_channel_id}: {e}")
                    await self._release_call(original_channel_id)
                    return
                # Return control of original channel to dialplan
                await self._ari_request(
                    'POST',
                    f"/channels/{original_channel_id}/continue",
                    params={}
                )
                call['waiting'] = False
                logger.info(f"Channel {original_channel_id} returned to dialplan")

    async def _start_connector(self, channel_id):
        """Start the Deepgram connector in background"""
        try:
            if channel_id not in self.channels:
                return

            channel = self.channels[channel_id]
            if channel.get('connector_started'):
                return
            if channel.get('connector_starting'):
                return

            if 'rtp_stream_in' not in channel or 'rtp_stream_out' not in channel:
                logger.info(f"Transcription requested for {channel_id} but RTP streams are not ready yet")
                return

            channel['connector_starting'] = True
            if channel.get('call_elapsed_at_start') is None:
                channel['call_elapsed_at_start'] = await self._get_answered_elapsed_seconds(channel_id)

            if 'connector' not in channel:
                channel['connector'] = self._build_connector(channel_id)

            await channel['connector'].start()
            channel['connector_started'] = True
            channel['connector_starting'] = False
            logger.info(f"Deepgram connector started for channel {channel_id}")
        except Exception as e:
            if channel_id in self.channels:
                self.channels[channel_id]['connector_starting'] = False
            logger.error(f"Failed to start Deepgram connector for channel {channel_id}: {e}")
            # Close the channel if connector fails to start
            if channel_id in self.channels:
                await self.close_channel(channel_id)

    async def start_transcription(self, call_id):
        """Enable realtime transcription for a specific active call."""
        self.pending_transcription_requests.add(call_id)
        channel_ids = self._find_channels_for_callid(call_id)
        if not channel_ids:
            logger.info(f"Queued transcription start for call {call_id}")
            return

        for channel_id in channel_ids:
            self.channels[channel_id]['transcription_requested'] = True
            answered_elapsed = await self._get_answered_elapsed_seconds(channel_id)
            if answered_elapsed is not None:
                self.channels[channel_id]['call_elapsed_at_start'] = answered_elapsed
            else:
                self.channels[channel_id]['call_elapsed_at_start'] = None
            if not self.channels[channel_id].get('connector_started'):
                asyncio.create_task(self._start_connector(channel_id))

    async def stop_transcription(self, call_id):
        """Disable realtime transcription for a specific active call."""
        self.pending_transcription_requests.discard(call_id)
        channel_ids = self._find_channels_for_callid(call_id)
        if not channel_ids:
            logger.info(f"Stop transcription ignored: call {call_id} not found")
            return

        for channel_id in channel_ids:
            channel = self.channels.get(channel_id)
            if channel is None:
                continue
            channel['transcription_requested'] = False
            connector = channel.pop('connector', None)
            if connector is not None:
                try:
                    await connector.close()
                except Exception as e:
                    logger.debug(f"Failed to close connector for channel {channel_id}: {e}")
                channel['connector_started'] = False
                channel['connector_starting'] = False

    async def _handle_stasis_end(self, event):
        """Handle channel hangup event"""
        channel = event['channel']
        channel_id = channel['id']
        if channel_id in self.channels:
            logger.debug(f"Channel {channel_id} snooped and continue to dialplan")
            return
        original_channel_id = _original_channel_id(channel_id, HELPER_CHANNEL_PREFIXES)
        if original_channel_id in self.channels:
            logger.info(f"Helper channel {channel_id} left Stasis, closing channel {original_channel_id}")
            await self._release_call(original_channel_id)

    async def _handle_channel_left_bridge(self, event):
        """Handle channel left bridge event"""
        channel = event['channel']
        channel_id = channel['id']
        logger.debug(f"_handle_channel_left_bridge(channel_id={channel_id})")
        original_channel_id = None
        for id, values in self.channels.items():
            if values.get('snoop_channel_in') == channel_id or values.get('snoop_channel_out') == channel_id:
                # Snoop channel left the bridge
                logger.debug(f"Snoop channel {channel_id} left the bridge")
                original_channel_id = id
                break
            if values.get('external_media_channel_in') == channel_id or values.get('external_media_channel_out') == channel_id:
                # External media channel left the bridge
                logger.debug(f"External media channel {channel_id} left the bridge")
                original_channel_id = id
                break
        if original_channel_id is not None:
            await self._release_call(original_channel_id)

    async def close_channel(self, channel_id):
        """Close a channel"""
        logger.debug(f"close_channel(channel_id={channel_id})")
        # Stop tracking the call first, so that it is not closed twice
        channel = self.channels.pop(channel_id, None)
        if channel is not None:
            # Close the deepgram connector
            connector = channel.pop('connector', None)
            if connector is not None:
                try:
                    await connector.close()
                except Exception as e:
                    logger.debug(f"Failed to close connector for channel {channel_id}: {e}")
            for direction in ['in', 'out']:
                # Remove the bridge
                if f'bridge_{direction}' in channel:
                    try:
                        await self._ari_request(
                            'DELETE',
                            f"/bridges/{channel[f'bridge_{direction}']}"
                        )
                    except Exception as e:
                        logger.debug(f"Failed to delete bridge {channel[f'bridge_{direction}']}: {e}")
                    del channel[f'bridge_{direction}']
            for direction in ['in', 'out']:
                # Remove the external media channel
                if f'external_media_channel_{direction}' in channel:
                    try:
                        await self._ari_request(
                            'DELETE',
                            f"/channels/{channel[f'external_media_channel_{direction}']}"
                        )
                    except Exception as e:
                        logger.debug(f"Failed to delete external media channel {channel[f'external_media_channel_{direction}']}: {e}")
                    del channel[f'external_media_channel_{direction}']
            for direction in ['in', 'out']:
                # Remove the RTP stream
                if f'rtp_source_port_{direction}' in channel:
                    self.rtp_server.end_stream(channel[f'rtp_source_port_{direction}'])
                    del channel[f'rtp_source_port_{direction}']
                if f'rtp_stream_{direction}' in channel:
                    del channel[f'rtp_stream_{direction}']
        self.pending_transcription_requests.discard(channel_id)

    async def _hangup_channel(self, channel_id):
        """Hang up a channel, ignoring the error if it is already gone"""
        try:
            await self._ari_request('DELETE', f"/channels/{channel_id}")
        except Exception as e:
            logger.debug(f"Failed to hang up channel {channel_id}: {e}")

    async def _sweep_loop(self):
        """Periodically run sweep_orphans()"""
        while True:
            try:
                await self.sweep_orphans()
            except Exception as e:
                logger.error(f"Failed to sweep orphaned channels: {e}")
            await asyncio.sleep(SWEEP_INTERVAL)

    async def sweep_orphans(self):
        """
        Remove what a lost event or a restart left behind: helper channels
        and bridges of calls that are not tracked, and tracked calls that are
        no longer in Asterisk. A helper channel never hangs up by itself.
        Retry the continues that did not reach Asterisk and release the calls
        still waiting in Stasis since the previous sweep: setup takes
        milliseconds, so they are stuck.
        """
        # Taken before listing the channels, as newer ones may not be in the list
        tracked = list(self.channels)
        pending = list(self.pending_continues)
        channel_ids = {c['id'] for c in await self._ari_request('GET', "/channels")}
        for channel_id in pending:
            if channel_id in channel_ids:
                await self._continue_channel(channel_id)
            else:
                self.pending_continues.discard(channel_id)
        for channel_id in tracked:
            call = self.channels.get(channel_id)
            if call is None:
                continue
            if channel_id not in channel_ids:
                logger.warning(f"Closing channel {channel_id}: no longer in Asterisk")
                await self.close_channel(channel_id)
            elif call.get('waiting'):
                if call.get('waiting_at_sweep'):
                    logger.warning(f"Releasing channel {channel_id}: stuck in setup")
                    await self._release_call(channel_id)
                else:
                    call['waiting_at_sweep'] = True
        # After the passes above, so that the helpers of the calls they closed go too
        for channel_id in channel_ids:
            original_channel_id = _original_channel_id(channel_id, HELPER_CHANNEL_PREFIXES)
            if original_channel_id is not None and original_channel_id not in self.channels:
                logger.warning(f"Hanging up orphaned channel {channel_id}")
                await self._hangup_channel(channel_id)
        for bridge in await self._ari_request('GET', "/bridges"):
            original_channel_id = _original_channel_id(bridge['id'], HELPER_BRIDGE_PREFIXES)
            if original_channel_id is not None and original_channel_id not in self.channels:
                logger.warning(f"Deleting orphaned bridge {bridge['id']}")
                try:
                    await self._ari_request('DELETE', f"/bridges/{bridge['id']}")
                except Exception as e:
                    logger.debug(f"Failed to delete bridge {bridge['id']}: {e}")

    async def _handle_channel_hangup(self, event):
        """Handle channel hangup event"""
        channel = event['channel']
        channel_id = channel['id']
        logger.debug(f"_handle_channel_hangup(channel_id={channel_id})")
        if channel_id in self.channels:
            logger.debug(f"Channel {channel_id} hangup: {event}")
            await self.close_channel(channel_id)
            return
        original_channel_id = None
        for id, values in self.channels.items():
            if values.get('snoop_channel_in') == channel_id or values.get('snoop_channel_out') == channel_id:
                # Snoop channel hangup
                logger.debug(f"Snoop channel {channel_id} hangup")
                original_channel_id = id
                break
            if values.get('external_media_channel_in') == channel_id or values.get('external_media_channel_out') == channel_id:
                # External media channel hangup
                logger.debug(f"External media channel {channel_id} hangup")
                original_channel_id = id
                break
        if original_channel_id is not None:
            await self._release_call(original_channel_id)

    async def _ari_request(self, method, endpoint, params=None, json_data=None):
        """Make a request to the Asterisk ARI"""
        logger.debug(f"ARI request(method={method}, endpoint={endpoint})")
        url = f"{self.url}/ari{endpoint}"

        async with self.session.request(
            method,
            url,
            params=params,
            json=json_data
        ) as response:
            if response.status >= 400:
                error_text = await response.text()
                logger.error(f"ARI request failed: {response.status} - {error_text}")
                raise AriError(f"ARI request failed: {response.status}")

            # Handle 204 No Content responses
            if response.status == 204:
                return None

            return await response.json()
