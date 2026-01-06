# Configuration Guide

The Bridge Service supports multiple configuration methods with clear precedence.

## Configuration Precedence

1. **Environment Variables** (highest priority)
2. **config.json** file
3. **Default Values** (fallback)

## Configuration File

Create `config.json` in the bridge-service root:

```json
{
  "rest": {
    "port": 5000,
    "host": "127.0.0.1"
  },
  "gamepipe": {
    "id": "vox-deorum-bridge",
    "retry": 5000
  },
  "eventpipe": {
    "enabled": true,
    "name": "vox-deorum-events"
  },
  "logging": {
    "level": "info"
  }
}
```

## Configuration Options

| Option | Type | Default | Description | Env Variable |
|--------|------|---------|-------------|--------------|
| **rest.port** | number | 5000 | HTTP server port | `PORT` |
| **rest.host** | string | "127.0.0.1" | Bind address (`"0.0.0.0"` for all interfaces) | `HOST` |
| **gamepipe.id** | string | "vox-deorum-bridge" | Pipe ID (actual: `\\.\pipe\tmp-app.{id}`) | `gamepipe_ID` |
| **gamepipe.retry** | number | 5000 | Max retry interval in ms (exponential backoff cap) | `gamepipe_RETRY` |
| **eventpipe.enabled** | boolean | false | Enable event pipe broadcasting | `EVENTPIPE_ENABLED` |
| **eventpipe.name** | string | "vox-deorum-events" | Event pipe ID (actual: `\\.\pipe\tmp-app.{name}`) | `EVENTPIPE_NAME` |
| **logging.level** | string | "info" | Log level: `error`, `warn`, `info`, or `debug` | `LOG_LEVEL` |

## Environment Variables

```bash
# REST API
export PORT=8080
export HOST="0.0.0.0"

# Game Pipe
export gamepipe_ID="my-custom-pipe"
export gamepipe_RETRY=10000

# Event Pipe
export EVENTPIPE_ENABLED=true
export EVENTPIPE_NAME="my-events"

# Logging
export LOG_LEVEL=debug
```

**Windows (PowerShell):**
```powershell
$env:PORT = 8080
$env:LOG_LEVEL = "debug"
```

## Configuration Examples

**Development:**
```json
{
  "rest": { "port": 5000, "host": "127.0.0.1" },
  "gamepipe": { "id": "vox-deorum-bridge", "retry": 1000 },
  "eventpipe": { "enabled": true, "name": "vox-deorum-events" },
  "logging": { "level": "debug" }
}
```
- Fast retry (1s), debug logging, event pipe enabled

**Production:**
```json
{
  "rest": { "port": 5000, "host": "127.0.0.1" },
  "gamepipe": { "id": "vox-deorum-bridge", "retry": 5000 },
  "eventpipe": { "enabled": false, "name": "vox-deorum-events" },
  "logging": { "level": "info" }
}
```
- Standard retry, info logging, event pipe disabled (use SSE)

**Multi-Instance:** Use environment variables to run multiple instances with different ports and pipe names.

## Hardcoded Settings

Some settings are hardcoded and cannot be configured:

| Setting | Value | Location |
|---------|-------|----------|
| Lua function timeout | 120s | [dll-connector.ts](../src/services/dll-connector.ts) |
| External function timeout | 5s default | Configurable per function via `/external/register` |
| SSE keep-alive | 5s | [routes/events.ts](../src/routes/events.ts) |
| Message delimiter | `!@#$%^!` | Throughout |
| Event batch timeout | 50ms | [event-pipe.ts](../src/services/event-pipe.ts) |
| Event batch size | 100 events | [event-pipe.ts](../src/services/event-pipe.ts) |
| Request body limit | 10MB | [index.ts](../src/index.ts) |
| Queue threshold | 50 messages | [dll-connector.ts](../src/services/dll-connector.ts) |

## Validation

The Bridge Service validates configuration on startup:

1. Loads config.json (if exists)
2. Applies environment variable overrides
3. Falls back to defaults for missing values
4. Logs final configuration

Invalid configurations log warnings but won't prevent startup (defaults are used).

## Troubleshooting

**DLL Connection Issues:**
- Verify `gamepipe.id` matches DLL configuration
- Remember actual pipe path includes `tmp-app.` prefix
- Check DLL is running and pipe server started

**Port Already in Use:**
- Change `rest.port` or use `PORT` environment variable
- Kill existing process using the port

**Event Pipe Not Working:**
- Verify `eventpipe.enabled` is `true`
- Check pipe name: `\\.\pipe\tmp-app.{eventpipe.name}`
- Check `/stats` endpoint for event pipe status

See [ERROR-HANDLING.md](ERROR-HANDLING.md) for complete troubleshooting guide.
