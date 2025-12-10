# Vox Agents Web UI - Implementation Plan

## Overview
A streamlined web interface for Vox Agents providing telemetry analysis, log viewing, session control, configuration management, and an interactive agent chat system. The implementation follows a phased approach, delivering working functionality at each stage without modifying existing code.

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

### Directory Structure
```
vox-agents/
├── src/
│   ├── db/                   # Database utilities (shared across vox-agents)
│   │   ├── kysely.ts         # Kysely instance and types
│   │   ├── telemetry.ts      # Telemetry schema and queries
│   │   └── memory.ts         # Agent memory schema and queries
│   ├── web/                  # Web server integration
│   │   ├── server.ts         # Express server with API routes + static serving
│   │   ├── routes/           # Modular API route handlers
│   │   │   ├── telemetry.ts  # Telemetry database queries
│   │   │   ├── logs.ts       # Log stream handling
│   │   │   ├── session.ts    # Session lifecycle control
│   │   │   ├── config.ts     # Config file management
│   │   │   ├── agents.ts     # Agent chat and discovery
│   │   │   └── memory.ts     # Agent memory retrieval
│   │   ├── chat-handler.ts   # SSE chat stream handler
│   │   └── log-handler.ts    # Winston log stream interceptor
│   └── [existing code remains untouched]
├── ui/                        # Vue 3 frontend (already initialized)
│   ├── src/
│   │   ├── App.vue           # Main application component
│   │   ├── router/
│   │   │   └── index.ts      # Vue Router configuration
│   │   ├── views/
│   │   │   ├── DashboardView.vue    # Overview dashboard
│   │   │   ├── TelemetryView.vue    # Telemetry viewer
│   │   │   ├── LogsView.vue         # Real-time logs
│   │   │   ├── SessionView.vue      # Session control
│   │   │   ├── ConfigView.vue       # Config management
│   │   │   └── ChatView.vue         # Agent chat interface
│   │   ├── components/
│   │   │   ├── ChatInterface.vue    # Chat UI component
│   │   │   ├── TelemetryGrid.vue    # PrimeVue DataTable for telemetry
│   │   │   └── LogViewer.vue        # Log streaming component
│   │   └── api/
│   │       └── client.ts             # API client with SSE support
│   └── [vite.config.ts, package.json, etc.]
├── dist-ui/                   # Production build output
│   └── [static files served by Express]
└── package.json
```

## Core Features & Implementation

### 1. Telemetry Dashboard
**Approach**: Interface with SQLiteSpanExporter using Kysely ORM for type-safe queries.

**Features**:
- Auto-discover databases in `telemetry/` directory (SQLiteSpanExporter's default)
- List active connections from SQLiteSpanExporter's database map
- Query spans using Kysely with strong typing
- Filter by context_id, trace_id, time range, and service name
- Display span hierarchy and timing waterfall

**Implementation**:
```typescript
// Use CamelCasePlugin for automatic conversion
// Define in camelCase, plugin converts to snake_case
interface SpanTableCamelCase {
  id: Generated<number>;
  contextId: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  startTime: number;
  endTime: number;
  serviceName: string;
  attributes: string; // JSON
  status: string;
  events: string; // JSON
}

interface TelemetryDatabase {
  spans: SpanTable; // Use snake_case version by default
}

// Type-safe queries with Kysely
import { Kysely, SqliteDialect, CamelCasePlugin } from 'kysely';
import Database from 'better-sqlite3';

// With CamelCasePlugin (use camelCase in queries, auto-converts)
const dbCamelCase = new Kysely<{ spans: SpanTableCamelCase }>({
  dialect: new SqliteDialect({
    database: new Database(dbPath, { readonly: true })
  }),
  plugins: [new CamelCasePlugin()]
});

const spansCamel = await dbCamelCase
  .selectFrom('spans')
  .selectAll()
  .where('contextId', '=', contextId)
  .orderBy('startTime', 'desc')
  .limit(100)
  .execute();
```

### 2. Real-time Log Viewer
**Approach**: Intercept Winston log streams and route to SSE with prefixed separation.

**Features**:
- Multiple log streams (vox-agents, webui) with prefixes
- Real-time streaming via Winston transport
- Frontend-only filtering by log level and source
- Search with highlighting
- Pause/resume streaming
- No file watching or server-side filtering needed

**Implementation**:
```typescript
// Custom Winston transport for log streaming
import { createLogger, transports, format } from 'winston';
import Transport from 'winston-transport';

class StreamTransport extends Transport {
  constructor(opts: { prefix: string; handler: (log: any) => void }) {
    super(opts);
    this.prefix = opts.prefix;
    this.handler = opts.handler;
  }

  log(info: any, callback: () => void) {
    // Add prefix and forward to SSE handler
    const prefixedLog = {
      ...info,
      source: this.prefix,
      timestamp: new Date().toISOString()
    };
    this.handler(prefixedLog);
    callback();
  }
}

// Configure loggers with stream handlers
const voxLogger = createLogger({
  transports: [
    new StreamTransport({
      prefix: 'vox-agents',
      handler: (log) => sseManager.broadcast('log', log)
    })
  ]
});

const webLogger = createLogger({
  transports: [
    new StreamTransport({
      prefix: 'webui',
      handler: (log) => sseManager.broadcast('log', log)
    })
  ]
});
```

### 3. Session Control
**Approach**: Web wrapper around existing StrategistSession without refactoring.

**Features**:
- Start/stop strategist sessions via API
- Monitor session status and progress
- Handle graceful shutdown
- Display repetition count progress

**Implementation**:
```typescript
// Reuse existing session management
import { StrategistSession } from '../strategist/strategist-session.js';

let currentSession: StrategistSession | null = null;

// API endpoints wrap existing functionality
app.post('/api/session/start', async (req, res) => {
  const config = req.body;
  currentSession = new StrategistSession(config);
  await currentSession.start();
  res.json({ status: 'started' });
});
```

### 4. Configuration Management
**Approach**: Simple JSON file CRUD operations.

**Features**:
- List/load/save/delete config files
- Basic form-based editor
- Validation using existing schemas
- Recent configs tracking

**Implementation**:
```typescript
// Config directory management
const configDir = './configs';

app.get('/api/configs', (req, res) => {
  const configs = fs.readdirSync(configDir)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ name: path.basename(f, '.json'), path: f }));
  res.json(configs);
});
```

### 5. Agent Chat Interface
**Approach**: Execute agents with user messages as input via VoxContext.

**Features**:
- Discover all registered agents dynamically
- Stream responses via SSE
- Display tool calls and reasoning
- Read-only AgentParameters context integration

## Implementation Phases
When implementing, always work on the minimal and wait for human verification to build up - don't overcomplicate things. 

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

### Stage 2: Full UI/Server Foundation (3 hours)
**Backend**:
- Complete routing structure and middleware
- SSE utility functions for streaming
- Static file serving for Vue production build (dist-ui/)
- CORS configuration for development
- Log stream transport setup
- Configure Express to serve static files from dist-ui/

**Frontend**:
- Vue 3 project already initialized at `ui/`
- Configure Vite build output to `../dist-ui/`
- Install and configure PrimeVue for data tables and UI components
- Tailwind CSS with Civ5 theme variables (or scoped CSS)
- Main layout with sidebar navigation using Vue Router
- API client wrapper with SSE support
- Routing setup for all views

**Deliverables**:
- Full dev environment with Vite HMR
- Navigation between all planned views
- Production build with `npm run build` in ui/ outputs to dist-ui/
- Static files served from dist-ui/ by Express
- Log streaming infrastructure
- Civ5-themed UI shell

### Phase 3: Telemetry Viewer (4 hours)
**Backend**:
- Kysely setup for telemetry databases
- Type-safe span queries with filtering
- Pagination and trace reconstruction

**Frontend**:
- Database selector dropdown
- PrimeVue DataTable for span display with virtual scrolling
- Filter controls (time, service, status)
- Span detail modal

**Deliverables**:
- List and select telemetry databases
- View spans with type-safe queries
- Trace hierarchy visualization

### Phase 4: Log Viewer (3 hours)
**Backend**:
- Winston transport integration
- SSE streaming with prefixed logs
- Buffer management for streams

**Frontend**:
- Virtual scrolling for performance
- Source/level filter buttons (frontend-only)
- Search with highlighting
- Auto-scroll toggle

**Deliverables**:
- Real-time log streaming from multiple sources
- Frontend filtering by source and level
- Search functionality

### Phase 5: Session Control (3 hours)
**Backend**:
- Wrapper API around StrategistSession
- Session state management
- Progress tracking
- Graceful shutdown handling

**Frontend**:
- Session status card
- Start/stop controls
- Progress indicators
- Config selector

**Deliverables**:
- Start/stop strategist sessions
- Live progress updates
- Error handling

### Phase 6: Configuration Management (2 hours)
**Backend**:
- File-based config storage
- CRUD operations for configs
- Schema validation endpoint

**Frontend**:
- Config list view
- JSON editor with syntax highlighting
- Save/load/delete operations
- Validation feedback

**Deliverables**:
- Full config CRUD
- Validation UI
- Import/export

### Phase 7: Agent Chat (4 hours)
**Backend**:
- Agent registry endpoint
- Chat message handler
- VoxContext/AgentParameters integration (parameters should be read-only)
- SSE response streaming

**Frontend**:
- Agent discovery and listing
- Chat interface component
- Message history

**Deliverables**:
- Chat with any agent
- Tool call visualization
- Context awareness

## API Design

### Telemetry Endpoints
```typescript
GET /api/telemetry/databases     // List all .db files in telemetry/
GET /api/telemetry/active        // Get active connections from SQLiteSpanExporter
GET /api/telemetry/spans         // Query spans with filters
  ?db=<filename>                 // Which database to query
  &context=<id>                  // Filter by context_id
  &limit=100                     // Pagination
  &offset=0
GET /api/telemetry/trace/:id    // Get all spans for a trace
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

### Civ5 Theme
```css
:root {
  --civ-gold: #D4AF37;
  --civ-bronze: #8B6914;
  --civ-dark: #1A2332;
  --civ-panel: #2C3E50;
  --civ-hover: #34495E;
  --civ-text: #F5E6D3;
  --civ-muted: #7F8C8D;
  --civ-success: #27AE60;
  --civ-error: #C0392B;
}
```

### Layout
- Fixed sidebar with navigation
- Main content area with page routing
- Status bar showing active session/context
- Responsive breakpoints for mobile

## Development Notes

### Key Principles
1. **Shared process** - Web server runs in same process as vox-agents with prefix separation
2. **Type safety** - Use Kysely ORM for strongly typed database queries
3. **Stream-based logs** - Intercept Winston streams rather than reading files
4. **Incremental delivery** - Each phase produces working functionality
5. **Minimal first stage** - Stage 1 only creates a nominal API endpoint

### File Locations
- **Telemetry databases**: `telemetry/` directory (SQLiteSpanExporter default)
- **Config files**: `configs/` directory (JSON files)
- **Log streams**: In-memory buffers (no file dependency)
- **Web UI build**: `dist-ui/` directory

### Testing Approach
- Manual testing during development
- Mock data for UI component development
- Real game session testing for integration
- Graceful handling of missing/empty data

### Performance Considerations
- Pagination for large span datasets (100 per page)
- Virtual scrolling for log viewer (1000 line buffer)
- Debounced search/filter inputs (300ms)
- SSE connection pooling and reconnection
- SQLite connection reuse with readonly mode

## Future Enhancements
- WebSocket upgrade for lower latency
- Span analysis and aggregations
- Multi-agent conversations
- Chat history persistence
- Export capabilities
- Bridge service integration
- MCP server tool visualization
- Agent memory retrieval and visualization
- Memory search and filtering capabilities
- Cross-agent memory correlation