# Vox Deorum Installation Guide

This comprehensive guide covers all installation methods and troubleshooting for Vox Deorum on Windows systems.

## Quick Start: Playing with AI

### Interactive Mode (Play alongside AI)
After completing the installation below, you can play Civilization V with AI agents controlling other civilizations:

1. Start all services with one command:
   ```cmd
   scripts\vox-deorum.cmd
   ```
   This launches Bridge Service, MCP Server, and Vox Agents automatically.

2. The default configuration uses `interactive-simple.json` where AI controls Player 1. To customize:
   ```bash
   # In a separate terminal, stop the default agents and run with custom config:
   cd vox-agents
   npm run strategist -- --config=your-config.json
   ```

3. Play normally - AI agents will take over when it's their turn
4. Watch AI decision-making in the console output (or the optional Langfuse dashboard)

### Creating Custom AI Agents
To create your own AI strategy:
1. Create agent class in `vox-agents/src/agents/`
2. Register in `vox-agents/src/infra/vox-context.ts`
3. Create config in `vox-agents/configs/`
4. Run with: `npm run strategist -- --config=your-agent.json`

See `vox-agents/README.md` for a comprehensive agent development guide.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
  - [Method 1: Quick Bootstrap (Recommended)](#method-1-quick-bootstrap-recommended)
  - [Method 2: Standard Installation](#method-2-standard-installation)
  - [Method 3: Manual Installation](#method-3-manual-installation)
- [Configuration](#configuration)
- [Running Vox Deorum](#running-vox-deorum)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)

## Prerequisites

### System Requirements
- **Operating System**: Windows 10/11 (64-bit)
- **RAM**: 8 GB minimum, 16 GB recommended
- **Disk Space**: 1 GB for Vox Deorum + space for Civilization V + Vox Populi
- **Network**: Internet connection for LLM API access

### LLM API Requirements
You need at least one of the following:
- **OpenAI API Key**: From [OpenAI Platform](https://platform.openai.com/)
- **OpenRouter API Key**: From [OpenRouter](https://openrouter.ai/)
- **Google AI API Key**: From [Google AI Studio](https://makersuite.google.com/app/apikey)
- Alternatively, you can add support for almost any LLM providers through the code

## Installation Methods

### Method 1: Quick Bootstrap (Recommended)

This is the easiest method for new users. It automatically installs Git, clones the repository, and sets up everything.

1. **Download the bootstrap script**:
   - Download `bootstrap.cmd` from the [releases page](https://github.com/CIVITAS-John/vox-deorum/releases)

2. **Run the bootstrap**:
   ```cmd
   bootstrap.cmd
   ```
   This will:
   - Install Git for Windows with LFS support (if needed)
   - Clone the Vox Deorum repository
   - Initialize all submodules
   - Run the full installation

3. **Configure your LLM API key** (see [Configuration](#configuration))

### Method 2: Standard Installation

If you already have Git installed, use this method:

1. **Clone the repository**:
   ```cmd
   git clone https://github.com/CIVITAS-John/vox-deorum.git
   cd vox-deorum
   ```

2. **Run the installation script**:
   ```cmd
   scripts\install.cmd
   ```

   For debug builds (with symbols), use:
   ```cmd
   scripts\install.cmd --debug
   ```

   The installer will:
   - Initialize Git submodules
   - Install Node.js dependencies for all components
   - Check for Steam and Civilization V
   - Deploy pre-built DLLs to your Civ V installation
   - Build all TypeScript services

3. **Configure your LLM API key** (see [Configuration](#configuration))

### Method 3: Manual Installation

For advanced users who want full control:

1. **Clone and initialize submodules**:
   ```cmd
   git clone https://github.com/CIVITAS-John/vox-deorum.git
   cd vox-deorum
   git submodule update --init --recursive
   git lfs pull
   ```

2. **Install dependencies for each component**:
   ```cmd
   :: Bridge Service
   cd bridge-service
   npm install
   npm run build
   cd ..

   :: MCP Server
   cd mcp-server
   npm install
   npm run build
   cd ..

   :: Vox Agents
   cd vox-agents
   npm install
   npm run build
   cd ..
   ```

3. **Copy DLLs to Civilization V**:
   ```cmd
   :: Find your Documents folder
   echo %USERPROFILE%\Documents

   :: Copy the DLLs
   copy scripts\release\CvGameCore_Expansion2.dll "%USERPROFILE%\Documents\My Games\Sid Meier's Civilization 5\MODS\(1) Community Patch\"
   copy scripts\release\lua51_win32.dll "%USERPROFILE%\Documents\My Games\Sid Meier's Civilization 5\MODS\(1) Community Patch\"
   ```

4. **Configure environment variables** (see [Configuration](#configuration))

## Configuration

### Setting LLM API Keys

The installation script automatically creates a `.env` file from `.env.default` and opens it for editing.

**Default Model**: The system uses `openai/gpt-oss-20b` from OpenRouter by default (cost-effective open-source model).

Choose one LLM provider and add its API key:

```env
# vox-agents/.env (created automatically)
OPENAI_API_KEY=sk-...
# OR
OPENROUTER_API_KEY=sk-or-v1-...  # Required for default model
# OR
GOOGLE_GENERATIVE_AI_API_KEY=...
```

### Changing the Default Model

To use a different model, edit `vox-agents/config.json`:
```json
{
  "llms": {
    "default": "gpt-4o-mini",  // Change to your preferred model
    "gpt-4-turbo": {
      "provider": "openai",
      "name": "gpt-4o-mini"
    }
  }
}
```

### Optional Configuration

#### Langfuse Observability (Optional)
For monitoring LLM usage and debugging:
```cmd
setx LANGFUSE_PUBLIC_KEY "pk-lf-..."
setx LANGFUSE_SECRET_KEY "sk-lf-..."
setx LANGFUSE_HOST "..."
```

#### Custom Ports (Advanced)
Edit the configuration files if you need different ports:
- `bridge-service/src/config.ts` - Default: 5000
- `mcp-server/src/config.ts` - Default: 4000

## Running Vox Deorum

### Recommended: All-in-One Launcher

**For most users, use the all-in-one launcher script:**
```cmd
scripts\vox-deorum.cmd
```

This automatically:
1. Starts Bridge Service (Port 5000)
2. Starts MCP Server (Port 4000)
3. Starts Vox Agents with interactive configuration
4. Handles all service coordination

Press ENTER to stop all services when done.

### Starting Services Individually

For development, debugging, or custom configurations, you can start services separately:

```cmd
:: Terminal 1: Bridge Service
cd bridge-service
npm run dev

:: Terminal 2: MCP Server
cd mcp-server
npm run dev

:: Terminal 3: Vox Agents
cd vox-agents
npm run strategist
```

## Updating
You can always use the `bootstrap.cmd` to update the installation.

### Updating DLLs from GitHub

When the C++ DLL code is updated:
```cmd
scripts\update-dlls.cmd
```

This script:
1. Pushes your changes to GitHub
2. Waits for GitHub Actions to build the DLLs
3. Pulls the built binaries
4. Copies them to your Civ V installation

### Updating Dependencies

To update Node.js packages:
```cmd
:: Update all components
cd bridge-service && npm update && cd ..
cd mcp-server && npm update && cd ..
cd vox-agents && npm update && cd ..
```

### Pulling Latest Changes

To get the latest code:
```cmd
git pull origin main
git submodule update --init --recursive
scripts\install.cmd
```

## Troubleshooting

### Common Issues

#### "Steam not found"
- **Solution**: Install Steam from [store.steampowered.com](https://store.steampowered.com/)
- The installer can automatically install Steam if you confirm

#### "Civilization V not installed"
- **Solution**: Install Civ V through Steam (App ID: 8930)
- Ensure you have the Community Patch installed

#### "Pre-built DLL not found"
- **Cause**: Missing binary files
- **Solution**:
  ```cmd
  git lfs pull
  git submodule update --init --recursive
  ```

#### "npm command not found"
- **Solution**: Install Node.js from [nodejs.org](https://nodejs.org/)
- Restart your command prompt after installation

#### "Connection refused" errors
- **Cause**: Services not running or firewall blocking
- **Solution**:
  - Ensure all services are started
  - Check Windows Firewall allows Node.js
  - Verify ports 4000 and 5000 are not in use

#### "LLM API errors"
- **Cause**: Invalid or missing API key
- **Solution**:
  - Verify your API key is correct
  - Check you have credits/quota with your provider
  - Test the key directly with the provider's playground

### Debug Mode

For troubleshooting at the Civ 5 level, use the debug DLLs with Visual Studio Debugger:

```cmd
:: Install debug build
scripts\install.cmd --debug
```

### Log Files

Check these locations for logs:
- `bridge-service/logs/` - Bridge service logs
- `mcp-server/data/` - MCP server database and logs
- `vox-agents/sessions/` - Agent session data
- `civ5-dll/clang-output/Debug/build.log` - DLL build logs

### Getting Help

1. Check the component-specific READMEs:
   - [Bridge Service README](bridge-service/README.md)
   - [MCP Server README](mcp-server/README.md)
   - [Vox Agents README](vox-agents/README.md)

2. Search existing issues on [GitHub Issues](https://github.com/CIVITAS-John/vox-deorum/issues)

3. Create a new issue with:
   - Your Windows version
   - Node.js version (`node --version`)
   - Error messages and logs
   - Steps to reproduce

## Next Steps

After installation:
1. Review the [Quick Start](README.md#quick-start) guide
2. Read about [Agent Configuration](vox-agents/README.md)
3. Learn about [MCP Tools](mcp-server/README.md#available-tools)

## Support

For issues or questions:
- GitHub Issues: [github.com/CIVITAS-John/vox-deorum/issues](https://github.com/CIVITAS-John/vox-deorum/issues)
- Author: John Chen, University of Arizona