# Bridge-Service Test Suites

`bridge-service` uses a mock-first test strategy.

- `npm test`
- `npm run test:mock`

Both commands run the mock suite by default.

Use the live Civ smoke suite only when you explicitly want end-to-end verification against a running game:

- `npm run test:real`

## Why Mock Is The Default

The mock suite covers almost all validation, route behavior, reconnect logic, IPC framing, and service state transitions. It is fast, deterministic, and safe to run even if a real Civ game is already open.

The real suite is intentionally small. It exists to prove that the bridge still works against an actual Civ instance, not to duplicate every mock-path assertion.

## Mock vs Real

Mock suite:

- Runs all `tests/**/*.test.ts` except `*.real.test.ts`.
- Uses a mock DLL, mock external services, and isolated test ports/pipes.
- Covers the main regression surface and should be the CI/default path.

Real suite:

- Runs only `tests/**/*.real.test.ts`.
- Assumes Civilization V plus the relevant DLL/mod setup is already running.
- Focuses on smoke coverage such as connect, Lua execution, external round-trip, and reconnect survival.

## Isolation Rules

Mock tests are designed to coexist with a real game session.

- The shared mock test run gets a unique named pipe ID instead of the production default.
- The shared mock test run gets a unique event-pipe name.
- The mock REST port and mock external service ports are generated per run.
- A few stateful suites temporarily replace the shared mock with an isolated mock pipe, then restore the shared mock when the suite finishes.

This prevents collisions with:

- a real Civ instance using the normal production pipe
- another local test run
- per-suite reconnect and buffering tests that need exclusive connector state

## Suite Layout

Kept and revised:

- `connection/lifecycle.test.ts`
- `connection/message-handling.test.ts`
- `connection/error-handling.test.ts`
- `connection/reconnection.test.ts`
- `routes/lua.test.ts`
- `routes/external.test.ts`
- `routes/sse.test.ts`
- `routes/statistics.test.ts`

Added:

- `connection/reconnect-state.test.ts`
- `routes/pause.test.ts`
- `routes/events-state.test.ts`
- `service/bridge-service.test.ts`
- `services/dll-connector-buffering.test.ts`
- `services/external-manager.test.ts`
- `services/lua-manager.test.ts`
- `services/pause-manager.test.ts`
- `real/bridge.real.test.ts`

Removed as low-value:

- `connection/configuration.test.ts`

## What Each Area Covers

Connection:

- connect/disconnect lifecycle
- request success, timeout, and disconnect failure behavior
- reconnect attempt tracking
- reconnect state restoration for external registrations
- IPC framing, partial buffers, and batched message handling

Routes:

- `/lua/*`
- `/external/*`
- pause routes
- SSE delivery and DLL status broadcasting
- current event-route behavior, including `PlayerDoTurn` handling and clearing paused players on DLL disconnect
- stats and health endpoints with meaningful state assertions

Services:

- bridge startup/shutdown orchestration
- external manager validation and re-registration
- lua registry sync
- pause manager local state and reconnect resync when state is still present

Real smoke:

- live Civ connection
- live Lua execution
- live external callback flow
- reconnect recovery

## Interpreting Failures

Reconnect failures usually mean one of these:

- the connector did not observe a clean pipe disconnect
- external registrations were not restored after reconnect
- tests assumed paused-player state survives a DLL disconnect when the route layer intentionally clears it

IPC/buffering failures usually mean one of these:

- the connector did not clear partial buffered data on disconnect
- the mock DLL is not matching the real delimiter protocol
- a suite accidentally reused shared connector state

SSE failures usually mean one of these:

- DLL status events were not broadcast
- event buffering/flushing was not completed before assertion
- the event pipe was unexpectedly enabled or disabled

Pause failures usually mean one of these:

- player ID validation drifted from `MaxCivs`
- disconnect handling no longer matches the intentional route behavior
- turn events are not mapping to the correct player IDs

## Real-Test Preconditions

Before running `npm run test:real`:

- start Civilization V
- load the mod/DLL configuration that the bridge expects
- make sure the live game is on the real production pipe, not a test override
- do not expect the real suite to cover every mock-only validation edge case

## Maintenance Notes

- Keep new edge-case coverage in mock mode unless it truly requires a live game.
- Prefer isolated mock pipes for any suite that mutates connector-global state.
- If a test only checks object shape or a library implementation detail, it probably does not belong here.
