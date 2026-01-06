# Error Handling Guide

Reference for error codes, recovery strategies, and troubleshooting in the Bridge Service.

## Error Code Reference

All errors follow the `ErrorCode` enum defined in [src/types/api.ts](../src/types/api.ts).

| Error Code | Description | Auto Recovery | Key Actions |
|------------|-------------|---------------|-------------|
| **DLL_DISCONNECTED** | Lost connection to DLL | Infinite retry with exponential backoff (200ms→5s), re-registers functions | Verify game running, check mod enabled, confirm pipe name matches (`gamepipe.id`) |
| **LUA_EXECUTION_ERROR** | Lua script/function failed | None | Check `/lua/functions`, verify name spelling, review game logs for Lua errors |
| **CALL_TIMEOUT** | Call exceeded timeout (120s Lua, configurable external) | Cancels request, cleans up queue | Check game not paused, monitor service response times, use batch API |
| **CALL_FAILED** | External HTTP endpoint error | None, function stays registered | Check external service logs, test endpoint with curl, verify arguments |
| **INVALID_FUNCTION** | Function not registered | None | List functions via `/lua/functions` or `/external/functions`, check spelling |
| **INVALID_SCRIPT** | Malformed Lua code | None | Validate syntax, test in Lua interpreter, ensure `return` statement |
| **INVALID_ARGUMENTS** | Wrong argument count/type | None | Check function signature, validate JSON format, review API docs |
| **NETWORK_ERROR** | External service unreachable | None | Test URL with curl, check firewall, verify DNS resolution |
| **SERIALIZATION_ERROR** | JSON parsing failed | None | Validate JSON, check for circular references, reduce data size |
| **INTERNAL_ERROR** | Unexpected service error | Varies | Check bridge logs for stack trace, restart service, report with logs |
| **NOT_FOUND** | Endpoint/resource not found | None | Verify endpoint URL in [API-REFERENCE.md](API-REFERENCE.md), check API version |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": "Optional technical details"
  }
}
```

## Connection Recovery

### DLL Reconnection

**Behavior:**
- Exponential backoff: 200ms base, ×1.5 per attempt, 5000ms max
- Infinite retries (never gives up)
- On reconnect: re-registers external functions, clears paused players

**Monitor:** `GET /health` shows `dll_connected` status

### External Service Failures

**Behavior:**
- No automatic retry from Bridge (caller's responsibility)
- Function registration persists
- Returns error to Lua immediately

**Recommended Lua pattern:**
```lua
function callWithRetry(funcName, args, maxRetries)
  for i = 1, maxRetries do
    local result, err = Game.CallExternal(funcName, args)
    if result then return result end
    if i < maxRetries then os.sleep(1000) end
  end
  return nil, "Max retries exceeded"
end
```

## Debugging Errors

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm run dev
```

Or in `config.json`:
```json
{
  "logging": { "level": "debug" }
}
```

### Common Debug Patterns

```
[bridge:dll] Connecting to pipe: \\.\pipe\tmp-app.vox-deorum-bridge
[bridge:dll] Connection established
[bridge:dll] → {"type":"lua_call",...}
[bridge:dll] ← {"type":"lua_response",...}
[bridge:dll] Request timeout after 120000ms: uuid
```

## Troubleshooting Quick Reference

**Check service status:**
```bash
curl http://127.0.0.1:5000/health
curl http://127.0.0.1:5000/lua/functions
curl http://127.0.0.1:5000/external/functions
```

**Test connectivity:**
```bash
# Simple Lua call
curl -X POST http://127.0.0.1:5000/lua/call \
  -H "Content-Type: application/json" \
  -d '{"function":"GetGameTurn","args":[]}'

# External service health
curl http://127.0.0.1:4000/health
```

**Common solutions:**
1. **DLL connection**: Verify game running, check pipe name, enable mod
2. **Timeouts**: Check game not paused, optimize functions, use batch API
3. **Function errors**: List available functions, verify spelling
4. **Network issues**: Test endpoints with curl, check firewall
5. **Persistence**: Restart bridge service, reload game (to reload DLL)

**Detailed troubleshooting:** See [DEVELOPMENT.md](DEVELOPMENT.md#debugging)

## Error Handling Best Practices

### In External Services

```javascript
app.post('/analyze', async (req, res) => {
  try {
    const result = await analyzeData(req.body.args);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'ANALYSIS_FAILED', message: error.message }
    });
  }
});
```

### In Lua Code

```lua
if Game.IsExternalRegistered("AnalyzeThreat") then
  local result, err = Game.CallExternal("AnalyzeThreat", args)
  if result then
    print("Analysis:", result)
  else
    print("Error:", err.code, err.message)
  end
end
```

### In Client Code

```javascript
async function callLuaFunction(func, args) {
  const response = await fetch('http://127.0.0.1:5000/lua/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: func, args })
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(`${data.error.code}: ${data.error.message}`);
  }
  return data.result;
}
```

## Configuration

**Timeout settings:**
- Lua calls: 120s (hardcoded in [dll-connector.ts](../src/services/dll-connector.ts))
- External calls: 5s default, configurable via `/external/register` `timeout` field
- SSE keep-alive: 5s (hardcoded in [routes/events.ts](../src/routes/events.ts))

**See:** [CONFIGURATION.md](CONFIGURATION.md) for all configuration options
