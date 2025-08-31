#!/bin/bash

# Array to store PIDs of started processes
declare -a PIDS=()

# Cleanup function to terminate all subprocesses
cleanup() {
    echo "Terminating all services..."
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            echo "Stopping process $pid"
            kill -TERM "$pid" 2>/dev/null
        fi
    done
    # Give processes time to terminate gracefully
    sleep 2
    # Force kill any remaining processes
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            echo "Force stopping process $pid"
            kill -KILL "$pid" 2>/dev/null
        fi
    done
    exit 0
}

# Set up trap to catch termination signals
trap cleanup SIGINT SIGTERM EXIT

# Start bridge-service
echo "Starting bridge-service..."
cd bridge-service && npm start &
BRIDGE_PID=$!
PIDS+=($BRIDGE_PID)
echo "Bridge service started with PID: $BRIDGE_PID"

# Wait for bridge-service to be ready (adjust sleep time as needed)
sleep 3

# Start mcp-server
echo "Starting mcp-server..."
cd mcp-server && npm start &
MCP_PID=$!
PIDS+=($MCP_PID)
echo "MCP server started with PID: $MCP_PID"

# Wait for mcp-server to be ready
sleep 3

# Start mcp-server inspect
echo "Starting mcp-server inspect..."
cd mcp-server && npm run inspect &
INSPECT_PID=$!
PIDS+=($INSPECT_PID)
echo "MCP server inspect started with PID: $INSPECT_PID"

# Wait for all processes
echo "All services started. Press Ctrl+C to stop all services."
wait