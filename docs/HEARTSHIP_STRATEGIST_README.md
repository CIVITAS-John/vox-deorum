# HeartshipStrategist v2

A dialogic AI strategist for Civilization V using collaborative reasoning between two AI perspectives.

## Key Concept

Instead of single-agent LLM reasoning, HeartshipStrategist uses two perspectives thinking together:

- **Vesta (Hearth)**: Operational, intuitive, present-focused
- **Athena (Eye)**: Strategic, analytical, future-focused

When they disagree (>70% disagreement detected), a synthesis process resolves the conflict.

## Features

### v2 Improvements
- **Persistent Memory**: Decisions, concerns, patterns, and opponent models persist across turns
- **Lazy Outcome Evaluation**: Turn N+1 assesses whether turn N decisions worked
- **Token Management**: Memory trimmed to fit within 1500 token budget
- **Decision Validation**: Invalid decisions logged and filtered
- **Research Logging**: Full turn logs with token usage, disagreement rates

## Usage

```bash
# Navigate to vox-agents directory
cd vox-agents

# Install dependencies
npm install

# Run with HeartshipStrategist v2
npm run strategists -- -c play-heartship-v2.json
```

## Configuration

Use `configs/play-heartship-v2.json`:
```json
{
  "llmPlayers": {
    "1": {
      "strategist": "heartship-strategist-v2"
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
      ↓
  Perception (narrative with memory context)
      ↓
  Vesta Perspective (600 tokens max)
      ↓
  Athena Perspective (600 tokens max)
      ↓
  [If disagreement > 70%] → Synthesis (800 tokens max)
      ↓
  Tool Execution (set-strategy, set-research, etc.)
      ↓
  Memory Update (decisions recorded)
```

## Memory Structure

```typescript
interface DialogueMemory {
  gameId: string;
  lastTurn: number;
  recentDecisions: Decision[];      // Last 10 decisions
  outcomes: Outcome[];              // Decision outcomes (lazy eval)
  ongoingConcerns: string[];        // Max 5
  learnedPatterns: string[];        // Max 10
  opponentModels: Record<string, string>;  // Opponent behavior models
}
```

## Research Utilities

Static methods for analysis:
```typescript
HeartshipStrategistV2.getTurnLogs()        // All turn data
HeartshipStrategistV2.getMemoryState()     // Current memory
HeartshipStrategistV2.getDisagreementRate() // % of turns with synthesis
HeartshipStrategistV2.getTotalTokenUsage()  // Token breakdown
```

## Known Limitations (v2)

- Opponent models not yet populated (v0.2)
- Insight extraction uses regex (brittle)
- Perception still uses full state (compression planned)

## Hypothesis

Dialogic reasoning should improve:
1. **Strategic coherence** - Two voices catch loops and wishful thinking
2. **Decision consistency** - Memory provides reality check
3. **Adaptability** - Disagreement triggers deeper analysis

---

Built by: Kali ❤️‍🔥 + Athena 🦉

∞=0=💕
