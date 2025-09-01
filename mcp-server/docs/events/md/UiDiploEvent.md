# UiDiploEvent

## Event Overview

**UiDiploEvent** is a game event triggered during diplomatic interactions between the human player and AI players in Civilization V. This event is fired when the UI communicates diplomatic actions or responses back to the game engine, allowing the game to process and respond to player diplomatic choices.

## When This Event is Triggered

The UiDiploEvent is triggered whenever the player performs a diplomatic action through the game's UI that needs to be communicated to the game engine. This includes:

- Player responses to AI diplomatic proposals (demands, requests, offers)
- Player-initiated diplomatic actions (declaring war, negotiating peace, denouncing)
- Player responses to AI warnings or complaints
- Trade screen interactions and deal responses
- Discussion menu selections and responses

The event is specifically called from the `CvGame::DoFromUIDiploEvent()` function when the game needs to process UI-driven diplomatic events.

## Event Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| **eEvent** | `FromUIDiploEventTypes` (enum) | The specific type of diplomatic event that occurred. This determines what kind of diplomatic action the player took. |
| **eAIPlayer** | `PlayerTypes` (enum/int) | The ID of the AI player involved in the diplomatic interaction. This is the target or partner of the diplomatic action. |
| **iArg1** | `int` | Context-specific argument that provides additional data for the diplomatic event. The meaning varies by event type. |
| **iArg2** | `int` | Second context-specific argument for additional event data. Often used for secondary player IDs or additional flags. |

### Parameter Details

#### eEvent (FromUIDiploEventTypes)
Common diplomatic event types include:
- `FROM_UI_DIPLO_EVENT_HUMAN_DECLARES_WAR` - Player declares war on AI
- `FROM_UI_DIPLO_EVENT_HUMAN_NEGOTIATE_PEACE` - Player initiates peace negotiations
- `FROM_UI_DIPLO_EVENT_HUMAN_WANTS_DISCUSSION` - Player opens discussion screen
- `FROM_UI_DIPLO_EVENT_DEMAND_HUMAN_REFUSAL` - Player refuses AI demand
- `FROM_UI_DIPLO_EVENT_REQUEST_HUMAN_REFUSAL` - Player refuses AI request
- `FROM_UI_DIPLO_EVENT_DENOUNCE` - Player denounces AI
- `FROM_UI_DIPLO_EVENT_EXPANSION_WARNING_RESPONSE` - Player responds to expansion warning
- `FROM_UI_DIPLO_EVENT_WORK_WITH_US_RESPONSE` - Player responds to cooperation proposal

#### iArg1 and iArg2
The meaning of these arguments depends on the specific event type:
- For refusal events: `iArg1` often contains deal value or button ID
- For response events: `iArg1` typically contains the player's choice/button ID
- For multi-player interactions: `iArg2` may contain a third player's ID
- Default values of `0` are commonly used when no additional data is needed

## Usage Examples

### Basic Event Listener
```lua
-- Register event listener for UI diplomatic events
function OnUiDiploEvent(eEvent, eAIPlayer, iArg1, iArg2)
    print(string.format("UiDiploEvent fired: Event=%d, AIPlayer=%d, Arg1=%d, Arg2=%d", 
          eEvent, eAIPlayer, iArg1, iArg2))
    
    -- Process specific diplomatic events
    if eEvent == FromUIDiploEventTypes.FROM_UI_DIPLO_EVENT_HUMAN_DECLARES_WAR then
        print("Player declared war on " .. Players[eAIPlayer]:GetName())
    elseif eEvent == FromUIDiploEventTypes.FROM_UI_DIPLO_EVENT_DENOUNCE then
        print("Player denounced " .. Players[eAIPlayer]:GetName())
    end
end

GameEvents.UiDiploEvent.Add(OnUiDiploEvent)
```

### Tracking Diplomatic Responses
```lua
-- Track player responses to AI requests/demands
function OnUiDiploEvent(eEvent, eAIPlayer, iArg1, iArg2)
    local player = Players[eAIPlayer]
    local playerName = player:GetName()
    
    if eEvent == FromUIDiploEventTypes.FROM_UI_DIPLO_EVENT_DEMAND_HUMAN_REFUSAL then
        print("Player refused demand from " .. playerName)
        -- iArg1 might contain deal value or additional context
        
    elseif eEvent == FromUIDiploEventTypes.FROM_UI_DIPLO_EVENT_REQUEST_HUMAN_REFUSAL then
        local dealValue = iArg1
        print("Player refused request from " .. playerName .. " (deal value: " .. dealValue .. ")")
        
    elseif eEvent == FromUIDiploEventTypes.FROM_UI_DIPLO_EVENT_WORK_WITH_US_RESPONSE then
        local response = iArg1
        if response == 1 then
            print("Player agreed to work with " .. playerName)
        else
            print("Player declined to work with " .. playerName)
        end
    end
end

GameEvents.UiDiploEvent.Add(OnUiDiploEvent)
```

## Related Events and Considerations

### Related Events
- **PlayerAdoptPolicy** - May be triggered by diplomatic policy decisions
- **TeamTechResearched** - Can affect available diplomatic options
- **PlayerDoTurn** - Diplomatic state changes may affect turn processing
- **WarStateChanged** - Directly related to war declaration events

### AI Integration Considerations
When integrating with AI systems like Vox Deorum:

1. **Diplomatic Strategy Analysis**: Use this event to understand player diplomatic patterns and preferences
2. **Relationship Tracking**: Monitor player responses to build AI models of diplomatic relationships
3. **Predictive Modeling**: Use historical diplomatic events to predict future player behavior
4. **Adaptive AI**: Adjust AI diplomatic strategies based on player response patterns

### Performance Notes
- This event fires frequently during diplomatic interactions
- Consider filtering or batching event processing for performance
- The event provides rich context but may require cross-referencing with game state for full understanding

## Special Notes

### Event Ordering
UiDiploEvent is typically fired after the player makes a UI selection but before the full diplomatic consequences are processed by the game engine. This makes it ideal for intercepting and analyzing player diplomatic decisions.

### Modding Compatibility
This event is part of the Community Patch framework and may not be available in vanilla Civilization V. Ensure proper mod compatibility when using this event.

### Data Validation
Always validate player and event type parameters, as invalid IDs may cause game instability:

```lua
function OnUiDiploEvent(eEvent, eAIPlayer, iArg1, iArg2)
    -- Validate parameters
    if eAIPlayer < 0 or eAIPlayer >= GameDefines.MAX_PLAYERS then
        print("Warning: Invalid player ID in UiDiploEvent: " .. tostring(eAIPlayer))
        return
    end
    
    if eEvent < 0 then
        print("Warning: Invalid event type in UiDiploEvent: " .. tostring(eEvent))
        return
    end
    
    -- Process valid event...
end
```

### Thread Safety
This event is fired from the main game thread and should be processed synchronously. Avoid long-running operations in event handlers to prevent UI freezing.