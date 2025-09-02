# Stage 4: Knowledge Management System

## Overview
Build a robust knowledge management system that tracks game state across sessions, detects game context changes, and maintains AI player knowledge with proper persistence using Kysely/Better-SQLite3.

## Core Components

### KnowledgeManager
Central orchestrator for all knowledge-related operations, monitoring game state changes and managing persistence.

**Responsibilities:**
- Monitor SSE and Bridge Service connection events
- Detect game instance changes through unique game IDs
- Automatically save and load knowledge based on game context
- Coordinate between game identification and knowledge storage
- Handle connection failures and recovery gracefully

### Game Identity System
Leverage Civilization V's save data capabilities to maintain unique game identifiers and track synchronization state.

**Key Features:**
- Generate unique game session IDs using Lua's `Modding.OpenSaveData()`
- Store game metadata (player, turn, map seed) for context validation
- Track last synchronization timestamp for data consistency
- Detect when a different game/save is loaded
- Trigger appropriate knowledge operations on context changes

**Lua Integration:**
```lua
-- Game ID management through save data
local saveDB = Modding.OpenSaveData()
-- Store unique game ID and sync timestamp
-- Retrieve and validate on reconnection
```

### KnowledgeStore
Foundation for storing and managing AI player knowledge with SQLite-based persistence.

**Database Schema:**
- Each knowledge item also serves as history - e.g. a city's information at Turn X, Y, Z...
  - Hence, when retrieving knowledge, could be about the history or the latest status
  - Also provides a way to cull knowledge (if loaded to an earlier stage)
- All tables include automatic timestamps (created_at)
- Separate tables for different knowledge types but all inherit from a base class `Knowledge`
  - Preparing for Stage 5, e.g. all knowledge items could have access control per player
- Efficient indexing for quick retrieval
- A key-value table for storing metadata (e.g. game identifier, turn number, last sync timestamp)

## Implementation Flow

### Phase 1: Database Infrastructure Setup
1. Define TypeScript interfaces for database schema
2. Create an example type definition for `GameEvent`.
2. Use JSONColumnType for dynamic/non-fixed items (e.g. the Payload of GameEvent).

### Phase 2: KnowledgeManager Implementation
1. Create KnowledgeManager class attached to MCPServer
2. Implement SSE event monitoring hooks
3. Add Bridge Service connection status tracking
4. Build game change detection logic using Kysely queries

### Phase 3: Game Identity Management
1. Implement Lua script execution for game ID operations
2. Create game session tracking using Kysely table operations
3. Add validation queries for game context changes
4. Build automatic ID generation and retrieval with type-safe queries

### Phase 4: KnowledgeStore Foundation
1. Create KnowledgeStore class with Kysely query builder
2. Implement type-safe CRUD operations with automatic timestamps using <T extends Knowledge>

### Phase 5: Persistence Layer
1. Implement auto-save triggers using Kysely insert/update queries
2. Create load mechanisms with Kysely select builders
3. Add backup and recovery using database snapshots
4. Build cleanup queries for old/stale data with Kysely delete operations

### Phase 6: Integration and Testing
1. Connect all components to MCPServer with Kysely database instance
2. Test game switching scenarios with query validation
3. Verify timestamp consistency through Kysely migrations
4. Validate persistence across restarts with type-safe queries

## Technical Specifications

### Database Connection
- Use Better-SQLite3 for synchronous, reliable operations
- WAL mode for concurrent read access
- Proper connection pooling and lifecycle management
- Location: `data/knowledge.db` (configurable)

### Timestamp Management
- All entries include `created_at` and `updated_at` columns
- Use INTEGER timestamps (Unix milliseconds)
- Automatic triggers for update timestamp maintenance
- Timezone-agnostic storage (UTC)

### Error Handling
- Graceful degradation on database failures
- Automatic retry for transient errors
- Logging of all knowledge operations
- Recovery from corrupted state

## Success Criteria

### Functional Requirements
- ✓ System correctly identifies unique game sessions
- ✓ Knowledge persists across server restarts for same game
- ✓ Clean reset when switching to different game
- ✓ All data entries have accurate timestamps
- ✓ Synchronization tracking prevents data inconsistency

### Performance Requirements
- Database operations complete within 50ms
- Minimal memory footprint for knowledge storage
- Efficient querying for large game states
- Quick context switching between games

### Reliability Requirements
- No data loss on unexpected shutdown
- Automatic recovery from connection failures
- Consistent state across components
- Audit trail for all knowledge changes

## Dependencies
- Better-SQLite3 for database operations
- Existing BridgeManager for Lua execution
- SSE connection monitoring from Stage 2
- MCP Server infrastructure from Stage 1

## Future Considerations
This stage establishes the foundation for:
- Stage 5: Per-player knowledge isolation
- Stage 6: Event-based notifications
- Stage 7: Advanced knowledge queries and tools
- Future: Distributed knowledge sharing between AI agents

## Configuration
```typescript
interface KnowledgeConfig {
  databasePath: string;        // Default: 'data/knowledge.db'
  autoSaveInterval: number;    // Default: 30000 (30 seconds)
  maxHistoryDays: number;      // Default: 30
  enableAuditLog: boolean;     // Default: true
  syncCheckInterval: number;   // Default: 5000 (5 seconds)
}
```

## API Preview
```typescript
class KnowledgeManager {
  async initialize(): Promise<void>
  async detectGameChange(): Promise<boolean>
  async saveKnowledge(): Promise<void>
  async loadKnowledge(gameId: string): Promise<void>
  async resetKnowledge(): Promise<void>
  getStore(): KnowledgeStore
}

class KnowledgeStore {
  async set(key: string, value: any): Promise<void>
  async get(key: string): Promise<any>
  async delete(key: string): Promise<void>
  async clear(): Promise<void>
  async getHistory(key: string, limit?: number): Promise<Entry[]>
}
```

## Notes
- Better-SQLite3 chosen for synchronous operations and reliability
- All timestamps stored as Unix milliseconds for consistency
- Knowledge isolation per player prepared but not implemented (Stage 5)
- Event notification system prepared but not implemented (Stage 6)