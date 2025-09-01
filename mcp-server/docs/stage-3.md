# Stage 3: Game Database Integration

## Overview
Integrate with Civilization V's SQLite databases to provide structured access to game rules, units, buildings, technologies, and localized text.

## Key Components

### DatabaseManager
- Attach to MCP Server as `DatabaseManager`
- Connect to game databases in read-only mode:
  - Main: `%Documents%\My Games\Sid Meier's Civilization 5\cache\Civ5DebugDatabase.db`
  - Localization: `%Documents%\My Games\Sid Meier's Civilization 5\cache\Localization-Merged.db`
- Setup and cleanup along with the main Server 
- Throw clear errors if databases cannot be found or opened
- Write a util function to get the `%Documents%` from Powershell.

### Core Features
1. **Raw SQL Query Support**
   - Execute SQL queries on main database
   - Return results as JSON (Record<string, any>)
   - Auto-convert localization keys to localized text

2. **Localization Support**
   - `GetLocalization(key: string): string` method
   - Language configuration setting
   - Query from LocalizedText table

3. **Utility Functions**
   - Create domain-specific utilities (e.g., `src/database/technology.ts`)
   - Support both full and simplified schemas using Zod
   - Generate schemas from SQLite definitions in `database/json/*.json`
   - Start with one template implementation

## Success Criteria
- Database connections established successfully
- SQL queries return structured JSON data
- Localization lookups work correctly
- One example utility function demonstrates the pattern
- All tests pass

## Testing Approach
- Mock database connections for unit tests
- Integration tests with sample database files
- Verify error handling for missing databases
- Test localization with different language settings