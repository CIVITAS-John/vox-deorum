# Vox Deorum

LLM-enhanced AI system for Civilization V using the Community Patch framework.

## Overview

Vox Deorum integrates modern AI capabilities into Civ V gameplay through a modular architecture that connects the game to LLM agents for strategic decision-making.

## Architecture

```
Civ 5 ↔ Community Patch DLL ↔ Bridge Service ↔ MCP Server ↔ Vox Agents → LLM
         (Named Pipe)         (HTTP/SSE)       (MCP)        (API calls)
```

## Components

### [Community Patch DLL](civ5-dll/)
Modified Community-Patch-DLL enabling external communication
- Windows-only 32-bit build requirement
- Build: `python build_vp_clang_sdk.py` (Windows)
- Deploy: `build-and-copy.bat`

### [Bridge Service](bridge-service/)
HTTP/REST+SSE communication layer
- Bidirectional Lua ↔ External function calls
- Real-time game event streaming
- Mock DLL for development without Civ V

### [MCP Server](mcp-server/)
Model Context Protocol server for game state
- Exposes game data as MCP tools/resources
- Direct database access with localization
- Persistent knowledge management

### [Vox Agents](vox-agents/)
LLM-powered strategic workflows
- Strategist: Dynamic AI strategy adjustment
- Extensible agent framework
- Flexible deployment modes

### [Civ 5 Mod](civ5-mod/)
Game integration and UI scripts
- Lua hooks for external communication
- Custom interface elements
- Mod configuration

## Quick Start

1. **Clone and initialize**:
   ```bash
   git clone <repository-url>
   cd vox-deorum
   git submodule update --init --recursive
   ```

2. **Install dependencies** (each component):
   ```bash
   cd <component-dir>
   npm install
   ```

3. **Start services** (in order):
   ```bash
   # Terminal 1: Bridge Service
   cd bridge-service && npm run dev

   # Terminal 2: MCP Server
   cd mcp-server && npm run dev

   # Terminal 3: Vox Agents
   cd vox-agents && npm run strategist
   ```

4. **Launch Civ V** with the Vox Deorum mod enabled

## Development

Each component has detailed setup instructions:
- [Bridge Service README](bridge-service/README.md)
- [MCP Server README](mcp-server/README.md)
- [Vox Agents README](vox-agents/README.md)

### Requirements
- Node.js ≥20.0.0
- Windows (for DLL compilation)
- Civilization V with Community Patch
- LLM API access (OpenAI/Anthropic)

### Testing
```bash
npm test  # In each component directory
```

## Project Structure

```
vox-deorum/
├── civ5-dll/          # Community Patch DLL (submodule)
├── civ5-mod/          # Game mod files
├── bridge-service/    # Communication layer
├── mcp-server/        # MCP game state server
├── vox-agents/        # LLM agent workflows
├── CLAUDE.md          # AI assistant instructions
└── README.md          # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the existing code conventions
4. Test your changes thoroughly
5. Submit a pull request

## License

Author: John Chen (with assistance from Claude Code).
Lecturer, University of Arizona, College of Information Science
Different licenses are used for submodules:

- `civ5-dll` - GPL 3.0 (following the upstream license)
- `bridge-service`, `vox-agents`, `mcp-server`, `civ5-mod` - CC BY-NC-SA 4.0