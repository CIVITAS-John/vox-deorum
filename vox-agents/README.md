# Vox Agents

LLM-powered strategic AI agents for Civilization V that analyze game state and provide high-level decision making.

## Purpose

Provides intelligent strategy through:
- **Game Analysis**: Real-time situation assessment via MCP
- **Strategic Planning**: LLM-based decision workflows
- **Agent Orchestration**: Coordinated multi-agent strategies
- **Flexible Deployment**: Standalone service or UI component

## Quick Start

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Run strategist workflow
npm run strategist

# Run tests
npm test
```

## Architecture

### Core Components
- **VoxAgent** (`src/infra/vox-agent.ts`) - Base agent framework
- **VoxContext** (`src/infra/vox-context.ts`) - Game context management
- **Strategist** (`src/strategist/`) - Strategic decision workflows
- **MCP Client** (`src/utils/mcp-client.ts`) - MCP server communication
- **Tool Wrappers** (`src/utils/tool-wrappers.ts`) - MCP tool abstractions

### Communication Flow
```
LLM Provider ← Vox Agents → MCP Server → Bridge Service → Civ V
                  (MCP)       (HTTP/SSE)    (Named Pipe)
```

## Configuration

Edit environment variables or `config.json`:
- MCP server endpoint
- LLM provider settings
- Telemetry configuration (optional)

## Development

### Project Structure
```
vox-agents/
├── src/
│   ├── infra/         # Core agent infrastructure
│   ├── strategist/    # Strategy workflows
│   └── utils/         # Shared utilities
├── tests/            # Vitest tests
└── package.json
```

### Creating Agents

```typescript
// Extend VoxAgent for new workflows
import { VoxAgent } from "./infra/vox-agent.js";

class MyAgent extends VoxAgent {
  async analyze(context: VoxContext) {
    // Implement analysis logic
  }
}
```

### Scripts
- `npm run dev` - Development with hot reload
- `npm run strategist` - Run strategist workflow
- `npm test` - Run tests
- `npm run test:watch` - Watch mode
- `npm run type-check` - TypeScript checking
- `npm run lint` - ESLint

## Testing

Uses Vitest for all testing:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Notes

- Requires MCP Server running
- LLM API keys must be configured
- Supports OpenTelemetry for monitoring
- ESM modules with .js imports