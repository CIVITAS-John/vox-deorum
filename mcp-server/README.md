# MCP Server

A Model Context Protocol server that exposes Civilization V game state as structured resources and tools for AI agents. Each server serves a single game and connects with a single bridge service.

## Overview

The MCP Server connects AI agents to live game data through a standardized protocol:
- **Resources**: Game state as queryable MCP resources
- **Tools**: Analysis capabilities for strategic decisions  
- **Events**: Real-time game updates from Bridge Service

## Technology Stack

- **Runtime**: Node.js + TypeScript
- **Protocol**: Model Context Protocol (MCP)
- **SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **Transport**: stdio, Streamable HTTP
- **Communication**: Bridge Service HTTP client

## Architecture

### Design Principles
- **Modular**: Plugin-based architecture for new capabilities
- **Flexible Transport**: Support multiple MCP transport methods
- **Event-Driven**: Real-time updates from game events

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
