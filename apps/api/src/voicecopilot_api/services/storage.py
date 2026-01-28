"""Object storage helper for transcripts and context files."""

from functools import lru_cache
from pathlib import Path
from typing import Optional

import boto3

from ..config import settings
from ..logging_config import get_logger

logger = get_logger(__name__)


class StorageClient:
    """Storage client with S3 and local fallback."""

    def __init__(self) -> None:
        self._bucket = settings.storage_bucket
        self._public_base = settings.storage_public_base_url.strip()
        if self._bucket:
            self._client = boto3.client(
                "s3",
                region_name=settings.storage_region,
                endpoint_url=settings.storage_endpoint_url or None,
                aws_access_key_id=settings.storage_access_key or None,
                aws_secret_access_key=settings.storage_secret_key or None,
            )
        else:
            self._client = None

    def upload_bytes(self, key: str, data: bytes, content_type: str) -> str:
        """Upload bytes to storage and return object key."""
        if self._client and self._bucket:
            self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
            return key

        local_root = Path.cwd() / "storage"
        local_path = local_root / key
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(data)
        return str(local_path)

    def upload_text(self, key: str, text: str, content_type: str = "text/plain") -> str:
        """Upload text content to storage."""
        return self.upload_bytes(key, text.encode("utf-8"), content_type)

    def public_url(self, key: str) -> Optional[str]:
        """Return a public URL for a key if configured."""
        if not self._public_base:
            return None
        return f"{self._public_base.rstrip('/')}/{key.lstrip('/')}"


@lru_cache(maxsize=1)
def get_storage_client() -> StorageClient:
    """Return cached storage client instance."""
    return StorageClient()
