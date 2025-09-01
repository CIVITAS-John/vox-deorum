# MCP Server

A Model Context Protocol server that exposes Civilization V game state as structured resources and tools for AI agents. Each server serves a single game session and connects with a single bridge service/MCP client. 

## Overview

The MCP Server connects AI agents to live game data through a standardized protocol:
- **Tools**: Both game state queries and action capabilities (unified as ToolBase)
- **Events**: Real-time game updates from Bridge Service via SSE
- **Database Access**: Direct access to Civ 5 game rules and localized text
- **Bridge Integration**: Lua script execution and function calls

## Technology Stack

- **Runtime**: Node.js >=20.0.0 + TypeScript (ESM modules)
- **Protocol**: Model Context Protocol (MCP) via official TypeScript SDK
- **SDK**: @modelcontextprotocol/sdk
- **Testing**: Vitest with coverage reporting
- **Transport**: stdio (direct), HTTP with SSE (Express server)
- **Bridge Communication**: REST API client + SSE event stream
- **Database**: Better-SQLite3 + Kysely ORM for Civ 5 databases
- **Logging**: Winston with module contexts

## Architecture

### Core Components (Implemented)

1. **MCP Server Core** (`src/server.ts`)
  - MCPServer singleton managing server lifecycle
  - Tool registration and discovery system
  - Integration with BridgeManager and DatabaseManager
  - Multi-transport support (stdio/HTTP)

2. **Transport Layer**
  - **Stdio Transport** (`src/stdio.ts`): Direct client connections
  - **HTTP Transport** (`src/http.ts`): Express server with SSE support
  - Config-based transport selection via entry point

3. **Bridge Service Integration** (`src/bridge/`)
  - **BridgeManager**: Central communication hub
    - Health checking for Bridge Service and DLL status
    - Lua script execution and function calls
    - SSE connection with auto-reconnection
    - Event emitter for game events
  - **LuaFunction**: Encapsulated Lua function definitions

4. **Database Integration** (`src/database/`)
  - **DatabaseManager**: Kysely-based database access
    - Readonly connections to Civ 5 SQLite databases
    - Automatic localization of TXT_KEY_* strings
    - Batch localization for query results
    - Type-safe queries with generated types

5. **Tool System** (`src/tools/`)
  - **ToolBase**: Abstract base class with Zod validation
  - **Calculator**: Example arithmetic tool
  - **LuaExecutor**: Execute Lua scripts via Bridge Service
  - Self-registration pattern with server

### Planned Components (Not Yet Implemented)

1. **Data Layer**: AI player knowledge management
  - Personal, persistent, and transient knowledge stores
  - Game context switching for different sessions
  - Event-driven knowledge updates

2. **Additional Tools**: Game-specific capabilities
  - Unit management, city operations
  - Technology research, diplomacy actions
  - Strategic analysis and planning tools

### Design Principles
- **Unified Tool Architecture**: Resources and tools share the same ToolBase infrastructure
- **Flexible Transport**: Support both stdio and HTTP/SSE transports
- **Event-Driven**: Real-time game events via SSE stream
- **Type-Safe**: Zod validation for tools, Kysely types for database
- **Singleton Pattern**: Single instances of Server, Bridge, and Database managers
- **Idempotent Operations**: Safe retry logic for all operations

## Communication Flow

### High-Level Flow
```
MCP Client ←→ MCP Server ←→ Bridge Service ←→ Civilization V
       (Streamable HTTP/stdio)        (HTTP/SSE)
```

### Detailed Communication Patterns

#### 1. Tool Execution (MCP Client → Game Action)
```
1. MCP Client → tools/call → MCP Server
2. MCP Server validates input with Zod schema
3. Tool implementation executes:
   - Direct database queries via DatabaseManager
   - Lua execution via BridgeManager.executeLuaScript()
   - Function calls via BridgeManager.callLuaFunction()
4. Tool result with localized text → MCP Client
```

#### 2. Game Events (Game → MCP Server)
```
1. Game event → DLL → Bridge Service
2. Bridge Service → SSE stream → MCP Server
3. BridgeManager emits 'gameEvent' with payload
4. Event handlers process and update state
5. MCP Server → notification → MCP Client (if configured)
```

#### 3. Database Access Pattern
```
1. Tool requests game data
2. DatabaseManager.getDatabase() returns Kysely instance
3. Type-safe query built with Kysely query builder
4. Results fetched from Civ5DebugDatabase.db
5. DatabaseManager.localizeObject() translates TXT_KEY_* strings
6. Localized results returned to tool
```

#### 4. SSE Connection Management
```
1. Server startup → BridgeManager.connectToEventStream()
2. SSE connection established to Bridge Service /events
3. Automatic reconnection on disconnect (5-second delay)
4. Events parsed and emitted via EventEmitter
5. Connection status tracked ('connected'/'disconnected' events)
```

## Getting Started

### Prerequisites
1. Node.js >=20.0.0
2. Civilization V with Community Patch installed
3. Bridge Service running
4. Game databases in Documents folder

### Installation
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Development mode with hot reload
npm run dev

# Run tests
npm test

# Test with coverage
npm run test:coverage
```
