# Vox Agents Web UI - Implementation Plan

## Overview
A streamlined web interface for Vox Agents providing telemetry analysis, log viewing, session control, configuration management, and an interactive agent chat system. The implementation follows a phased approach, delivering working functionality at each stage without modifying existing code.

## Technology Stack
- **Frontend**: SvelteKit 5 with TypeScript
- **Backend**: Express.js integrated into existing TypeScript codebase
- **UI Components**: SVAR Svelte (data grids), shadcn-svelte (modern components)
- **Styling**: Tailwind CSS with Civ5-inspired theme
- **Database**: Direct SQLite access via better-sqlite3 (no ORM needed)
- **Real-time**: Server-Sent Events (SSE) for streaming

## Architecture

### Directory Structure
```
vox-agents/
├── src/
│   ├── web/                  # Web server integration
│   │   ├── server.ts         # Express server with API routes
│   │   ├── routes/           # Modular API route handlers
│   │   │   ├── telemetry.ts  # Telemetry database queries
│   │   │   ├── logs.ts       # Log file streaming
│   │   │   ├── session.ts    # Session lifecycle control
│   │   │   ├── config.ts     # Config file management
│   │   │   └── agents.ts     # Agent chat and discovery
│   │   └── chat-handler.ts   # SSE chat stream handler
│   └── [existing code remains untouched]
├── ui/                        # SvelteKit frontend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── +layout.svelte       # Main navigation shell
│   │   │   ├── +page.svelte         # Dashboard overview
│   │   │   ├── telemetry/+page.svelte
│   │   │   ├── logs/+page.svelte
│   │   │   ├── session/+page.svelte
│   │   │   ├── config/+page.svelte
│   │   │   └── chat/[agent]/+page.svelte
│   │   └── lib/
│   │       ├── api.ts               # API client with SSE
│   │       └── components/
│   │           ├── ChatInterface.svelte
│   │           ├── TelemetryGrid.svelte
│   │           └── LogViewer.svelte
│   └── [build configs]
└── package.json
```

## Core Features & Implementation

### 1. Telemetry Dashboard
**Approach**: Interface directly with SQLiteSpanExporter to access telemetry databases.

**Features**:
- Auto-discover databases in `telemetry/` directory (SQLiteSpanExporter's default)
- List active connections from SQLiteSpanExporter's database map
- Query spans directly using better-sqlite3 (simple schema, no ORM needed)
- Filter by context_id, trace_id, time range, and service name
- Display span hierarchy and timing waterfall

**Implementation**:
```typescript
// Access SQLiteSpanExporter's database directory
import { SQLiteSpanExporter } from '../utils/telemetry/sqlite-exporter.js';

// Get active databases (if exporter is running)
const activeDbs = spanProcessor?.exporter?.databases || new Map();

// List all database files in telemetry directory
const telemetryDir = 'telemetry';
const dbFiles = fs.readdirSync(telemetryDir)
  .filter(f => f.endsWith('.db'))
  .map(f => ({
    path: path.join(telemetryDir, f),
    contextId: path.basename(f, '.db'),
    active: activeDbs.has(contextId)
  }));

// Direct SQLite queries - no ORM needed
const db = new Database(dbPath, { readonly: true });
const spans = db.prepare(`
  SELECT * FROM spans
  WHERE context_id = ?
  ORDER BY start_time DESC
  LIMIT 100
`).all(contextId);
```

### 2. Real-time Log Viewer
**Approach**: Stream log file changes via SSE.

**Features**:
- Tail vox-agents.log with configurable buffer size
- Real-time updates using fs.watch
- Client-side filtering by log level
- Search with highlighting
- Pause/resume streaming

**Implementation**:
```typescript
// Watch log file and stream changes
const logPath = 'vox-agents.log';
const watcher = fs.watch(logPath, (eventType) => {
  if (eventType === 'change') {
    // Read new lines and send via SSE
    const newLines = readNewLines(logPath, lastPosition);
    sseClient.send({ type: 'log', data: newLines });
  }
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
- Read-only AgentParameters context display

**Context Management**:
```typescript
// AgentParameters as read-only context
interface ChatContext {
  // Mirror AgentParameters but read-only in UI
  readonly playerID: number;    // Display current player
  readonly gameID: string;       // Display game ID
  readonly turn: number;         // Display current turn
  readonly running?: string;     // Display which agent is active
}

// Use for agent execution but don't allow UI modification
const context: AgentParameters = {
  playerID: currentGame?.playerID || -1,
  gameID: currentGame?.id || 'test',
  turn: currentGame?.turn || 0,
  running: agent.name
};

// Execute agent with fixed context
const result = await voxContext.executeAgent(
  agent.name,
  context,  // Read-only from UI perspective
  userMessage
);
```

## Implementation Phases

### Phase 1: UI/Server Foundation (3 hours)
**Backend**:
- Express server setup with TypeScript
- Basic routing structure and middleware
- SSE utility functions for streaming
- Static file serving for built UI
- CORS configuration for development

**Frontend**:
- SvelteKit 5 project initialization
- Tailwind CSS with Civ5 theme variables
- Main layout with collapsible sidebar navigation
- API client wrapper with SSE support
- Basic routing for all pages

**Deliverables**:
- Working dev environment with hot reload
- Navigation between all planned pages
- Health check and version endpoints
- Civ5-themed UI shell

### Phase 2: Telemetry Viewer (4 hours)
**Backend**:
- Interface with SQLiteSpanExporter to find databases
- Direct SQLite queries for spans (no ORM)
- Pagination and filtering logic
- Trace reconstruction from spans

**Frontend**:
- Database selector dropdown
- SVAR DataGrid for span display
- Filter controls (time, service, status)
- Span detail modal

**Deliverables**:
- List and select telemetry databases
- View spans with filtering
- Trace hierarchy visualization

### Phase 3: Log Viewer (3 hours)
**Backend**:
- File watcher for log changes
- Tail implementation with buffer
- SSE streaming of new lines
- Log parsing for structured data

**Frontend**:
- Virtual scrolling for performance
- Log level filter buttons
- Search with highlighting
- Auto-scroll toggle

**Deliverables**:
- Real-time log streaming
- Client-side filtering
- Search functionality

### Phase 4: Session Control (3 hours)
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

### Phase 5: Configuration Management (2 hours)
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

### Phase 6: Agent Chat (4 hours)
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
GET /api/logs/tail?lines=100    // Get last N lines
SSE /api/logs/stream            // Real-time log stream
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
1. **Less refactoring** - Try not change existing code structures unless necessary
2. **Direct access** - Interface with SQLiteSpanExporter and better-sqlite3 directly
3. **Simple queries** - Direct SQLite access, no ORM overhead
4. **Incremental delivery** - Each phase produces working functionality

### File Locations
- **Telemetry databases**: `telemetry/` directory (SQLiteSpanExporter default)
- **Config files**: `configs/` directory (JSON files)
- **Log file**: `vox-agents.log` in root directory
- **Web UI build**: `ui/dist/` directory

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