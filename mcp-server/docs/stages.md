# MCP Server Implementation Plan

## Executive Summary
This document outlines the implementation strategy for the MCP Server component of Vox Deorum, which exposes Civilization V game state as structured MCP resources and tools for AI agents. The server acts as a translation layer between the Model Context Protocol and the Bridge Service, enabling AI agents to access live game data and perform strategic analysis through standardized interfaces.

## Architecture Overview
The MCP Server establishes a bidirectional communication bridge between AI agents using MCP protocol and the Civilization V game through the Bridge Service. It maintains AI player knowledge states, processes real-time game events, and provides structured access to game data while ensuring proper separation of concerns between different AI players.

## Implementation Stages

### Stage 0: Project Setup & Foundation
Establish the basic Node.js/TypeScript project structure with proper dependencies, tooling, and development workflow. Create a minimal "hello world" MCP server using the TypeScript SDK that can respond to basic protocol messages. Set up the testing infrastructure with Vitest, including test directory structure, configuration files, and sample tests. This stage includes package.json setup, TypeScript configuration, build scripts, and development tooling that follows project conventions.

### Stage 1: Core MCP Infrastructure
Establish the core MCP server infrastructure using the TypeScript SDK with support for multiple transport methods (stdio, Streamable HTTP). This stage focuses on protocol compliance, resource/tool registration systems, and basic request/response handling. The foundation includes proper error handling, logging infrastructure, and configuration management that aligns with the existing project patterns.

### Stage 2: Bridge Service Integration Manager
Implement a manager object that exposes stateless APIs for Bridge Service interaction through HTTP REST API for Lua function calls and Server-Sent Events for real-time game updates. This manager abstracts Bridge Service communication without involving MCP message formats, providing clean interfaces for connection management and timeout logic. The manager handles connection failures gracefully and maintains protocol compliance with PROTOCOL.md specifications.
- It should be named `BridgeManager` which belongs to the MCPServer object.
- It should support raw Lua script calling.
- It should support function registration through a `LuaFunction` object:
  - constructor(name, script)
  - property: Registered (thus, we support lazy registration)
  - execute(args) - registered if not already
    - also, if the execution error is about unregistered function, register and try again automatically!
- BridgeManager should keep track of registered functions and support reset - i.e. setting all LuaFunctions to unregistered (later we will use it; for example, when the game restarted).

### Stage 3: External Function Registration Infrastructure
Implement the bidirectional communication infrastructure for MCP Server to register external functions with the Bridge Service, enabling Lua scripts to call back into AI analysis tools. This creates the foundation for game-initiated AI requests with proper function lifecycle management, parameter marshaling, and response handling following the external function protocol. This infrastructure supports later resource and tool implementations.

### Stage 4: Knowledge Management & Serialization
Develop the AI player knowledge management system with serialization/deserialization capabilities and reset functionality for game context switching (loading different games). Implement Knowledge Retriever for game state access, Knowledge Store for tracking different types of AI knowledge (personal, persistent, transient), and proper data lifecycle management. This layer ensures proper isolation between AI players and handles game session transitions cleanly.
- A manager instance (attached to Server) named `KnowledgeManager`
  - The manager monitors: SSE connection/reconnection/DLL connection status events to check if the connected game instance is the same or not
  - The manager saves & loads individual KnowledgeStore based on the game's unique ID
    - Set up util functions to 
- A knowledge store instance named `KnowledgeStore`

### Stage 5: Resource/Tool Providers
Implement MCP tools for AI decision-making capabilities including memory management (short/long-term), strategic analysis tools, and preference modification actions. Tools should be idempotent, support retry operations, and integrate with the AI knowledge system to provide contextual analysis. This includes both read-only analysis tools and write operations that affect AI behavior in-game through the external function infrastructure.

### Stage 6: MCP Notifications & Client Communication
Complete the event processing pipeline by implementing MCP notifications to connected clients based on processed game events. This includes intelligent notification routing based on AI player relevance, current game context, and client subscription preferences. The system should filter and format notifications appropriately for different types of AI agents and strategic contexts.

## Technical Constraints & Solutions

### Protocol Compliance
- Strict adherence to Model Context Protocol specifications
- Strict adherence to PROTOCOL.md when talking to the Bridge Service
- Proper resource and tool registration patterns
- Correct message formatting and error handling
- Support for multiple transport mechanisms

### Performance Requirements
- Efficient event processing pipeline
- Minimal latency for real-time game updates
- Memory-efficient knowledge storage with proper cleanup

### Multi-Player Support
- Isolated knowledge states per AI player
- Proper authentication and access control
- Context switching between different game sessions
- Clean separation of AI player capabilities and information

## Integration Points
The system integrates with existing Vox Deorum components:
- Bridge Service HTTP API and SSE endpoints
- MCP Client connections via stdio/HTTP transports
- Knowledge persistence for game session management
- External function calls from Civilization V Lua scripts

## Future Considerations
The architecture supports future enhancements without major refactoring:
- Additional resource types for expanded game state access
- Enhanced AI analysis capabilities and strategic tools
- Performance monitoring and metrics collection
- Advanced caching strategies for large game states

## Summary
The implementation provides a robust bridge between AI agents and Civilization V game state through standardized MCP protocol while maintaining clean separation of concerns, proper multi-player support, and efficient real-time event processing. The staged approach ensures incremental validation and testing throughout development.