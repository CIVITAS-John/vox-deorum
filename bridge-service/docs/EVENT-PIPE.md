# Event Pipe Documentation

The Event Pipe provides a one-to-many broadcasting mechanism for game events via named pipes (Windows). This allows external processes to receive real-time game events without using HTTP/SSE connections.

## Configuration

Add the following to your `config.json`:

```json
{
  "eventpipe": {
    "enabled": true,
    "name": "vox-deorum-events"
  }
}
```

Or use environment variables:
- `EVENTPIPE_ENABLED=true`
- `EVENTPIPE_NAME=vox-deorum-events`

## Connection Details

- Pipe path: `\\.\pipe\{name}` (e.g., `\\.\pipe\vox-deorum-events`)


## Protocol

- **Transport**: Named pipe (Windows) using node-ipc with raw buffer mode
- **Format**: JSON messages delimited by `!@#$%^!` (same as DLL connector)
- **Direction**: One-way (server to clients, broadcast only)
- **Batching**: Events are batched for performance (50ms timeout or 100 events max)

## Batching

Events are automatically batched for performance optimization:
- **Timeout**: Events are flushed every 50ms
- **Size limit**: Batches are sent immediately when reaching 100 events
- **Critical events**: Some events (like dll_status) trigger immediate flush
- **Format**: Multiple JSON objects joined with `!@#$%^!` delimiter in a single message
- **Benefits**: Reduces IPC overhead, improves throughput for high-frequency events

## Event Format

Each event is a JSON object with the following structure:

```typescript
interface GameEvent {
  type: string;           // Event type (e.g., "PlayerDoTurn", "dll_status")
  id?: string;            // Optional unique event ID
  payload?: any;          // Event-specific data
  extraPayload?: any;     // Additional event data
  visibility?: number[];  // Optional player visibility restrictions
}
```

## Special Events

### Connection Event
Sent immediately when a client connects:
```json
{
  "type": "connected",
  "timestamp": "2025-09-30T15:30:00.000Z",
  "message": "Connected to event pipe"
}
```

### Disconnection Event
Sent before server shutdown:
```json
{
  "type": "disconnecting",
  "timestamp": "2025-09-30T15:30:00.000Z",
  "message": "Server shutting down"
}
```

### DLL Status Events
```json
{
  "type": "dll_status",
  "payload": { "connected": true }
}
```

## Example Clients

### Using node-ipc (Recommended)

See `examples/event-pipe-client.js` for a complete Node.js client implementation using node-ipc with raw buffer support.

```javascript
const ipc = require('node-ipc');

ipc.config.id = 'my-client';
ipc.config.silent = true;
ipc.config.rawBuffer = true; // Important: match server configuration
ipc.config.encoding = 'utf8';

let messageBuffer = '';

ipc.connectTo('vox-deorum-events', () => {
  ipc.of['vox-deorum-events'].on('data', (data) => {
    // Append to buffer and split by delimiter
    messageBuffer += data.toString();
    const messages = messageBuffer.split('!@#$%^!');
    messageBuffer = messages.pop() || '';

    // Process each complete message
    messages.forEach(message => {
      if (message.trim()) {
        const event = JSON.parse(message.trim());
        console.log('Event:', event);
      }
    });
  });
});
```

### Using Raw Sockets

You can also connect directly to the named pipe using raw sockets:

```javascript
const net = require('net');
const pipe = '\\\\.\\pipe\\tmp-app.vox-deorum-events';

let messageBuffer = '';
const client = net.createConnection(pipe);

client.on('data', (data) => {
  // Messages use !@#$%^! delimiter
  messageBuffer += data.toString();
  const messages = messageBuffer.split('!@#$%^!');
  messageBuffer = messages.pop() || '';

  messages.forEach(message => {
    if (message.trim()) {
      const event = JSON.parse(message.trim());
      console.log('Event:', event);
    }
  });
});
```

## Monitoring

Check the event pipe status via the service stats endpoint:

```bash
curl http://localhost:5000/health/stats
```

Response includes:
```json
{
  "eventPipe": {
    "enabled": true,
    "clients": 3,
    "pipeName": "vox-deorum-events"
  }
}
```