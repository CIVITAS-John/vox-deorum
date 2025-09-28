# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Protocol
- When asked to commit, always only commit the staged changes
- When asked to implement a feature, always delegate work to appropriate sub-agents and coordinate their work
- Refer to each submodule's CLAUDE.md for component-specific patterns

## Project Overview
This is Vox Deorum - an LLM-enhanced AI system for Civilization V using the Community Patch framework.

### Architecture Components
Each component has its own README with setup instructions and CLAUDE.md with development patterns.

1. **Community Patch DLL** (`civ5-dll/`) - Modified Community-Patch-DLL submodule
   - Focus on `CvCoreDLL_Expansion2` and `CvGameCoreDLLUtil` only
   - Make minimal changes to maintain compatibility
   - Windows-only build: `python build_vp_clang_sdk.py`
   - Build and deploy: `cd "F:\Minor Solutions\vox-deorum\civ5-dll" && powershell -Command "& .\build-and-copy.bat" 2>&1`
   - Debug logs: `clang-output/Debug/build.log`
   - See `civ5-dll/CLAUDE.md` for C++ patterns and IPC protocol

   **Exposing Lua APIs:**
   - Add method declarations in `Lua/CvLuaPlayer.h` as static methods
   - Implement methods in `Lua/CvLuaPlayer.cpp` with `lMethodName` naming
   - Register methods using `Method(MethodName)` macro in CvLuaPlayer.cpp constructor area
   - For serialized data, update `Serialize()`, constructor, and `Reset()` in the relevant class

2. **Bridge Service** (`bridge-service/`) - IPC bridge between DLL and services
   - REST API + SSE for real-time events
   - Follow `protocol.md` for cross-module communication
   - Singleton services with EventEmitter pattern
   - See `bridge-service/CLAUDE.md` for error handling and SSE patterns

3. **MCP Server** (`mcp-server/`) - Game state exposure via MCP protocol
   - Supports stdio and HTTP transports
   - Tools use factory pattern with lazy loading
   - Knowledge persisted in SQLite per game
   - See `mcp-server/CLAUDE.md` for tool development and caching patterns

4. **Vox Agents** (`vox-agents/`) - LLM-powered strategic AI
   - Vitest for all testing (sequential execution for IPC)
   - Dual mode: Standalone (autonomous) or Component (web UI)
   - Agent architecture with VoxAgent base class
   - See `vox-agents/CLAUDE.md` for agent patterns and MCP integration

### Communication Flow
```
Civ 5 Mod ↔ Community Patch DLL ↔ Bridge Service (REST + SSE)
                                           ↕
                                    MCP Server (game state)
                                           ↕
                                    Vox Agents → LLM
```

## Top-Level Development Patterns

### Module System
- All TypeScript modules use ESM ("type": "module")
- **Critical**: Always use `.js` extensions in imports, even for `.ts` files
- This applies to ALL submodules (bridge-service, mcp-server, vox-agents)

### Testing Framework
- **Vitest** for all TypeScript testing (NOT Jest)
- Test files: `tests/*.test.ts`
- Sequential execution for IPC tests: `singleFork: true`
- Extended timeouts for game integration

### Error Handling Patterns
- Standardized response format: `respondSuccess()` / `respondError()`
- Exponential backoff with jitter for retries
- Graceful degradation with connection loss
- Bounded retry attempts for crash recovery

### State Management
- Singleton pattern for services (export instance, not class)
- Map-based registries for dynamic content
- AbortController for cancellation (refresh after abort)
- Distinguish manual vs automatic state changes

### Performance Optimization
- Lazy loading with factory patterns
- Batch operations to reduce IPC overhead (up to 50 Lua calls)
- Connection pooling (standard vs fast pools)
- Multi-level caching (tool, manager, knowledge store)

### IPC Communication
- Message batching with `!@#$%^!` delimiter
- JSON messaging with typed schemas
- SSE for real-time events with keep-alive
- Queue management with auto-pause on overflow

## Development Guidelines

### Windows Environment
- **Use PowerShell for Windows commands** (avoid cmd.exe - cannot retrieve output reliably)
- **Prefer Bash tool over file system commands** when possible

### Implementation Philosophy
- **Check existing infrastructure first** - Never reinvent the wheel
- **Keep implementations simple** - Straightforward code focused on goals
- **Avoid redundant error handling** - Don't add unnecessary layers
- **Use existing utilities** - Check utils/ directories before creating new helpers
- **Follow established patterns** - Consistency over cleverness

### Planning
- Use TodoWrite tool for task management
- Don't present action plans until requested
- Focus on conceptual level, not excessive technical details
- Don't change test scripts unless explicitly asked

### Code Conventions
- Production-ready code following existing patterns
- Testable and maintainable architecture
- Proper (not excessive) error handling - avoid redundant try-catch layers
- DRY principles
- Straightforward implementation focused on goals

### Comment Conventions
- Top-level comments in each code file
- Comments on all public/exported definitions
- Comments within long functions
- Use `// Vox Deorum:` prefix for modifications in C++ code beyond CvConnectionService

### Common Pitfalls Across Modules
1. **Forgetting `.js` extensions** in TypeScript imports
2. **Using Jest instead of Vitest** for tests
3. **Direct HTTP calls** instead of using manager classes
4. **Not refreshing AbortController** after abort
5. **Missing graceful shutdown** handlers
6. **Ignoring player visibility** in game data
7. **Not batching operations** for performance
8. **Using `=` / `!=` for SQLite null checks** (use `is` / `is not`)

### Integration Best Practices
- Always use manager classes for cross-service communication
- Test with both stdio and HTTP transports where applicable
- Implement observability/telemetry wrapping
- Handle connection failures with retry logic
- Flush telemetry on shutdown
- Use configuration-driven initialization

## Quick Reference

### Build Commands by Module
```bash
# civ5-dll (Windows only)
.\build-and-copy.bat

# bridge-service
npm run dev      # Development
npm test         # Vitest tests
npm run build    # Production build

# mcp-server
npm run dev      # Development
npm test         # Vitest tests (TEST_TRANSPORT=stdio/http)
npm run build    # Production build

# vox-agents
npm run dev         # Standalone development
npm run strategist  # Strategist workflow
npm test           # Vitest tests
```

### Key Files to Check
- `protocol.md` - Communication protocol specification
- `*/CLAUDE.md` - Component-specific patterns
- `*/tests/setup.ts` - Test configuration
- `*/src/config.ts` - Configuration management
- `*/vitest.config.ts` - Test framework setup