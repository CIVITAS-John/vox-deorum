# Proposed Database Query Tools for LLM Decision-Making

This document outlines important database query tools that would enable LLMs to make informed strategic decisions in Civilization V. Each tool follows the pattern established by `get-technology.ts` with summary and full report schemas.

## 1. get-unit Tool

Query unit capabilities, strengths, maintenance costs, and requirements. Essential for military planning and unit production decisions.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "UNIT_WARRIOR"
  Name: string,           // e.g., "Warrior"
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
  PrereqTech: string,                    // Required technology
  ObsoleteTech: string,                  // Technology that makes unit obsolete
  UpgradesTo: string[],                  // Units this can upgrade to
  ResourcesRequired: {                   // Strategic resources needed
    ResourceType: string,
    Quantity: number
  }[],
  FreePromotions: string[],              // Promotions unit starts with
  MaintenanceCost: number,               // Gold per turn maintenance
  AIType: string,                        // AI behavior type
  DomainType: string,                    // DOMAIN_LAND, DOMAIN_SEA, DOMAIN_AIR
  SpecialAbilities: string[]             // Special abilities/traits
}
```

## 2. get-building Tool

Retrieve building benefits, costs, prerequisites, and yield changes. Critical for city development strategies.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "BUILDING_LIBRARY"
  Name: string,           // e.g., "Library"
  Cost: number,           // Production cost
  GoldMaintenance: number,// Gold per turn maintenance
  PrereqTech: string,     // Required technology
  IsWonder: boolean       // World/National wonder flag
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  BuildingClass: string,                 // Building class type
  PrereqBuildings: string[],             // Required buildings in city
  YieldChanges: {                        // Direct yield changes
    YieldType: string,
    Yield: number
  }[],
  SpecialistSlots: {                     // Specialist slots provided
    SpecialistType: string,
    Count: number
  }[],
  GreatPersonPoints: {                   // Great person generation
    GreatPersonType: string,
    Points: number
  }[],
  BuildingModifiers: {                   // Percentage modifiers
    ModifierType: string,               // e.g., "SCIENCE", "PRODUCTION"
    Modifier: number
  }[],
  ResourceYieldChanges: {                // Yield changes from resources
    ResourceType: string,
    YieldType: string,
    Yield: number
  }[],
  Happiness: number,                     // Local happiness
  Defense: number,                       // Defense bonus
  HitPoints: number,                     // City HP bonus
  SpecialAbilities: string[]             // Special effects text
}
```

## 3. get-policy Tool

Access policy tree information, benefits, and requirements. Vital for cultural/social development planning.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "POLICY_TRADITION"
  Name: string,           // e.g., "Tradition"
  PolicyBranch: string,   // Parent branch
  Level: number,          // Depth in tree (0 for opener)
  CultureCost: number     // Base culture cost
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  PrereqPolicies: string[],              // Required policies
  EraPrereq: string,                     // Minimum era required
  IdeologyRequired: string,              // Required ideology (if any)
  YieldModifiers: {                      // Empire-wide yield modifiers
    YieldType: string,
    Modifier: number
  }[],
  CityYieldChanges: {                    // Per-city yield changes
    YieldType: string,
    Yield: number
  }[],
  CapitalYieldChanges: {                 // Capital-specific yields
    YieldType: string,
    Yield: number
  }[],
  BuildingModifiers: {                   // Building-specific modifiers
    BuildingClass: string,
    ModifierType: string,
    Value: number
  }[],
  UnitModifiers: {                       // Unit-specific modifiers
    ModifierType: string,
    Value: number
  }[],
  HappinessModifiers: number,            // Global happiness changes
  SpecialEffects: string[]               // Text descriptions of effects
}
```

## 4. get-improvement Tool

Query terrain improvements, their yields, and requirements. Important for optimizing tile development.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "IMPROVEMENT_FARM"
  Name: string,           // e.g., "Farm"
  PrereqTech: string,     // Required technology
  BuildTime: number,      // Worker turns to build
  OnlyCity: boolean       // Can only be built near cities
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  ValidTerrains: string[],               // Terrains where buildable
  ValidFeatures: string[],               // Features where buildable
  ValidResources: string[],              // Resources this can improve
  BaseYields: {                          // Base yield changes
    YieldType: string,
    Yield: number
  }[],
  TechYieldChanges: {                    // Yields that improve with tech
    TechType: string,
    YieldType: string,
    Yield: number
  }[],
  FreshWaterYieldChanges: {              // Bonus yields if fresh water
    YieldType: string,
    Yield: number
  }[],
  HillsYieldChanges: {                   // Bonus yields on hills
    YieldType: string,
    Yield: number
  }[],
  RequiresFeatureRemoval: boolean,       // Must remove feature first
  Pillaged: boolean,                     // Can be pillaged
  SpecialProperties: string[]            // Special effects
}
```

## 5. get-resource Tool

Access resource types, yields, and strategic value. Critical for trade and strategic planning.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "RESOURCE_IRON"
  Name: string,           // e.g., "Iron"
  ResourceClass: string,  // RESOURCECLASS_LUXURY, RESOURCECLASS_STRATEGIC, RESOURCECLASS_BONUS
  TechReveal: string,     // Technology that reveals resource
  TechImprove: string     // Technology needed to improve
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  BaseYields: {                          // Yields from unimproved resource
    YieldType: string,
    Yield: number
  }[],
  ImprovementYields: {                   // Additional yields when improved
    ImprovementType: string,
    YieldType: string,
    Yield: number
  }[],
  ValidTerrains: string[],               // Where resource can appear
  ValidFeatures: string[],               // Features where can appear
  Happiness: number,                     // Happiness (luxury resources)
  StrategicValue: number,                // AI strategic importance
  UnitsRequiring: string[],              // Units that need this resource
  BuildingsRequiring: string[],          // Buildings that need this resource
  Frequency: number,                     // Map generation frequency
  SeaTrade: boolean,                     // Available for sea trade
  TradeValue: number                     // Base trade route value
}
```

## 6. get-civilization Tool

Query civilization unique abilities, units, and buildings. Essential for understanding opponents and leveraging own strengths.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "CIVILIZATION_ROME"
  Name: string,           // e.g., "Rome"
  Leader: string,         // Default leader name
  Adjective: string,      // e.g., "Roman"
  StartBias: string[]     // Terrain/feature start biases
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  UniqueAbility: {                       // Civilization trait
    Name: string,
    Description: string,
    Effects: string[]
  },
  UniqueUnits: {                         // Unique unit replacements
    BaseUnit: string,
    UniqueUnit: string,
    Differences: string[]
  }[],
  UniqueBuildings: {                     // Unique building replacements
    BaseBuilding: string,
    UniqueBuilding: string,
    Differences: string[]
  }[],
  UniqueImprovements: {                  // Unique improvements (if any)
    Type: string,
    Description: string,
    Effects: string[]
  }[],
  PersonalityTraits: {                   // AI personality tendencies
    Trait: string,
    Value: number
  }[],
  PreferredVictory: string,              // AI victory preference
  PreferredReligion: string,             // Preferred religion name
  CityNames: string[]                    // List of city names
}
```

## 7. get-belief Tool

Access religious beliefs and their effects. Important for religious victory strategies.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "BELIEF_TITHE"
  Name: string,           // e.g., "Tithe"
  Category: string,       // BELIEF_PANTHEON, BELIEF_FOUNDER, etc.
  MinFollowers: number,   // Minimum followers required
  MaxReligions: number    // Max religions that can adopt
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  RequiredReligion: boolean,             // Requires founded religion
  CityYieldChanges: {                    // Per-city yield changes
    YieldType: string,
    Yield: number
  }[],
  HolyCityYieldChanges: {                // Holy city yield changes
    YieldType: string,
    Yield: number
  }[],
  YieldPerFollower: {                    // Yields per X followers
    YieldType: string,
    YieldPer: number,
    Followers: number
  }[],
  BuildingClassChanges: {                // Building modifications
    BuildingClass: string,
    ChangeType: string,
    Value: number
  }[],
  UnitModifiers: {                       // Unit modifications
    ModifierType: string,
    Value: number
  }[],
  SpreadModifiers: {                     // Religion spread modifiers
    ModifierType: string,
    Value: number
  }[],
  SpecialEffects: string[]               // Special belief effects
}
```

## 8. get-great-person Tool

Query great person types and abilities. Crucial for cultural and scientific advancement planning.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "GREAT_PERSON_SCIENTIST"
  Name: string,           // e.g., "Great Scientist"
  Class: string,          // e.g., "GREAT_PERSON_CLASS_SCIENCE"
  BasePointsRequired: number, // Points needed to spawn
  PointScaling: number    // Points increase per spawn
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  Abilities: {                           // Special abilities
    AbilityType: string,                // e.g., "DISCOVER_TECH", "BUILD_IMPROVEMENT"
    Description: string,
    Value: number                       // Strength/amount of effect
  }[],
  ImprovementCreated: string,           // Improvement GP can create
  ImprovementYields: {                   // Yields from improvement
    YieldType: string,
    Yield: number
  }[],
  GreatWorks: {                          // Great works can create
    WorkType: string,
    BaseValue: number,
    ThemingBonus: number
  }[],
  BuildingsWithSlots: string[],         // Buildings that generate points
  SpecialistsGenerating: string[],      // Specialists that generate points
  PolicyModifiers: string[],            // Policies affecting generation
  WonderModifiers: string[]             // Wonders affecting generation
}
```

## 9. get-terrain-feature Tool

Access terrain and feature yields and modifiers. Essential for city placement and expansion decisions.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "TERRAIN_GRASSLAND" or "FEATURE_FOREST"
  Name: string,           // e.g., "Grassland" or "Forest"
  Category: string,       // "TERRAIN" or "FEATURE"
  Movement: number,       // Movement cost
  Defense: number         // Defense modifier
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  BaseYields: {                          // Base tile yields
    YieldType: string,
    Yield: number
  }[],
  FreshWaterYields: {                   // Additional yields with fresh water
    YieldType: string,
    Yield: number
  }[],
  HillsYields: {                        // Additional yields on hills
    YieldType: string,
    Yield: number
  }[],
  ValidImprovements: string[],          // Improvements that can be built
  ValidResources: string[],             // Resources that can appear
  RemovalTech: string,                  // Tech to remove (features)
  RemovalTime: number,                  // Worker turns to remove
  RemovalProduction: number,            // Production from removal
  NaturalWonder: boolean,               // Is natural wonder
  Impassable: boolean,                  // Cannot be entered
  CanFoundCity: boolean,                // Can found city on tile
  RiverCrossing: number                 // River crossing penalty
}
```

## 10. get-promotion Tool

Query unit promotion trees and effects. Important for military unit development strategies.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "PROMOTION_DRILL_1"
  Name: string,           // e.g., "Drill I"
  PromotionClass: string, // Promotion category
  Level: number,          // Tier in promotion tree
  PrereqPromotion: string // Required promotion
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  PrereqPromotions: string[],           // All required promotions
  UnitCombatTypes: string[],            // Valid unit combat types
  CombatModifier: number,                // General combat bonus
  TerrainModifiers: {                   // Terrain-specific bonuses
    TerrainType: string,
    Modifier: number
  }[],
  FeatureModifiers: {                   // Feature-specific bonuses
    FeatureType: string,
    Modifier: number
  }[],
  UnitClassModifiers: {                 // Bonuses vs unit classes
    UnitClass: string,
    Modifier: number
  }[],
  DomainModifiers: {                    // Domain-specific bonuses
    Domain: string,
    Modifier: number
  }[],
  MovementBonus: number,                // Extra movement
  HealBonus: number,                    // Healing rate bonus
  SpecialAbilities: {                   // Special abilities
    Ability: string,
    Description: string
  }[]
}
```

## 11. get-victory-condition Tool

Access victory types and requirements. Critical for overall strategy planning.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "VICTORY_DOMINATION"
  Name: string,           // e.g., "Domination Victory"
  IsTargetScore: boolean, // Score-based victory
  VictoryPoints: number,  // Points required (if applicable)
  Enabled: boolean        // Currently enabled in game
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
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

## 12. get-era Tool

Query era progression and bonuses. Important for long-term planning.

### Summary Schema
```typescript
{
  Type: string,           // e.g., "ERA_CLASSICAL"
  Name: string,           // e.g., "Classical Era"
  ID: number,             // Era sequence number
  ResearchAgreementTurns: number, // RA duration
  StartingUnitType: string // Starting unit for era
}
```

### Full Report Schema
```typescript
{
  // All summary fields plus:
  TechsInEra: string[],                 // Technologies in this era
  RequiredTechs: number,                // Techs needed to advance
  GreatPersonThreshold: number,         // GP point threshold modifier
  CityBombardRange: number,             // City attack range
  WarmongerModifier: number,            // Warmonger penalty modifier
  TradeRouteRange: number,              // Trade route range
  SpyRankRequired: number,              // Spy rank for era
  PolicyCostModifier: number,           // Policy cost adjustment
  BuildingMaintenanceModifier: number,  // Maintenance adjustment
  UnitMaintenanceModifier: number,      // Unit maintenance adjustment
  WonderProductionModifier: number,     // Wonder production adjustment
  BarbarianSpawnModifier: number,       // Barbarian spawn rate
  NewUnitsAvailable: string[],          // Units unlocked in era
  NewBuildingsAvailable: string[],      // Buildings unlocked in era
  NewWondersAvailable: string[]         // Wonders unlocked in era
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

Tools should be registered in the MCP server's tool index and made available through the Bridge Service for LLM agents to query game state and make informed decisions.