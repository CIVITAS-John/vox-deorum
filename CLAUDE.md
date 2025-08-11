# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Protocol
- When asked to commit, always only commit the staged changes.
- When asked to implement a feature, always delegate work to appropriate sub-agents and coordinate their work. 

## Project Overview
This is Vox Deorum - an LLM-enhanced AI system for Civilization V using the Community Patch framework.

### Architecture Components
Each component has its own README with specific setup instructions.

1. **Community Patch DLL** (`civ5-dll/`) - Modified Community-Patch-DLL submodule that talks to Bridge Service
2. **Civ5 Mod** (`civ5-mod/`) - Lua scripts for Civilization V integration with game events
3. **Bridge Service** (`bridge-service/`) - Communication wrapper between DLL and external services via JSON/REST+SSE API
4. **MCP Server** (`mcp-server/`) - Exposes game state as resources, talks to Bridge Service
5. **MCP Client** (`mcp-client/`) - Produces strategies with LLM agents, talks to both Bridge Service and MCP Server

### Communication Flow
```
Civ 5 Mod ↔ Community Patch DLL ↔ Bridge/JSON Service (REST API + SSE)
                                                    ↕
                                          MCP Server (game state)
                                                    ↕  
                                          MCP Client → LLM Agents
```

## Development Guidelines
### Planning
- During the Plan mode, do not present an action plan until the human initiates. Do use to-do list.

### Code Convention
- Code must be production-ready and follow best practices
- Ensure code is testable and maintainable
- Maintain consistency with existing codebase style and patterns
- Implement proper error handling and validation
- Follow DRY (Don't Repeat Yourself) principles

### Comment Convention
- Always add/sync top-level comments to each code file
- Always add/sync comments to all public/exported definitions (incl. classes, types, functions)
- Always add/sync comments within long functions

### Testing
- Use Vitest for testing in the bridge-service
- Test files should be in `tests/` directory with `.test.ts` extension
- Run tests with `npm test`, watch mode with `npm run test:watch`, coverage with `npm run test:coverage`
- Test setup file is at `tests/setup.ts` for global test configuration