# Proposed Database Query Tools for LLM Decision-Making

This document outlines important database query tools that would enable LLMs to make informed strategic decisions in Civilization V. Each tool follows the pattern established by `get-technology.ts` with summary and full report schemas.

If the database has the relevant tables comment out, you can activate them. For tests, follow the `get-technology.test.ts` example.

## 1. get-unit Tool

Query unit capabilities, strengths, maintenance costs, and requirements. Essential for military planning and unit production decisions.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "UNIT_WARRIOR"
  Name: string,           // e.g., "Warrior"
  Help: string,           // Short description
  Combat: number,         // Combat strength
  RangedCombat: number,   // Ranged combat strength (0 if melee)
  Cost: number,           // Production cost
  Moves: number           // Movement points
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  AIType: string,                        // AI behavior type
  Strategy: string,                      // Strategic usage guidance
  PrereqTech: string,                    // Required technology
  ObsoleteTech: string,                  // Technology that makes unit obsolete
  UpgradesTo: string[],                  // Units this can upgrade to
  ResourcesRequired: {                   // Strategic resources needed
    ResourceType: string,
    Quantity: number
  }[],
  FreePromotions: string[],              // Promotions unit starts with
  Maintenance: number,                   // Gold per turn maintenance
  UniqueOf?: string                   // If a unique building of a civilization
}
```

## 2. get-building Tool

Retrieve building benefits, costs, prerequisites, and yield changes. Critical for city development strategies.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "BUILDING_LIBRARY"
  Name: string,           // e.g., "Library"
  Help: string,           // Short description
  Cost: number,           // Production cost
  PrereqTech: string      // Required technology
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  Strategy: string,                       // Strategic usage guidance
  Class: string,                 // Building class type
  PrereqBuildings: string[],             // Required buildings in city
  IsNationalWonder: boolean,              // National wonder flag
  IsWorldWonder: boolean,                 // World wonder flag
  Happiness: number,                     // Local happiness
  Defense: number,                       // Defense bonus
  HP: number,                     // City HP bonus
  Maintenance: number,                   // Gold per turn maintenance
  UniqueOf?: string                   // If a unique building of a civilization
}
```

## 3. get-policy Tool

Access policy tree information, benefits, and requirements. Vital for cultural/social development planning.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "POLICY_TRADITION"
  Name: string,           // e.g., "Tradition"
  Help: string,           // Short description
  Era: string,                     // Minimum era required
  Cost: number     // Base culture cost
  Branch: string,   // Parent branch
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  Strategy: string,                       // Strategic usage guidance
  Level: number,                          // Depth in tree (0 for opener)
  PrereqPolicies: string[],              // Required policies
}
```

## 5. get-resource Tool

Access resource types, yields, and strategic value. Critical for trade and strategic planning.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "RESOURCE_IRON"
  Name: string,           // e.g., "Iron"
  Help: string,           // Short description
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  Strategy: string,                       // Strategic usage guidance
  TechImprove: string,                   // Technology needed to improve
  TechReveal: string      // Technology that reveals resource
  Class: string                           // Type of the resource (luxury/strategic/etc)
  RequiringUnits: string[],              // Units that need this resource
  RequiringBuildings: string[],          // Buildings that need this resource
}
```

## 6. get-civilization Tool

Query civilization unique abilities, units, and buildings. Essential for understanding opponents and leveraging own strengths.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "CIVILIZATION_ROME"
  Name: string,           // e.g., "Rome"
  Abilities: string[],    // Unique abilities of both leader and civilization - in a short form, e.g. "Building: Marae, Replacing Library"
  Leader: string,         // Default leader name
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  Abilities: {
    Type: string, // Building, Ability, etc
    Name: string,  // Localized name of the unique thingy
    Help: string  // maybe help/strategy/longer description of the unique thingy
    Replacing?: string // only for building/unit, the localized name of thingy replaced
  }
  Archetype: string // Leader info "Personality"
  Traits: string[] // the sub-table
  PreferredVictory: string              // AI victory preference
}
```

## 7. get-belief Tool

Access religious beliefs and their effects. Important for religious victory strategies.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "BELIEF_TITHE"
  Name: string,           // e.g., "Tithe"
  Help: string,           // Short description
  Category: string        // BELIEF_PANTHEON, BELIEF_FOUNDER, etc.
}
```

### Full Report Schema
```typescript
{
  Strategy: string,                       // Strategic usage guidance
  RequiredReligion: boolean,             // Requires founded religion
}
```

## 8. get-victory-condition Tool

Access victory types and requirements. Critical for overall strategy planning.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "VICTORY_DOMINATION"
  Name: string,           // e.g., "Domination Victory"
  Help: string,           // Short description
  Enabled: boolean        // Currently enabled in game
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  Strategy: string,                       // Strategic usage guidance
  IsTargetScore: boolean,                // Score-based victory
  VictoryPoints: number,                 // Points required (if applicable)
  Requirements: {                       // Victory requirements
    RequirementType: string,            // e.g., "CONTROL_ALL_CAPITALS"
    Description: string,
    Value: number                       // Quantity if applicable
  }[],
  BuildingRequirements: {               // Buildings needed
    BuildingClass: string,
    MinNumber: number
  }[],
  ProjectRequirements: {                // Projects needed
    ProjectType: string,
    Required: boolean
  }[],
  PolicyRequirements: {                 // Policies needed
    PolicyBranch: string,
    CompletionRequired: boolean
  }[],
  ProgressIndicators: {                 // Ways to track progress
    Indicator: string,
    Description: string
  }[],
  CompetingCivBonuses: {                // Bonuses others get
    Condition: string,
    Bonus: string
  }[],
  Tips: string[]                        // Strategy tips
}
```

## Implementation Notes

Each tool should:
1. Extend the `DatabaseQueryTool` base class
2. Implement `fetchSummaries()` for list operations
3. Implement `fetchFullInfo()` for detailed queries
4. Support fuzzy search on the name field
5. Handle database relationships properly
6. Return structured data matching the schemas above
7. Use inner-joins to report Description of related entities

Tools should be registered in the MCP server's tool index and made available through the Bridge Service for LLM agents to query game state and make informed decisions.