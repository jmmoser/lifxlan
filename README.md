# lifxlan

A fast, lightweight TypeScript library for controlling LIFX smart lights over your local network (LAN). Works with Node.js, Bun, and Deno with zero dependencies.

## What does this do?

This library lets you discover and control LIFX smart lights on your local network. You can:
- 🔍 **Discover devices** on your network
- 💡 **Control lights** (turn on/off, change colors, brightness)
- 🎯 **Target specific devices** or broadcast to all devices
- 🔗 **Group devices** for batch operations
- ⚡ **High performance** - optimized for speed
- 🚀 **Zero dependencies** - bring your own UDP socket
- 🎛️ **Direct packet control** - each client operation sends exactly one packet with no hidden behavior

## Quick Start

### Installation

```bash
npm install lifxlan
```

### Turn a light on (simplest example)

```javascript
import dgram from 'node:dgram';
import { Client, Devices, Router, GetServiceCommand, SetPowerCommand } from 'lifxlan/index.js';

const socket = dgram.createSocket('udp4');

// Set up the router to send messages
const router = Router({
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

// Track discovered devices
const devices = Devices();

// Handle incoming messages
socket.on('message', (message, remote) => {
  const { header, serialNumber } = router.receive(message);
  devices.register(serialNumber, remote.port, remote.address, header.target);
});

// Start the socket
await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.once('listening', resolve);
  socket.bind();
});

socket.setBroadcast(true);

const client = Client({ router });

// Discover devices
client.broadcast(GetServiceCommand());
const scanInterval = setInterval(() => {
  client.broadcast(GetServiceCommand());
}, 1000);

// Wait for a specific device (replace with your device's serial number)
const device = await devices.get('d07123456789');

// Stop scanning
clearInterval(scanInterval);

// Turn the light on!
await client.send(SetPowerCommand(true), device);

socket.close();
```

### Discover and control all devices

```javascript
import { GetServiceCommand, SetPowerCommand } from 'lifxlan/index.js';

// ... setup code from above ...

// Discover all devices
client.broadcast(GetServiceCommand());
const scanInterval = setInterval(() => {
  client.broadcast(GetServiceCommand());
}, 1000);

// Wait a few seconds for discovery
await new Promise(resolve => setTimeout(resolve, 3000));

// Stop scanning
clearInterval(scanInterval);

// Turn on all discovered lights
for (const device of devices) {
  await client.send(SetPowerCommand(true), device);
}
```

### Change light color

```javascript
import { SetColorCommand } from 'lifxlan/index.js';

// Set to bright red
await client.send(
  SetColorCommand(0, 65535, 65535, 3500, 0), // hue, saturation, brightness, kelvin, duration
  device
);

// Set to blue with 2-second transition
await client.send(
  SetColorCommand(43690, 65535, 65535, 3500, 2000),
  device
);
```

## Core Concepts

### Architecture Overview

The library uses three main components:

1. **Router** - Handles message routing and correlation between requests/responses
2. **Client** - High-level interface for sending commands with timeouts and retries  
3. **Devices** - Registry that tracks discovered LIFX devices on your network

### Bring Your Own Socket

This library doesn't include UDP socket implementation - you provide it. This makes it work across different server-side JavaScript runtimes:

- **Node.js/Bun**: Use `dgram.createSocket('udp4')`
- **Deno**: Use `Deno.listenDatagram()`

### Response Mode Control

The `client.send()` method supports flexible response modes with **full type safety** - the return type changes based on the response mode you choose:

```javascript
// Use command defaults (recommended)
const color = await client.send(GetColorCommand(), device);     // Promise<LightState>
await client.send(SetPowerCommand(true), device);              // Promise<StatePower> (ack-only default)

// Override response behavior with type-safe returns
await client.send(command, device, { responseMode: 'ack-only' });  // Promise<void>
const data = await client.send(command, device, { responseMode: 'response' }); // Promise<T>
const result = await client.send(command, device, { responseMode: 'both' });   // Promise<T>

// With abort signal
const response = await client.send(GetColorCommand(), device, { 
  responseMode: 'both',     // TypeScript knows this returns Promise<LightState>
  signal: abortController.signal 
});
console.log(response.hue);    // ✅ TypeScript knows response is LightState
```

**Response Modes:**
- `'auto'` - Use the command's default behavior (recommended) → `Promise<T>`
- `'ack-only'` - Wait for acknowledgment packet (confirms receipt) → `Promise<void>`
- `'response'` - Wait for response data packet (Get commands) → `Promise<T>`
- `'both'` - Wait for both ack and response (maximum reliability) → `Promise<T>`

**Command Defaults:**
- **Get commands** (GetColor, GetPower, etc.) default to `'response'`
- **Set commands** (SetColor, SetPower, etc.) default to `'ack-only'`

**Fire-and-forget:** Use `client.unicast()` for commands that don't need confirmation

**Type Safety:** The return type automatically changes based on your response mode choice - no type assertions needed!

## Examples by Runtime

### Node.js / Bun

```javascript
import dgram from 'node:dgram';
import { Client, Router, Devices, GetServiceCommand } from 'lifxlan/index.js';

const socket = dgram.createSocket('udp4');

// Router handles outgoing messages and forwards responses to clients
const router = Router({
  onSend(message, port, address) {
    // A message is ready to be sent
    socket.send(message, port, address);
  },
});

// Devices keeps track of devices discovered on the network
const devices = Devices({
  onAdded(device) {
    // A device has been discovered
    console.log(device);
  },
});

socket.on('message', (message, remote) => {
  // Forward received messages to the router
  const { header, serialNumber } = router.receive(message);
  // Forward the message to devices so it can keep track
  devices.register(serialNumber, remote.port, remote.address, header.target);
});

// Client handles communication with devices
const client = Client({ router });

socket.once('listening', () => {
  socket.setBroadcast(true);
  // Discover devices on the network
  client.broadcast(GetServiceCommand());
});

socket.bind();

setTimeout(() => {
  socket.close();
}, 1000);
```

### Deno

```javascript
import { Client, Router, Devices, GetServiceCommand } from 'lifxlan/index.js';

const socket = Deno.listenDatagram({
  hostname: '0.0.0.0',
  port: 0,
  transport: 'udp',
});

const router = Router({
  onSend(message, port, hostname) {
    socket.send(message, { port, hostname });
  }
});

const devices = Devices({
  onAdded(device) {
    console.log(device);
  },
});

const client = Client({ router });

client.broadcast(GetServiceCommand());

setTimeout(() => {
  socket.close();
}, 1000);

for await (const [message, remote] of socket) {
  const { header, serialNumber } = router.receive(message);
  devices.register(serialNumber, remote.port, remote.hostname, header.target);
}
```

## Common Patterns

### Error Handling with Retries

```javascript
for (let i = 0; i < 3; i++) {
  try {
    console.log(await client.send(GetColorCommand(), device));
    break;
  } catch (err) {
    const delay = Math.random() * Math.min(Math.pow(2, i) * 1000, 30 * 1000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
```

### Custom Timeouts

```javascript
const controller = new AbortController();

const timeout = setTimeout(() => {
  controller.abort();
}, 100);

try {
  console.log(await client.send(GetColorCommand(), device, { signal: controller.signal }));
} finally {
  clearTimeout(timeout)
}
```

### Use Without Device Discovery

```javascript
import { Client, Device, Router, SetPowerCommand } from 'lifxlan/index.js';

// ... socket setup ...

const client = Client({ router });

// Create the device directly
const device = Device({
  serialNumber: 'd07123456789',
  address: '192.168.1.50',
});

await client.send(SetPowerCommand(true), device);
```

### Multiple Clients

```javascript
const client1 = Client({ router });
const client2 = Client({ router });

// Both clients share the same router and can operate independently
await client1.broadcast(GetServiceCommand());
await client2.send(SetPowerCommand(true), device);
```

### Resource Management for Many Clients

```javascript
while (true) {
  const client = Client({ router });

  console.log(await client.send(GetPowerCommand(), device));

  // When creating a lot of clients, call dispose to avoid running out of source values
  client.dispose();
}
```

### Response Mode Control Examples

```javascript
// High-reliability mode: wait for both ack and response (typed return)
const state = await client.send(SetColorCommand(120, 100, 100, 3500, 1000), device, { 
  responseMode: 'both'     // TypeScript knows this returns Promise<LightState>
});
console.log('Confirmed color:', state.hue); // ✅ Fully typed

// Fast mode: fire-and-forget for animations (no promise)
for (let i = 0; i < 360; i += 10) {
  client.unicast(SetColorCommand(i * 182, 65535, 65535, 3500, 100), device);
  await new Promise(resolve => setTimeout(resolve, 50));
}

// Confirmation only (void return)
await client.send(SetColorCommand(120, 100, 100, 3500, 0), device, { 
  responseMode: 'ack-only' // TypeScript knows this returns Promise<void>
});

// Get response data (typed return)
const currentState = await client.send(SetColorCommand(120, 100, 100, 3500, 0), device, { 
  responseMode: 'response' // TypeScript knows this returns Promise<LightState>
});
console.log('Light is now:', currentState.hue); // ✅ Fully typed, no assertions needed
```

## Advanced Examples

### Device Groups

```javascript
import { Groups, GetGroupCommand } from 'lifxlan/index.js';

const groups = Groups({
  onAdded(group) {
    console.log('Group added', group);
  },
  onChanged(group) {
    console.log('Group changed', group);
  },
});

const devices = Devices({
  async onAdded(device) {
    const group = await client.send(GetGroupCommand(), device);
    groups.register(device, group);
  },
});

// Send command to all devices in a group
for (const group of groups) {
  await Promise.all(
    group.devices.map(device => 
      client.send(GetLabelCommand(), device)
    )
  );
}
```

### Party Mode (Animated Colors)

```javascript
const PARTY_COLORS = [
  [48241, 65535, 65535, 3500], // Red
  [43690, 49151, 65535, 3500], // Blue  
  [54612, 65535, 65535, 3500], // Green
  [43690, 65535, 65535, 3500], // Cyan
  [38956, 55704, 65535, 3500], // Purple
];

while (true) {
  for (const device of devices) {
    const [hue, saturation, brightness, kelvin] = 
      PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)];
    
    client.unicast(
      SetColorCommand(hue, saturation, brightness, kelvin, 1000), 
      device
    );
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

### Custom Commands

```javascript
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
function decodeCustom(bytes, offsetRef) {
  const val1 = bytes[offsetRef.current++];
  const val2 = bytes[offsetRef.current++];
  return { val1, val2 };
}

function CustomCommand() {
  return {
    type: 1234,
    decode: decodeCustom,
  };
}

const res = await client.send(CustomCommand(), device);
console.log(res.val1, res.val2);
```

### Separate Sockets for Broadcast/Unicast

```javascript
const broadcastSocket = dgram.createSocket('udp4');
const unicastSocket = dgram.createSocket('udp4');

const router = Router({
  onSend(message, port, address, serialNumber) {
    if (!serialNumber) {
      broadcastSocket.send(message, port, address);
    } else {
      unicastSocket.send(message, port, address);
    }
  },
});

// ... handle messages from both sockets ...
```

### Message Callbacks

```javascript
// Router-level message callback (all messages)
const router = Router({
  onMessage(header, payload, serialNumber) {
    console.log('Router received:', header.type);
  },
});

// Client-level message callback (messages for this client)
const client = Client({
  router,
  onMessage(header, payload, serialNumber) {
    console.log('Client received:', header.type);
  },
});
```

## Contributing

This library follows a modular architecture with clear separation between protocol, transport, and application layers. See the source code for implementation details.

## License

MIT © Justin Moser