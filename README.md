# Vox Deorum

Play Civilization V with AI-enhanced opponents powered by GPT, Claude, and other large language models. Built on [Community Patch + Vox Populi](https://github.com/LoneGazebo/Community-Patch-DLL).

**Version 0.9.0 - Beta**

![Replay](https://github.com/CIVITAS-John/vox-deorum-replay/blob/gh-pages/examples/replay-demo.gif)

## Quick Start

### Prerequisites
- Windows 10/11
- Civilization V (Only tested with both expansion packs)
- An API key from your favorite LLM provider

For macOS, Vox Deorum runs in **copilot mode**: the advisor stack runs locally and can be used from the Web UI or an MCP client such as Codex/ChatGPT, while DLL-backed in-game automation remains Windows-only because Civilization V for macOS cannot load the Community Patch DLL.

### Installation

1. **Download the installer**: Get the installer from our [releases page](https://github.com/CIVITAS-John/vox-deorum/releases)
2. **Run the installer**: The setup wizard should handle everything automatically
3. **Run Vox Deorum**: 
- "Vox Deorum" in Start Menu
- Or, manually open `scripts\vox-deorum.cmd`

### macOS Copilot

1. Install Node.js 20 or newer.
2. Start Civilization V once so it creates its user data/cache folder.
3. Run `npm run start:macos`.
4. Open `http://127.0.0.1:5555` and choose the `macos-copilot` config, or connect Codex/ChatGPT to the MCP server at `http://127.0.0.1:4000/mcp`.

The macOS launcher disables the Windows game pipe and event pipe, then uses SSE/HTTP between the Bridge Service, MCP Server, and Vox Agents. Set `CIV5_USER_DATA_PATH` if your Civ V data folder is not auto-detected.

### Features

- **LLM-enhanced AI Opponent**: Play with your favorite LLM - local models supported
- **Chat with LLM Spokespersons**: Chat with any LLM-enhanced player in the game!
- **Session Replay**: Review your (and LLM's) gameplay with the [Vox Deorum Replayer](https://github.com/CIVITAS-John/vox-deorum-replay)

## For Developers

### Architecture

```
Civ 5 ↔ Community Patch DLL ↔ Bridge Service ↔ MCP Server ↔ Vox Agents → LLM
         (Named Pipe)         (REST/SSE)       (MCP/HTTP)   (LLMs)
```

**Components:**
- [Community Patch DLL](civ5-dll/) - Modified game DLL for IPC
- [Bridge Service](bridge-service/) - REST API & game communication
- [MCP Server](mcp-server/) - Game state tools via Model Context Protocol
- [Vox Agents](vox-agents/) - LLM decision engine
- [Civ 5 Mod](civ5-mod/) - Lua integration scripts

### Building from Source

**Prerequisites:** Node.js ≥20, Python 3.x, Git with LFS. Windows DLL builds also require Windows 10/11 and Visual Studio Build Tools.

```bash
# Clone and setup
git clone --recursive https://github.com/CIVITAS-John/vox-deorum.git
cd vox-deorum
npm install --include=dev

# Build DLL (Windows)
cd civ5-dll
build-and-copy

# Build TypeScript modules
npm run build:all
```

### Documentation

- [CLAUDE.md](CLAUDE.md) - Development guidelines
- [PROTOCOL.md](bridge-service/PROTOCOL.md) - IPC protocol
- Component docs in each subdirectory
- [Database Schema](civ5-dll/docs/db.md) - Civ V database

## License

Author: John Chen (with assistance from Claude Code).
Assistant Professor, University of Arizona, College of Information Science
Different licenses are used for submodules:

- `civ5-dll` - GPL 3.0 (following the upstream license)
- `bridge-service`, `vox-agents`, `mcp-server`, `civ5-mod` - [CC BY-NC-SA 4.0](LICENSE.md)
