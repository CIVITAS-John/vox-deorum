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
- Maintains registries for resources and tools
- Provides registration methods for self-registering components
- Sets up capabilities based on registered handlers

### 2. Multi-Transport Support
Then, for each transport mode, create a separate entry file that sets up the instance:
- **Stdio Transport** (`src/stdio.ts`): Default mode for direct client connections
- **HTTP Transport** (`src/http.ts`): Express server with SSE support and CORS
The `src/index.ts` reads existing config from `src/utils/config.ts` and forward to either mode
Graceful shutdown handling for both transport types

### 3. Base Classes Architecture
#### ResourceBase (`src/resources/base.ts`)
Abstract base class for all resources:
- Handles self-registration with the server
- Manages resource metadata (URI, name, description, mimeType)
- Provides hooks for lifecycle events (onRegistered, onRead, onSubscribed)
- Built-in support for player-specific context handling
- Error handling and validation framework
- Abstract methods: `read()`, `getMetadata()`

#### ToolBase (`src/tools/base.ts`)
Abstract base class for all tools:
- Handles self-registration with the server
- Manages tool metadata (name, description, input schema)
- Provides hooks for lifecycle events (onRegistered, onExecute)
- Built-in support for player-specific execution contexts
- Schema validation with Zod and JSON schema conversion
- Abstract methods: `execute()`, `getSchema()`

### 4. Registration System
Central registration (`src/server.ts`).
- Resources and tools self-register during initialization
- Server maintains internal registries
- Automatic capability detection based on registered resources/tools
- Support for dynamic registration/unregistration

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
- Self-registration verification

**Component Tests**: Isolated testing of individual components:
- Base classes: ResourceBase and ToolBase functionality
- Resource implementations: Mock data validation, URI handling, context support
- Tool implementations: Schema validation, execution logic, context handling
- Registration system: Auto-registration, capability detection
- Configuration: Environment variable parsing, schema validation

**Unit Tests**: Base class behavior:
- Lifecycle hooks (onRegistered, onRead, onExecute)
- Metadata management and validation
- Context handling for player-specific operations
- Error propagation and handling

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
- **Base Class Architecture**: ResourceBase and ToolBase provide common infrastructure for Bridge Service integration
- **Context-Aware Handlers**: Built-in support for player-specific operations ready for multi-player game state
- **Self-Registration Pattern**: Easy to add new Bridge Service resources/tools without modifying core server
- **Lifecycle Hooks**: Ready integration points for Bridge Service connection management
- **Flexible Transport**: Both transports for different deployment scenarios
- **Configuration Framework**: Existing config extended for Bridge Service settings
- **Logging Infrastructure**: Existing winston logger ready for integration debugging
- **Test Patterns**: Established patterns for testing external service interactions

## Summary
Stage 1 creates a functional MCP server using the SDK's built-in capabilities. Instead of reimplementing protocol handling, we focus on creating a thin wrapper that adds logging, configuration, and prepares the structure for Bridge Service integration in Stage 2.