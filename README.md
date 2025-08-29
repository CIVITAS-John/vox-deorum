# Vox Deorum

LLM-enhanced AI system for Civilization V using the Community Patch framework.

## Architecture

This project creates an intelligent AI assistant for Civ V gameplay through a multi-component architecture:

```
Civ 5 Mod ↔ Community Patch DLL ↔ Bridge/JSON Service (REST API + SSE)
                                                    ↕
                                          MCP Server (game state)
                                                    ↕  
                                          MCP Client → LLM Agents
```

## Components

### Community Patch DLL
- A modified version of [Community-Patch-DLL](https://github.com/LoneGazebo/Community-Patch-DLL) as a submodule: `civ5-dll/`
- Talks to the Bridge Service
- Exposes functions for Lua script integration within the game through `Game.CallExternal("method", args, callback)` pattern
- To build the DLL, use `python build_vp_clang_sdk.py` (but only in Windows environment).
- To build the DLL AND copy to the mod folder, use `build-and-copy.bat`.
- To debug the building process, the log exists in `clang-output/Debug/build.log`.

### Bridge Service
- **Location**: `bridge-service/`
- A thin layer of communication wrapper between DLL and external services
- Exposes JSON/REST+SSE API endpoints for both synchronous and asynchronous calls

### MCP Server
- **Location**: `mcp-server/`
- Exposes game's internal state as resources, tools, etc.
- Talks to the Bridge Service via JSON, e.g.
  - Call a Lua function to gather game state data
- Talks to the MCP Client via MCP protocol, e.g. 
  - Provides structured access to game data for LLM consumption
  - Sending active notifications (e.g. turn started, war declared, etc.)

### MCP Client
- **Location**: `mcp-client/`
- Produces/revises strategies based on game state with LLM agents
- Talks to the MCP Server via MCP protocol, e.g.
  - When the LLM needs access to game state data
  - When the LLM wants to change the in-game AI preference

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd vox-populi-ai
   ```

2. Initialize the Community Patch submodule:
   ```bash
   git submodule add https://github.com/LoneGazebo/Community-Patch-DLL.git community-patch-dll
   git submodule update --init --recursive
   ```

3. Set up each component:
   ```bash
   # Civ5 Mod
   cd civ5-mod
   # Follow component-specific setup instructions
   
   # Bridge Service
   cd ../bridge-service
   # Follow component-specific setup instructions
   
   # MCP Server
   cd ../mcp-server
   # Follow component-specific setup instructions
   
   # MCP Client  
   cd ../mcp-client
   # Follow component-specific setup instructions
   ```

## Development

Each component contains its own README with specific development instructions:
- [`civ5-mod/README.md`](civ5-mod/README.md)
- [`bridge-service/README.md`](bridge-service/README.md)
- [`mcp-server/README.md`](mcp-server/README.md) 
- [`mcp-client/README.md`](mcp-client/README.md)

## Project Structure

```
vox-deorum/
├── civ5-dll/              # Community Patch DLL submodule
├── bridge-service/        # Communication bridge and REST API with SSE
├── mcp-server/            # Game state MCP server
├── mcp-client/            # LLM agent MCP client
├── docs/                  # Documentation
├── scripts/               # Utility scripts
├── CLAUDE.md              # Claude Code guidance
└── README.md              # This file
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
- `bridge-service`, `mcp-client`, `mcp-server` - CC BY-NC-SA 4.0