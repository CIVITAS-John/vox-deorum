# OBS Studio Integration

Vox Agents supports automated OBS Studio control for recording and livestreaming game sessions. This is managed through the **production mode** system and the **ObsManager** singleton.

## Production Mode

The `production` field on `StrategistSessionConfig` controls animation behavior and OBS integration:

| Mode | Animations | Strategic View Toggle | OBS |
|------|-----------|----------------------|-----|
| `"none"` (default) | Skip in autoplay | Yes | No |
| `"test"` | Play | No | No |
| `"livestream"` | Play | No | Streaming |
| `"recording"` | Play | No | Recording with live event logs |

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
    ├── Set up scenes (game capture + audio capture + pause scene)
    ├── Mute default audio sources (Desktop Audio, Mic/Aux)
    ├── Query recording directory (GetRecordDirectory)
    ├── Listen for RecordStateChanged events
    └── Start health monitoring (10s poll)
    │
setGameID(gameID)              // Set game ID, update OBS recording directory
    │
startProduction()              // Open event log, start recording/streaming
    │
pauseProduction()              // Recording: PauseRecord / Livestream: switch to pause scene
resumeProduction()             // Recording: ResumeRecord / Livestream: switch to game scene
    │
stopProduction()               // Stop recording/streaming, finalize event log
    │
destroy()                      // Disconnect, restore recording dir, cleanup
```

### Game ID Directory Management

When a game ID is set via `setGameID(gameID)`, ObsManager organizes recordings under `{baseRecordDir}/{gameID}/`:

```
C:\Users\John\Videos\
  └── game-abc123/
      ├── events-1775232600000.jsonl     (session event log)
      ├── 2026-04-03 16-30-00.mkv       (first recording)
      └── 2026-04-03 17-50-00.mkv       (second recording)
```

Uses `SetRecordDirectory` (OBS 30.2+) to redirect OBS output. The directory is set before each `startProduction()` call and restored to the original on `destroy()`. Repeated calls with the same game ID are idempotent.

### Scene Setup

On `initialize()`, ObsManager creates OBS scenes programmatically:

1. **"Vox Deorum"** scene with:
   - A `game_capture` input targeting `CivilizationV.exe` by executable name (`WINDOW_PRIORITY_EXE` matching)
   - An `Application Audio Capture` input (`wasapi_process_output_capture`) targeting `CivilizationV.exe` — captures only game audio
2. **"Vox Deorum - Paused"** scene (livestream mode only) with an `image_source` input showing a static pause image

Default Desktop Audio and Mic/Aux inputs are muted during the session to ensure only game audio is recorded. Original mute states are restored on `destroy()`.

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
  logPath: string;    // Companion .events.jsonl path
}
```

Access via `obsManager.getRecordingFiles()`.

### Live Event Log (JSONL)

Events are written to a JSONL file on disk as they happen, providing crash resilience. One centralized `.events.jsonl` file is created per production session (not per recording).

The log opens when `startProduction()` is called and closes when `stopProduction()` or `destroy()` is called. Each `addEvent()` call appends a line via `appendFileSync`, so events survive process crashes.

```jsonl
{"type":"session_start","at":1775232600000,"configName":"livestream","productionMode":"recording","gameID":"abc123"}
{"type":"recording_started","at":1775232600100}
{"type":"recording_paused","at":1775233501000}
{"type":"recording_resumed","at":1775233591000}
{"type":"recording_stopped","at":1775237100000}
{"type":"recording_file","at":1775237100100,"details":"2026-04-03 16-30-00.mkv"}
{"type":"recording_started","at":1775237400000}
{"type":"recording_stopped","at":1775239800000}
{"type":"recording_file","at":1775239800100,"details":"2026-04-03 17-50-00.mkv"}
{"type":"session_end","at":1775239801000}
```

Event fields:
- `type` — event identifier (string)
- `at` — Unix timestamp in milliseconds (`Date.now()`)
- `details` — optional context string

Add custom events via `obsManager.addEvent(type, details?)` — called by strategist-session at key lifecycle points (crash, recovery, victory).

### Health Monitoring

ObsManager polls `GetVersion` every 10 seconds. On connection loss:

1. Check if OBS process is still running (via `tasklist`)
2. Relaunch OBS if process died
3. Reconnect WebSocket
4. Restart production if it was active

Recovery is bounded to 3 attempts. After that, monitoring stops.

### ProcessManager Integration

ObsManager self-registers with `processManager` on first `initialize()` call, ensuring clean shutdown (stop production, disconnect, restore recording directory) when the Node.js process exits via SIGINT/SIGTERM/SIGBREAK/SIGHUP.

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

### Integration Tests (`tests/obs/obs-manager.test.ts`)

Requires a running OBS Studio instance with WebSocket server enabled (default port 4455). Tests are skipped gracefully if OBS is not reachable.

Covers: initialization, scene creation, start/stop recording, game ID directory management, live JSONL event logs, pause/resume, scene switching, event tracking.

Run: `npm run test:obs`

## Prerequisites

- OBS Studio 30.2+ with WebSocket server enabled (Tools > WebSocket Server Settings)
- `obs-websocket-js` npm package (installed at workspace root)
- Windows (game capture and process detection use Windows-specific APIs)
