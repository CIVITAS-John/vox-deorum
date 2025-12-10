# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Protocol
- When asked to commit, always only commit the staged changes
- When asked to implement a feature, always delegate work to appropriate sub-agents and coordinate their work
- Refer to each submodule's CLAUDE.md for component-specific patterns
- Always delegate to subagents when the task is complicated

## Project Overview
This is Vox Deorum - an LLM-enhanced AI system for Civilization V using the Community Patch framework.

### Architecture Components
Each component has its own README with setup instructions and CLAUDE.md with development patterns.

1. **Community Patch DLL** (`civ5-dll/`) - Modified Community-Patch-DLL submodule
   - Windows-only 32-bit build for external communication
   - Named pipe IPC implementation
   - Minimal changes to maintain compatibility
   - Build: `python build_vp_clang_sdk.py`
   - Deploy: `powershell -Command "& .\build-and-copy.bat"`
   - See `civ5-dll/CLAUDE.md` for C++ patterns and IPC protocol

2. **Bridge Service** (`bridge-service/`) - Communication layer between Civ V and AI
   - REST API + Server-Sent Events (SSE)
   - Named pipe client with auto-reconnection
   - Message batching for 10x performance boost
   - Game pause control system
   - Mock DLL server for testing
   - See `bridge-service/CLAUDE.md` for patterns

3. **MCP Server** (`mcp-server/`) - Model Context Protocol server
   - 17 MCP tools for game interaction
   - Direct SQLite database access (Kysely ORM)
   - Localization with TXT_KEY resolution
   - Knowledge persistence with auto-save
   - Multi-transport support (stdio/HTTP)
   - See `mcp-server/CLAUDE.md` for patterns

4. **Vox Agents** (`vox-agents/`) - LLM-powered strategic AI framework
   - Extensible agent base classes (VoxAgent, Briefer, Strategist)
   - Turn-based decision engine with session management
   - Multi-LLM provider support (OpenRouter, OpenAI, Google AI)
   - OpenTelemetry observability integration
   - See `vox-agents/CLAUDE.md` for patterns

5. **Civ 5 Mod** (`civ5-mod/`) - Game integration
   - Lua hooks for external communication
   - Custom UI elements
   - Mod configuration files

### Communication Flow
```
Civ 5 ↔ Community Patch DLL ↔ Bridge Service ↔ MCP Server ↔ Vox Agents → LLM
         (Named Pipe)         (REST/SSE)       (MCP/HTTP)   (LLMs)
```

## Top-Level Development Patterns

### Module System
- All TypeScript modules use ESM ("type": "module")
- **Always use `.js` extensions in imports**, even for `.ts` files
- This applies to ALL submodules (bridge-service, mcp-server, vox-agents)

### Dependency Management
- **Root-level package.json with npm workspaces** manages shared dependencies
- Centralized version management reduces duplication
- Individual submodules keep their scripts and configs
- Use `npm install` to install all workspace dependencies
- Run commands across workspaces: `npm run build:all` or `npm test:all`

### Testing Framework
- **Use Vitest** for all TypeScript testing
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
- **Always refresh AbortController after abort** for proper cancellation
- Distinguish manual vs automatic state changes
- **Implement graceful shutdown handlers** in all services

### Performance Optimization
- Lazy loading with factory patterns
- **Always batch operations** to reduce IPC overhead (up to 50 Lua calls)
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
- Straightforward implementation focused on goals
- Production-ready code following existing patterns
- DRY principles
- Proper (not excessive) error handling - avoid redundant try-catch layers
- Should never use any or unknown types unless absolutely necessary
- Before creating new mechanisms, check if it already exists

### Logging Conventions
- **Use Winston logger** for all TypeScript modules (bridge-service, mcp-server, vox-agents)
- **Never use console.log/error/warn** in production code - always use the logger utility
- Import the logger utility from the appropriate utils directory
- Create logger instance with component context
- Use appropriate log levels: debug, info, warn, error
- Pass error objects as metadata when logging errors
- Test files may use console.log for debugging during test runs

### Database Conventions
- **Use `is` / `is not` for SQLite null checks** (never `=` / `!=`)
- Prepare statements for repeated queries
- Use transactions for batch operations
- Implement proper indexing for performance

### Documentation & Comment Conventions
- **Always update documentation but never create unless prompted** - Avoid creating README.md or docs files proactively
- Top-level comments in each code file describing the module's purpose
- Comments on all public/exported definitions explaining their function
- Comments within long functions for complex logic sections
- Use `// Vox Deorum:` prefix for modifications in C++ code beyond CvConnectionService
- Keep comments concise and focused on the "why" rather than the "what"
- In the documentation, never bring concrete code as they can get outdated

### Integration Best Practices
- **Use manager classes for all cross-service communication** (not direct HTTP calls)
- Test with both stdio and HTTP transports where applicable
- Implement observability/telemetry wrapping
- Handle connection failures with retry logic
- Flush telemetry on shutdown
- Use configuration-driven initialization
- **Respect player visibility** when handling game data

## Quick Reference

### Build Commands by Module
```bash
# Root level (all workspaces)
npm install         # Install all dependencies
npm run build:all   # Build all TypeScript modules
npm run test:all    # Run all tests

# civ5-dll (Windows only)
cd civ5-dll
python build_vp_clang_sdk.py
.\build-and-copy.bat

# bridge-service
npm run dev      # Development with watch
npm test         # Vitest tests
npm run build    # Production build

# mcp-server
npm run dev      # Development with watch
npm test         # Vitest tests
npm run build    # Production build

# vox-agents
npm run dev         # Standalone development
npm run briefer     # Briefer workflow
npm run strategist  # Strategist workflow
npm test           # Vitest tests
```

### Key Files to Check
- `protocol.md` - Communication protocol specification
- `*/CLAUDE.md` - Component-specific patterns
- `*/tests/setup.ts` - Test configuration
- `*/src/config.ts` - Configuration management
- `*/vitest.config.ts` - Test framework setup