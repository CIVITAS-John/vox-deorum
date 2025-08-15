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

## Stage 2: Initialize the Minimal Named Pipe Server
The NAMED PIPE server should only listen to message and write into logs, then send the same message back.
- The server should spawn a child thread to wait for the client (Bridge Service) to connect
- The server only intends to serve one client (Bridge Service), hence the listening/responding loop should happen in the same child thread.
- The server should keep track of whether the client is connected and write logs accordingly.

## Stage 3: Event Loop Implementation
Implement a thread-safe message queue system where the SSE thread receives JSON messages, queues them, and the game loop processes them during its update cycle.

### Key Components

#### Thread-Safe Message Queue Structure
Add to CvConnectionService.h:
- GameMessage struct with jsonData and timestamp
- Two message queues: m_incomingQueue (Bridge -> Game) and m_outgoingQueue (Game -> Bridge)
- Two CRITICAL_SECTION objects for thread safety: m_csIncoming and m_csOutgoing
- Public method ProcessMessages() for game loop to call
- Private helper methods: QueueIncomingMessage() and DequeueOutgoingMessage()

#### Initialization Changes
- Setup(): Initialize critical sections with InitializeCriticalSection()
- Shutdown(): Delete critical sections with DeleteCriticalSection()

#### Modified HandleClientConnection
Instead of just logging and echoing:
1. Parse received data as JSON (validate format)
2. Queue message using QueueIncomingMessage()
3. Check outgoing queue for responses using DequeueOutgoingMessage()
4. Send any pending outgoing messages back to Bridge

#### ProcessMessages Implementation
Called from main game thread:
1. Lock incoming queue with critical section
2. Process all queued messages
3. For each message: log it and queue echo response
4. Release locks promptly to avoid blocking SSE thread

#### CvGame Integration
Add call to CvConnectionService::GetInstance().ProcessMessages() in CvGame::update() or similar periodic method

### Thread Safety Strategy
- Two separate critical sections to avoid deadlocks
- Minimal lock duration - quickly enter, operate, exit
- No blocking operations inside critical sections
- SSE thread writes to incoming queue, reads from outgoing queue
- Game thread reads from incoming queue, writes to outgoing queue

### Implementation Steps
1. Add queue structures and critical sections to header
2. Initialize/cleanup critical sections in Setup/Shutdown
3. Implement QueueIncomingMessage and DequeueOutgoingMessage
4. Modify HandleClientConnection to use queues
5. Implement ProcessMessages with logging/echo logic
6. Add ProcessMessages call to CvGame update loop
7. Test with Bridge Service for message flow

### Testing Strategy
- Send test JSON from Bridge Service
- Verify messages are logged during game loop
- Confirm echo messages are received by Bridge
- Monitor for thread safety issues (race conditions, deadlocks)