"""Speech-to-text transcription service using faster-whisper."""

from typing import Optional

from ..config import settings
from ..logging_config import get_logger
from ..models.schemas import TranscriptionResult

logger = get_logger(__name__)


class TranscriptionService:
    """Service for transcribing audio to text using Whisper.

    Handles audio chunk buffering, VAD, and transcription.

    Attributes:
        model: Loaded Whisper model instance.
        buffer: Audio buffer for accumulating chunks.
    """

    def __init__(self) -> None:
        """Initialize the transcription service.

        Lazy-loads the Whisper model on first use.
        """
        self._model: Optional[object] = None
        self._buffers: dict[str, bytes] = {}
        self._initialized = False
        self._stream_configs: dict[str, tuple[int, int]] = {}
        self._vad_enabled = False

    def _ensure_model_loaded(self) -> None:
        """Ensure the Whisper model is loaded.

        Raises:
            RuntimeError: If model loading fails.
        """
        if self._initialized:
            return

        try:
            from faster_whisper import WhisperModel

            logger.info(
                "Loading Whisper model",
                model=settings.stt_model,
                device=settings.stt_device,
            )
            self._model = WhisperModel(
                settings.stt_model,
                device=settings.stt_device,
                compute_type="int8" if settings.stt_device == "cpu" else "float16",
            )
            self._initialized = True
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.exception("Failed to load Whisper model", error=str(e))
            raise RuntimeError(f"Failed to load Whisper model: {e}")

    async def process_chunk(
        self,
        audio_data: bytes,
        sample_rate: int = 16000,
        channels: int = 1,
        speaker: str = "user",
    ) -> TranscriptionResult:
        """Process an audio chunk and return transcription.

        Buffers audio data and transcribes when enough is accumulated.

        Args:
            audio_data: Raw audio bytes (16-bit PCM).
            sample_rate: Sample rate of the audio in Hz.
            channels: Number of channels in the audio.
            speaker: Speaker label for the stream.

        Returns:
            Transcription result with text and metadata.
        """
        self._ensure_model_loaded()

        # Reset buffer if audio configuration changes per speaker
        if self._stream_configs.get(speaker) != (sample_rate, channels):
            self._buffers[speaker] = b""
            self._stream_configs[speaker] = (sample_rate, channels)

        # Add to buffer
        self._buffers[speaker] = self._buffers.get(speaker, b"") + audio_data

        # Check if we have enough audio (~1 second)
        min_buffer_size = sample_rate * channels * 2
        if len(self._buffers[speaker]) < min_buffer_size:
            return TranscriptionResult()

        try:
            # Convert bytes to numpy array
            import numpy as np

            audio_array = np.frombuffer(self._buffers[speaker], dtype=np.int16)

            # Downmix to mono if needed
            if channels > 1:
                sample_count = (audio_array.size // channels) * channels
                audio_array = audio_array[:sample_count].reshape(-1, channels)
                audio_array = audio_array.mean(axis=1)

            audio_array = audio_array.astype(np.float32) / 32768.0

            # Resample to 16kHz if necessary
            if sample_rate != 16000:
                audio_array = self._resample_audio(audio_array, sample_rate, 16000)

            segments = self._transcribe(audio_array)

            # Collect text from segments
            text = " ".join(segment.text.strip() for segment in segments)

            # Clear buffer after successful transcription
            self._buffers[speaker] = b""

            return TranscriptionResult(
                text=text,
                is_final=True,
                speaker=speaker,
            )

        except Exception as e:
            logger.exception("Transcription error", error=str(e))
            return TranscriptionResult()

    def _transcribe(self, audio_array: "np.ndarray") -> list[object]:
        """Run Whisper transcription with VAD fallback.

        If the VAD model assets are missing in the bundled app, retry without VAD.
        """
        try:
            segments, _ = self._model.transcribe(  # type: ignore
                audio_array,
                language="ru",
                vad_filter=self._vad_enabled,
            )
            return list(segments)
        except Exception as exc:
            message = str(exc)
            vad_missing = "silero_vad_v6.onnx" in message or "onnxruntime" in message
            if self._vad_enabled and vad_missing:
                logger.warning(
                    "VAD unavailable, retrying without VAD",
                    error=message,
                )
                self._vad_enabled = False
                segments, _ = self._model.transcribe(  # type: ignore
                    audio_array,
                    language="ru",
                    vad_filter=False,
                )
                return list(segments)
            raise

    @staticmethod
    def _resample_audio(
        audio: "np.ndarray", source_rate: int, target_rate: int
    ) -> "np.ndarray":
        """Resample audio to a target sample rate using linear interpolation.

        Args:
            audio: Mono audio signal as float32 array.
            source_rate: Original sample rate.
            target_rate: Target sample rate.

        Returns:
            Resampled audio array.
        """
        import numpy as np

        if source_rate == target_rate or audio.size == 0:
            return audio

        duration = audio.size / float(source_rate)
        target_length = max(1, int(duration * target_rate))
        x_old = np.linspace(0, audio.size - 1, num=audio.size)
        x_new = np.linspace(0, audio.size - 1, num=target_length)
        return np.interp(x_new, x_old, audio).astype(np.float32)

    def reset(self) -> None:
        """Reset the audio buffer."""
        self._buffers = {}
