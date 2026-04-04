# OBS Studio Integration

Vox Agents supports automated OBS Studio control for recording and livestreaming game sessions. This is managed through the **production mode** system and the **ObsManager** singleton.

## Production Mode

The `production` field on `StrategistSessionConfig` controls animation behavior and OBS integration:

| Mode | Animations | Strategic View Toggle | OBS |
|------|-----------|----------------------|-----|
| `"none"` (default) | Skip in autoplay | Yes | No |
| `"test"` | Play | No | No |
| `"livestream"` | Play | No | Streaming |
| `"recording"` | Play | No | Recording with companion logs |

Helper functions in `types/config.ts`:
- `isVisualMode(mode?)` — true for `test`, `livestream`, `recording` (play animations, don't toggle strategic view)
- `isObsMode(mode?)` — true for `livestream`, `recording` (initialize OBS)

## Configuration

OBS settings live in `VoxAgentsConfig.obs` (type `ObsConfig`):

```typescript
interface ObsConfig {
  executablePath?: string;   // Path to obs64.exe (auto-detected if not set)
  wsPort?: number;           // WebSocket port (default: 4455)
  wsPassword?: string;       // WebSocket password
  profile?: string;          // OBS profile name
  sceneCollection?: string;  // OBS scene collection name
  scene?: string;            // Override scene name
  recordingOutputDir?: string;
  pauseImagePath?: string;   // Static image for livestream pause screen
}
```

Environment variable overrides: `OBS_EXECUTABLE_PATH`, `OBS_WS_PORT`, `OBS_WS_PASSWORD`.

Session config example (`configs/livestream.json`):
```json
{
  "production": "livestream"
}
```

## ObsManager

Singleton at `src/infra/obs-manager.ts`. Controls OBS via `obs-websocket-js` (WebSocket v5 protocol).

### Lifecycle

```
initialize(mode, config?, configName?)
    │
    ├── Ensure OBS is running (detect via tasklist, launch if needed)
    ├── Connect to OBS WebSocket
    ├── Set up scenes (game capture + pause scene)
    ├── Listen for RecordStateChanged events
    └── Start health monitoring (10s poll)
    │
startProduction()          // Idempotent — joins existing session if already active
    │
pauseProduction()          // Recording: PauseRecord / Livestream: switch to pause scene
resumeProduction()         // Recording: ResumeRecord / Livestream: switch to game scene
    │
stopProduction()           // Stops recording/streaming, writes companion log file
    │
destroy()                  // Disconnect, stop monitoring, cleanup
```

### Scene Setup

On `initialize()`, ObsManager creates OBS scenes programmatically:

1. **"Vox Deorum"** scene with a `game_capture` input targeting `CivilizationV.exe` by executable name (`WINDOW_PRIORITY_EXE` matching)
2. **"Vox Deorum - Paused"** scene (livestream mode only) with an `image_source` input showing a static pause image

The game capture scene is set as the active program scene.

### Pause Behavior

| Mode | Pause | Resume |
|------|-------|--------|
| Recording | `PauseRecord` (keeps file open, no dead air) | `ResumeRecord` |
| Livestream | Switch to "Vox Deorum - Paused" scene | Switch back to "Vox Deorum" scene |

### Recording File Tracking

Each recording is tracked as a `RecordingFile`:

```typescript
interface RecordingFile {
  path: string;       // Video file path (set when OBS finishes)
  startedAt: Date;
  stoppedAt?: Date;
  logPath: string;    // Companion .log.json path
}
```

Access via `obsManager.getRecordingFiles()`.

### Companion Log Files

When a recording stops, a `.log.json` file is written alongside the video file:

```
2026-04-03 16-30-00.mkv
2026-04-03 16-30-00.log.json
```

Log contents:
```json
{
  "videoFile": "2026-04-03 16-30-00.mkv",
  "configName": "livestream",
  "productionMode": "recording",
  "startedAt": "2026-04-03T16:30:00.000Z",
  "stoppedAt": "2026-04-03T17:45:00.000Z",
  "events": [
    { "type": "recording_started", "at": "2026-04-03T16:30:00.000Z" },
    { "type": "game_crashed", "at": "2026-04-03T16:45:00.000Z" },
    { "type": "recording_paused", "at": "2026-04-03T16:45:01.000Z" },
    { "type": "recording_resumed", "at": "2026-04-03T16:46:31.000Z" },
    { "type": "recording_stopped", "at": "2026-04-03T17:45:00.000Z" }
  ]
}
```

Add custom events via `obsManager.addEvent(type, details?)` — called by strategist-session at key lifecycle points (crash, recovery, victory).

### Health Monitoring

ObsManager polls `GetVersion` every 10 seconds. On connection loss:

1. Check if OBS process is still running (via `tasklist`)
2. Relaunch OBS if process died
3. Reconnect WebSocket
4. Restart production if it was active

Recovery is bounded to 3 attempts. After that, monitoring stops.

### ProcessManager Integration

ObsManager self-registers with `processManager` on first `initialize()` call, ensuring clean shutdown (stop production, disconnect) when the Node.js process exits via SIGINT/SIGTERM/SIGBREAK/SIGHUP.

## ProcessManager

Singleton at `src/infra/process-manager.ts`. Consolidates signal handling across all console entry points.

```typescript
import { processManager } from './infra/process-manager.js';

processManager.register('my-service', async () => {
  await myService.shutdown();
});
```

- Lazily registers signal handlers on first `register()` call
- Hooks execute in insertion order during shutdown
- Safe to call `shutdown()` multiple times (idempotent)
- Used by: strategist console, telepathist console, oracle console, archivist console, web server, ObsManager

## Testing

### Unit Tests (`tests/utils/config-helpers.test.ts`)

Tests `isVisualMode()` and `isObsMode()` with all `ProductionMode` values. No external dependencies.

Run: `npm test`

### Integration Tests (`tests/infra/obs-manager.test.ts`)

Requires a running OBS Studio instance with WebSocket server enabled (default port 4455). Tests are skipped gracefully if OBS is not reachable.

Covers: initialization, scene creation, start/stop recording, companion log files, pause/resume, scene switching, event tracking.

Run: `npm run test:game`

## Prerequisites

- OBS Studio installed with WebSocket server enabled (Tools > WebSocket Server Settings)
- `obs-websocket-js` npm package (installed at workspace root)
- Windows (game capture and process detection use Windows-specific APIs)
