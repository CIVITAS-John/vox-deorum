#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This launcher is intended for macOS. Use scripts/vox-deorum.cmd on Windows."
  exit 1
fi

export GAMEPIPE_ENABLED="${GAMEPIPE_ENABLED:-false}"
export EVENTPIPE_ENABLED="${EVENTPIPE_ENABLED:-false}"
export MCP_TRANSPORT="${MCP_TRANSPORT:-http}"
export MCP_HOST="${MCP_HOST:-127.0.0.1}"
export MCP_PORT="${MCP_PORT:-4000}"
export BRIDGE_SERVICE_HOST="${BRIDGE_SERVICE_HOST:-127.0.0.1}"
export BRIDGE_SERVICE_PORT="${BRIDGE_SERVICE_PORT:-5050}"
export WEBUI_PORT="${WEBUI_PORT:-5555}"
export REQUIRE_VOX_POPULI_SCHEMA="${REQUIRE_VOX_POPULI_SCHEMA:-false}"

if [[ ! -d node_modules ]]; then
  npm install --include=dev
fi

if [[ ! -d vox-agents/ui/node_modules ]]; then
  npm --prefix vox-agents/ui install
fi

npm --prefix vox-agents/ui run build

pids=()

cleanup() {
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

trap cleanup INT TERM EXIT

start_service() {
  local name="$1"
  shift
  echo "Starting $name..."
  "$@" &
  pids+=("$!")
}

start_service "Bridge Service (copilot mode)" env PORT="$BRIDGE_SERVICE_PORT" HOST="$BRIDGE_SERVICE_HOST" npm --workspace bridge-service run dev
sleep 2
start_service "MCP Server" npm --workspace mcp-server run dev
sleep 2
start_service "Vox Agents Web UI" npm --workspace vox-agents run dev

echo "Bridge Service: http://${BRIDGE_SERVICE_HOST}:${BRIDGE_SERVICE_PORT}"
echo "MCP Server: http://${MCP_HOST}:${MCP_PORT}/mcp"
echo "Vox Agents UI: http://127.0.0.1:${WEBUI_PORT}"
echo "Start Civilization V normally on macOS, then use the UI or an MCP client as a copilot."

while true; do
  for pid in "${pids[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid"
      exit "$?"
    fi
  done
  sleep 1
done
