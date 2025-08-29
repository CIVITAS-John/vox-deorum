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

### Design Principles
- **Modular**: Each resource/tool/etc exists independently
- **Flexible Transport**: Support multiple MCP transport methods
- **Event-Driven**: Both the MCP client and the game can initiate actions
- **Multi-Player**: Serves multiple LLM-enhanced AI players and keeps track of their knowledge separately (to avoid AI players knowing things they shouldn't)

## Communication Flow

```
MCP Client ←→ MCP Server ←→ Bridge Service ←→ Civilization V
       (Streamable HTTP/stdio)        (HTTP/SSE)
```

The server translates between MCP protocol and Bridge Service APIs, providing AI agents with structured access to live game data.

## Getting Started

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Run tests
npm test
```

The server will expose MCP resources and tools via stdio for local MCP client integration.
