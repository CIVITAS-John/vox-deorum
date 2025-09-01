# Stage 3: Database Manager Integration ✅

## Overview
Integration with Civilization V's SQLite databases for game rules and localized text access.

## What Was Actually Implemented

### 1. DatabaseManager (`src/database/database-manager.ts`)
Core database management with Kysely ORM:
- **Connection Management**: Opens readonly connections to Civ 5 SQLite databases
- **Path Resolution**: Automatic detection of database files in Documents folder
- **Localization Support**: Methods to translate TXT_KEY_* strings
- **Batch Localization**: Efficient bulk translation of query results
- **Language Configuration**: Configurable language selection (default: en_US)
- **Lifecycle Management**: Proper initialization and cleanup

### 2. Database Type Definitions
- **Main Database** (`src/database/database.d.ts`): Generated types for game rules
- **Localization Database** (`src/database/localization.d.ts`): LocalizedText table types
- Generated using kysely-codegen from actual database schemas

### 3. Integration Points
- **Server Integration**: DatabaseManager created during MCPServer construction
- **Singleton Access**: Exported `databaseManager` instance from server.ts
- **Auto-initialization**: Connects to databases during server startup
- **Error Handling**: Clear error messages when databases not found

### 4. Key Methods
```typescript
class DatabaseManager {
  // Initialize connections
  async initialize(): Promise<void>
  
  // Get single localized string
  async localize(key: string): Promise<string>
  
  // Batch localize query results
  async localizeObject<T>(results: T[]): Promise<T[]>
  
  // Direct database access
  getDatabase(): Kysely<MainDB>
  
  // Language management
  setLanguage(language: string): void
  getLanguage(): string
}
```

## What Was NOT Implemented
- Raw SQL query support (using Kysely query builder instead)
- Domain-specific utility functions
- Schema generation from JSON
- Caching layer for frequently accessed data
- Mock database connections for unit tests

## Database Locations
```
<Documents>/My Games/Sid Meier's Civilization 5/cache/
├── Civ5DebugDatabase.db    # Main game rules
└── Localization-Merged.db  # Localized text
```

## Usage Examples

### Direct Query with Kysely
```typescript
import { databaseManager } from './server.js';

const db = databaseManager.getDatabase();
const units = await db
  .selectFrom('Units')
  .where('Combat', '>', 0)
  .selectAll()
  .execute();
```

### With Automatic Localization
```typescript
const buildings = await db
  .selectFrom('Buildings')
  .selectAll()
  .execute();

// Converts all TXT_KEY_* strings to localized text
const localized = await databaseManager.localizeObject(buildings);
```

## Dependencies
- **better-sqlite3**: SQLite driver for Node.js
- **kysely**: Type-safe SQL query builder
- **kysely-codegen**: Schema type generation

## Key Tables Identified
- Units, Buildings, Technologies, Civilizations
- Policies, Improvements, Resources, Terrains
- LocalizedText (for all game text)