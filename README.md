# Vox Deorum

LLM-enhanced AI system for Civilization V using the Community Patch framework.

## Overview

Vox Deorum integrates modern AI capabilities into Civ V gameplay through a modular architecture that connects the game to LLM agents for strategic decision-making.

## Architecture

```
Civ 5 ↔ Community Patch DLL ↔ Bridge Service ↔ MCP Server ↔ Vox Agents → LLM
         (Named Pipe)         (REST/SSE)       (MCP/HTTP)   (LLMs)
```

## Components

### [Community Patch DLL](civ5-dll/)
Modified Community-Patch-DLL submodule enabling external communication
- Windows-only 32-bit build requirement
- Minimal modifications to maintain compatibility
- Build: `python build_vp_clang_sdk.py` (Windows)
- Deploy: `build-and-copy.bat`
- Debug logs: `clang-output/Debug/build.log`

### [Bridge Service](bridge-service/)
Critical communication layer between Civ V and AI services
- **Core Features**:
  - REST API with Server-Sent Events (SSE) for real-time updates
  - Named pipe IPC with automatic reconnection
  - Intelligent game pause system with per-player auto-pause
  - Message batching for 10x performance improvement
  - External function registration as Lua-callable endpoints
- **Development**: Mock DLL server for testing without Civ V

### [MCP Server](mcp-server/)
Comprehensive Model Context Protocol server exposing game state
- **17 MCP Tools** across categories (general, database, knowledge, actions)
- **Key Features**:
  - Direct Civ5 SQLite database access with Kysely ORM
  - Multi-language localization with TXT_KEY resolution
  - Persistent/transient knowledge management with auto-save
  - Real-time SSE integration with Bridge Service
  - Multi-transport support (stdio/HTTP)

### [Vox Agents](vox-agents/)
LLM-powered strategic AI for autonomous gameplay
- **Agent Framework**: Flexible base classes (VoxAgent/VoxContext)
- **Simple Strategist**: Production-ready turn-based decision agent
- **Features**:
  - Multi-LLM support (OpenAI, OpenRouter, Google AI)
  - MCP client with automatic tool discovery
  - Session management with crash recovery
  - Langfuse observability for monitoring

### [Civ 5 Mod](civ5-mod/)
Game integration and UI scripts
- Lua hooks for external communication
- Custom interface elements
- Mod configuration

## Quick Start

### Prerequisites
- Windows 10/11 (64-bit)
- Civilization V with Community Patch installed
- LLM API key (OpenAI, OpenRouter, or Google AI)

### Recommended Installation (Bootstrap)

For new users, the easiest way to get started:

1. **Download and run the bootstrap script**:
   ```cmd
   :: Download bootstrap.cmd from releases page
   :: https://github.com/CIVITAS-John/vox-deorum/releases
   bootstrap.cmd
   ```
   This automatically installs Git, Node.js, clones the repository, and sets up everything.

2. **Configure LLM API**:
   The installation will automatically create a `.env` file and open it for you.
   The default model is `openai/gpt-oss-20b` (OpenRouter), but you can use any provider:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-...  # For default model
   # OR
   OPENAI_API_KEY=sk-...
   # OR
   GOOGLE_GENERATIVE_AI_API_KEY=...
   ```
   To change models, edit `vox-agents/config.json`.

3. **Start playing with AI**:
   ```cmd
   scripts\vox-deorum.cmd
   ```
   This launches all services and starts the AI in interactive mode.

### Manual Installation

If you prefer manual setup:

1. **Clone and setup**:
   ```cmd
   git clone https://github.com/CIVITAS-John/vox-deorum.git
   cd vox-deorum
   scripts\install.cmd
   ```

2. **Configure LLM**: The .env file will be created automatically from .env.default

3. **Start services**: `scripts\vox-deorum.cmd`

### Update DLLs (when needed)
```cmd
scripts\update-dlls.cmd
```
Builds and deploys the latest DLL changes to your Civ V installation.

For detailed installation instructions and troubleshooting, see [INSTALLATION.md](INSTALLATION.md).

## Development

Each component has detailed documentation:
- [Bridge Service README](bridge-service/README.md) - REST API, IPC, game control
- [MCP Server README](mcp-server/README.md) - MCP tools, database access, knowledge
- [Vox Agents README](vox-agents/README.md) - Agent framework, LLM integration

### Key Features by Component

**Bridge Service**:
- Named pipe: `\\.\pipe\vox-deorum-bridge`
- Batch API for 10x performance
- 30-second timeouts with cleanup
- Exponential backoff reconnection

**MCP Server**:
- 17 tools with Zod validation
- Multi-database support (Gameplay, Localization, Units)
- 30-second auto-save for knowledge
- Lazy tool loading for performance

**Vox Agents**:
- Turn-based event handling
- Automatic session recovery
- Dynamic tool discovery from MCP
- Token usage tracking

### Requirements
- Node.js ≥20.0.0
- Windows (for DLL compilation only)
- Civilization V with Community Patch
- LLM API access (OpenAI/OpenRouter/Google AI)

### Testing
All components use Vitest for testing:
```bash
npm test              # Run test suite
npm run test:watch    # Watch mode for development
npm run test:coverage # Generate coverage report
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
- `bridge-service`, `vox-agents`, `mcp-server`, `civ5-mod` - [CC BY-NC-SA 4.0](LICENSE.md)