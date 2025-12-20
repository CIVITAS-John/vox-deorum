# Vox Agents Web UI - Implementation Plan & Status

## Overview
A streamlined web interface for Vox Agents providing telemetry analysis, log viewing, session control, configuration management, and an interactive agent chat system.

## Current Status: 85% Complete (6/7 stages)
- ✅ **Backend**: 100% complete (all API routes implemented)
- 🔄 **Frontend**: 86% complete (SessionView is placeholder only)
- ✅ **Production-ready**: Telemetry, Logs, Config, and Chat features

## Technology Stack
- **Frontend**: Vue 3 + TypeScript + Vite + PrimeVue 4
- **Backend**: Express.js (shared process with vox-agents)
- **Real-time**: Server-Sent Events (SSE) for streaming
- **Database**: SQLite with Kysely ORM
- **Styling**: Primeflex CSS with shared component styles

## Implementation Status

### ✅ Stage 1-2: Foundation (COMPLETE)
- Express server with API routes and static serving
- SSE manager with heartbeat (30s intervals)
- Vue 3 app with routing and PrimeVue components
- API client with typed endpoints
- Health monitoring and log streaming

### ✅ Stage 3: Log Viewer (COMPLETE)
- Real-time log streaming via SSE
- Virtual scrolling with Virtua library
- Multi-source and level-based filtering
- Auto-scroll with manual override
- Connection status indicators

### ✅ Stage 4: Telemetry Viewer (COMPLETE)
- Database discovery and file upload (100MB limit)
- Active telemetry sessions with real-time span streaming
- Historical trace browsing with search
- Span hierarchy visualization
- AI message viewer for LLM interactions
- Virtual scrolling for performance

### ✅ Stage 5: Configuration Management (COMPLETE)
- API key management with password inputs
- Agent-model mappings configuration
- Model definitions with auto-generated IDs
- Full config.json and .env file management
- Save/reload with validation

### ✅ Stage 6: Agent Chat (COMPLETE)
- Multiple agent support with tags
- Session creation with live context or database
- Real-time message streaming via SSE
- Tool call visualization
- Message type rendering (text, reasoning, tool calls/results)
- Virtual scrolling message list

### 🔄 Stage 7: Session Control (BACKEND COMPLETE, FRONTEND PENDING)
**Backend Implemented**:
- GET `/api/session/status` - Current session state
- GET `/api/session/configs` - List available configs
- POST `/api/session/start` - Start new game session
- POST `/api/session/save` - Save configuration
- DELETE `/api/session/config/:filename` - Delete config
- POST `/api/session/stop` - Stop session gracefully

**Frontend Needed** (SessionView.vue is placeholder):
- Session status card with state indicators
- Config file selector and editor
- Start/Stop controls
- Turn progress display
- Error handling UI

## Directory Structure

```
vox-agents/
├── src/web/                    # Backend implementation
│   ├── server.ts              # Express server setup
│   ├── sse-manager.ts         # SSE client management
│   └── routes/                # API endpoints
│       ├── telemetry.ts       # 8 endpoints
│       ├── config.ts          # 2 endpoints
│       ├── agent.ts           # 6 endpoints
│       └── session.ts         # 6 endpoints
├── ui/                        # Frontend application
│   ├── src/
│   │   ├── views/            # Page components (7 complete, 1 placeholder)
│   │   ├── components/       # Reusable components (16 complete)
│   │   ├── stores/           # Pinia state management
│   │   ├── api/              # API client and utilities
│   │   ├── composables/      # Shared logic
│   │   └── styles/           # Global CSS
│   └── [vite.config.ts, package.json]
└── dist-ui/                   # Production build output
```

## API Endpoints (23 implemented, 1 missing)

### Core
- ✅ GET `/api/health` - Server health status
- ✅ SSE `/api/logs/stream` - Real-time log streaming

### Telemetry (8 endpoints)
- ✅ GET `/api/telemetry/databases` - List discovered databases
- ✅ POST `/api/telemetry/upload` - Upload database file
- ✅ GET `/api/telemetry/sessions/active` - Active telemetry sessions
- ✅ GET/SSE `/api/telemetry/sessions/:id/*` - Session spans and streaming
- ✅ GET `/api/telemetry/db/:filename/*` - Database traces and spans

### Configuration (2 endpoints)
- ✅ GET `/api/config` - Get current configuration
- ✅ POST `/api/config` - Update configuration (full replacement)

### Agent Chat (6 endpoints)
- ✅ GET `/api/agents` - List available agents
- ✅ POST `/api/agents/session` - Create chat session
- ✅ GET `/api/agents/sessions` - List all sessions
- ✅ GET `/api/agents/session/:id` - Get session details
- ✅ POST `/api/agents/chat` - Send message (SSE response)
- ✅ DELETE `/api/agents/session/:id` - Delete session

### Session Control (6 implemented, 1 missing)
- ✅ GET `/api/session/status` - Current session state
- ✅ GET `/api/session/configs` - Available config files
- ✅ POST `/api/session/start` - Start game session
- ✅ POST `/api/session/save` - Save configuration
- ✅ DELETE `/api/session/config/:filename` - Delete config
- ✅ POST `/api/session/stop` - Stop session

## Critical Path to 100% Completion

### 1. Implement SessionView.vue (4-6 hours)
```vue
<!-- Required components -->
- Session status card (state, config, start time)
- Config selector dropdown (use existing API)
- Start/Stop buttons with loading states
- Config editor (similar to ConfigView)
- Error display with recovery options
```

### 2. Add SSE Session Events [Optional] (2-3 hours)
- Backend: Implement `/api/session/events` endpoint
- Emit events from StrategistSession during turns
- Frontend: Connect SSE in SessionView

### 3. Update Documentation (1 hour)
- Remove outdated planning sections
- Update status indicators
- Add user guide

## Code Quality Highlights

### Strengths
- **Type Safety**: Full TypeScript with shared types
- **Architecture**: Clean separation of concerns
- **Performance**: Virtual scrolling, SSE streaming
- **Error Handling**: Comprehensive with user feedback
- **Styling**: Consistent PrimeVue theme usage

## Notes

- WebUI runs in shared process with vox-agents
- All logs automatically stream to connected clients
- Chat sessions lost on restart (in-memory storage)
- Frontend filters logs/telemetry client-side for performance
- Virtual scrolling limits: 1000 logs, 100 spans