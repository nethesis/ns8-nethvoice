'''
connect rtp stream with deepgram retrieving transcriptions and publishing it to mqtt
'''

import asyncio
import json
import logging
import time
import numpy as np
from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
)

logger = logging.getLogger("deepgram_connector")
logging.getLogger('websockets').setLevel(logging.INFO)

class DeepgramConnector:
    """
    Connect to Deepgram
    - send audio stream to deepgram
    - retrieve transcriptions
    - call transcription callback
    """
    def __init__(self, deepgram_api_key, rtp_stream_in, rtp_stream_out, mqtt_client, uniqueid, **kwargs):
        """
        Initialize Deepgram Connector
        :param deepgram_api_key: Deepgram API key
        :param mqtt_client: MQTT client
        :param audio_stream: Audio stream to send to Deepgram
        :param uniqueid: Asterisk Channel ID (uniqueid)
        """
        self.deepgram_api_key = deepgram_api_key
        self.mqtt_client = mqtt_client
        self.uniqueid = uniqueid
        self.transcription_callback = None
        self.read_audio_from_rtp_task = None
        self.send_audio_to_deepgram_task = None
        self.get_transcription_task = None
        self.rtp_stream_in = rtp_stream_in
        self.rtp_stream_out = rtp_stream_out
        self.language = kwargs.get("language", "en")
        self.speaker_name_in = kwargs.get("speaker_name_in", None)
        self.speaker_number_in = kwargs.get("speaker_number_in", None)
        self.speaker_name_out = kwargs.get("speaker_name_out", None)
        self.speaker_number_out = kwargs.get("speaker_number_out", None)
        self.audio_queue = asyncio.Queue(maxsize=100)
        self.connected = False
        self.dg_connection = None
        self.loop = None
        self.complete_call = []
        self.latest_interim_by_channel = {}
        self._close_started = False
        self._close_lock = asyncio.Lock()
        self._first_transcript_logged = False
        self.call_elapsed_at_start_override = kwargs.get("call_elapsed_at_start")
        self.call_start_epoch = kwargs.get("call_start_epoch")
        self.call_elapsed_at_start = 0.0
        self.transcription_start_monotonic = None

    async def start(self):
        if isinstance(self.call_elapsed_at_start_override, (int, float)) and self.call_elapsed_at_start_override >= 0:
            self.call_elapsed_at_start = float(self.call_elapsed_at_start_override)
        elif isinstance(self.call_start_epoch, (int, float)) and self.call_start_epoch > 0:
            self.call_elapsed_at_start = max(0.0, time.time() - float(self.call_start_epoch))
            logger.info(
                f"Transcription timing base for {self.uniqueid}: "
                f"call_elapsed_at_start={self.call_elapsed_at_start:.3f}s"
            )

        deepgram: DeepgramClient = DeepgramClient(self.deepgram_api_key)
        self.dg_connection = deepgram.listen.asyncwebsocket.v("1")
        self.dg_connection.on(LiveTranscriptionEvents.Transcript, self.on_message)
        self.dg_connection.on(LiveTranscriptionEvents.Metadata, self.on_metadata)
        self.dg_connection.on(LiveTranscriptionEvents.Error, self.on_error)
        # Store the current event loop for later use in callbacks
        self.loop = asyncio.get_running_loop()

        options: LiveOptions = LiveOptions(
            model="nova-2",
            punctuate=True,
            language=self.language,
            encoding="linear16",
            multichannel=True,
            channels=2,
            sample_rate=16000,
            ## To get UtteranceEnd, the following must be set:
            interim_results=True,
            utterance_end_ms="1000",
            vad_events=True,
        )
        if await self.dg_connection.start(options) is False:
            logger.error(f"Failed to start Deepgram connection for {self.uniqueid}")
            return

        self.transcription_start_monotonic = time.monotonic()
        self.connected = True
        self.read_audio_from_rtp_task = asyncio.create_task(self.read_audio_from_rtp())
        self.send_audio_to_deepgram_task = asyncio.create_task(self.send_audio_to_deepgram())
        logger.info(f"Deepgram connector started for {self.uniqueid}")

    async def on_message(self, client, result, **kwargs):
        """
        Send transcription to mqtt
        """
        transcription = result.channel.alternatives[0].transcript
        if len(transcription) == 0:
            return
        if not self._first_transcript_logged:
            logger.info(
                f"First Deepgram transcript for {self.uniqueid} "
                f"(is_final={result.is_final}, len={len(transcription)})"
            )
            self._first_transcript_logged = True
        # Use wall-clock elapsed since transcription start to avoid drift
        # caused by buffered audio being processed faster/slower than realtime.
        if self.transcription_start_monotonic is None:
            stream_elapsed = float(result.start)
        else:
            stream_elapsed = max(0.0, time.monotonic() - self.transcription_start_monotonic)
        timestamp = stream_elapsed + float(self.call_elapsed_at_start)
        if result.channel_index[0] == 0:
            speaker_name = self.speaker_name_in
            speaker_number = self.speaker_number_in
            speaker_counterpart_name = self.speaker_name_out
            speaker_counterpart_number = self.speaker_number_out
        else:
            speaker_name = self.speaker_name_out
            speaker_number = self.speaker_number_out
            speaker_counterpart_name = self.speaker_name_in
            speaker_counterpart_number = self.speaker_number_in
        try:
            channel_index = result.channel_index[0]
            segment_start = float(result.start)
            await self.mqtt_client.publish(
                    topic='transcription',
                    payload=json.dumps({
                        "uniqueid": self.uniqueid,
                        "transcription": transcription,
                        "timestamp": timestamp,
                        "channel_index": channel_index,
                        "segment_start": segment_start,
                        "speaker_name": speaker_name,
                        "speaker_number": speaker_number,
                        "speaker_counterpart_name": speaker_counterpart_name,
                        "speaker_counterpart_number": speaker_counterpart_number,
                        "is_final": result.is_final,
                    })
                )
            message = {
                "uniqueid": self.uniqueid,
                "transcription": transcription,
                "timestamp": timestamp,
                "channel_index": channel_index,
                "segment_start": segment_start,
                "speaker_name": speaker_name,
                "speaker_number": speaker_number,
                "speaker_counterpart_name": speaker_counterpart_name,
                "speaker_counterpart_number": speaker_counterpart_number,
                "is_final": result.is_final,
            }
            self.latest_interim_by_channel[channel_index] = message
            # save the transcription to the complete_call if it is final
            if result.is_final:
                self.complete_call.append(message)
                self.latest_interim_by_channel.pop(channel_index, None)
        except Exception as e:
                logger.error(f"Failed to schedule transcription publishing: {e}")

    async def on_metadata(self, client, metadata, **kwargs):
        """
        Handle metadata events
        """
        return

    async def on_error(self, client, error, **kwargs):
        """
        Handle error events
        """
        logger.error(f"Error received: {error}")
        if self._close_started:
            return

        # Use the stored event loop to schedule the task
        try:
            if self.loop and self.loop.is_running():
                self.loop.call_soon_threadsafe(
                    lambda: asyncio.create_task(self.close())
                )
            else:
                logger.warning("No running event loop available; cannot schedule close")
        except Exception as e:
            logger.error(f"Failed to schedule close operation: {e}")

    async def read_audio_from_rtp(self):
        """
        Read audio from RTP stream
        """
        try:
            # Keep chunks relatively small to reduce latency to first transcript.
            target_size = 1600
            timeout = 0.10
            while self.connected:
                # Read audio data from both streams till target size or timeout is reached
                buffer_in = bytearray()
                buffer_out = bytearray()
                start_time = asyncio.get_event_loop().time()
                while (len(buffer_in) < target_size and
                       len(buffer_out) < target_size and
                       (asyncio.get_event_loop().time() - start_time) < timeout):
                    if len(buffer_in) < target_size:
                        audio_data_in = self.rtp_stream_in.reader.read(320)
                        if audio_data_in:
                            buffer_in.extend(audio_data_in)
                    if len(buffer_out) < target_size:
                        audio_data_out = self.rtp_stream_out.reader.read(320)
                        if audio_data_out:
                            buffer_out.extend(audio_data_out)
                    # Always yield control to ensure fair scheduling between multiple calls
                    await asyncio.sleep(0)
                # If we have no data in both buffers after timeout, wait and continue
                if len(buffer_in) == 0 and len(buffer_out) == 0:
                    await asyncio.sleep(0.01)
                    continue
                # Convert buffers to numpy arrays
                arr1 = np.frombuffer(buffer_in, dtype=np.int16)
                arr2 = np.frombuffer(buffer_out, dtype=np.int16)

                # Ensure arrays are the same size by padding the smaller one
                if arr1.size != arr2.size:
                    if arr1.size < arr2.size:
                        arr1 = np.pad(arr1, (0, arr2.size - arr1.size), 'constant')
                    else:
                        arr2 = np.pad(arr2, (0, arr1.size - arr2.size), 'constant')
                # Interleave the audio data
                interleaved = np.empty((arr1.size + arr2.size,), dtype=np.int16)
                interleaved[0::2] = arr1
                interleaved[1::2] = arr2
                # Put interleaved audio data into the queue
                await self.audio_queue.put(interleaved.tobytes())
        except Exception as e:
            logger.error(f"Error reading audio from RTP stream: {e}")
            self.connected = False
            await self.close()

    async def send_audio_to_deepgram(self):
        """
        Read audio from queue and send to Deepgram
        """
        try:
            while self.connected:
                try:
                    # Use wait_for with short timeout instead of checking empty
                    audio_data = await asyncio.wait_for(self.audio_queue.get(), timeout=0.01)
                    if audio_data is not None:
                        await self.dg_connection.send(audio_data)
                except asyncio.TimeoutError:
                    # No data in queue, just continue (wait_for already yielded control)
                    pass
        except Exception as e:
            logger.error(f"Error sending audio to Deepgram: {e}")
            self.connected = False
            await self.close()

    async def close(self):
        """
        Close the connection to Deepgram
        """
        async with self._close_lock:
            if self._close_started:
                return
            self._close_started = True

            logger.debug(f"Closing Deepgram connection for {self.uniqueid}")
            self.connected = False

            # Cancel background tasks
            if self.read_audio_from_rtp_task is not None:
                self.read_audio_from_rtp_task.cancel()
            if self.send_audio_to_deepgram_task is not None:
                self.send_audio_to_deepgram_task.cancel()

            # Close Deepgram connection/socket
            if self.dg_connection is not None:
                try:
                    await self.dg_connection.finalize()
                except Exception as e:
                    logger.debug(f"Deepgram finalize failed for {self.uniqueid}: {e}")

                # Best-effort close of the underlying socket if finalize doesn't do it
                try:
                    if self.dg_connection is not None:
                        socket = getattr(self.dg_connection, "_socket", None)
                        if socket is not None:
                            await socket.close()
                except Exception as e:
                    logger.debug(f"Deepgram socket close failed for {self.uniqueid}: {e}")

        # Give the SDK a short window to emit final transcript callbacks after finalize().
        await asyncio.sleep(0.5)

        # publish full conversation to mqtt
        messages = list(self.complete_call)
        if not messages and self.latest_interim_by_channel:
            messages = sorted(
                self.latest_interim_by_channel.values(),
                key=lambda item: item.get("timestamp", 0),
            )
            logger.info(
                "Publishing fallback final transcript for %s using %d interim segment(s)",
                self.uniqueid,
                len(messages),
            )

        text = ""
        last_speaker = None
        for message in messages:
            if last_speaker != message["speaker_name"]:
                text += f'\n{message["speaker_name"]}: '
            text += f'{message["transcription"]}\n'
            last_speaker = message["speaker_name"]

        if not text.strip():
            logger.warning("No transcript content available to publish for %s", self.uniqueid)
            return

        # publish the full conversation to mqtt
        await self.mqtt_client.publish(
            topic='final',
            payload=json.dumps({
                "uniqueid": self.uniqueid,
                "raw_transcription": text
            })
        )
