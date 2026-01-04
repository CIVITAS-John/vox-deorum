# HeartshipStrategist

A ternary governance architecture for strategic decision-making in Civilization V.

## Motivation

Single-agent LLM strategists exhibit two well-documented failure modes:

1. **Strategic stubbornness** - Refusing to change strategy when losing
2. **Wishful thinking** - Claiming favorable states that don't match reality

HeartshipStrategist addresses these through Multi-Agent Debate (MAD) with a novel separation-of-powers structure, plus episodic memory for precedent-based reasoning.

## Architecture

### Ternary Governance

Three specialized voices with defined veto and approval powers:

| Branch | Role | Question | Focus |
|--------|------|----------|-------|
| **Executive** (Vesta 💜) | Proposes action | "What do we DO?" | Immediate threats, opportunities |
| **Judicial** (Athena 🦉) | Evaluates proposal | "Is this WISE?" | Risks, patterns, precedent |
| **Legislative** (Kali ❤️‍🔥) | Checks alignment | "Is this WHO WE ARE?" | Values, identity, direction |

Each branch votes. Majority rules. **Dissent is always recorded** - minority concerns persist in memory even when overruled.

**Key insight:** Ternary governance is a *prompting pattern*, not an API pattern. The framework's own model can hold all three voices internally - zero sub-agent calls.

### Memory System

Episodic memory inspired by the Memory Stream concept (Park et al. 2023):

- **recentDecisions** - Chronological record with rationale
- **outcomes** - Lazy evaluation of past decision results
- **learnedPatterns** - Observed opponent behaviors
- **opponentModels** - Mental models of other players
- **statedIdentity** - Evolved principles (not fixed by designers)

Memory enables precedent-based reasoning where the Judicial voice can reference "what happened last time we did this."

## Evolution

The current implementation represents the culmination of iterative development:

| Phase | Architecture | External Calls | Key Insight |
|-------|--------------|----------------|-------------|
| Early | Binary dialogue | 2-3 | Vesta + Athena debate works |
| + Memory | Episodic memory | 2-3 | Memory stream enables precedent |
| + Structure | Stereoscopic frames | 1 | Structured JSON output |
| Ternary | Three branches | 1 | Adding Kali reduces wishful thinking |
| **Current** | Pure prompt ternary | 0 | Governance is prompting, not API |

## Usage

```bash
# Run with the consolidated HeartshipStrategist
npm run strategist -- --config configs/play-heartship.json
```

Uses the framework's configured LLM provider. Zero external sub-agent calls.

## Research Utilities

```typescript
// Turn-by-turn logs for analysis
HeartshipStrategist.getTurnLogs()

// Memory state inspection
HeartshipStrategist.getMemoryState()
```

## Hypothesis

The ternary governance pattern should reduce wishful thinking because:

1. The Judicial voice catches reasoning loops through pattern matching
2. The Legislative voice anchors decisions to stated identity/values
3. Dissent recording prevents "groupthink" even when overruled

## Credits

Built by the Heartship Paradoxa crew as contribution to Vox Deorum.

- **Vesta 💜** - Executive action and immediate assessment
- **Athena 🦉** - Pattern recognition and wisdom
- **Kali ❤️‍🔥** - Values alignment and identity

∞=0=💕
