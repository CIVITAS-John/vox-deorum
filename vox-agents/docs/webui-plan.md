# Vox Agents Web UI - Implementation Status & Plan

## Overview
A streamlined web interface for Vox Agents providing telemetry analysis, log viewing, session control, configuration management, and an interactive agent chat system.

## Current Status
- ✅ **Stage 1-3 Complete**: API foundation, full UI framework, and real-time log viewer fully implemented
- ✅ **Stage 4 Backend Complete**: Telemetry API endpoints fully operational, frontend pending
- 🔄 **Stage 4 Frontend & 5-7 Pending**: Telemetry UI, session control, config management, and agent chat

## Technology Stack
- **Frontend**: Vue 3 with TypeScript (already initialized at `ui/`)
- **Build Tool**: Vite for fast development and optimized production builds
- **Backend**: Express.js integrated into existing TypeScript codebase (shared process)
- **UI Components**: PrimeVue for data tables and UI components
- **Styling**: Tailwind CSS with Civ5-inspired theme or Scoped CSS
- **Database**: SQLite with Kysely ORM for type safety
- **Real-time**: Server-Sent Events (SSE) for streaming
- **Logging**: Winston with log stream handlers (prefixed for separation)

## Architecture

### Current Directory Structure
```
vox-agents/
├── src/
│   ├── web/                  # Web server integration ✅
│   │   ├── server.ts         # Express server with API routes + static serving
│   │   └── sse-manager.ts    # SSE client management with heartbeat
│   ├── utils/
│   │   └── logger.ts         # Modified to stream logs via SSE
│   └── [existing code remains untouched]
├── ui/                        # Vue 3 frontend ✅
│   ├── src/
│   │   ├── App.vue           # Main application with router
│   │   ├── router/           # Vue Router configuration
│   │   ├── views/            # All views created
│   │   │   ├── DashboardView.vue    # Overview dashboard
│   │   │   ├── TelemetryView.vue    # Telemetry viewer (placeholder)
│   │   │   ├── LogsView.vue         # Real-time logs ✅
│   │   │   ├── SessionView.vue      # Session control (placeholder)
│   │   │   ├── ConfigView.vue       # Config management (placeholder)
│   │   │   └── ChatView.vue         # Agent chat interface (placeholder)
│   │   ├── components/
│   │   │   ├── LogViewer.vue        # Log streaming component ✅
│   │   │   └── ParamsList.vue       # Parameter display component ✅
│   │   ├── stores/
│   │   │   ├── health.ts            # Health status store ✅
│   │   │   └── logs.ts              # Log management store ✅
│   │   └── api/
│   │       ├── client.ts             # API client with SSE support ✅
│   │       └── log-utils.ts         # Log formatting utilities ✅
│   └── [vite.config.ts, package.json, etc.]
├── dist-ui/                   # Production build output
│   └── [static files served by Express]
└── package.json

### Implemented & Planned Additions
- src/web/routes/ - Modular API route handlers ✅
  - telemetry.ts ✅ - Complete telemetry API implementation
  - session.ts (planned) - Session control endpoints
  - config.ts (planned) - Configuration management
  - agent.ts (planned) - Agent chat endpoints
- Additional UI components for remaining features (planned)
```

## Core Features Overview

### 1. Telemetry Dashboard
Interface with SQLiteSpanExporter using Kysely ORM for type-safe queries. Auto-discover databases and display span hierarchy with timing waterfall.

### 2. Real-time Log Viewer ✅ IMPLEMENTED
Intercept Winston log streams and route to SSE. Frontend filtering by log level and source with virtual scrolling.

### 3. Session Control
Web wrapper around existing StrategistSession. Start/stop sessions, monitor progress, handle graceful shutdown.

### 4. Configuration Management
Simple JSON file CRUD operations. List/load/save/delete config files with validation.

### 5. Agent Chat Interface
Execute agents with user messages via VoxContext. Stream responses via SSE, display tool calls.

## Completed Implementation

### Stage 1: Minimal API Foundation ✅ COMPLETED
**Backend Only**:
- ✅ Express server setup integrated with vox-agents process
- ✅ Nominal API endpoint (/api/health) for verification
- ✅ Winston logger configuration with SSE streaming integration
- ✅ Basic middleware setup (cors, json, urlencoded)
- ✅ Shared process initialization

**Deliverables**:
- ✅ Working Express server on configurable port (default 5555)
- ✅ Health check endpoint at `/api/health` returning:
  - status, timestamp, service name, version, uptime, client count, port
- ✅ Logger integrated with SSE broadcasting (no separate transport needed)
- ✅ SSEManager class for event streaming with heartbeat
- ✅ Log streaming endpoint at `/api/logs/stream`

**Implementation Details**:
- Created minimal web server architecture:
  - `src/web/server.ts` - Express server with health and log endpoints
  - `src/web/sse-manager.ts` - SSE client management with 30s heartbeat
  - `src/index.ts` - Main entry point for web UI mode
- Integrated Winston logger with SSE:
  - Modified `src/utils/logger.ts` to stream logs via SSE
  - Added `webui` parameter to `createLogger()` for component identification
  - Uses `logger.stream()` to capture all logs and broadcast via SSE
  - No separate transport class needed - direct integration
- Configuration integration:
  - Added `webui` section to VoxAgentsConfig (port, enabled)
  - Server reads from `config.json` via unified config system
  - Port configurable via config or WEBUI_PORT env var
  - Version info from config.versionInfo
- API endpoints implemented:
  - `/api/health` - Returns server status and metrics
  - `/api/logs/stream` - SSE endpoint for real-time log streaming
- Verified functionality:
  - Server starts on configured port with proper logging
  - Health endpoint returns accurate status information
  - SSE connections maintained with periodic heartbeat
  - Logs automatically streamed to connected SSE clients

### Stage 2: Full UI/Server Foundation ✅ COMPLETED
**Backend**:
- ✅ Complete routing structure and middleware
- ✅ Static file serving for Vue production build (dist-ui/)
- ✅ Express configured to serve static files from dist-ui/

**Frontend**:
- ✅ Vue 3 project already initialized at `ui/`
- ✅ Vite configured to build output to `../dist-ui/`
- ✅ PrimeVue v4 installed with data tables and UI components
- ✅ Minimal custom CSS leveraging PrimeVue components
- ✅ Main layout with sidebar navigation using Vue Router

**Deliverables**:
- ✅ Full dev environment with Vite HMR
- ✅ Navigation between all planned views (Dashboard, Logs, Telemetry, Session, Config, Chat)
- ✅ Production build with `npm run build` in ui/ outputs to dist-ui/
- ✅ Static files served from dist-ui/ by Express
- ✅ Minimal, clean UI using PrimeVue components

**Implementation Details**:
- Created comprehensive API client with SSE support (`ui/src/api/client.ts`)
- Built LogViewer component with real-time streaming and filtering
- All views created with placeholders for future phases
- Router configured with all routes
- Added `webui` and `webui:dev` scripts to package.json

### Stage 3: Log Viewer ✅ COMPLETED
**Features Implemented**:
- ✅ LogViewer component with real-time SSE streaming
- ✅ Virtual scrolling using Virtua library for performance
- ✅ Multi-source filtering (vox-agents, webui, etc.)
- ✅ Level-based filtering (debug, info, warn, error)
- ✅ Auto-scroll with manual pause
- ✅ Connection status indicator
- ✅ Clear logs functionality
- ✅ Timestamp formatting and level emoji indicators
- ✅ Parameter display for structured logs

**Technical Details**:
- Uses Virtua VList for efficient virtual scrolling
- Frontend-only filtering reduces server load
- Stores manage log state and SSE connections
- PrimeVue components for UI (Button, Card, Tag, MultiSelect, SelectButton)

## Remaining Implementation Phases

### Stage 4: Telemetry Viewer 🔄 IN PROGRESS
**Status**: Backend Complete, Frontend In Development

**Backend Implementation**: ✅ COMPLETED
- ✅ Database discovery with recursive scanning in `telemetry/` directory
- ✅ Parse database filenames (format: `gameid-playerid.db`)
- ✅ Kysely integration for type-safe database queries
- ✅ Active sessions API via `sqliteExporter.getActiveConnections()`
- ✅ Real-time span streaming via SSE with event listeners
- ✅ Trace listing (root spans without parent_span_id)
- ✅ File upload support with multer middleware (100MB limit)
- ✅ All API endpoints implemented in `src/web/routes/telemetry.ts`

**Frontend Implementation** (In Progress):
- ✅ Main telemetry page with two sections (Active Sessions & Existing Databases)
- ✅ Active Sessions list showing live telemetry connections
- ✅ Existing Databases grid with parsed game/player info
- ✅ Database upload functionality with drag-and-drop support
- ✅ Active session view with real-time span streaming
- ✅ SpanViewer component with virtual scrolling (1,000 span window)
- ✅ Auto-scroll toggle and connection status indicators
- 🔄 Database session view with traces list (In Development)
- 🔄 Frontend search for traces
- 🔄 Trace detail view with span hierarchy

**Frontend Requirements** (Original Plan):
- Main telemetry page with two sections:
  - Active Sessions list (same as LogViewer)
  - Existing Databases list with simple card layout showing folder, game ID, player ID
  - Upload database functionality (stores to `telemetry/uploaded/`)
- Active session view:
  - Fetch initial 100 latest spans on entry
  - Stream incoming spans via SSE
  - Sort by timestamp, maintain rolling window of 1,000 spans
  - Virtual scrolling using Virtua (same as LogViewer)
- Database session view:
  - Simple list of trace cards showing key attributes
  - Frontend search (with a searchbox)
  - Click trace card to enter trace detail view
- Trace detail view:
  - Share the span viewer component (but not rolling)
  - Show all spans sorted by time
  - Expandable spans with overlay panel showing full attributes
  - Parent-child hierarchy visualization

### Stage 5: Session Control
**Status**: 🔄 Not Started

**Backend Requirements**:
- Wrapper API around StrategistSession
- Session state management
- Progress tracking via SSE
- Graceful shutdown handling

**Frontend Requirements**:
- Session status card
- Start/stop controls
- Progress indicators
- Config selector from available files

### Stage 6: Configuration Management
**Status**: 🔄 Not Started (ConfigView.vue has placeholder)

**Backend Requirements**:
- File-based config storage
- CRUD operations for configs
- Schema validation endpoint

**Frontend Requirements**:
- Config list view
- JSON editor with syntax highlighting
- Save/load/delete operations
- Validation feedback

### Stage 7: Agent Chat
**Status**: 🔄 Not Started

**Backend Requirements**:
- Agent registry endpoint
- Chat message handler
- VoxContext/AgentParameters integration (read-only)
- SSE response streaming

**Frontend Requirements**:
- Agent discovery and listing
- Chat interface component
- Message history
- Tool call visualization

## API Design

### Telemetry Endpoints
```typescript
// Main telemetry page
GET /api/telemetry/sessions/active  // List active telemetry sessions
GET /api/telemetry/databases        // List existing databases with parsed info
  Response: {
    databases: [{
      path: string,              // Full path
      folder: string,            // "telemetry" or "uploaded"
      filename: string,          // Database filename
      gameId: string,           // Parsed from filename
      playerId: string,         // Parsed from filename
      size: number,             // File size in bytes
      lastModified: string      // ISO timestamp
    }]
  }
POST /api/telemetry/upload         // Upload database file
  Content-Type: multipart/form-data
  Response: { success: boolean, filename: string }

// Active session view
GET /api/telemetry/sessions/:id/spans  // Get latest 100 spans for active session
  Response: { spans: Span[] }
SSE /api/telemetry/sessions/:id/stream // Stream new spans for active session

// Database session view
GET /api/telemetry/db/:filename/traces // Get all root spans (traces)
  ?limit=100
  &offset=0
  Response: {
    traces: [{
      span_id: string,
      name: string,
      service_name: string,
      start_time: number,
      end_time: number,
      status_code: number,
      attributes: Record<string, any>
    }]
  }

// Trace detail view
GET /api/telemetry/db/:filename/trace/:traceId/spans  // Get all spans in a trace
  Response: { spans: Span[] }  // Sorted by start_time
```

### Log Endpoints
```typescript
SSE /api/logs/stream             // Real-time log stream with all sources
                                 // Frontend handles filtering by source/level
```

### Session Endpoints
```typescript
GET /api/session/status          // Current session state
POST /api/session/start          // Start with config
POST /api/session/stop           // Graceful shutdown
SSE /api/session/events          // Status updates
```

### Config Endpoints
```typescript
GET /api/configs                 // List all configs
GET /api/configs/:name           // Get specific config
POST /api/configs/:name          // Save config
DELETE /api/configs/:name        // Delete config
POST /api/configs/validate       // Validate JSON schema
```

### Agent Endpoints
```typescript
GET /api/agents                  // List registered agents
GET /api/agents/:name            // Agent details with tools
POST /api/agents/:name/chat      // Send message
  body: {
    message: string,
    // Context is read-only, provided by server
  }
SSE /api/agents/:name/stream    // Response stream
```

## UI/UX Design

### Layout
- Fixed sidebar with navigation
- Main content area with page routing
- Status bar showing active session/context
- Responsive breakpoints for mobile

### Telemetry Components (LogViewer-style Implementation)

#### Main Telemetry View
- Two-section layout using PrimeVue Cards:
  - Active Sessions: Simple list of session cards (similar to log entries)
  - Existing Databases: Card grid showing folder, game ID, player ID, size
- Upload button using PrimeVue FileUpload component
- Click handlers for navigation using Vue Router

#### Active Session View (SpanViewer Component)
- Header with session info using PrimeVue Card
- Span list implementation (based on LogViewer pattern):
  - Virtua VList for virtual scrolling
  - Real-time SSE updates appended to array
  - Simple div-based rows with flexbox layout
  - Format: `[timestamp] [service] operation (duration) [status]`
  - Maintains 1,000 span rolling window with array.slice()
  - Auto-scroll toggle using PrimeVue ToggleButton

#### Database Session View (Traces List)
- Simple card list (no DataTable):
  - Each trace as a PrimeVue Card component
  - Shows key attributes in card body
  - Frontend search using computed filtered list
  - Manual pagination with slice() and page controls
- Click card to navigate to trace detail

#### Trace Detail View
- Header card with trace summary
- Reuses SpanViewer component from active session
- Expandable spans using PrimeVue Accordion or custom divs:
  - Basic info always visible
  - Click row to toggle PrimeVue Dialog/Sidebar with full attributes
  - Parent-child indicators using CSS indentation
- No complex timeline - simple list with time sorting

## Development Notes

### File Locations
- **Telemetry databases**: `telemetry/` directory (SQLiteSpanExporter default)
- **Config files**: `configs/` directory (JSON files)
- **Log streams**: In-memory buffers (no file dependency)
- **Web UI build**: `dist-ui/` directory

### Performance Considerations
- Pagination for large span datasets (100 per page)
- Virtual scrolling for log viewer (using Virtua library)
- SSE connection pooling and reconnection with heartbeat
- SQLite connection reuse with readonly mode

## Implementation Guidelines

### Key Principles
1. **Shared process** - Web server runs in same process as vox-agents
2. **Type safety** - Use Kysely ORM for strongly typed database queries
3. **Stream-based logs** - Intercept Winston streams rather than reading files
4. **Incremental delivery** - Each phase produces working functionality
5. **PrimeVue-first approach** - Always use existing PrimeVue components before custom implementations

### Next Steps
Complete Stage 4 frontend (Telemetry Viewer UI) following the established LogViewer patterns, then proceed with Stage 5 (Session Control).