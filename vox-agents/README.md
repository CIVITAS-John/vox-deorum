# Vox Agents

LLM-powered strategic AI agents for Civilization V that provide high-level decision making and strategy planning through the Vox Deorum system.

## Overview

Vox Agents connects to the MCP Server to receive game state and execute strategic decisions using LLM-based workflows. The agents analyze game situations and provide strategic recommendations back to the game through a coordinated pipeline.

**Stack**: Node.js 20+, TypeScript, Mastra (LLM orchestration), OpenTelemetry (optional)

## Architecture

### Core Components

1. **Agent Workflows** - Mastra-based LLM agents for strategic analysis
2. **MCP Client** - Connects to MCP Server for game state access
3. **Strategy Engine** - Coordinates agent decisions and game actions
4. **Telemetry** - Optional OpenTelemetry support for monitoring

### Communication Flow

```
LLM Provider ← Vox Agents → MCP Server → Bridge Service → Civilization V
                    (MCP protocol)
```

## Getting Started

### Prerequisites

- Node.js >=20.0.0
- MCP Server running (see `../mcp-server/`)
- LLM API access (OpenAI, Anthropic, etc.)

### Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Development mode
npm start            # Production mode
npm test             # Run tests
```

### Configuration

Edit `config.json` for agent settings:
```json
{
  "mcp": {
    "server": "http://localhost:3000"
  },
  "telemetry": {
    "enabled": false,
    "endpoint": "http://localhost:4318"
  }
}
```

## Development

### Project Structure

```
vox-agents/
├── src/
│   ├── briefer/           # The briefer workflow
│   ├── strategist/        # The strategist workflow
│   └── utils/             # Shared utilities between workflows
├── tests/
├── package.json
├── tsconfig.json
└── README.md
```

### Commands

```bash
npm install          # Install dependencies
npm run briefer      # Run the strategist workflow
npm run strategist   # Run the strategist workflow
npm test             # Run tests
npm run type-check   # TypeScript checking
npm run lint         # Code linting
```

## Contributing

- Follow TypeScript best practices
- Add tests for new functionality
- Use conventional commits
- Document agent workflows