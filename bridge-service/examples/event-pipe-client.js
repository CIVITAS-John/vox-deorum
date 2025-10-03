/**
 * Example client for connecting to the Bridge Service Event Pipe using node-ipc
 *
 * This demonstrates how to connect to the event pipe and receive game events
 * in real-time through a named pipe connection using the node-ipc library.
 *
 * The client handles batched events using the !@#$%^! delimiter format.
 */

const ipc = require('node-ipc');

// Configuration
const eventPipeName = 'vox-deorum-events'; // Must match the server's eventpipe.name config

// Configure IPC client
ipc.config.id = 'event-pipe-client';
ipc.config.retry = 1500;
ipc.config.silent = true;
ipc.config.rawBuffer = true; // Use raw buffer to match server
ipc.config.encoding = 'utf8';

// Statistics
let totalEventsReceived = 0;
let batchesReceived = 0;
let messageBuffer = '';

console.log(`🔌 Connecting to event pipe: ${eventPipeName}`);

// Connect to the event pipe server
ipc.connectTo(eventPipeName, () => {
  ipc.of[eventPipeName].on('connect', () => {
    console.log('🎉 Connected to event pipe');
  });

  ipc.of[eventPipeName].on('disconnect', () => {
    console.log('🔌 Disconnected from event pipe');
    console.log(`📊 Statistics: ${totalEventsReceived} events in ${batchesReceived} batches`);
    process.exit(0);
  });

  // Handle raw buffer data with delimiter
  ipc.of[eventPipeName].on('data', (data) => {
    // Append to buffer
    messageBuffer += data.toString();

    // Process all complete messages (delimited by !@#$%^!)
    const messages = messageBuffer.split('!@#$%^!');

    // Keep the last incomplete message in buffer (if any)
    messageBuffer = messages.pop() || '';

    // Process each complete message
    messages.forEach(message => {
      const trimmed = message.trim();
      if (trimmed === '') return;

      try {
        const event = JSON.parse(trimmed);
        totalEventsReceived++;

        // Check if this is a batch (multiple events sent together)
        if (messages.length > 1) {
          if (batchesReceived === 0 || messages.length > 1) {
            batchesReceived++;
            console.log(`📦 Batch received: ${messages.length} events`);
          }
        } else {
          console.log('📨 Single event received:', event.type || 'unknown');
        }

        processEvent(event);
      } catch (error) {
        console.error('❌ Error parsing event:', error.message);
        console.error('Raw message:', trimmed.substring(0, 100) + '...');
      }
    });
  });

  ipc.of[eventPipeName].on('error', (error) => {
    console.error('❌ Connection error:', error);
    if (!ipc.of[eventPipeName].socket.readable) {
      console.error('❌ Cannot connect to event pipe. Is the bridge service running with eventpipe enabled?');
      console.error('   Set eventpipe.enabled to true in config.json');
      process.exit(1);
    }
  });
});

// Function to process individual events
function processEvent(event) {
  // Handle specific event types with nice formatting
  if (event.type === 'connected') {
    console.log('  ✅ Successfully connected to event pipe');
  } else if (event.type === 'disconnecting') {
    console.log('  👋 Server is shutting down');
  } else if (event.type === 'dll_status') {
    console.log(`  🔗 DLL Status: ${event.payload?.connected ? 'Connected' : 'Disconnected'}`);
  } else if (event.type === 'PlayerDoTurn') {
    console.log(`  🎮 Player ${event.payload?.PlayerID} is taking their turn`);
  } else if (event.type === 'PlayerDoneTurn') {
    console.log(`  ✅ Player turn complete, next player: ${event.payload?.NextPlayerID}`);
  } else if (event.type === 'CityFounded') {
    console.log(`  🏛️ City founded: ${event.payload?.CityName} by Player ${event.payload?.PlayerID}`);
  } else if (event.type === 'TechResearched') {
    console.log(`  🔬 Tech researched: ${event.payload?.TechName} by Player ${event.payload?.PlayerID}`);
  } else if (event.type === 'UnitCreated') {
    console.log(`  ⚔️ Unit created: ${event.payload?.UnitType} by Player ${event.payload?.PlayerID}`);
  } else if (event.type === 'CombatResult') {
    console.log(`  💥 Combat: ${event.payload?.AttackerDamage} dmg to defender, ${event.payload?.DefenderDamage} dmg to attacker`);
  } else {
    // Log other events with less detail
    console.log(`  📌 ${event.type}${event.payload ? ': ' + JSON.stringify(event.payload).substring(0, 50) + '...' : ''}`);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Closing connection...');
  console.log(`📊 Final statistics: ${totalEventsReceived} events received`);
  ipc.disconnect(eventPipeName);
  process.exit(0);
});

// Display stats periodically
setInterval(() => {
  if (totalEventsReceived > 0) {
    const avgEventsPerBatch = batchesReceived > 0 ? (totalEventsReceived / batchesReceived).toFixed(2) : totalEventsReceived;
    console.log(`📊 Stats update: ${totalEventsReceived} events, ${batchesReceived} batches (avg: ${avgEventsPerBatch} events/batch)`);
  }
}, 30000); // Every 30 seconds

console.log('📡 Waiting for events... (Press Ctrl+C to exit)');
console.log('💡 Tip: Events are batched using !@#$%^! delimiter for performance');