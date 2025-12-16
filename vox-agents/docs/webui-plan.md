# Vox Agents Web UI - Implementation Status & Plan

## Overview
A streamlined web interface for Vox Agents providing telemetry analysis, log viewing, session control, configuration management, and an interactive agent chat system.

## Current Status
- ✅ **Stage 1-3 Complete**: API foundation, full UI framework, and real-time log viewer fully implemented
- ✅ **Stage 4 Complete**: Telemetry API and UI fully operational with span viewing and trace analysis
- ✅ **Stage 5 Complete**: Configuration management API and UI for settings and API keys
- ✅ **Stage 6 Backend Complete**: Agent chat API with strong typing and SSE streaming
- 🔄 **Stage 6 Frontend & 7 Pending**: Agent chat UI and session control

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
  - config.ts ✅ - Configuration management endpoints
  - session.ts (planned) - Session control endpoints
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

### Stage 4: Telemetry Viewer ✅ COMPLETED
**Status**: Fully Implemented

**Backend Implementation**: ✅ COMPLETED
- ✅ Database discovery with recursive scanning in `telemetry/` directory
- ✅ Parse database filenames (format: `gameid-playerid.db`)
- ✅ Kysely integration for type-safe database queries
- ✅ Active sessions API via `sqliteExporter.getActiveConnections()`
- ✅ Real-time span streaming via SSE with event listeners
- ✅ Trace listing (root spans without parent_span_id)
- ✅ File upload support with multer middleware (100MB limit)
- ✅ All API endpoints implemented in `src/web/routes/telemetry.ts`

**Frontend Implementation**: ✅ COMPLETED
- ✅ Main telemetry page with two sections (Active Sessions & Existing Databases)
- ✅ Active Sessions list showing live telemetry connections
- ✅ Existing Databases grid with parsed game/player info
- ✅ Database upload functionality with drag-and-drop support
- ✅ Active session view with real-time span streaming
- ✅ SpanViewer component with virtual scrolling (1,000 span window)
- ✅ Auto-scroll toggle and connection status indicators
- ✅ Database session view with traces list and pagination
- ✅ Frontend search for traces with real-time filtering
- ✅ Trace detail view with span hierarchy and attributes
- ✅ AI Message viewer component for LLM interactions
- ✅ Dedicated telemetry session view combining traces and spans

**Lessons Learned & Implementation Notes**:
1. **Component Reusability**: Created a shared SpanViewer component that works for both live streaming (active sessions) and static display (trace details)
2. **Virtual Scrolling**: Virtua library proved essential for handling thousands of spans without performance degradation
3. **SSE Event Handling**: Implemented proper event listener cleanup and connection management to prevent memory leaks
4. **Database Access Pattern**: Using Kysely with readonly mode and connection pooling improved query performance significantly
5. **UI/UX Simplification**: Opted for card-based layouts over complex data tables for better readability and mobile responsiveness
6. **AI Message Display**: Created dedicated component for rendering structured LLM messages with proper formatting
7. **State Management**: Pinia stores effectively managed complex state for telemetry data and real-time updates
8. **Error Boundaries**: Added comprehensive error handling for database access failures and SSE disconnections
9. **Performance Optimization**: Implemented pagination, lazy loading, and computed properties for large datasets

### Stage 5: Configuration Management
**Status**: ✅ COMPLETED

**Backend**: Minimal configuration API in `src/web/routes/config.ts`
- GET /api/config - Returns config.json and .env API keys
- POST /api/config - Overwrites entire config.json and .env
- Supports multi-line values (e.g., private keys) with proper escaping

**Frontend**: Full configuration UI in `ConfigView.vue`
- API Keys card with password inputs for common LLM providers
- Agent-Model Mappings for assigning models to agents
- Model Definitions with auto-generated IDs from provider/name
- Save All/Reload functionality with success/error messaging

### Stage 6: Agent Chat
**Status**: ✅ Backend COMPLETED, Frontend Pending

**Overview**: Unified chat interface for interacting with agents - both specialized agents (Diplomat, General) using live context and a Telepathist agent for analyzing past records via telemetry.

**Backend Implementation**: ✅ COMPLETED
- ✅ Enhanced `EnvoyThread` type with `contextType`, `contextId`, and `databasePath` fields
- ✅ Strong type definitions in `src/web/types/agent-api.ts` for all API endpoints
- ✅ Complete API implementation in `src/web/routes/agent.ts`:
  - `GET /api/agents` - Lists all registered agents with tags
  - `POST /api/agents/session` - Creates new chat session with validation
  - `GET /api/agents/sessions` - Returns all sessions as EnvoyThreads
  - `GET /api/agents/session/:id` - Returns specific EnvoyThread
  - `POST /api/agents/chat` - Streaming chat endpoint with SSE
  - `DELETE /api/agents/session/:id` - Removes session
- ✅ Added `tags: string[]` field to VoxAgent base class for filtering
- ✅ Validation for contextId (active telemetry sessions) and databasePath (file existence)
- ✅ In-memory session storage with full EnvoyThread structure
- ✅ SSE integration for streaming responses

**Frontend Implementation**: 🔄 Partially Started
- ✅ Basic `ChatView.vue` component created with session selection UI
- ✅ Integration with active sessions from telemetry store
- ✅ Navigation to session/telemetry views for session discovery
- ✅ Uses `ActiveSessionsList` component for session display
- ⏳ **Still Needed**:
  - Chat interface components (message list, input, streaming display)
  - Integration with new API endpoints
  - Tool call display and formatting
  - Agent selection and filtering by tags

#### Unified Chat API ✅ IMPLEMENTED
All endpoints use strongly-typed interfaces and return `EnvoyThread` objects directly.

**Implemented Endpoints**:
- `GET /api/agents` - List all available agents
  ```typescript
  Response: ListAgentsResponse {
    agents: AgentInfo[] {
      name: string,           // Agent identifier
      description: string,    // Human-readable description
      tags: string[]         // For categorization/filtering
    }
  }
  ```

- `POST /api/agents/session` - Create a new chat session
  ```typescript
  Request: CreateSessionRequest {
    agentName: string,        // Required: agent to use
    contextId?: string,       // Option 1: Active telemetry session ID
    databasePath?: string,    // Option 2: Database file path
    turn?: number            // Optional: Specific turn number
  }
  Response: EnvoyThread     // Full thread object with all fields
  ```

- `GET /api/agents/sessions` - Get all active chat sessions
  ```typescript
  Response: ListSessionsResponse {
    sessions: EnvoyThread[]   // Array of full thread objects
  }
  ```

- `GET /api/agents/session/:sessionId` - Get session details
  ```typescript
  Response: EnvoyThread       // Full thread with message history
  ```

- `POST /api/agents/chat` - Unified streaming chat endpoint
  ```typescript
  Request: ChatRequest {
    agentName?: string,       // Optional: agent name
    sessionId?: string,       // Optional: existing session
    message: string          // Required: user's message
  }
  Response: SSE stream with ChatEventData
  ```

- `DELETE /api/agents/session/:sessionId` - Delete session
  ```typescript
  Response: DeleteSessionResponse {
    success: boolean
  }
  ```

**Implementation Details**:
- All types defined in `src/web/types/agent-api.ts`
- Validates contextId against active telemetry sessions
- Validates databasePath for file existence
- Parses gameId/playerId from contextId or database filename
- Returns full `EnvoyThread` objects, not custom responses
- SSE streaming ready for real-time chat responses

#### Frontend Architecture

**Shared Components to Extract**:
```typescript
// components/shared/
├── ContextSelector.vue
│   // Unified selector for active sessions
│
└── StreamingMessage.vue
    // Renders streaming agent responses with tool calls
```

### Stage 7: Session Control
**Status**: 🔄 Not Started - Placeholder exists

**What's Already Implemented**:
- Basic `SessionView.vue` component created as placeholder
- Route configured in Vue Router

**Backend Requirements Still Needed**:
- Wrapper API around StrategistSession in `src/web/routes/session.ts`
- Session state management
- Progress tracking via SSE
- Graceful shutdown handling

**Frontend Requirements Still Needed**:
- Session status card
- Start/stop controls with config file selection
- Progress indicators for turn processing
- Real-time status updates via SSE
- Integration with existing StrategistSession class

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

### Config Endpoints ✅ IMPLEMENTED
```typescript
GET /api/config                  // Get current configuration
  Response: {
    config: VoxAgentsConfig,     // From config.json
    apiKeys: Record<string, string>  // From .env (API_KEY entries)
  }

POST /api/config                 // Update configuration
  body: {
    config?: Partial<VoxAgentsConfig>,  // REPLACES entire config.json
    apiKeys?: Record<string, string>     // REPLACES entire .env
  }
  Response: { success: boolean }

// Note: POST does full replacement, not merging
// Supports multi-line values (e.g., private keys) with proper escaping
// No reload/validate endpoints - handled by frontend
```

### Session Endpoints
```typescript
GET /api/session/status          // Current session state
POST /api/session/start          // Start with config
POST /api/session/stop           // Graceful shutdown
SSE /api/session/events          // Status updates
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

### Infrastructure Improvements (2024-12-15)
- **ContextRegistry** ✅ - Centralized registry for tracking all active VoxContext instances
  - Automatic registration on creation and unregistration on shutdown
  - Provides global visibility into active contexts
  - Singleton pattern with Map-based storage for O(1) lookups
  - Methods: `register()`, `unregister()`, `get()`, `getAll()`, `shutdownAll()`

- **AgentRegistry Refactor** ✅ - Converted from function-based to class-based architecture
  - Consistent with ContextRegistry design pattern
  - Removed deprecated legacy function exports
  - All code updated to use new class API (`agentRegistry.method()`)
  - Maintains backward compatibility through instance methods

### Next Steps
1. Complete Stage 6 Frontend (Agent Chat UI) to enable interactive agent testing
2. Implement Stage 7 (Session Control) for game session management
3. Integrate ContextRegistry with web UI for context monitoring