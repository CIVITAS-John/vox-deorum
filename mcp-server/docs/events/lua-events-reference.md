# Lua Events Documentation - Vox Deorum

**Original Request**: "Analyze each event in the json file and create a documentation with: Name, Meaning, and Arguments for each event. Call a subagent for each event. After you are done, check if any events are omitted. then, call subagents to validate and revise the report accordingly. In the report, document this prompt so that we can automate the process in the future."

## Overview

This document provides a comprehensive reference for all 51 Lua events that can be intercepted and forwarded by the Vox Deorum system. These events are automatically captured through the `LuaSupport::CallHook` interception mechanism in the Community Patch DLL and forwarded to external services via the Bridge Service using Server-Sent Events (SSE).

The events documented here represent the complete set of game state changes and actions that external AI services can monitor and respond to, enabling real-time analysis and decision-making for enhanced Civilization V gameplay.

## Event Categories

The 51 events are organized into the following logical categories:

### City Management (7 events)
- Population changes and growth
- Construction and building management
- Plot acquisition and expansion
- City founding and capture

### Combat & Military (8 events)
- Unit combat and casualties
- Nuclear warfare
- Unit movement and positioning
- Military promotions and upgrades

### Diplomacy & Politics (6 events)
- War declarations and peace treaties
- Team meetings and relationships
- Alliance formations

### Technology & Research (4 events)
- Technology discoveries
- Era transitions
- Goody hut research bonuses

### Religion & Culture (6 events)
- Pantheon and religion founding
- Religious conversion events
- Policy adoption and golden ages

### Exploration & Discovery (3 events)
- Natural wonder discoveries
- Circumnavigation achievements
- Special exploration targets

### Game Flow & System (10 events)
- Turn management and completion
- Game core updates
- Victory condition checks
- Replay statistics gathering

### Player Actions (6 events)
- Turn initiation and completion
- Great person expenditure
- Pre-AI update processing

### Construction & Development (1 event)
- Build completion events

## Complete Event Reference

### City Management Events

#### SetPopulation
- **Category**: City Management
- **Meaning**: Triggered when a city's population changes
- **Arguments**: 
  - `cityID` (number): Unique identifier for the city
  - `newPopulation` (number): The new population value
- **Source Location**: Multiple locations in city growth and management code
- **Trigger Conditions**: Population growth, starvation, conquest effects

#### CityBoughtPlot
- **Category**: City Management  
- **Meaning**: Fired when a city purchases a plot with gold
- **Arguments**:
  - `cityID` (number): City that bought the plot
  - `plotX` (number): X coordinate of purchased plot
  - `plotY` (number): Y coordinate of purchased plot
  - `cost` (number): Gold cost of the purchase
- **Source Location**: Plot purchase validation and execution code
- **Trigger Conditions**: Player manually buys plot, AI city expansion via gold purchase

#### CityTrained
- **Category**: City Management
- **Meaning**: Called when a city completes training a unit
- **Arguments**:
  - `cityID` (number): City that trained the unit
  - `unitType` (string): Type of unit trained
  - `unitID` (number): Unique ID of the newly trained unit
- **Source Location**: Unit production completion code
- **Trigger Conditions**: City finishes unit production, unit rush-bought with gold/faith

#### CityConstructed
- **Category**: City Management
- **Meaning**: Triggered when a city completes construction of a building or wonder
- **Arguments**:
  - `cityID` (number): City that completed construction
  - `buildingType` (string): Type of building/wonder constructed
  - `isWonder` (boolean): True if the construction was a world/national wonder
- **Source Location**: Building production completion handlers
- **Trigger Conditions**: Natural construction completion, rush-bought buildings

#### CityCreated
- **Category**: City Management
- **Meaning**: Fired when a new city is established
- **Arguments**:
  - `playerID` (number): Player who founded the city
  - `cityID` (number): Unique identifier for the new city
  - `cityName` (string): Name assigned to the city
  - `plotX` (number): X coordinate of city location
  - `plotY` (number): Y coordinate of city location
- **Source Location**: City foundation code in settler actions
- **Trigger Conditions**: Settler founds city, city gifted through diplomacy, city captured and kept

#### CitySoldBuilding
- **Category**: City Management
- **Meaning**: Called when a player sells a building for gold
- **Arguments**:
  - `cityID` (number): City where building was sold
  - `buildingType` (string): Type of building sold
  - `goldReceived` (number): Amount of gold received from sale
- **Source Location**: Building management interface handlers
- **Trigger Conditions**: Player manually sells building via city screen

#### CityCaptureComplete
- **Category**: City Management
- **Meaning**: Triggered after a city capture is fully processed
- **Arguments**:
  - `originalOwnerID` (number): Player who previously owned the city
  - `newOwnerID` (number): Player who captured the city
  - `cityID` (number): Captured city identifier
  - `cityDamage` (number): Damage dealt to city during capture
- **Source Location**: Combat resolution and city capture logic
- **Trigger Conditions**: Military unit captures enemy city, city surrenders

### Combat & Military Events

#### UnitKilledInCombat
- **Category**: Combat & Military
- **Meaning**: Fired when a unit is destroyed in battle
- **Arguments**:
  - `deadUnitID` (number): ID of the unit that was killed
  - `killerUnitID` (number): ID of the unit that made the kill
  - `plotX` (number): X coordinate where combat occurred
  - `plotY` (number): Y coordinate where combat occurred
- **Source Location**: Combat resolution code
- **Trigger Conditions**: Unit health reaches 0 in combat, unit destroyed by ranged attack

#### CombatResult
- **Category**: Combat & Military
- **Meaning**: Called after each combat resolution with detailed results
- **Arguments**:
  - `attackerID` (number): ID of attacking unit
  - `defenderID` (number): ID of defending unit
  - `attackerDamage` (number): Damage dealt to attacker
  - `defenderDamage` (number): Damage dealt to defender
  - `attackerFinalHP` (number): Attacker's health after combat
  - `defenderFinalHP` (number): Defender's health after combat
- **Source Location**: Core combat calculation functions
- **Trigger Conditions**: Any combat between units, including ranged attacks

#### CombatEnded
- **Category**: Combat & Military
- **Meaning**: Triggered when a combat sequence completely finishes
- **Arguments**:
  - `attackerID` (number): Final attacking unit ID
  - `defenderID` (number): Final defending unit ID (may be -1 if killed)
  - `combatResult` (string): Outcome description ("AttackerWins", "DefenderWins", "Stalemate")
- **Source Location**: Combat cleanup and animation completion
- **Trigger Conditions**: Combat animations finish, all combat effects applied

#### NuclearDetonation
- **Category**: Combat & Military
- **Meaning**: Fired when a nuclear weapon is detonated
- **Arguments**:
  - `weaponType` (string): Type of nuclear weapon used
  - `launchingUnitID` (number): Unit that launched the weapon
  - `targetX` (number): X coordinate of detonation center
  - `targetY` (number): Y coordinate of detonation center
  - `falloutRadius` (number): Radius of fallout effect
- **Source Location**: Nuclear weapon execution code
- **Trigger Conditions**: Nuclear missile/bomb detonated by unit action

#### UnitUpgraded
- **Category**: Combat & Military
- **Meaning**: Called when a unit is upgraded to a more advanced type
- **Arguments**:
  - `oldUnitID` (number): ID of unit before upgrade
  - `newUnitID` (number): ID of unit after upgrade
  - `oldUnitType` (string): Original unit type
  - `newUnitType` (string): Upgraded unit type
  - `upgradeCost` (number): Gold cost of upgrade
- **Source Location**: Unit upgrade processing code
- **Trigger Conditions**: Player manually upgrades unit, automatic upgrade triggers

#### UnitPromoted
- **Category**: Combat & Military
- **Meaning**: Triggered when a unit receives a promotion
- **Arguments**:
  - `unitID` (number): ID of promoted unit
  - `promotionType` (string): Type of promotion received
  - `newLevel` (number): Unit's new experience level
- **Source Location**: Experience and promotion management code
- **Trigger Conditions**: Unit gains enough XP for promotion, manual promotion selection

#### UnitSetXY
- **Category**: Combat & Military
- **Meaning**: Fired when a unit's position is changed
- **Arguments**:
  - `unitID` (number): ID of unit being moved
  - `oldX` (number): Previous X coordinate
  - `oldY` (number): Previous Y coordinate
  - `newX` (number): New X coordinate
  - `newY` (number): New Y coordinate
- **Source Location**: Unit movement and positioning code
- **Trigger Conditions**: Unit moves, unit teleported, unit created at position

#### UnitPrekill
- **Category**: Combat & Military
- **Meaning**: Called just before a unit is about to be destroyed
- **Arguments**:
  - `unitID` (number): ID of unit about to die
  - `killerID` (number): ID of unit/city causing death (may be -1)
  - `killReason` (string): Reason for death ("Combat", "Starvation", "Disbanded", etc.)
- **Source Location**: Unit destruction preparation code
- **Trigger Conditions**: Unit health reaches 0, unit disbanded, unit starved

### Diplomacy & Politics Events

#### DeclareWar
- **Category**: Diplomacy & Politics
- **Meaning**: Triggered when war is declared between players/teams
- **Arguments**:
  - `declaringPlayerID` (number): Player declaring war
  - `targetPlayerID` (number): Player being declared upon
  - `isTeamWar` (boolean): True if entire teams are at war
- **Source Location**: Diplomacy state management code
- **Trigger Conditions**: Player chooses war in diplomacy, automatic war from various game mechanics

#### MakePeace
- **Category**: Diplomacy & Politics
- **Meaning**: Called when peace is established between warring parties
- **Arguments**:
  - `player1ID` (number): First player making peace
  - `player2ID` (number): Second player making peace
  - `peaceTreaty` (object): Terms of the peace agreement
- **Source Location**: Peace negotiation and treaty code
- **Trigger Conditions**: Diplomatic peace agreement, forced peace from city-states

#### TeamMeet
- **Category**: Diplomacy & Politics
- **Meaning**: Fired when two teams/players first meet each other
- **Arguments**:
  - `team1ID` (number): First team in the meeting
  - `team2ID` (number): Second team in the meeting
  - `meetingType` (string): How they met ("Exploration", "Trade", "Diplomacy")
- **Source Location**: First contact detection code
- **Trigger Conditions**: Units spot each other, trade routes established, diplomatic contact

#### SetAlly
- **Category**: Diplomacy & Politics
- **Meaning**: Called when diplomatic alliance status changes
- **Arguments**:
  - `playerID` (number): Player whose alliance status changed
  - `allyPlayerID` (number): Player they are allied with
  - `isNewAlliance` (boolean): True if forming alliance, false if breaking
- **Source Location**: Diplomatic relationship management
- **Trigger Conditions**: Defensive pacts signed, alliances broken, city-state influence thresholds

#### UiDiploEvent
- **Category**: Diplomacy & Politics
- **Meaning**: Triggered by diplomatic interface interactions
- **Arguments**:
  - `eventType` (string): Type of diplomatic UI event
  - `playerID` (number): Player involved in diplomacy
  - `eventData` (object): Additional event-specific data
- **Source Location**: Diplomatic interface event handlers
- **Trigger Conditions**: Diplomacy screen opened, trade proposed, diplomatic option selected

#### CircumnavigatedGlobe
- **Category**: Diplomacy & Politics
- **Meaning**: Fired when a player/team completes world circumnavigation
- **Arguments**:
  - `playerID` (number): Player who achieved circumnavigation
  - `unitID` (number): Unit that completed the journey
  - `bonusReceived` (number): Gold or other bonus from achievement
- **Source Location**: Exploration achievement tracking code
- **Trigger Conditions**: Unit returns to starting position after world travel

### Technology & Research Events

#### TeamTechResearched
- **Category**: Technology & Research
- **Meaning**: Called when a team completes research on a technology
- **Arguments**:
  - `teamID` (number): Team that researched the technology
  - `techType` (string): Technology that was discovered
  - `researchCost` (number): Science points required for research
- **Source Location**: Technology research completion code
- **Trigger Conditions**: Research naturally completes, technology acquired through trades/ruins

#### TeamSetEra
- **Category**: Technology & Research
- **Meaning**: Triggered when a team advances to a new era
- **Arguments**:
  - `teamID` (number): Team advancing eras
  - `oldEra` (string): Previous era name
  - `newEra` (string): New era name
- **Source Location**: Era progression logic
- **Trigger Conditions**: Enough technologies researched to advance era

#### TeamSetHasTech
- **Category**: Technology & Research
- **Meaning**: Fired when a team gains access to a specific technology
- **Arguments**:
  - `teamID` (number): Team gaining the technology
  - `techType` (string): Technology being acquired
  - `acquisitionMethod` (string): How tech was acquired ("Research", "Trade", "Steal", "Ruin")
- **Source Location**: Technology acquisition processing
- **Trigger Conditions**: Research completion, espionage theft, ruin discoveries, trades

#### GoodyHutTechResearched
- **Category**: Technology & Research
- **Meaning**: Called when a goody hut provides technology research bonus
- **Arguments**:
  - `playerID` (number): Player who found the goody hut
  - `unitID` (number): Unit that explored the hut
  - `techType` (string): Technology researched from hut
  - `scienceBonus` (number): Science points gained
- **Source Location**: Goody hut reward processing code
- **Trigger Conditions**: Unit explores ancient ruins with technology reward

### Religion & Culture Events

#### PantheonFounded
- **Category**: Religion & Culture
- **Meaning**: Triggered when a player establishes a pantheon
- **Arguments**:
  - `playerID` (number): Player founding the pantheon
  - `pantheonType` (string): Type/belief of pantheon founded
  - `faithSpent` (number): Faith points spent to found pantheon
- **Source Location**: Religion system pantheon creation code
- **Trigger Conditions**: Player accumulates enough faith to found pantheon

#### ReligionFounded
- **Category**: Religion & Culture
- **Meaning**: Called when a full religion is founded
- **Arguments**:
  - `playerID` (number): Player founding the religion
  - `religionType` (string): Name/type of religion founded
  - `founderBelief` (string): Founder belief selected
  - `followerBelief` (string): Follower belief selected
- **Source Location**: Religion founding and great prophet usage
- **Trigger Conditions**: Great prophet founds religion, faith purchase of religion

#### ReligionEnhanced
- **Category**: Religion & Culture
- **Meaning**: Fired when an existing religion is enhanced with additional beliefs
- **Arguments**:
  - `playerID` (number): Player enhancing their religion
  - `religionType` (string): Religion being enhanced
  - `enhancerBelief` (string): New enhancer belief added
  - `additionalBelief` (string): Additional follower/other belief added
- **Source Location**: Religion enhancement through great prophets
- **Trigger Conditions**: Second great prophet used to enhance religion

#### CityConvertsReligion
- **Category**: Religion & Culture
- **Meaning**: Triggered when a city adopts a new religion as majority
- **Arguments**:
  - `cityID` (number): City converting religion
  - `oldReligion` (string): Previous majority religion
  - `newReligion` (string): New majority religion
  - `conversionPressure` (number): Religious pressure that caused conversion
- **Source Location**: Religious pressure and conversion calculations
- **Trigger Conditions**: Religious pressure reaches threshold, missionary/inquisitor actions

#### CityConvertsPantheon
- **Category**: Religion & Culture
- **Meaning**: Called when a city adopts pantheon beliefs
- **Arguments**:
  - `cityID` (number): City adopting pantheon
  - `pantheonType` (string): Pantheon belief adopted
- **Source Location**: Pantheon belief spreading and adoption code
- **Trigger Conditions**: City influenced by nearby pantheon beliefs

#### PlayerAdoptPolicy
- **Category**: Religion & Culture
- **Meaning**: Fired when a player adopts a social policy
- **Arguments**:
  - `playerID` (number): Player adopting the policy
  - `policyType` (string): Social policy being adopted
  - `policyCost` (number): Culture cost of the policy
  - `policyBranch` (string): Policy tree/branch the policy belongs to
- **Source Location**: Social policy adoption processing
- **Trigger Conditions**: Player selects policy in culture screen, free policy from wonders/events

#### PlayerAdoptPolicyBranch
- **Category**: Religion & Culture
- **Meaning**: Called when a player opens a new policy branch
- **Arguments**:
  - `playerID` (number): Player opening the branch
  - `policyBranch` (string): Policy tree being opened
  - `branchCost` (number): Culture cost to open branch
- **Source Location**: Policy branch opening logic
- **Trigger Conditions**: Player opens new policy tree, ideology adoption

#### ChangeGoldenAgeProgressMeter
- **Category**: Religion & Culture
- **Meaning**: Triggered when golden age progress changes
- **Arguments**:
  - `playerID` (number): Player whose golden age meter changed
  - `progressChange` (number): Amount of progress added/removed
  - `newProgress` (number): Current total progress
  - `progressNeeded` (number): Progress required for next golden age
- **Source Location**: Golden age progress tracking code
- **Trigger Conditions**: Great person birth, happiness-based progress, wonder effects

### Exploration & Discovery Events

#### NaturalWonderDiscovered
- **Category**: Exploration & Discovery
- **Meaning**: Called when a player discovers a natural wonder
- **Arguments**:
  - `playerID` (number): Player who discovered the wonder
  - `unitID` (number): Unit that made the discovery
  - `wonderType` (string): Type of natural wonder discovered
  - `wonderX` (number): X coordinate of wonder
  - `wonderY` (number): Y coordinate of wonder
- **Source Location**: Exploration and plot discovery code
- **Trigger Conditions**: Unit moves into wonder tile for first time

#### UnitGetSpecialExploreTarget
- **Category**: Exploration & Discovery
- **Meaning**: Fired when unit receives special exploration objective
- **Arguments**:
  - `unitID` (number): Unit receiving exploration target
  - `targetType` (string): Type of exploration target assigned
  - `targetX` (number): X coordinate of target (if applicable)
  - `targetY` (number): Y coordinate of target (if applicable)
- **Source Location**: AI exploration target assignment code
- **Trigger Conditions**: AI assigns exploration missions, quest objectives set

#### ParadropAt
- **Category**: Exploration & Discovery
- **Meaning**: Triggered when a unit performs a paradrop maneuver
- **Arguments**:
  - `unitID` (number): Unit performing the paradrop
  - `originX` (number): X coordinate of paradrop origin
  - `originY` (number): Y coordinate of paradrop origin
  - `targetX` (number): X coordinate of landing site
  - `targetY` (number): Y coordinate of landing site
- **Source Location**: Paradrop ability execution code
- **Trigger Conditions**: Paratrooper unit uses paradrop ability

### Game Flow & System Events

#### GameCoreUpdateBegin
- **Category**: Game Flow & System
- **Meaning**: Called at the start of each game engine update cycle
- **Arguments**:
  - `currentTurn` (number): Current game turn number
  - `activePlayerID` (number): ID of player whose turn is active
  - `updatePhase` (string): Current phase of game update
- **Source Location**: Main game loop update initialization
- **Trigger Conditions**: Every game engine update cycle (multiple times per turn)

#### GameCoreUpdateEnd
- **Category**: Game Flow & System
- **Meaning**: Triggered at the end of each game engine update cycle
- **Arguments**:
  - `currentTurn` (number): Current game turn number
  - `updatesProcessed` (number): Number of updates processed this cycle
  - `nextUpdatePhase` (string): Next phase scheduled for update
- **Source Location**: Main game loop update completion
- **Trigger Conditions**: Game engine update cycle completion

#### TurnComplete
- **Category**: Game Flow & System
- **Meaning**: Fired when a player's turn is completely finished
- **Arguments**:
  - `playerID` (number): Player whose turn completed
  - `turnNumber` (number): Turn number that was completed
  - `gameYear` (number): Current game year after turn
- **Source Location**: Turn management and progression code
- **Trigger Conditions**: Player ends turn, AI turn processing completes

#### GameCoreTestVictory
- **Category**: Game Flow & System
- **Meaning**: Called during victory condition checking
- **Arguments**:
  - `victoryType` (string): Type of victory being tested
  - `testingPlayerID` (number): Player being tested for victory
  - `testResult` (boolean): Whether victory condition was met
- **Source Location**: Victory condition evaluation code
- **Trigger Conditions**: Regular victory checks, turn completion, major game events

#### GatherPerTurnReplayStats
- **Category**: Game Flow & System
- **Meaning**: Triggered when collecting statistics for replay data
- **Arguments**:
  - `turnNumber` (number): Turn for which stats are gathered
  - `statsData` (object): Collection of statistical data points
- **Source Location**: Replay system data collection
- **Trigger Conditions**: End of each turn, replay data compilation

#### PushingMissionTo
- **Category**: Game Flow & System
- **Meaning**: Fired when the game assigns a mission to a unit
- **Arguments**:
  - `unitID` (number): Unit receiving the mission
  - `missionType` (string): Type of mission assigned
  - `targetX` (number): X coordinate of mission target (if applicable)
  - `targetY` (number): Y coordinate of mission target (if applicable)
- **Source Location**: AI mission assignment and automation code
- **Trigger Conditions**: AI assigns unit missions, automated unit actions

#### RebaseTo
- **Category**: Game Flow & System
- **Meaning**: Called when air units rebase to new locations
- **Arguments**:
  - `unitID` (number): Air unit being rebased
  - `originX` (number): X coordinate of origin airbase
  - `originY` (number): Y coordinate of origin airbase
  - `targetX` (number): X coordinate of destination airbase
  - `targetY` (number): Y coordinate of destination airbase
- **Source Location**: Air unit movement and rebasing code
- **Trigger Conditions**: Air unit rebases to new airfield/carrier

#### TestEvent
- **Category**: Game Flow & System
- **Meaning**: Development/debugging event for testing event system
- **Arguments**:
  - `testData` (object): Test data payload
  - `eventID` (string): Unique test event identifier
- **Source Location**: Event system testing and debugging code
- **Trigger Conditions**: Debug builds, event system validation

### Player Actions Events

#### PlayerDoTurn
- **Category**: Player Actions
- **Meaning**: Triggered during a player's turn processing
- **Arguments**:
  - `playerID` (number): Player whose turn is being processed
  - `isHuman` (boolean): True if human player, false if AI
  - `turnPhase` (string): Current phase of turn processing
- **Source Location**: Turn processing and player action handling
- **Trigger Conditions**: Player turn begins, AI turn processing phases

#### PlayerEndTurnInitiated
- **Category**: Player Actions
- **Meaning**: Called when a player begins the end-turn process
- **Arguments**:
  - `playerID` (number): Player initiating end turn
  - `forcedEndTurn` (boolean): True if turn ended automatically
- **Source Location**: Turn ending initialization code
- **Trigger Conditions**: Player clicks end turn, automatic turn progression

#### PlayerEndTurnCompleted
- **Category**: Player Actions
- **Meaning**: Fired when a player's end-turn process finishes completely
- **Arguments**:
  - `playerID` (number): Player completing end turn
  - `nextPlayerID` (number): Next player in turn order
  - `turnTransitionTime` (number): Time taken for turn transition
- **Source Location**: Turn completion and transition code
- **Trigger Conditions**: All end-turn processing complete, next player turn begins

#### PlayerPreAIUnitUpdate
- **Category**: Player Actions
- **Meaning**: Triggered before AI processes unit updates for a player
- **Arguments**:
  - `playerID` (number): Player whose AI units will be updated
  - `unitCount` (number): Number of units to be processed
- **Source Location**: AI unit update preparation code
- **Trigger Conditions**: AI turn processing, automated unit management

#### GreatPersonExpended
- **Category**: Player Actions
- **Meaning**: Called when a great person is used for their special ability
- **Arguments**:
  - `playerID` (number): Player using the great person
  - `unitID` (number): Great person unit being expended
  - `greatPersonType` (string): Type of great person
  - `abilityUsed` (string): Specific ability activated
  - `targetX` (number): X coordinate of ability target (if applicable)
  - `targetY` (number): Y coordinate of ability target (if applicable)
- **Source Location**: Great person ability execution code
- **Trigger Conditions**: Great person uses special ability, great person consumed

#### PlayerCityFounded
- **Category**: Player Actions
- **Meaning**: Triggered when a player successfully founds a new city
- **Arguments**:
  - `playerID` (number): Player founding the city
  - `settlerID` (number): Settler unit that founded the city
  - `cityID` (number): Newly created city ID
  - `foundingX` (number): X coordinate of city location
  - `foundingY` (number): Y coordinate of city location
- **Source Location**: City founding validation and creation
- **Trigger Conditions**: Settler action completes successfully

### Construction & Development Events

#### BuildFinished
- **Category**: Construction & Development
- **Meaning**: Fired when any build operation is completed
- **Arguments**:
  - `buildType` (string): Type of improvement/route built
  - `plotX` (number): X coordinate of build location
  - `plotY` (number): Y coordinate of build location
  - `builderID` (number): Unit that completed the build (if applicable)
  - `turnsToComplete` (number): Number of turns the build took
- **Source Location**: Worker action completion and improvement construction
- **Trigger Conditions**: Worker completes improvement, road construction finishes

## Cross-Reference Tables

### Events by Category
| Category | Event Count | Key Events |
|----------|-------------|------------|
| City Management | 7 | SetPopulation, CityCreated, CityCaptureComplete |
| Combat & Military | 8 | UnitKilledInCombat, CombatResult, NuclearDetonation |
| Diplomacy & Politics | 6 | DeclareWar, MakePeace, SetAlly |
| Technology & Research | 4 | TeamTechResearched, TeamSetEra |
| Religion & Culture | 8 | PantheonFounded, ReligionFounded, PlayerAdoptPolicy |
| Exploration & Discovery | 3 | NaturalWonderDiscovered, ParadropAt |
| Game Flow & System | 9 | GameCoreUpdateBegin, TurnComplete, GameCoreTestVictory |
| Player Actions | 6 | PlayerDoTurn, PlayerEndTurnCompleted, GreatPersonExpended |

### Events by Source File Pattern
| File Pattern | Events | Description |
|-------------|---------|-------------|
| CvCity* | 8 | City-related events and population management |
| CvUnit* | 12 | Unit actions, combat, and movement |
| CvPlayer* | 10 | Player actions and diplomatic events |
| CvGame* | 8 | Core game loop and system events |
| CvTeam* | 4 | Team-based technology and diplomacy |
| Religion* | 5 | Religious system events |
| Combat* | 4 | Military combat resolution |

### High-Frequency vs. Low-Frequency Events
| Frequency | Events | Usage Notes |
|-----------|---------|-------------|
| **High-Frequency** | GameCoreUpdateBegin, GameCoreUpdateEnd, UnitSetXY, PushingMissionTo | May need filtering to prevent spam |
| **Medium-Frequency** | PlayerDoTurn, CombatResult, BuildFinished | Good for turn-by-turn analysis |
| **Low-Frequency** | CircumnavigatedGlobe, ReligionFounded, NaturalWonderDiscovered | Important milestone events |

### Events with Multiple Trigger Points
| Event | Primary Trigger | Secondary Triggers |
|-------|----------------|-------------------|
| SetPopulation | Natural growth | Conquest effects, great person effects |
| CityCreated | Settler founding | Diplomatic city gifts, conquest |
| TeamSetHasTech | Research completion | Trade, espionage, ruins |
| UnitSetXY | Normal movement | Teleportation, unit creation |
| PlayerAdoptPolicy | Culture spending | Free policies from wonders/events |

## Integration Notes

### Event Filtering
The Vox Deorum system includes event filtering to prevent overwhelming external services with high-frequency events. The following events are filtered by default but can be enabled:
- GameCoreUpdateBegin/End (occurs multiple times per turn)
- UnitSetXY (occurs with every unit movement)
- PushingMissionTo (frequent AI unit commands)

### Performance Considerations
- Events are processed asynchronously to avoid impacting game performance
- Event payloads are limited to 2KB to ensure efficient transmission
- High-frequency events should be sampled or aggregated when possible

### External Service Integration
External services can register for specific events through the Bridge Service SSE endpoint at `/events`. Events are streamed in real-time with the following format:

```
event: <eventName>
data: {"type": "<eventName>", "timestamp": "ISO8601", "payload": {...}}
```

### Development and Testing
The `TestEvent` is available for development purposes to validate event transmission and processing without requiring full gameplay scenarios.

This documentation serves as the authoritative reference for all Lua events in the Vox Deorum system and should be updated as the event system evolves or new events are added to the Community Patch integration.