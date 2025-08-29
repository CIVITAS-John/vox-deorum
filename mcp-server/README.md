# MCP Server

A Model Context Protocol server that exposes Civilization V game state as structured resources and tools for AI agents. Each server serves a single game session and connects with a single bridge service/MCP client. 

## Overview

The MCP Server connects AI agents to live game data through a standardized protocol:
- **Resources**: Game state as queryable MCP resources
- **Tools**: Analysis capabilities for strategic decisions  
- **Events**: Real-time game updates from Bridge Service

## Technology Stack

- **Runtime**: Node.js + TypeScript
- **Protocol**: Model Context Protocol (MCP)
- **SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **Test**: Vitest
- **Transport**: stdio, Streamable HTTP
- **Communication**: Bridge Service HTTP client

## Architecture

### Layers

1. **Protocol/Transport Layer**
  - Leverages official TypeScript MCP SDK for protocol implementation
  - Handles MCP communication (stdio, stateless Streamable HTTP) via SDK
  - Manages resource/tool registration and discovery
  - Handles request/response routing and notifications

2. **Bridge Service Integration**: Stateless manager for Bridge Service communication
  - Calls Lua functions via REST API
  - Receives game events via SSE stream
  - Manages external function registration with Bridge Service
  - Handles connection lifecycle and retry logic
    - Turn changes, combat results, diplomatic events

3. **Data Layer**: Manages AI players' game knowledge with serialization support
  - **Knowledge Store**: Tracks what each AI player knows with serialization/deserialization
    - Personal knowledge: AI's short/long-term memories (e.g. plans)
    - Persistent knowledge: Records of in-game events (e.g. declaration of war)
    - Transient knowledge: Transient cache of in-game states (expiration by turn numbers)
    - Game context switching: Reset/reload for different game sessions
  - **Knowledge Retriever**: Retrieves game state as resources/other purposes
  - **Event Processing**: Processes in-game events for knowledge updates and notifications
    - Record keeping: Some events should be kept as record knowledge (e.g. declaration of war)
    - Notifying clients: Some events should be sent as MCP notifications to clients (e.g. player turn started)

4. **Service Layer**
  - **Resource Providers**: Expose game state as queryable MCP resources
    - Units, cities, technologies, diplomacy, records, etc.
  - **Tool Providers**: Analysis and decision-making capabilities
    - Short/long-term memories, analysis tools, and actions (i.e. changing in-game AI's preference)

### Design Principles
- **Modular**: Each resource/tool/etc exists independently
- **Flexible Transport**: Support multiple MCP transport methods
- **Event-Driven**: Both the MCP client and the game can initiate actions
- **Multi-Player**: Serves multiple LLM-enhanced AI players and keeps track of their knowledge separately (to avoid AI players knowing things they shouldn't)
- **Stateless Resources**: Resources are computed on-demand from cached state
- **Idempotent Tools**: Tool operations can be safely retried

## Communication Flow

### High-Level Flow
```
MCP Client ←→ MCP Server ←→ Bridge Service ←→ Civilization V
       (Streamable HTTP/stdio)        (HTTP/SSE)
```

### Detailed Communication Patterns

#### 1. Resource Query (MCP Client → Game)
```
1. MCP Client → resources/list → MCP Server
2. MCP Server returns available resources
3. MCP Client → resources/read → MCP Server  
4. MCP Server → POST /lua/call → Bridge Service
5. Bridge Service → Named Pipe → DLL → Lua
6. Lua result → DLL → Bridge Service → MCP Server
7. MCP Server formats and returns resource to MCP Client
```

#### 2. Tool Execution (MCP Client → Game Action)
```
1. MCP Client → tools/call → MCP Server
2. MCP Server executes tool logic
3. If game action needed:
   - MCP Server → POST /lua/call → Bridge Service
   - Bridge Service → DLL → Lua execution
4. Tool result → MCP Client
```

#### 3. Game Events (Game → MCP Client)
```
1. Lua event → DLL → Bridge Service
2. Bridge Service → SSE event → MCP Server
3. MCP Server processes event, updates state
4. MCP Server → notification → MCP Client
5. MCP Client receives real-time game update
```

#### 4. External Function Call (Game → MCP Server)
```
1. MCP Server registers function with Bridge Service
2. Lua calls Game.CallExternal()
3. DLL → Bridge Service → POST to MCP Server endpoint
4. MCP Server processes, returns result
5. Result → Bridge Service → DLL → Lua callback
```

The server translates between MCP protocol and Bridge Service APIs, providing AI agents with structured access to live game data.

## Implementation Plan

See [docs/stages.md](docs/stages.md) for detailed implementation stages from project setup through full MCP integration.

## Getting Started

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Run tests
npm test
```

The server will expose MCP resources and tools for MCP client integration.
