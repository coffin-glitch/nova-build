#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"           # force project root

echo "[runner] PWD=$(pwd)"

# Load .env file if it exists
if [ -f ".env" ]; then
    set -a
    . ./.env
    set +a
    echo "[runner] Loaded .env file"
else
    echo "[runner] WARNING: .env file not found"
fi

# Check DATABASE_URL
echo "[runner] DATABASE_URL=${DATABASE_URL:-<EMPTY>}" | sed -E 's|(.{60}).*|\1...|'
if [ -z "${DATABASE_URL:-}" ]; then
    echo "[runner] ERROR: DATABASE_URL is empty. Set it in .env" >&2
    exit 1
fi

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "[runner] ERROR: .venv directory not found. Run 'python -m venv .venv' first" >&2
    exit 1
fi

# Activate virtual environment and run the forwarder
echo "[runner] Activating virtual environment and starting forwarder..."
source .venv/bin/activate
python scripts/telegram_bot_forwarder.py