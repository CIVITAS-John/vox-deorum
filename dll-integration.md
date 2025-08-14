# Vox Deorum DLL Integration Plan

## Executive Summary
This document outlines the minimal-change strategy for integrating Named Pipe IPC communication into the Community Patch DLL to enable bidirectional communication with the Bridge Service.

The implementation is separate into several stages. In each stage, focus on faithfully carring out the plan without over thinking. Then, plan the additional features for the next stage. 

## Code Requirements
The C++ code must:
1. Work with 32-bit Windows C++ (Visual Studio 2008 SP1 toolset)
2. Make minimal changes to existing Community Patch DLL code
3. Utilize existing logging infrastructure
4. Allow graceful degradation if external services are unavailable
5. Since Civilization only works on Windows, no need for other platform support

## Protocol Requirements
Follow the `bridge-service/PROTOCOL.md`.

## Stage 1: Initialize the Connection Service
In this stage, initialize the ConnectionService with the bare minimum of structures:
- Setup()
- Shutdown()
- Log(Level, Message)

### Log Example
```
FILogFile* pLog = LOGFILEMGR.GetLog("connection.log", FILogFile::kDontTimeStamp);
if (pLog)
{
    pLog->Msg(Message);
}
```

Then, inject the two functions into relevant entry points within existing game lifecycle.