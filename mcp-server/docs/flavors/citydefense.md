# FLAVOR_CITY_DEFENSE

## Overview

FLAVOR_CITY_DEFENSE is an AI personality flavor in Civilization V that controls the AI's preference for city-specific defensive infrastructure, garrison units, and urban fortification strategies. This flavor specifically focuses on protecting cities through defensive buildings, city ranged strikes, and garrison bonuses, distinguishing it from the broader FLAVOR_DEFENSE which emphasizes general defensive units and field positioning.

The flavor value typically ranges from 4-9 for individual leaders, with the AI dynamically adjusting this value based on war status, threat levels, and strategic circumstances.

## Core Functionality

### City Defensive Infrastructure Priority

FLAVOR_CITY_DEFENSE directly influences AI decisions about constructing defensive buildings and city fortifications:

- **Defensive Buildings**: Higher values increase construction priority for walls, castles, arsenals, and other city defense structures
- **Wonder Selection**: Affects valuation of defensive wonders like Great Wall, Red Fort, and Himeji Castle
- **Urban Fortification**: Prioritizes buildings that provide city combat strength and ranged strike bonuses

### Garrison and City Combat

The flavor affects how the AI manages city defense through:

- **Garrison Unit Deployment**: Influences decisions about stationing units within cities for defensive bonuses
- **City Ranged Strike Investment**: Affects prioritization of buildings and beliefs that enhance city bombardment capabilities
- **Capital Defense**: Special emphasis on protecting the capital city with defensive measures

### Religion and Belief Selection

FLAVOR_CITY_DEFENSE plays a significant role in religious belief evaluation:

- **Defensive Beliefs**: Used to score beliefs that provide city healing or ranged strike modifiers
- **Neighbor Threat Assessment**: Weight increases when surrounded by warmonger civilizations
- **Tall Strategy Bonus**: Defensive beliefs valued more highly by civilizations pursuing tall (fewer, larger cities) strategies

## Code References

### Advisor Recommendation Weighting (CvAdvisorRecommender.cpp)

**Lines 286-289: Economic Advisor - Building Recommendations**
```cpp
case ADVISOR_ECONOMIC:
    if(strFlavorName == "FLAVOR_CITY_DEFENSE")
    {
        return 1;
    }
```
Economic advisor assigns minimal weight (1) to city defense when recommending buildings, as defensive structures are not primarily economic.

**Lines 349-352: Military Advisor - Building Recommendations**
```cpp
else if(strFlavorName == "FLAVOR_CITY_DEFENSE")
{
    return 9;
}
```
Military advisor assigns moderate-high weight (9) to city defense for building recommendations, making defensive buildings more attractive to military-focused AIs.

**Lines 431-434: Foreign Advisor - Building Recommendations**
```cpp
case ADVISOR_FOREIGN:
    if(strFlavorName == "FLAVOR_CITY_DEFENSE")
    {
        return 1;
    }
```
Foreign advisor assigns minimal weight (1), as city defense buildings have limited diplomatic impact.

**Lines 465-468: Science Advisor - Building Recommendations**
```cpp
case ADVISOR_SCIENCE:
    if(strFlavorName == "FLAVOR_CITY_DEFENSE")
    {
        return 1;
    }
```
Science advisor assigns minimal weight (1), as defensive buildings don't contribute to scientific progress.

### Unit Promotion Selection (CvUnit.cpp)

**Line 31663: Flavor Initialization**
```cpp
int iFlavorCityDefense = range(pFlavorMgr->GetPersonalityIndividualFlavor((FlavorTypes)GC.getInfoTypeForString("FLAVOR_CITY_DEFENSE")), 1, 20);
```
Retrieves the player's FLAVOR_CITY_DEFENSE value, clamped between 1-20, for use in promotion value calculations.

**Line 31938: Attack Above Health Modifier Promotions**
```cpp
iExtra = ( iTemp + iExtra ) * ( iFlavorDefense + 2 * iFlavorCityDefense);
```
City defense flavor is weighted 2x compared to general defense when evaluating promotions that grant attack bonuses when above certain health thresholds. This applies primarily to defensive units holding positions.

**Line 31984: Adjacent Unit Modifier Promotions**
```cpp
iExtra = (iTemp) * (iFlavorOffense + iFlavorDefense + iFlavorCityDefense);
```
Promotions providing bonuses when adjacent to other units are valued using city defense flavor, as these situations commonly occur in urban defense scenarios.

**Line 32217: Extra Attacks for Ranged Units (Logistics)**
```cpp
iExtra = iTemp * (iFlavorOffense + iFlavorDefense + iFlavorCityDefense);
iExtra *= 20;
```
For ranged units, the Logistics promotion (extra attacks) is highly valued by city defense-focused AIs, as ranged units excel at city defense with city strike bonuses weighted heavily (x20 multiplier).

**Line 32264: Splash Damage Promotions**
```cpp
iExtra = (iTemp + iExtra) * (iFlavorOffense + iFlavorDefense + iFlavorCityDefense);
iExtra *= 1.5;
iExtra *= GetRange();
```
Splash damage promotions (affecting multiple enemies) are valued using city defense flavor, with additional bonuses for range, making them attractive for garrison units.

**Line 32281: Tile Damage Promotions**
```cpp
iExtra = iTemp * (iFlavorOffense + iFlavorDefense + iFlavorCityDefense);
iExtra *= 1.5;
```
Promotions that damage enemies on adjacent tiles are valued with city defense flavor, particularly useful for static defensive positions.

**Line 32622: Terrain Attack Bonuses**
```cpp
iExtra = (iTemp + iExtra) * (iFlavorOffense + iFlavorDefense + iFlavorCityDefense);
iExtra *= 0.2;
```
Terrain-specific attack bonuses incorporate city defense flavor in their evaluation, helping units defend cities built on specific terrain types.

**Line 32715: Feature Attack Bonuses**
```cpp
iExtra = (iTemp + iExtra) * (iFlavorOffense + iFlavorDefense + iFlavorCityDefense);
iExtra *= 0.2;
```
Feature-specific attack bonuses (forest, jungle, etc.) are valued using city defense flavor for units defending cities near these features.

**Line 32955: Max Hit Points Modifier (Ranged Units)**
```cpp
iExtra = iTemp * (iFlavorOffense + iFlavorDefense + iFlavorCityDefense);
iExtra *= 0.5;
```
For ranged units, hit point increases are valued using city defense flavor, as these units often serve as city garrisons.

**Line 32978: Friendly Lands Combat Modifier**
```cpp
iExtra = ( iTemp + iExtra ) * ( iFlavorDefense + 2 * iFlavorCityDefense );
iExtra *= 0.3;
```
Promotions granting combat bonuses in friendly territory receive 2x city defense weighting, as these primarily benefit garrison units defending cities.

**Line 32988: Capital Defense Modifier**
```cpp
iExtra = ( iTemp + iExtra ) * (3 * iFlavorCityDefense );
iExtra *= 0.2;
```
Capital-specific defense bonuses are weighted exclusively by city defense flavor (3x multiplier), making them highly valuable to defense-oriented AIs.

**Line 32997: Friendly Lands Attack Modifier**
```cpp
iExtra = ( iTemp + iExtra ) * ( iFlavorDefense + 2 * iFlavorCityDefense );
iExtra *= 0.15;
```
Attack bonuses in friendly territory also receive 2x city defense weighting, supporting counter-attacks from garrisoned units.

### Policy Selection (CvPolicyClasses.cpp)

**Lines 6200-6203: War Status Policy Flavor Boost**
```cpp
else if (bIsAtWarWithSomeone && iFlavor == GC.getInfoTypeForString("FLAVOR_CITY_DEFENSE"))
{
    iFlavorValue += 3;
}
```
When at war, FLAVOR_CITY_DEFENSE receives a +3 bonus for policy evaluation, increasing the value of defensive policies during conflicts.

### Policy Victory Scoring (CvPolicyAI.cpp)

**Line 4916: Conquest Victory Flavor Contribution**
```cpp
if (GC.getFlavorTypes((FlavorTypes)iFlavor) == "FLAVOR_OFFENSE" || ... ||
    GC.getFlavorTypes((FlavorTypes)iFlavor) == "FLAVOR_CITY_DEFENSE" || ... )
{
    iConquestValue += iFlavorValue;
}
```
Policies with FLAVOR_CITY_DEFENSE contribute to conquest victory scoring, as strong city defense is essential for holding conquered territory.

### Technology Research Priority (CvTechClasses.cpp)

**Lines 1284: Conquest Grand Strategy Tech Boost**
```cpp
|| GC.getFlavorTypes((FlavorTypes)iFlavor) == "FLAVOR_CITY_DEFENSE"
```
When pursuing conquest grand strategy, technologies with FLAVOR_CITY_DEFENSE receive priority bonuses, ensuring conquered cities can be defended.

### Religious Belief Evaluation (CvReligionClasses.cpp)

**Lines 8619-8620: Belief Scoring - Flavor Retrieval**
```cpp
int iFlavorCityDefense = pFlavorManager->GetPersonalityIndividualFlavor((FlavorTypes)GC.getInfoTypeForString("FLAVOR_CITY_DEFENSE"));
int iFlavorHappiness = pFlavorManager->GetPersonalityIndividualFlavor((FlavorTypes)GC.getInfoTypeForString("FLAVOR_HAPPINESS"));
```
City defense flavor is retrieved for evaluating religious beliefs, particularly those affecting city combat and healing.

**Lines 10369-10370: Enhanced Belief Scoring Context**
```cpp
int iFlavorCityDefense = pFlavorManager->GetPersonalityIndividualFlavor((FlavorTypes)GC.getInfoTypeForString("FLAVOR_CITY_DEFENSE"));
int iFlavorDefense = pFlavorManager->GetPersonalityIndividualFlavor((FlavorTypes)GC.getInfoTypeForString("FLAVOR_DEFENSE"));
```
Both city defense and general defense flavors are used together when evaluating beliefs in context of neighbor threats.

**Lines 10429-10433: Defensive Belief Scoring Against Warmongers**
```cpp
if (pEntry->GetFriendlyHealChange() > 0)
{
    iRtnValue += (iFlavorCityDefense + iFlavorDefense) * pEntry->GetFriendlyHealChange() * iNumWarmongerNeighbors * (bIsTall ? 2 : 1);
}
if (pEntry->GetCityRangeStrikeModifier() > 0)
{
    iRtnValue += (iFlavorCityDefense + iFlavorDefense) * pEntry->GetCityRangeStrikeModifier() * iNumWarmongerNeighbors * (bIsTall ? 2 : 1);
```
Beliefs providing friendly territory healing or city ranged strike bonuses are scored using both city defense and general defense flavors, multiplied by the number of neighboring warmonger civilizations. The value doubles for tall strategy civilizations (fewer, more developed cities).

## Building Flavors

FLAVOR_CITY_DEFENSE is assigned to defensive buildings across all eras:

### Ancient/Classical Defensive Structures (20-30)
- **Walls** (20): Basic city defense structure providing combat strength
- **Walls of Babylon** (30): Babylonian unique building with enhanced defensive capabilities
- **Lamassu Gate** (30): Assyrian unique defensive structure

### Medieval Fortifications (25-40)
- **Barbican** (30): Advanced medieval defensive structure
- **Castle** (25): Standard medieval fortification
- **Mughal Fort** (40): Indian unique castle with exceptional defensive bonuses

### Renaissance/Industrial Defenses (15-25)
- **Bastion Fort** (25): Gunpowder-era fortification
- **Krepost** (25): Russian unique defensive building (Ostrog replacement)
- **Doelen** (15): Dutch unique building with defensive components
- **Arsenal** (25): Industrial era military production and defense building
- **Minefield** (20): Modern area denial defensive structure

### Modern/Atomic Era Defenses (25-30)
- **Military Base** (30): Modern comprehensive military facility
- **Bomb Shelter** (25): Nuclear defense infrastructure

### Religious and Ideological Buildings (15)
- **Order** (15): Ideological building with defensive components
- **Gurdwara** (15): Religious building providing defensive bonuses

### World Wonders (10-75)
- **Great Wall** (20): Ancient defensive wonder providing border defense
- **Alhambra** (10): Medieval wonder with cultural and defensive benefits
- **Himeji Castle** (15): Japanese castle wonder with defensive bonuses
- **Red Fort** (75): Highest city defense flavor - Indian defensive wonder with massive combat strength bonus
- **Neuschwanstein** (20): Late-game wonder combining culture and defense
- **The Motherland Calls** (20): Modern defensive monument

## Technology Flavors

Technologies unlocking or enhancing city defenses receive FLAVOR_CITY_DEFENSE:

### Ancient Era
- **Masonry** (20): Critical early tech unlocking walls and defensive structures
- **Archery** (5): Enables ranged city defense capabilities

### Medieval Era
- **Chivalry** (20): Unlocks castle-era fortifications

### Renaissance Era
- **Navigation** (20): Naval and coastal city defense improvements

### Industrial Era
- **Combustion** (20): Modern defensive technologies

### Atomic Era
- **Nuclear Fission** (5): Nuclear defensive capabilities
- **Radar** (20): Air defense and detection systems

## Strategic Influences

### Military Strategies

**At War - Player (+20 player, +20 cities)**
Moderate increase in city defense priority when engaged in active warfare, ensuring cities remain protected during conflicts.

**Winning Wars - Player (-20 player, -30 cities)**
Significant reduction when winning wars, as resources shift from defensive to offensive operations to press the advantage.

**Losing Wars - Player (+40 player, +50 cities)**
Major increase when losing wars, prioritizing city fortifications to prevent further losses and stabilize defensive lines.

**Minor Civ Threat Critical (+40)**
Massive boost when minor civilizations face critical threats, ensuring city-state allies can defend their capitals.

**Minor Civ Threat Elevated (+25)**
Substantial increase for elevated minor civ threats, preparing defenses proactively.

**Minor Civ General Defense (+10)**
Baseline increase for general minor civilization defense obligations.

### City Strategies

**Need Happiness from Pillage Defense (+20)**
Increases city defense priority when cities are vulnerable to pillaging that would reduce happiness.

### Economic Strategies

Unlike offensive military flavors, FLAVOR_CITY_DEFENSE receives minimal penalties from economic strain, as basic city defense remains essential regardless of economic conditions.

## Leader Flavor Values

Representative leader FLAVOR_CITY_DEFENSE values:

### Defensive-Oriented Leaders (7-9)
- **Catherine (Russia)**: 7 - Emphasis on defending vast territorial holdings with unique Krepost building
- **Enrico Dandolo (Venice)**: 9 - Highest value, protecting limited but valuable city holdings
- **Pocatello (Shoshone)**: 7 - Defending expanded territorial claims

### Balanced Leaders (5-6)
- **Dido (Carthage)**: 7 - Coastal and trade route defense
- **Elizabeth (England)**: 5 - Reduced emphasis favoring naval and offensive strategies

### Standard Leaders (4-8)
- **Barbarian Leader**: 8 - High defensive priority for barbarian encampments
- Most other leaders fall in the 4-6 range, providing baseline city defense capability

## Process Flavors

**Defense Process** (5): City production process focused on defense receives city defense flavor, allowing cities to prioritize defensive preparations when no specific building is optimal.

## AI Behavior Summary

### High FLAVOR_CITY_DEFENSE (8-10)
- Prioritizes walls and fortifications in all cities early
- Heavily invests in defensive wonders (Red Fort, Great Wall, Himeji Castle)
- Maintains strong city garrisons even during peacetime
- Selects defensive religious beliefs when threatened
- Chooses promotions favoring garrison and urban combat
- Pursues defensive technologies proactively

### Medium FLAVOR_CITY_DEFENSE (5-7)
- Builds defensive structures in frontier and vulnerable cities
- Balances defensive buildings with economic infrastructure
- Maintains adequate garrisons in key cities
- Considers defensive options situationally
- Moderate promotion selection for city defense

### Low FLAVOR_CITY_DEFENSE (2-4)
- Minimal defensive building construction
- Relies on mobile field armies rather than static defenses
- Few garrison units, prefers offensive deployment
- Rarely selects defensive beliefs or promotions
- Deprioritizes defensive technologies unless required for other benefits

## Dynamic Adjustments

The effective FLAVOR_CITY_DEFENSE value changes dynamically based on game state:

### War Context Modifiers
1. **At War**: +20 (both player and cities)
2. **Winning Wars**: -20 to -30 (shift to offense)
3. **Losing Wars**: +40 to +50 (desperate defense)
4. **War Status in Policy Selection**: +3 additional boost

### Threat Assessment
1. **Minor Civ Critical Threat**: +40 (protect allies)
2. **Minor Civ Elevated Threat**: +25 (prepare defenses)
3. **Minor Civ General Defense**: +10 (baseline protection)
4. **Warmonger Neighbors**: Multiplier in religious belief scoring

### Strategic Posture
1. **Tall Strategy**: 2x multiplier for defensive beliefs (fewer cities to protect)
2. **Conquest Grand Strategy**: Priority boost for defensive technologies
3. **Pillage Vulnerability**: +20 when happiness threatened

These modifiers stack with the base personality flavor, creating adaptive AI behavior that responds to strategic circumstances while maintaining individual leader personalities.

## Relationship with Other Flavors

FLAVOR_CITY_DEFENSE works in conjunction with other defensive and strategic flavors:

### Complementary Flavors

- **FLAVOR_DEFENSE**: Broader defensive military focus covering field armies and unit positioning, while FLAVOR_CITY_DEFENSE specializes in urban fortifications
- **FLAVOR_RANGED**: Ranged units excel at city defense, with city defense flavor affecting ranged unit promotion selection
- **FLAVOR_MILITARY_TRAINING**: Both contribute to overall defensive readiness and military infrastructure

### Contrasting Flavors

- **FLAVOR_OFFENSE**: Creates a spectrum from defensive to aggressive military postures; high city defense with low offense suggests a turtle strategy
- **FLAVOR_EXPANSION**: Aggressive expansion may leave cities vulnerable; high city defense helps secure expanded territories
- **FLAVOR_MOBILE**: Mobile field armies contrast with static city defenses; balance determines military doctrine

### Strategic Combinations

The AI's defensive posture emerges from flavor combinations:
- **High City Defense + High General Defense**: Complete defensive strategy (fortress civilization)
- **High City Defense + High Offense**: Secure base for aggressive expansion
- **High City Defense + Low Mobile**: Static defensive doctrine
- **Low City Defense + High Mobile**: Offensive mobile warfare doctrine

## Distinction from FLAVOR_DEFENSE

While both flavors contribute to defensive capabilities, they serve different strategic roles:

### FLAVOR_CITY_DEFENSE Focuses On:
- Buildings that increase city combat strength
- Garrison unit bonuses and city ranged strikes
- Urban fortifications and defensive infrastructure
- Protecting specific city locations
- Static defensive positions

### FLAVOR_DEFENSE Focuses On:
- Defensive unit types (spearmen, infantry)
- Field positioning and terrain defense
- General military defensive posture
- Mobile defensive formations
- Border security through unit deployment

The two flavors work together to create comprehensive defensive strategies, with city defense handling urban fortifications while general defense manages field armies and positioning.

## Technical Implementation

### Database Integration

FLAVOR_CITY_DEFENSE values are stored in the game database and associated with:
- Leader personality definitions in Leader_Flavors tables
- Building construction priorities in Building_Flavors tables
- Technology research weights in Technology_Flavors tables
- Strategy flavor modifications in StrategyUpdates tables
- Religious belief scoring calculations

### Dynamic Weighting

The flavor value serves as a weight in AI calculations:
- Building production scores multiply flavor values by building-specific weights
- Unit promotion evaluations apply flavor-modified bonuses
- Religious belief scores scale with flavor and threat assessment
- Technology priorities receive flavor-based adjustments

### Contextual Modification

The effective weight of FLAVOR_CITY_DEFENSE is modified by:
- Current war status (increases during wars, decreases when winning)
- Threat level assessment (increases with dangerous neighbors)
- Strategic posture (tall vs. wide, conquest vs. peaceful)
- Economic constraints (minimal penalties unlike offensive flavors)
- Diplomatic relationships (increases near warmongers)

## Strategic Significance

Understanding FLAVOR_CITY_DEFENSE is valuable for:

### AI Prediction
- Anticipating which leaders will heavily fortify their cities
- Predicting garrison strength and city bombardment capabilities
- Estimating investment in defensive wonders
- Gauging difficulty of capturing AI cities

### Military Planning
- Leaders with high city defense require siege preparation
- Low city defense leaders have vulnerable cities for quick strikes
- Defensive beliefs indicate enhanced city ranged strikes
- Wonder construction patterns reveal defensive priorities

### Diplomatic Strategy
- High city defense leaders may be less aggressive but harder to conquer
- Defensive-minded AIs may be interested in defensive pacts
- Understanding defensive priorities informs alliance value
- Predicting AI response to threats near their cities

## Related Flavors

For complete understanding of AI defensive and military behavior, consider these related flavors:

- **FLAVOR_DEFENSE**: General defensive military posture and field armies
- **FLAVOR_OFFENSE**: Complementary aggressive military flavor
- **FLAVOR_RANGED**: Ranged units effective for city defense
- **FLAVOR_MILITARY_TRAINING**: Overall military preparedness and infrastructure
- **FLAVOR_EXPANSION**: Territorial growth requiring defensive protection
- **FLAVOR_MOBILE**: Mobile warfare vs. static defense trade-off
- **FLAVOR_ANTIAIR**: Specialized city air defense (late game)

## Notes

- Flavor values typically range from 2-10, with 5-6 being neutral for most leaders
- Actual AI behavior emerges from combinations of multiple flavors and strategic contexts
- City defense flavor can shift dramatically during wars (+50 when losing, -30 when winning)
- The flavor works in conjunction with broader military, economic, and diplomatic AI systems
- Religious belief scoring uniquely considers both city defense and general defense flavors together
- Tall strategy civilizations value defensive beliefs at 2x the normal rate

## Data Sources

This documentation is based on:
- C++ source code analysis in CvGameCoreDLL_Expansion2 directory
- Database flavor assignments in AI strategy, building, and technology SQL files
- Unit promotion AI implementation in CvUnit.cpp
- Religious belief scoring in CvReligionClasses.cpp
- Advisor recommendation weighting in CvAdvisorRecommender.cpp
- Strategic flavor modifications in CoreStrategyChanges.sql and StrategyChanges.sql
