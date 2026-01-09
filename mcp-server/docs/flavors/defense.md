# FLAVOR_DEFENSE

## Overview

FLAVOR_DEFENSE is an AI personality flavor that controls the prioritization of defensive units and fortifications in Civilization V. This flavor influences how aggressively the AI invests in defensive military capabilities, defensive positioning, and protective infrastructure.

## Description

Prioritization of defensive units and fortifications

## AI Behavior Impact

The FLAVOR_DEFENSE flavor affects multiple aspects of AI decision-making across different game systems:

### Military Unit Production

**Defensive Unit Prioritization**: Higher FLAVOR_DEFENSE values increase the AI's tendency to produce units with defensive bonuses, such as:
- Spearmen and Pikemen (anti-cavalry defense)
- Infantry and Riflemen (defensive combat bonuses)
- Units with terrain defense bonuses
- Garrison units for city defense

**Unit Composition**: Influences the ratio of defensive to offensive units in the AI's military composition, favoring balanced or defensive-heavy armies over purely aggressive compositions.

### City Defense Strategy

**Fortification Buildings**: Higher values increase investment in defensive buildings:
- City Walls and Castle upgrades
- Military buildings that provide city defense bonuses
- Arsenal and Military Academy structures
- Anti-aircraft defenses in later eras

**Garrison Management**: Affects decisions about:
- Number of units kept as city garrisons
- Priority of garrisoning frontier cities versus interior cities
- Allocation of defensive units to vulnerable locations

### Tactical Positioning

**Unit Deployment**: Influences tactical decisions such as:
- Preference for fortified positions
- Use of defensive terrain (hills, forests, behind rivers)
- Creation of defensive lines and barriers
- Protection of strategic resources and improvements

**Border Defense**: Higher FLAVOR_DEFENSE values lead to:
- More units stationed along borders
- Earlier detection and response to threats
- Defensive positioning rather than forward deployment

### Strategic Planning

**Military Strategy Selection**: Works in conjunction with other military flavors to determine overall military posture:
- Defensive strategies become more attractive
- Resource allocation favors protective measures
- City placement considers defensive terrain features

**Threat Response**: Affects how the AI responds to military threats:
- Earlier military buildup when enemies approach
- Greater emphasis on defensive preparations during peacetime
- More cautious expansion patterns that prioritize defensible positions

## Relationship with Other Flavors

FLAVOR_DEFENSE interacts with and balances against other military and strategic flavors:

### Complementary Flavors

- **FLAVOR_CITY_DEFENSE**: Specializes in city-specific defensive infrastructure while FLAVOR_DEFENSE covers broader defensive unit and positioning strategies
- **FLAVOR_MILITARY_TRAINING**: Both contribute to overall military strength, with Defense focusing on protective capabilities
- **FLAVOR_RECON**: Defensive positioning benefits from good reconnaissance to identify threats early

### Opposing Flavors

- **FLAVOR_OFFENSE**: Creates a spectrum from defensive to aggressive military postures
- **FLAVOR_EXPANSION**: High defense may lead to more conservative expansion patterns
- **FLAVOR_MOBILE**: Defensive units tend to be less mobile, creating a trade-off in military composition

### Balanced Combinations

The AI's overall military behavior emerges from the combination of multiple flavors. A civilization might have:
- High Defense + High Offense = Well-rounded military
- High Defense + Low Offense = Turtle/protective strategy
- Low Defense + High Offense = Aggressive expansion focus

## Leader Personality Variation

Different AI leaders have varying FLAVOR_DEFENSE values that reflect their historical personalities:

- **High Defense Leaders**: Civilizations known for defensive strategies or fortress building traditions typically have higher values
- **Aggressive Expansionists**: Leaders focused on conquest tend to have lower defensive flavor values
- **Balanced Leaders**: Most leaders have moderate values that allow for situational defensive responses

## Game Phase Considerations

The impact of FLAVOR_DEFENSE can vary across different game phases:

### Early Game
- Affects barbarian defense priorities
- Influences early military unit choices
- Impacts city placement for defensive terrain

### Mid Game
- Determines investment in city walls and defensive buildings
- Affects response to neighbor aggression
- Influences fortification of border cities

### Late Game
- Affects anti-aircraft and anti-armor unit production
- Influences defensive infrastructure in core cities
- Determines garrison strength during ideological conflicts

## Technical Implementation

### Database Integration

FLAVOR_DEFENSE values are stored in the game database and associated with:
- Leader personality definitions
- Unit production weights
- Building construction priorities
- Strategic AI decision trees

### Dynamic Weighting

The flavor value is used as a weight in various AI calculations:
- Building production scores incorporate flavor weights
- Unit purchase decisions use flavor-modified evaluations
- Tactical positioning algorithms apply defensive flavor bonuses

### Contextual Modification

The effective weight of FLAVOR_DEFENSE can be modified by:
- Current war status (increases during active conflicts)
- Diplomatic situation (higher when threatened)
- Strategic resource availability
- Game difficulty settings

## Strategic Significance

Understanding FLAVOR_DEFENSE is valuable for:

### AI Prediction
- Anticipating which leaders will invest heavily in defense
- Predicting garrison strength of AI cities
- Estimating defensive response to military pressure

### Diplomatic Strategy
- Leaders with high defense values may be less aggressive but harder to conquer
- Defensive-minded AIs may be more interested in defensive pacts
- Understanding defensive priorities can inform war planning

### Strategic Planning
- Knowing defensive tendencies helps optimize attack timing
- Defensive AIs may leave opportunities for aggressive expansion elsewhere
- Coordinating attacks against heavily defended positions

## Related Flavors

For a complete understanding of AI military behavior, consider these related flavors:

- **FLAVOR_OFFENSE**: Complementary aggressive military flavor
- **FLAVOR_CITY_DEFENSE**: Specialized city fortification focus
- **FLAVOR_MILITARY_TRAINING**: General military preparation emphasis
- **FLAVOR_RECON**: Scouting and intelligence gathering
- **FLAVOR_RANGED**: Ranged unit prioritization (often defensive)
- **FLAVOR_ANTI_AIR**: Specialized air defense (late game defensive component)

## Notes

- Flavor values typically range from 0-10, with 5 being neutral
- Actual AI behavior emerges from the combination of multiple flavors
- Flavor weights can be modified by game events and situational factors
- The defense flavor works in conjunction with broader strategic AI systems

## Data Sources

This documentation is based on:
- Flavor system configuration data in `mcp-server/docs/strategies/flavors.json`
- Civilization V AI architecture and flavor weighting system
- Community Patch AI behavior patterns
