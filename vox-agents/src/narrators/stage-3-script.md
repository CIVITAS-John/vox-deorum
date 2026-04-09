# Stage 3: Script — Generate Narration Scripts

## Contract

### Config

```typescript
interface ScriptConfig extends NarratorStageConfig {
  type: 'narrator-script';
  writer: 'phased-writer';
}
```

### Input
- `workspace/selection.json` (SelectionOutput from Stage 2)
- `workspace/episodes.json` (Episodes from Stage 1)
- Knowledge DB at `knowledgeDbPath` (queried directly for detailed game context)

### Output: `workspace/scripts.json`

```typescript
interface ScriptsOutput {
  arc: ArcOutline;
  scripts: ScriptedEpisode[];        // in presentation order
}

interface ArcOutline {
  hook: string;                      // opening line/concept
  throughline: string;               // the central narrative thread
  tone: string;                      // overall tone (dramatic, analytical, humorous, epic)
  episodeBeats: EpisodeBeat[];       // per-episode beat, in presentation order
  closer: string;                    // ending concept
}

interface EpisodeBeat {
  turn: number;
  playerID: number;
  order: number;                     // presentation order (may differ from chronological)
  beat: string;                      // what this episode contributes to the arc
  keyDetail: string;                 // the specific detail to highlight
  transition: string;                // how to transition from the previous episode
}

interface ScriptedEpisode {
  turn: number;
  playerID: number;
  script: string;                    // the narration text
  wordCount: number;
  estimatedDuration: number;         // wordCount / 2.5 * 1000
  openingLine: string;               // for quick preview
}
```

### LLM Required — multiple implementations possible

This is the most creative stage. It determines episode ordering and writes narration text.

---

## DB Context Fetching (shared across implementations)

Before LLM calls, the stage runner programmatically queries the knowledge DB for each selected episode's turn/player to build a context bundle. Agents receive this as structured input — they don't query the DB themselves.

```typescript
interface EpisodeContext {
  turn: number;
  playerID: number;

  // From PlayerSummaries (all players at this turn — omniscient)
  playerStates: Array<{
    playerID: number;
    civilization: string;
    score: number; cities: number; population: number;
    militaryStrength: number; technologies: number;
    era: string;
  }>;

  // From GameEvents (all events this turn, all visibility — omniscient)
  events: Array<{
    type: string;
    payload: Record<string, unknown>;
  }>;

  // From VictoryProgress
  victoryStandings: Array<{
    playerID: number;
    domination: number; science: number;
    culture: number; diplomatic: number;
  }>;

  // From PlayerOpinions (diplomatic relationships)
  opinions: Array<{
    fromPlayer: number; toPlayer: number;
    opinion: string;
  }>;
}
```

---

## Reference Implementation: Outline + Sequential Scripting

Two-phase process: arc outline first, then per-episode scripts.

### Phase A: Arc Outline

**Agent:** `NarratorOutliner`

**Extends:** `VoxAgent` — programmatic, maxSteps: 1, no tools.

**Input:** All selected episodes' game contexts + game outcome + selection rationales.

**What it decides:**
- Presentation order (may reorder from chronological for dramatic effect)
- Per-episode beat (what narrative role each episode plays)
- Opening hook and closing concept
- Overall tone and throughline

This is one LLM call. The outline ensures coherence without needing to pass full scripts between episodes.

### Phase B: Per-Episode Scripting

**Agent:** `NarratorScripter`

**Extends:** `VoxAgent` — programmatic, maxSteps: 1, no tools.

Executed **sequentially** in presentation order (from arc outline). Each call receives:
- The arc outline (always in context)
- This episode's game context bundle
- The beat for this episode (from outline)
- The previous episode's script (rolling window of 1, for transition continuity)
- Word budget: `duration / 1000 * 2.5` words (approx 150 words/minute speaking rate)

**Efficiency:** Phase A = 1 LLM call. Phase B = N calls (one per episode). For TikTok (3-5 episodes) = 4-6 total. For documentary (15-30 episodes) = 16-31 calls, each small.

---

## Alternative Implementation Ideas

- **Single-pass scripter:** Skip the outline. Feed all selected episodes + contexts in one large prompt, get all scripts at once. Simpler but may exceed context limits for long games.
- **Batched scripter:** Group episodes into narrative chapters, outline per chapter, script per episode within chapter. Better for very long documentaries.
- **Style-specialized scripters:** Different agent classes for TikTok vs documentary, with tailored prompts and output formats rather than parameterized style instructions.
