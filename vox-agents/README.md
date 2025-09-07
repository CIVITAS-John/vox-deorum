# Vox Agents

LLM-powered strategic AI agents for Civilization V that provide high-level decision making and strategy planning through the Vox Deorum system.

## Overview

Vox Agents connects to the MCP Server to receive game state and execute strategic decisions using LLM-based workflows. The agents analyze game situations and provide strategic recommendations back to the game through a coordinated pipeline.

**Stack**: Node.js 20+, TypeScript, Mastra (LLM orchestration), Vitest (testing), OpenTelemetry (optional)

## Startup Modes

The repository supports two startup modes:

### 1. Standalone Mode
Runs as an autonomous service that connects to the MCP server and operates independently. The service listens for MCP server notifications and responds with strategic decisions automatically.

```bash
npm run standalone   # Start in standalone mode
```

### 2. Component Mode  
Functions as a module/library for a web UI, allowing manual control and visualization of agent decisions. This mode exposes APIs for UI integration while maintaining MCP server connectivity. 

## Architecture

### Core Components

1. **Agent Workflows** - Mastra-based LLM agents for strategic analysis
2. **MCP Client** - Connects to MCP Server for game state access
34. **Telemetry** - Optional OpenTelemetry support for monitoring

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
    "server": "http://localhost:4000"
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
├── vitest.config.ts       # Vitest configuration
└── README.md
```

### Commands

```bash
# Installation
npm install          # Install dependencies

# Workflow Entry Points
npm run briefer      # Run the briefer workflow directly
npm run strategist   # Run the strategist workflow directly

# Development
npm run dev          # Development mode with hot reload
npm test             # Run Vitest tests
npm run test:watch   # Run tests in watch mode
npm run test:ui      # Open Vitest UI
npm run type-check   # TypeScript type checking
npm run lint         # ESLint code linting
npm run build        # Build for production
```

## Testing

The project uses Vitest for testing. Tests are organized into:

- **Unit Tests** (`tests/unit/`): Test individual components and functions
- **Integration Tests** (`tests/integration/`): Test MCP server communication and workflow integration

Run tests with:
```bash
npm test                # Run all tests
npm run test:watch      # Watch mode for development
npm run test:coverage   # Generate coverage report
```

## Contributing

- Follow TypeScript best practices
- Write tests for new functionality using Vitest
- Use conventional commits
- Document agent workflows
- Ensure all tests pass before submitting PRs