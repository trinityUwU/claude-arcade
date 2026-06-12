#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PID_FILE="server.pid"
LOG_DIR="logs"
mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "claude-arcade déjà lancé (PID $(cat "$PID_FILE"))"
  exit 0
fi

# Reset logs (pas d'append)
: > "$LOG_DIR/server.log"

bun run src/server/api.ts > "$LOG_DIR/server.log" 2>&1 &
echo $! > "$PID_FILE"
echo "claude-arcade démarré (PID $(cat "$PID_FILE")) → http://localhost:${ARCADE_PORT:-4317}"
