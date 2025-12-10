# Vox Agents Web UI - Implementation Plan

## Overview
A web-based interface for managing and monitoring Vox Agents, providing configuration management, real-time telemetry, logs viewing, and mode orchestration.

## Technology Stack
- **Frontend**: SvelteKit 5 (latest)
- **Backend**: Express.js with TypeScript
- **UI Components**: SVAR Svelte (data grids, forms)
- **Styling**: Tailwind CSS with Civ5-inspired theme
- **Build**: Vite bundler with local dependencies
- **Database**: SQLite (existing telemetry DB)
- **Real-time**: Server-Sent Events (SSE) for lightweight streaming

## Architecture

### Directory Structure
```
vox-agents/
├── src/                       # Backend + existing strategist code
│   ├── strategist/           # Existing strategist code (refactored)
│   │   ├── index.ts          # CLI entry point
│   │   ├── strategist-session.ts
│   │   └── ...
│   ├── api/                  # REST API routes
│   │   ├── config.ts         # Config management endpoints
│   │   ├── session.ts        # Session control endpoints
│   │   ├── telemetry.ts      # Telemetry data endpoints
│   │   └── logs.ts           # Log streaming endpoints (SSE)
│   ├── services/             # Shared services
│   │   ├── config-manager.ts        # Config file CRUD operations
│   │   ├── session-manager.ts       # Core session management (from strategist)
│   │   ├── telemetry-reader.ts      # SQLite telemetry reader
│   │   └── log-watcher.ts           # Log file monitoring
│   ├── web/                  # Web server entry point
│   │   └── index.ts          # Express server setup
│   ├── utils/
│   │   └── sse.ts            # SSE helper utilities
│   └── ...                   # Other existing code
├── ui/                        # Svelte frontend
│   ├── src/
│   │   ├── app.html
│   │   ├── app.css           # Tailwind + Civ5 theme
│   │   ├── routes/
│   │   │   ├── +layout.svelte       # Main layout with sidebar
│   │   │   ├── +page.svelte         # Dashboard/home
│   │   │   ├── strategist/
│   │   │   │   ├── +page.svelte     # Strategist mode UI
│   │   │   │   └── config-dialog.svelte
│   │   │   ├── telemetry/
│   │   │   │   └── +page.svelte     # Telemetry viewer
│   │   │   └── logs/
│   │   │       └── +page.svelte     # Log viewer
│   │   ├── lib/
│   │   │   ├── stores/              # Svelte stores
│   │   │   ├── components/          # Reusable components
│   │   │   └── api.ts               # API client with SSE support
│   │   └── theme/
│   │       └── civ5.css            # Civ5 color palette
│   ├── static/
│   ├── dist/                  # Built frontend output
│   ├── package.json
│   └── vite.config.ts
└── package.json               # Root package with workspaces
```

## Core Features

### 1. Mode Management (Initial: Strategist)
- **Configuration UI**:
  - Load/save local JSON configs
  - Player selection (multi-select for LLM control)
  - Strategist type selection per player
  - Game mode selection (start/load/wait)
  - Auto-play toggle
  - Repetition count setting
- **Session Control**:
  - Start/stop sessions
  - Live status indicators
  - Graceful shutdown with Ctrl+A simulation
  - Progress tracking for repetitions

### 2. Telemetry Dashboard
- **Database Selection**:
  - Browse and select from previously stored telemetry database files
  - Upload/import telemetry database files
  - Real-time mode: Direct connection to active SQLiteSpanExporter
  - Historical mode: Load and analyze past sessions
- **SQLite Span Explorer**:
  - SVAR DataGrid for span display
  - Hierarchical trace view
  - Filter by service, operation, time range
  - Auto-refresh with SSE updates in real-time mode
  - Performance metrics aggregation
  - Session comparison tools

### 3. Real-time Log Viewer
- **Log Streaming**:
  - Tail vox-agents logs in real-time
  - Log level filtering (debug/info/warn/error)
  - Search/grep functionality
  - Component filtering
  - Future: bridge-service and mcp-server logs

### 4. Version Management
- **Update Checker**:
  - Display current version from package.json
  - Check GitHub releases API
  - Show update notification badge
  - One-click update trigger (future)

## UI Design

### Color Palette (Civ5-inspired)
```css
:root {
  --civ-gold: #D4AF37;        /* Primary accent */
  --civ-bronze: #8B6914;      /* Secondary accent */
  --civ-dark-blue: #1A2332;   /* Background */
  --civ-medium-blue: #2C3E50; /* Panels */
  --civ-light-blue: #34495E;  /* Hover states */
  --civ-cream: #F5E6D3;       /* Text primary */
  --civ-gray: #7F8C8D;        /* Text secondary */
  --civ-green: #27AE60;       /* Success */
  --civ-red: #C0392B;         /* Error */
}
```

### Layout Components
- **Sidebar Navigation** (collapsible):
  - Logo/title
  - Mode list (Strategist, future modes)
  - Version display
  - Update badge
- **Main Content Area**:
  - Tab-based or route-based navigation
  - Responsive grid layouts
  - Card-based information panels

## Implementation Steps

### Phase 1: Refactoring Existing Code (Priority)
1. **Extract Shared Services**:
   - Move StrategistSession core logic to `src/services/session-manager.ts`
   - Create `src/services/config-manager.ts` for config CRUD operations
   - Extract config validation to config-manager
   - Keep session lifecycle management independent of CLI
2. **Refactor strategist/index.ts**:
   - Import and use shared services
   - Keep only CLI-specific logic (readline, keyboard handling)
   - Add support for `--web` flag to start in headless mode
   - Maintain backward compatibility
3. **Prepare for Web Integration**:
   - Create programmatic session control API
   - Add event emitters for session state changes
   - Implement proper cleanup and resource management
   - Ensure thread-safe session management

### Phase 2: Web Backend Infrastructure
1. Create web server entry point in `src/web/index.ts`
2. Setup Express server with TypeScript
3. **Additional Services**:
   - `src/services/session-controller.ts`: Web wrapper for session-manager
   - `src/services/telemetry-reader.ts`: Read from SQLite files or active exporter
   - `src/services/log-watcher.ts`: Monitor log files with tail functionality
4. **API Layer** (`src/api/`):
   - REST endpoints for config, session, telemetry
   - SSE endpoints for real-time streaming
   - File upload endpoint for telemetry databases
   - Mount routes in Express server

### Phase 3: Frontend Setup
1. Create `ui/` directory with SvelteKit
2. Configure Vite for local bundling (no CDN deps)
3. Setup Tailwind with Civ5 color palette
4. Install SVAR Svelte components

### Phase 4: Frontend Implementation
1. **Layout & Navigation**:
   - Sidebar with mode selection
   - Version display and update checker
   - Responsive collapsible menu
2. **Strategist Mode**:
   - Config editor with live validation
   - Player selection grid
   - Session control panel
   - Progress indicators
3. **Telemetry Dashboard**:
   - Database file selector/uploader
   - Real-time/historical mode toggle
   - SVAR DataGrid for span data
   - Trace hierarchy viewer
   - Performance metrics charts
4. **Log Viewer**:
   - Virtual scrolling log display
   - Log level filtering
   - Search functionality
   - Clear/export options

### Phase 5: Integration & Launch
1. **Update package.json scripts**:
   - Add web server scripts
   - Modify existing scripts to support web mode
2. **Update vox-deorum.cmd**:
   - Detect no parameters → launch web UI
   - Parameters present → start web server without popup + execute mode
   - Add web server to service startup sequence
3. **Integration Testing**:
   - Test CLI mode still works
   - Verify web control of sessions
   - Test SSE streaming reliability
   - Validate telemetry database switching

### Phase 6: Polish & Documentation
1. Error handling and loading states
2. Responsive design breakpoints
3. Keyboard shortcuts
4. User documentation
5. Basic E2E tests

## API Endpoints

### Configuration Management
- `GET /api/config/list` - List available configs
- `GET /api/config/:name` - Get config content
- `POST /api/config/:name` - Save config
- `DELETE /api/config/:name` - Delete config

### Session Management
- `GET /api/session/status` - Get current session status
- `POST /api/session/start` - Start new session
- `POST /api/session/stop` - Stop current session
- `GET /api/session/progress` - Get repetition progress

### Telemetry
- `GET /api/telemetry/databases` - List available database files
- `POST /api/telemetry/upload` - Upload telemetry database file
- `GET /api/telemetry/spans` - Get spans with pagination (query param: db file)
- `GET /api/telemetry/traces/:traceId` - Get full trace (query param: db file)
- `SSE /api/telemetry/stream` - Real-time span updates from active exporter

### Logs
- `GET /api/logs/tail` - Get last N lines
- `SSE /api/logs/stream` - Real-time log streaming

### System
- `GET /api/version` - Get current version
- `GET /api/version/check` - Check for updates

## SSE Event Streams

### Event Types
- **Log Events** (`/api/logs/vox-agents/stream`):
  - `log` - New log entry
  - `clear` - Log cleared signal

- **Telemetry Events** (`/api/telemetry/stream`):
  - `span` - New span data
  - `trace` - Complete trace update

## Build Configuration

### Vite Config (Local Bundling)
```js
// All dependencies bundled locally
// No external CDN references
// Service worker for offline capability
```

### Package Scripts
```json
{
  "scripts": {
    "dev": "concurrently \"npm:dev:*\"",
    "dev:web": "tsx watch src/web/index.ts",
    "dev:ui": "cd ui && vite dev",
    "build": "npm run build:src && npm run build:ui",
    "build:ui": "cd ui && vite build",
    "build:src": "tsc",
    "web": "node dist/web/index.js",
    "strategist": "node --import ./dist/instrumentation.js dist/strategist/index.js",
    "strategist:web": "node --import ./dist/instrumentation.js dist/strategist/index.js --web"
  }
}
```

## Security Considerations
- Local-only binding (127.0.0.1)
- No authentication (local use only)
- Input validation for config files
- Safe path handling for file operations
- Rate limiting on API endpoints

## Future Enhancements
- Bridge-service and mcp-server log integration
- Performance profiling tools
- Export telemetry reports
- Internationalization support