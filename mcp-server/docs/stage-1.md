# Stage 1: Core MCP Infrastructure

## Overview
Build a functional MCP server using the TypeScript SDK. Create a thin wrapper that adds logging, configuration, and prepares for Bridge Service integration.

Read example code first: https://github.com/modelcontextprotocol/typescript-sdk

## Objectives
1. Working MCP server with SDK's built-in Server class
2. Support stdio and HTTP transports 
3. Placeholder resources and tools
4. Extension points for Bridge Service integration

## What We Need to Implement
### 1. Main Server (`src/server.ts`)
Implement the server as a singleton instance abstracted from the transport. 
- Uses SDK's built-in Server class
- Registers all resource and tool handlers
- Sets up capabilities

### 2. Multi-Transport Support
Then, for each transport mode, create a separate entry file that sets up the instance:
- **Stdio Transport** (`src/stdio.ts`): Default mode for direct client connections
- **HTTP Transport** (`src/http.ts`): Express server with SSE support and CORS
The `src/index.ts` reads existing config from `src/utils/config.ts` and forward to either mode
Graceful shutdown handling for both transport types

### 3. Resource Registration System (`src/resources/registry.ts`)
Pluggable resource handler architecture:
- `ResourceHandler` interface for modular resources
- Centralized registration with the MCP server
- Error handling and resource discovery
- Placeholder game state resource returning mock data

### 4. Tool Registration System (`src/tools/registry.ts`)
Pluggable tool handler architecture:
- `ToolHandler` interface for modular tools
- Schema validation with Zod and JSON schema conversion
- Centralized tool execution with error handling
- Placeholder analysis tool with configurable options

## Testing Strategy

### Test Structure
Component-based test organization:

```
tests/
├── integration/          # End-to-end tests with both transports
├── resources/           # Resource tests
├── tools/               # Tool tests
├── test-utils/              # Utility function for tests
```

### Key Test Categories

**Integration Tests**: End-to-end testing with actual MCP clients for both stdio and HTTP transports. Tests include:
- Resource listing and reading
- Tool discovery and execution
- Transport-specific functionality (CORS for HTTP)
- Client-server communication patterns

**Component Tests**: Isolated testing of individual handlers:
- Resource handlers: Mock data validation, URI handling
- Tool handlers: Schema validation, execution logic
- Configuration: Environment variable parsing, schema validation

## Success Criteria
1. ✅ Server starts with both stdio and HTTP transports
2. ✅ Extended configuration supports transport settings
3. ✅ Resources and tools work via both transport modes
4. ✅ HTTP transport handles CORS and multiple clients
5. ✅ Comprehensive test coverage (>90%) across all components
6. ✅ Graceful shutdown for both transport modes
7. ✅ Error handling and validation throughout

## Dependencies

**Core Dependencies**: express, cors, zod-to-json-schema
**Dev Dependencies**: @types/express, @types/cors  
**Already Available**: @modelcontextprotocol/sdk, Vitest, TypeScript, winston (existing logging)

## Usage Examples

**Stdio Transport** (Default):
```bash
node dist/index.js  # Default mode
MCP_TRANSPORT=stdio node dist/index.js  # Explicit
```

**HTTP Transport**:
```bash
MCP_TRANSPORT=http node dist/index.js  # Basic
MCP_TRANSPORT=http MCP_PORT=8080 node dist/index.js  # Custom port
```

## Migration Path from Stage 0
- Extend existing structure with configuration layer
- Preserve Vitest testing infrastructure  
- Add new registration patterns while maintaining SDK compatibility
- Restructure tests to component-based organization

## Preparation for Stage 2
- **Extensible Resource System**: Plugin-based resources ready for Bridge Service data
- **Flexible Transport**: Both transports for different deployment scenarios
- **Configuration Framework**: Existing config extended for Bridge Service settings
- **Logging Infrastructure**: Existing winston logger ready for integration debugging
- **Test Patterns**: Established patterns for testing external service interactions

## Summary
Stage 1 creates a functional MCP server using the SDK's built-in capabilities. Instead of reimplementing protocol handling, we focus on creating a thin wrapper that adds logging, configuration, and prepares the structure for Bridge Service integration in Stage 2.