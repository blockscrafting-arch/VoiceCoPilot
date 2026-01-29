# VoiceCoPilot

Real-time voice copilot for calls — listens to your microphone and system audio, provides AI-powered suggestions on what to say next.

## Features

- Captures microphone and system/tab audio (Windows WASAPI loopback for desktop; browser extension or getDisplayMedia for Web UI)
- Real-time speech recognition (faster-whisper)
- Context-aware suggestions via LLM (Gemini via OpenRouter)
- Desktop app (Tauri) with overlay UI; Web UI (Vercel + Railway) with screen/tab audio

## Tech Stack

- **Desktop**: Tauri 2 + React + TypeScript + Vite
- **Backend**: Python 3.11+ / FastAPI / WebSocket
- **STT**: faster-whisper
- **LLM**: OpenRouter (Gemini 2.x)

## Project Structure

```
apps/
  web/          # Tauri desktop app with React UI
  api/          # FastAPI backend server
packages/
  shared/       # Shared types and utilities
tests/          # Unit, integration, e2e tests
docs/           # Documentation and ADRs
```

## Quick Start

- **Desktop:** run API + Tauri app locally (see Setup below).
- **Web:** deploy API to Railway, frontend to Vercel; optionally install the browser extension or use screen/tab sharing. See [docs/DEPLOY_WEB.md](docs/DEPLOY_WEB.md).

### Prerequisites

- Node.js 20+
- pnpm 9+
- Python 3.11+
- Rust (for Tauri)

### Setup

```bash
# Install Node dependencies
pnpm install

# Setup Python environment
cd apps/api
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env
# Edit .env with your OpenRouter API key

# Run development servers
pnpm dev
```

## Configuration

See `.env.example` for available environment variables.

## License

MIT
