# Vox Deorum

Vox Deorum brings modern AI capabilities to your Civilization V games, allowing you to play alongside or against AI opponents powered by large language models (LLMs) like GPT-5. Built upon the [Community Patch + Vox Populi](https://github.com/LoneGazebo/Community-Patch-DLL).

**Version 0.2.1 - Alpha (Last Updated: 12/07/25)**

Designed to work with the [Vox Deorum Replayer](https://github.com/CIVITAS-John/vox-deorum-replay), a web-based review player that also demonstrates how LLMs play Civilization V.

![Replay Viewer in Action](https://github.com/CIVITAS-John/vox-deorum-replay/blob/gh-pages/examples/replay-demo.gif)

## For Players

### What You Need

- Windows 10/11
- Civilization V (only tested on the Complete Edition)
- An API key from one of these AI providers:
  - [OpenRouter](https://openrouter.ai/) - Recommended, supports many models
  - [OpenAI](https://platform.openai.com/) - For GPT models
  - [Google AI](https://ai.google.dev/) - For Gemini models

### Installation

#### Easy Setup (Recommended)

1. **Download and run the installer**:
   - Download `bootstrap.cmd` from the [releases page](https://github.com/CIVITAS-John/vox-deorum/blob/main/scripts/bootstrap.cmd)
   - Double-click to run - it will install everything automatically in the `vox-deorum/` folder

2. **Add your AI API key**:
   - The installer opens a `.env` file
   - Add your API key (get one from the providers above):
   ```env
   OPENROUTER_API_KEY=sk-or-v1-...  # Default option
   # OR
   OPENAI_API_KEY=sk-...
   # OR
   GOOGLE_GENERATIVE_AI_API_KEY=...
   ```

3. **Start playing**:
   ```cmd
   scripts\vox-deorum.cmd
   ```
   - This launches the AI in interactive mode (default)
   - Start Civilization V normally
   - The AI will connect automatically
   - The game will pause for human turns

### How It Works

When you start a game with Vox Deorum:
1. The AI observes the game state in real-time
2. On attached AI players' turn, it analyzes the situation
3. It makes strategic decisions using the chosen LLM
4. Actions are executed automatically in-game
5. You play the game normally (interactive mode) or watch AI play against each other (observe mod)

The LLM-based AI directs the in-game AI's behaviors through:
1. Changing its grand, military, and economic strategies
2. Changing its diplomatic inclinations
3. More is planned and coming soon!

### Game Modes

- **Interactive Mode** (default): Play alongside AI, game pauses for human turns
  ```cmd
  scripts\vox-deorum.cmd
  ```

- **Observe Mode**: Watch AI play autonomously
  ```cmd
  scripts\vox-deorum.cmd --autoPlay
  ```

### Customization

Edit `vox-agents/config.json` to:
- Change AI models (GPT-5, Claude, Gemini, etc.)
- The default model is GPT-OSS-20B ($0.04/0.15), costs ~$0.5 for an entire tiny map + 4 players game
- We are still evaluating the performance of different models

### Troubleshooting

- **Slow responses**: Consider using a faster/cheaper model
- **Installation issues**: See [INSTALLATION.md](INSTALLATION.md)

## For Developers

### Architecture Overview

```
Civ 5 ↔ Community Patch DLL ↔ Bridge Service ↔ MCP Server ↔ Vox Agents → LLM
         (Named Pipe)         (REST/SSE)       (MCP/HTTP)   (LLMs)
```

### Components

#### [Community Patch DLL](civ5-dll/)
Modified Community-Patch-DLL submodule for external communication
- Windows-only 32-bit build
- Named pipe IPC implementation
- Minimal modifications for compatibility
- Build: `python build_vp_clang_sdk.py`
- Deploy: `build-and-copy.bat`

#### [Bridge Service](bridge-service/)
Communication layer between Civ V and AI services
- REST API with Server-Sent Events (SSE)
- Named pipe client with auto-reconnection
- Message batching (10x performance boost)
- Game pause control system
- Mock DLL server for testing

#### [MCP Server](mcp-server/)
Model Context Protocol server exposing game state
- 17 MCP tools for game interaction
- Direct SQLite database access (Kysely ORM)
- Localization with TXT_KEY resolution
- Knowledge persistence with auto-save
- Multi-transport support (stdio/HTTP)

#### [Vox Agents](vox-agents/)
LLM-powered strategic AI framework
- Extensible agent base classes
- Turn-based decision engine
- Multi-LLM provider support
- Session management with recovery
- Local observability integration

#### [Civ 5 Mod](civ5-mod/)
Game integration scripts
- Lua hooks for external communication
- Custom UI elements
- Mod configuration files

### Development Setup

#### Prerequisites
- Node.js ≥20.0.0
- Windows 10/11 (for DLL compilation)
- Python 3.x (for DLL build scripts)
- Visual Studio Build Tools or Windows SDK
- Git with LFS support

#### Building from Source
- Note that all node_modules are installed at the root level.

```bash
# Clone with submodules
git clone --recursive https://github.com/CIVITAS-John/vox-deorum.git
cd vox-deorum

# Initialize and update submodules
git submodule update --init --recursive

# Install all dependencies for TypeScript modules
npm install

# Build the Community Patch DLL (Windows only)
cd civ5-dll
python build_vp_clang_sdk.py
# Or use the build-and-copy script to also deploy
powershell -Command "& .\build-and-copy.bat"

# Build TypeScript modules
cd ../bridge-service && npm run build
cd ../mcp-server && npm run build
cd ../vox-agents && npm run build

# Run tests
npm test --workspaces
```

### Testing

All components use Vitest:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Component-specific testing:
```bash
cd bridge-service && npm test  # IPC and API tests
cd mcp-server && npm test      # MCP tool tests
cd vox-agents && npm test      # Agent workflow tests
```

### Communication Flow
1. **Game → DLL**: Lua callbacks trigger C++ functions
2. **DLL → Bridge**: Named pipe messages (JSON protocol)
3. **Bridge → MCP**: REST API calls and SSE events
4. **MCP → Agents**: MCP protocol (tools and resources)
5. **Agents → LLM**: Provider-specific API calls

### Performance Optimizations
- Message batching (50 Lua calls per batch)
- Connection pooling (standard vs fast)
- Multi-level caching (tool, manager, knowledge)
- Lazy tool loading in MCP server
- AbortController for request cancellation

### Contributing

1. Fork the repository
2. Create a feature branch
3. Follow existing patterns (see CLAUDE.md)
4. Write tests for new functionality
5. Submit a pull request

### Documentation

- [CLAUDE.md](CLAUDE.md) - AI development guidelines
- [PROTOCOL.md](bridge-service/PROTOCOL.md) - IPC communication protocol specification
- Component READMEs in each subdirectory
- TypeScript API Documentation (auto-generated):
  - [Bridge Service API](bridge-service/docs/api/README.md) - REST endpoints, SSE, and IPC services
  - [MCP Server API](mcp-server/docs/api/README.md) - MCP tools and game state interfaces
  - [Vox Agents API](vox-agents/docs/api/README.md) - Agent classes and workflow types
- [Database Schema](civ5-dll/docs/db.md) - Civ V database documentation

## License

Author: John Chen (with assistance from Claude Code).
Lecturer, University of Arizona, College of Information Science
Different licenses are used for submodules:

- `civ5-dll` - GPL 3.0 (following the upstream license)
- `bridge-service`, `vox-agents`, `mcp-server`, `civ5-mod` - [CC BY-NC-SA 4.0](LICENSE.md)