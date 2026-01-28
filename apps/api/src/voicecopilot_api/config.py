"""Application configuration via environment variables."""

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Attributes:
        openrouter_api_key: API key for OpenRouter.
        llm_model: Primary LLM model identifier.
        llm_fallback_model: Fallback LLM model identifier.
        stt_model: Whisper model size (tiny, base, small, medium, large).
        stt_device: Device for STT inference (cpu or cuda).
        api_host: Host to bind the API server.
        api_port: Port to bind the API server.
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR).
    """

    openrouter_api_key: str = ""
    llm_model: str = "google/gemini-2.0-flash-001"
    llm_fallback_model: str = "google/gemini-2.5-flash"
    stt_model: str = "base"
    stt_device: str = "cpu"
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    log_level: str = "INFO"
    database_url: str = "sqlite:///./voicecopilot.db"
    storage_bucket: str = ""
    storage_region: str = "us-east-1"
    storage_endpoint_url: str = ""
    storage_access_key: str = ""
    storage_secret_key: str = ""
    storage_public_base_url: str = ""

    class Config:
        """Pydantic configuration."""

        env_file = str(Path(__file__).resolve().parents[2] / ".env")
        env_file_encoding = "utf-8"


settings = Settings()
