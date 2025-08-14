# Vox Deorum DLL Integration Plan

## Executive Summary
This document outlines the minimal-change strategy for integrating Winsock-based IPC communication into the Community Patch DLL to enable bidirectional communication with the Bridge Service.

## Code Requirements
The C++ code must:
1. Work with 32-bit Windows C++ (Visual Studio 2008 SP1 toolset)
2. Make minimal changes to existing Community Patch DLL code
3. Utilize existing logging infrastructure
4. Allow graceful degradation if external services are unavailable

## Architecture Overview

### Communication Flow
```
Civ 5 Game → Community Patch DLL → IPC (Named Pipes/Sockets) → Bridge Service
                    ↑                                              ↓
                Lua Scripts                                  REST API + SSE
                                                                   ↓
                                                            External Services
```

### Protocol Requirements
Based on Bridge Service analysis (`bridge-service/src/services/dll-connector.ts`):
- **IPC Type**: Windows Named Pipes
- **Message Format**: UTF-8 JSON strings
- **Connection ID**: `"civ5"`
- **Message Types**:
  - From DLL: `lua_response`, `external_call`, `game_event`, `lua_register`
  - To DLL: `lua_call`, `lua_execute`, `external_register`, `external_unregister`, `external_response`
