# Stage 1: Core MCP Infrastructure - Implementation Plan

## Overview
Stage 1 establishes a functional MCP server using the TypeScript SDK. The SDK provides most of the protocol handling, transport management, and registration systems. We focus on creating a thin wrapper that adds logging, basic configuration, and prepares for Bridge Service integration in Stage 2.

## Objectives
1. Create a working MCP server using the SDK's built-in Server class
2. Support both stdio and HTTP transports (SDK provides the implementations)
3. Add structured logging for debugging and monitoring
4. Implement basic placeholder resources and tools to verify the system works
5. Prepare extension points for Bridge Service integration

## What the SDK Provides (No Need to Implement)
- **Protocol Handling**: Full MCP protocol implementation
- **Transport Layer**: StdioServerTransport and HTTP transport classes
- **Request/Response Management**: Automatic routing and validation
- **Resource/Tool Registration**: Built-in registration via setRequestHandler
- **Error Handling**: Protocol-compliant error responses
- **Schema Validation**: Using Zod schemas
- **Message Serialization**: JSON-RPC handling

## What We Need to Implement

### 1. Main Server (`src/server.ts`)
**Purpose**: Thin wrapper around SDK's Server class

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create server instance
const server = new Server({
  name: "vox-deorum-mcp",
  version: "1.0.0"
}, {
  capabilities: {
    resources: {},
    tools: {}
  }
});

// Register placeholder resources
// Register placeholder tools
// Set up request handlers
```

### 2. Transport Setup (`src/transport.ts`)
**Purpose**: Initialize transport based on environment

```typescript
// For stdio (default)
const transport = new StdioServerTransport();

// For HTTP (when needed)
// Simple Express setup for Streamable HTTP
```

### 3. Logging (`src/utils/logger.ts`)
**Purpose**: Add winston logging for debugging

```typescript
import winston from 'winston';

// Simple logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
});
```

### 4. Placeholder Resources (`src/resources/`)
**Purpose**: Verify resource system works

#### `src/resources/gameState.ts`
```typescript
// Placeholder resource that returns mock game state
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [{
      uri: "game://state",
      name: "Game State",
      description: "Current game state (placeholder)"
    }]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "game://state") {
    return {
      contents: [{
        uri: "game://state",
        mimeType: "application/json",
        text: JSON.stringify({ turn: 0, players: [] })
      }]
    };
  }
});
```

### 5. Placeholder Tools (`src/tools/`)
**Purpose**: Verify tool system works

#### `src/tools/analysis.ts`
```typescript
// Placeholder tool for game analysis
const AnalyzePositionSchema = z.object({
  playerId: z.number()
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: "analyze_position",
      description: "Analyze current game position (placeholder)",
      inputSchema: zodToJsonSchema(AnalyzePositionSchema)
    }]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "analyze_position") {
    return {
      content: [{
        type: "text",
        text: "Position analysis placeholder"
      }]
    };
  }
});
```

### 6. Main Entry Point (`src/index.ts`)
**Purpose**: Bootstrap the server

```typescript
import { server } from './server.js';
import { setupTransport } from './transport.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    const transport = setupTransport();
    await server.connect(transport);
    logger.info('MCP Server started');
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      await server.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

main();
```

## Testing Strategy

### Integration Tests (`tests/integration/`)
- Test server with actual MCP client connections
- Verify resource listing and reading
- Test tool listing and execution
- Validate transport switching (stdio vs HTTP)

### Unit Tests (`tests/unit/`)
- Test placeholder resources return correct data
- Test placeholder tools execute properly
- Verify logging outputs

## Development Tasks

### Implementation Steps (2-3 days)
1. Create basic server wrapper using SDK
2. Add winston logging
3. Implement placeholder resources (game state)
4. Implement placeholder tools (analyze position)
5. Set up transport initialization
6. Create main entry point
7. Write integration tests
8. Test with MCP inspector or client

## Success Criteria
1. ✅ Server starts and accepts stdio connections
2. ✅ Can list and read placeholder resources
3. ✅ Can list and execute placeholder tools
4. ✅ Logs server events properly
5. ✅ Graceful shutdown handling
6. ✅ Tests pass with good coverage

## Dependencies
- @modelcontextprotocol/sdk - Core MCP protocol (already installed)
- winston - Logging (to be added)
- zod-to-json-schema - Schema conversion (may be needed)

## Migration Path from Stage 0
1. Build on existing hello-world server
2. Keep test infrastructure
3. Extend with resources and tools
4. Add logging layer

## Preparation for Stage 2
- Server structure ready for Bridge Service client
- Logging in place for debugging integration
- Resource/tool patterns established for real implementations
- Transport flexibility for different deployment scenarios

## File Structure
```
mcp-server/
├── src/
│   ├── index.ts           # Main entry point
│   ├── server.ts          # Server setup and registration
│   ├── transport.ts       # Transport initialization
│   ├── resources/
│   │   └── gameState.ts   # Placeholder game state resource
│   ├── tools/
│   │   └── analysis.ts    # Placeholder analysis tool
│   └── utils/
│       └── logger.ts      # Winston logger setup
└── tests/
    └── integration/
        └── server.test.ts # Integration tests
```

## Summary
Stage 1 creates a minimal but functional MCP server using the SDK's built-in capabilities. Instead of reimplementing protocol handling, we focus on creating a thin wrapper that adds logging and prepares the structure for Bridge Service integration in Stage 2. The SDK handles all the complex protocol details, allowing us to focus on our specific use case.