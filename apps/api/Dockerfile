# VoiceCoPilot API Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

# Set Python path
ENV PYTHONPATH=/app/src
ENV PYTHONUNBUFFERED=1

# Railway injects PORT at runtime; default 8000 for local runs
EXPOSE 8000

# Run the API server (use $PORT so Railway healthcheck and proxy match)
CMD ["sh", "-c", "exec uvicorn voicecopilot_api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
