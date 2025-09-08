# MCP Server - Claude Instructions

## Development Guidelines

### Testing
- Use Vitest for all testing (not Jest)
- Test files should be in `tests/` directory with `.test.ts` extension
- Run tests with `npm test`, watch mode with `npm run test:watch`, coverage with `npm run test:coverage`
- Test setup file is at `tests/setup.ts` for global test configuration

### TypeScript & ESM
- Project uses ESM modules ("type": "module" in package.json)
- When importing local files, use `.js` extensions in imports even for `.ts` files
- Follow strict TypeScript configuration for type safety

### Code Structure
- Source code in `src/` directory
- Utilities in `src/utils/` subdirectory  
- Tools in `src/tools` subdirectory
- Tests mirror source structure in `tests/` directory
- Built output goes to `dist/` directory (gitignored)

### MCP Protocol Compliance
- Always follow Model Context Protocol specifications
- Use the official @modelcontextprotocol/sdk package
- Implement proper resource and tool registration
- Resource and tools are both defined as "ToolBase" to share the same infrastructure
- Handle errors gracefully with proper MCP error responses
- Support multiple transport methods (stdio, HTTP)

### Tools/Resources Implementation
- Use the `calculator.ts` tool implementation as the template
- Similarly, use the `calculator.test.ts` implementation as the test template
- Tools/resources do not need to handle errors unless necessary to bypass them
- Tool/resource tests should be done by doing MCP client calls
- Tool/resource tests should use the mcpClient object exported by the setup.ts
- Before implementing a database-related tool, always check the schema
- When you need a database table that's commented, uncomment it

### SQLite Queries
- Always use `is` and `is not` for SQLite null checking.

### Build & Development
- `npm run dev` - Development with hot reload using tsx
- `npm run build` - TypeScript compilation to dist/
- `npm run type-check` - TypeScript type checking without emit
- `npm run lint` - ESLint code quality checks

### Lua Script Development
- Standalone Lua scripts must be placed in the `lua/` directory
- Follow existing Lua module patterns (e.g., `event-visibility.lua`, `game-identity.lua`)
- **IMPORTANT**: Always check `civ5-dll/CvGameCoreDLL_Expansion2/Lua/` for existing Civ5 Lua APIs. Never invent non-existent APIs.
  - Check existing wrapper classes like CvLuaGame, CvLuaPlayer, CvLuaUnit, CvLuaCity, etc.
  - Use existing patterns like `LuaFunction` for Lua callback implementations instead of creating new ones
- Lua scripts executed in-game have access to all Civ5's exposed Lua APIs
- Scripts are executed within the game context via BridgeManager

### Integration with Bridge Service
- Follow PROTOCOL.md specifications when implementing Bridge Service communication
- Always use the BridgeManager class (`src/bridge/bridge-manager.ts`) for all Bridge Service communication
  - Do NOT use direct fetch/HTTP calls to the Bridge Service
  - BridgeManager provides methods for Lua script execution, function calls, and SSE handling
  - Import the singleton instance through `import { bridgeManager } from '../server.js';`
- Handle connection failures and retry logic gracefully