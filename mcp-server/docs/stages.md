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

### Stage 3: Game Database Integration
- Game's main database exists at %Document$\My Games\Sid Meier's Civilization 5\cache\Civ5DebugDatabase.db, in SQLite format
- Game's localization database exists at %Document$\My Games\Sid Meier's Civilization 5\cache\Localization-Merged.db
- Create a manager instance (attached to Server) named `DatabaseManager` responsible for querying it
- Throw an error if cannot find or open the database (in read-only mode, don't lock it)
- Should handle raw SQL query in the main database and return structured JSON data (Record<string, any>)
  - Should automatically convert Localization text into the corresponding localized text. Should set up a configuration item about the game text language.
- For localization, just one feature: GetLocalization(Key): string
  - Schema: CREATE TABLE LocalizedText("Language" TEXT,
						   "Tag" TEXT,
						   "Text" TEXT,						
						   "Gender" TEXT,
						   "Plurality" TEXT,
						   PRIMARY KEY(Language, Tag))
- Create a number of example util functions to extract structured information about game database.
  - Each group of util functions in its own file (e.g. `src/database/technology.ts`)
  - Each function should support the return of the full or a custom Zod schema that keeps the most core information (both generate from the SQLite schema from database/json/*.json)
  - Create one first as the template; don't create more than that.

### Stage 4: Knowledge Management
Develop the AI player knowledge management system with serialization/deserialization capabilities and reset functionality for game context switching (loading different games). 
- A manager instance (attached to Server) named `KnowledgeManager`
  - The manager monitors: SSE connection/reconnection/DLL connection status events to check if the connected game instance is the same or not
  - The manager saves & loads KnowledgeStore based on the game's unique ID
    - Execute lua scripts to get/set the ID using the Civ 5 modding system's capabilities
```
local saveDB = Modding.OpenSaveData()
-- Create a table
for row in saveDB:Query('CREATE TABLE MyTest("ID" NOT NULL PRIMARY KEY, "A" INTEGER, "B" TEXT)') do end
-- Insert something
for row in saveDB:Query('INSERT INTO MyTest("ID","A","B") VALUES(1,2,"three")') do end
-- Retrieve everything
for row in saveDB:Query("SELECT * FROM MyTest") do 
  print(row.ID, row.A, row.B)
end
```
    - Also, keep track of the synchronization status by constantly saving a "last update timestamp" also using the OpenSaveData() - try to merge the two features into one
- A knowledge store instance named `KnowledgeStore`

### Stage 5: Per-Player Knowledge Store
Implement Knowledge Store for tracking different types of AI knowledge (personal, persistent, transient) for individual players, ensuring proper isolation between AI players.

### Stage 6: MCP Notifications & Client Communication
Complete the event processing pipeline by implementing MCP notifications to connected clients based on processed game events. This includes intelligent notification routing based on AI player relevance, current game context, and client subscription preferences. The system should filter and format notifications appropriately for different types of AI agents and strategic contexts.

### Stage 7: More Resource/Tool Providers
Implement MCP tools for AI decision-making capabilities including memory management (short/long-term), strategic analysis tools, and preference modification actions. Tools should be idempotent, support retry operations, and integrate with the AI knowledge system to provide contextual analysis. This includes both read-only analysis tools and write operations that affect AI behavior in-game through the external function infrastructure.

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