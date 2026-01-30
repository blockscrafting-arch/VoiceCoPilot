"""Audio streaming WebSocket endpoint."""

import base64
import json
import math
import re
import time
from array import array
from dataclasses import dataclass

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..logging_config import get_logger
from ..services.transcription import get_transcription_service
from ..services.transcript_saver import save_transcript

router = APIRouter()
logger = get_logger(__name__)


@dataclass
class AudioStreamConfig:
    """Audio stream configuration received from the client."""

    sample_rate: int = 16000
    channels: int = 1


# Subtitle/credits pattern: skip sending repeated credits text to client
CREDITS_PATTERN = re.compile(
    r"редактор\s+субтитров|корректор\s+[а-яёa-z]",
    re.IGNORECASE,
)

# Whisper hallucination: typical TV/radio outro and subtitle credits (no such sounds in room)
OUTRO_PATTERN = re.compile(
    r"с\s+вами\s+был|до\s+скорой\s+встречи|спасибо\s+за\s+внимание|"
    r"продолжение\s+следует|игорь\s+негода|"
    r"субтитры\s+(делал|создал|создавал|подогнали)",
    re.IGNORECASE,
)

# Minimum characters to send (skip noise / single-char)
MIN_TRANSCRIPT_CHARS = 2


def _normalize_text(text: str) -> str:
    """Normalize text for duplicate check (strip, collapse spaces)."""
    return " ".join(text.strip().split())


def _should_skip_transcription(
    text: str,
    speaker: str,
    last_sent: dict[str, str],
) -> bool:
    """Return True if we should not send this transcription (credits, outro/hallucination, duplicate, or too short)."""
    if not text or not text.strip():
        return True
    normalized = _normalize_text(text)
    if len(normalized) < MIN_TRANSCRIPT_CHARS:
        return True
    if CREDITS_PATTERN.search(normalized):
        return True
    if OUTRO_PATTERN.search(normalized):
        return True
    if last_sent.get(speaker) == normalized:
        return True
    return False


def _estimate_rms(pcm_bytes: bytes, max_samples: int = 2000) -> float:
    """Estimate RMS amplitude from PCM16 bytes.

    Args:
        pcm_bytes: Raw PCM16 bytes.
        max_samples: Maximum number of samples to inspect.

    Returns:
        RMS amplitude (0..32767 for 16-bit PCM).
    """
    if not pcm_bytes:
        return 0.0
    byte_len = len(pcm_bytes) - (len(pcm_bytes) % 2)
    if byte_len <= 0:
        return 0.0
    sample_bytes = pcm_bytes[: min(byte_len, max_samples * 2)]
    samples = array("h")
    samples.frombytes(sample_bytes)
    if not samples:
        return 0.0
    power = sum(sample * sample for sample in samples) / len(samples)
    return math.sqrt(power)


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
    transcription_service = get_transcription_service()
    transcript_entries: list[dict[str, str]] = []
    active_project_id = "default"
    last_sent_text: dict[str, str] = {}
    stats = {
        "user": {"bytes": 0, "chunks": 0, "last_log": time.monotonic()},
        "other": {"bytes": 0, "chunks": 0, "last_log": time.monotonic()},
    }

    def log_audio_stats(
        speaker: str,
        chunk_bytes: bytes,
        sample_rate: int,
        channels: int,
    ) -> None:
        if not chunk_bytes:
            return
        state = stats.setdefault(
            speaker,
            {"bytes": 0, "chunks": 0, "last_log": time.monotonic()},
        )
        state["bytes"] += len(chunk_bytes)
        state["chunks"] += 1
        now = time.monotonic()
        elapsed = now - state["last_log"]
        if elapsed < 5:
            return
        bytes_per_sec = state["bytes"] / max(elapsed, 0.001)
        avg_chunk = state["bytes"] / max(state["chunks"], 1)
        rms = _estimate_rms(chunk_bytes)
        logger.info(
            "Audio stream stats",
            client_id=client_id,
            speaker=speaker,
            sample_rate=sample_rate,
            channels=channels,
            bytes_per_sec=round(bytes_per_sec, 2),
            avg_chunk_bytes=round(avg_chunk, 2),
            rms=round(rms, 2),
        )
        state["bytes"] = 0
        state["chunks"] = 0
        state["last_log"] = now

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            # Handle config messages (text)
            if message.get("text"):
                try:
                    payload = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue

                if payload.get("type") == "config":
                    speaker = payload.get("speaker") or "user"
                    source = payload.get("source")
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
                        source=source,
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
                    log_audio_stats(
                        speaker,
                        audio_bytes,
                        config.sample_rate,
                        config.channels,
                    )

                    if result.text:
                        if _should_skip_transcription(
                            result.text, result.speaker, last_sent_text
                        ):
                            continue
                        last_sent_text[result.speaker] = _normalize_text(result.text)
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
            log_audio_stats(
                "other",
                data,
                stream_configs["other"].sample_rate,
                stream_configs["other"].channels,
            )

            if result.text:
                if _should_skip_transcription(
                    result.text, result.speaker, last_sent_text
                ):
                    continue
                last_sent_text[result.speaker] = _normalize_text(result.text)
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
        try:
            await websocket.close(code=1011, reason="Internal error")
        except RuntimeError:
            # Connection already closed (e.g. disconnect received); ignore
            pass
    finally:
        try:
            save_transcript(active_project_id, transcript_entries)
        except Exception as e:
            logger.exception(
                "Failed to save transcript",
                client_id=client_id,
                error=str(e),
            )
