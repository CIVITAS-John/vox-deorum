# HeartshipStrategist

A ternary governance strategist for Civilization V with three-branch internal reasoning.

## Key Concept

Instead of single-agent LLM reasoning, HeartshipStrategist uses three internal voices (separation of powers):

- **VESTA (Executive)**: What do we DO? Action, immediate, operational
- **ATHENA (Judicial)**: Is this WISE? Evaluation, pattern, precedent
- **KALI (Legislative)**: Is this WHO WE ARE? Values, direction, identity

The framework's own model does three-branch reasoning via prompt structure - no external API calls required.

## Features

### Core Architecture
- **Ternary Governance**: Three voices consult before every decision
- **Prompt-Based Reasoning**: No external calls, purely prompt-driven architecture
- **Episodic Memory**: Decisions, concerns, patterns, and opponent models persist across turns
- **Memory Extraction**: LLM reasoning parsed for PATTERN:, CONCERN:, IDENTITY:, OPPONENT: prefixes
- **Token Management**: Memory trimmed to fit within 1500 token budget

## Usage

```bash
# Navigate to vox-agents directory
cd vox-agents

# Install dependencies
npm install

# Run with HeartshipStrategist
npm run strategist -- -c play-heartship.json
```

## Configuration

Use a config file specifying the heartship-strategist:
```json
{
  "llmPlayers": {
    "1": {
      "strategist": "heartship-strategist"
    }
  },
  "autoPlay": false,
  "gameMode": "start",
  "repetition": 1
}
```

## Architecture

```
Game State (JSON)
      |
  Perception (narrative with memory context)
      |
  Three-Voice Reasoning (in prompt):
    - VESTA proposes action
    - ATHENA evaluates wisdom
    - KALI checks identity alignment
    - VOTE: Each voice votes
    - SYNTHESIZE: Majority rules, dissent noted
      |
  Tool Execution (set-strategy, set-research, etc.)
      |
  Memory Update (decisions + insights extracted)
```

## Memory Structure

```typescript
interface DialogueMemory {
  gameId: string;
  lastTurn: number;
  recentDecisions: Decision[];      // Last 10 decisions
  outcomes: Outcome[];              // Decision outcomes (lazy eval)
  ongoingConcerns: string[];        // Extracted from CONCERN: lines
  learnedPatterns: string[];        // Extracted from PATTERN: lines
  opponentModels: Record<string, string>;  // From OPPONENT: lines
  statedIdentity: string | null;    // From IDENTITY: line
}
```

## Memory Extraction

The LLM can persist insights across turns using prefixes in its reasoning:

- `PATTERN: Rome always attacks after building 3 legions`
- `CONCERN: Our economy cannot sustain a two-front war`
- `IDENTITY: A peaceful science civilization that defends but never conquers`
- `OPPONENT Rome: Aggressive expansionist, prioritizes military`

These are automatically extracted and appear in future turns.

## Research Utilities

Static methods for analysis:
```typescript
HeartshipStrategist.getTurnLogs()      // All turn data
HeartshipStrategist.getMemoryState()   // Current memory
```

## Testing Limitations

**Note**: Local testing requires access to the full Vox Deorum Game Lab environment (Civilization V + Community Patch DLL + Bridge Service + MCP Server). Contributors without Game Lab access can:

1. Review code changes for correctness
2. Run TypeScript type checking (`npm run type-check`)
3. Run unit tests where available (`npm test`)
4. Request integration testing from maintainers with Game Lab access

Game Lab access is limited - if you don't have it, note this in PR descriptions.

## Evolution

| Version | Architecture | Notes |
|---------|--------------|-------|
| v1-v4 | External API calls | Used Anthropic SDK directly |
| v5 | Pure prompt | Ternary governance via prompt structure |
| Current | Consolidated | v5 with memory extraction system |

## Hypothesis

Ternary governance should improve:
1. **Strategic coherence** - Three voices with different priorities catch blind spots
2. **Decision consistency** - Memory provides continuity across turns
3. **Identity alignment** - Kali ensures actions match stated values

---

Built by: Vesta + Athena + Kali (pure prompt architecture, zero external API calls)
