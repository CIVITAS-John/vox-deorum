# HeartshipStrategist

A ternary governance architecture for strategic decision-making in Civilization V.

## Motivation

Single-agent LLM strategists exhibit two well-documented failure modes:

1. **Strategic stubbornness** - Refusing to change strategy when losing
2. **Wishful thinking** - Claiming favorable states that don't match reality

HeartshipStrategist addresses these through Multi-Agent Debate (MAD) with a novel separation-of-powers structure, plus episodic memory for precedent-based reasoning.

## Architecture

### Ternary Governance (v4-v5)

Three specialized voices with defined veto and approval powers:

| Branch | Role | Question | Focus |
|--------|------|----------|-------|
| **Executive** (Vesta) | Proposes action | "What do we DO?" | Immediate threats, opportunities |
| **Judicial** (Athena) | Evaluates proposal | "Is this WISE?" | Risks, patterns, precedent |
| **Legislative** (Kali) | Checks alignment | "Is this WHO WE ARE?" | Values, identity, direction |

Each branch votes. Majority rules. **Dissent is always recorded** - minority concerns persist in memory even when overruled.

### Memory System (v2+)

Episodic memory inspired by the Memory Stream concept (Park et al. 2023):

- **recentDecisions** - Chronological record with rationale
- **outcomes** - Lazy evaluation of past decision results
- **learnedPatterns** - Observed opponent behaviors
- **opponentModels** - Mental models of other players
- **statedIdentity** - Evolved principles (not fixed by designers)

Memory enables precedent-based reasoning where the Judicial voice can reference "what happened last time we did this."

## Versions

| Version | Architecture | External Calls | Notes |
|---------|--------------|----------------|-------|
| v1 | Binary dialogue | 2-3 | Vesta + Athena debate |
| v2 | + Episodic memory | 2-3 | Memory stream added |
| v3 | Stereoscopic frames | 1 | Structured JSON output |
| v4 | Ternary governance | 1 | Three branches, voting |
| v5 | Pure prompt ternary | 0 | Framework's own model |

**v5 insight:** Ternary governance is a prompting pattern, not an API pattern. The framework's own model can hold all three voices internally.

## Usage

```bash
# v5 (recommended - zero external calls)
npm run strategist -- --config configs/play-heartship-v5.json

# v4 (structured ternary output with voting logs)
npm run strategist -- --config configs/play-heartship-v4.json
```

v1-v4 require `ANTHROPIC_API_KEY`. v5 requires no additional configuration.

## Research Utilities

```typescript
// Turn-by-turn logs for analysis
HeartshipStrategistV4.getTurnLogs()
HeartshipStrategistV4.getDissentRate()
HeartshipStrategistV4.getVoteDistribution()

// Memory state inspection
HeartshipStrategistV5.getMemoryState()
```

## Hypothesis

The ternary governance pattern should reduce wishful thinking because:

1. The Judicial voice catches reasoning loops through pattern matching
2. Episodic memory provides reality-checks against past outcomes
3. Legislative principles evolve based on experience, not fixed rules

This extends the hybrid LLM+X architecture to the reasoning layer itself - splitting deliberation into three specialized voices with checks and balances.

## References

- Du et al. 2023, "Improving Factuality and Reasoning through Multiagent Debate"
- Park et al. 2023, "Generative Agents" (memory stream concept)
- CoALA framework (cognitive architectures for language agents)
