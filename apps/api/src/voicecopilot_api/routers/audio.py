"""Audio streaming WebSocket endpoint."""

import base64
import json
from dataclasses import dataclass

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..logging_config import get_logger
from ..services.transcription import TranscriptionService
from ..services.transcript_saver import save_transcript

router = APIRouter()
logger = get_logger(__name__)


@dataclass
class AudioStreamConfig:
    """Audio stream configuration received from the client."""

    sample_rate: int = 16000
    channels: int = 1


@router.websocket("/stream")
async def audio_stream(websocket: WebSocket) -> None:
    """WebSocket endpoint for streaming audio data.

    Receives audio chunks from the client, transcribes them,
    and sends back transcription results.

    Args:
        websocket: WebSocket connection instance.
    """
    await websocket.accept()
    client_id = id(websocket)
    logger.info("Audio stream connected", client_id=client_id)

    stream_configs: dict[str, AudioStreamConfig] = {
        "user": AudioStreamConfig(),
        "other": AudioStreamConfig(),
    }
    transcription_service = TranscriptionService()
    transcript_entries: list[dict[str, str]] = []
    active_project_id = "default"

    try:
        while True:
            message = await websocket.receive()

            # Handle config messages (text)
            if message.get("text"):
                try:
                    payload = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue

                if payload.get("type") == "config":
                    speaker = payload.get("speaker") or "user"
                    config = stream_configs.get(speaker) or AudioStreamConfig()
                    config.sample_rate = int(payload.get("sample_rate") or 16000)
                    config.channels = int(payload.get("channels") or 1)
                    stream_configs[speaker] = config
                    if payload.get("project_id"):
                        active_project_id = str(payload.get("project_id"))
                    logger.info(
                        "Audio config received",
                        client_id=client_id,
                        speaker=speaker,
                        sample_rate=config.sample_rate,
                        channels=config.channels,
                    )
                    continue

                if payload.get("type") == "audio":
                    speaker = payload.get("speaker") or "user"
                    data = payload.get("data")
                    if not data:
                        continue

                    try:
                        audio_bytes = base64.b64decode(data)
                    except Exception:
                        continue

                    config = stream_configs.get(speaker) or AudioStreamConfig()
                    result = await transcription_service.process_chunk(
                        audio_bytes,
                        sample_rate=config.sample_rate,
                        channels=config.channels,
                        speaker=speaker,
                    )

                    if result.text:
                        transcript_entries.append({
                            "timestamp": "",
                            "speaker": result.speaker,
                            "text": result.text,
                        })
                        await websocket.send_json({
                            "type": "transcription",
                            "text": result.text,
                            "is_final": result.is_final,
                            "speaker": result.speaker,
                        })
                    continue

                continue

            # Receive audio chunk (binary)
            data = message.get("bytes")
            if data is None:
                continue

            # Process audio and get transcription
            result = await transcription_service.process_chunk(
                data,
                sample_rate=stream_configs["other"].sample_rate,
                channels=stream_configs["other"].channels,
                speaker="other",
            )

            if result.text:
                transcript_entries.append({
                    "timestamp": "",
                    "speaker": result.speaker,
                    "text": result.text,
                })
                await websocket.send_json({
                    "type": "transcription",
                    "text": result.text,
                    "is_final": result.is_final,
                    "speaker": result.speaker,
                })

    except WebSocketDisconnect:
        logger.info("Audio stream disconnected", client_id=client_id)
    except Exception as e:
        logger.exception("Error in audio stream", client_id=client_id, error=str(e))
        await websocket.close(code=1011, reason="Internal error")
    finally:
        try:
            save_transcript(active_project_id, transcript_entries)
        except Exception as e:
            logger.exception(
                "Failed to save transcript",
                client_id=client_id,
                error=str(e),
            )
