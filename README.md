# lifxlan

[![npm version](https://img.shields.io/npm/v/lifxlan.svg)](https://www.npmjs.com/package/lifxlan)
[![npm downloads](https://img.shields.io/npm/dm/lifxlan.svg)](https://www.npmjs.com/package/lifxlan)
[![CI](https://github.com/jmmoser/lifxlan/actions/workflows/ci.yml/badge.svg)](https://github.com/jmmoser/lifxlan/actions/workflows/ci.yml)
![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![runtimes](https://img.shields.io/badge/runtime-Node.js%20%7C%20Bun%20%7C%20Deno-blueviolet)
[![license](https://img.shields.io/npm/l/lifxlan.svg)](LICENSE)

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

Runnable scripts for every runtime live in [`examples/`](examples/).

## Quick Start

### Installation

```bash
npm install lifxlan
```

### Turn a light on

```javascript
import dgram from 'node:dgram';
import { Client, Devices, Router, GetServiceCommand, SetPowerCommand } from 'lifxlan';

const socket = dgram.createSocket('udp4');

// Set up the router to send messages
const router = Router({
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

// Registry of discovered devices (populated by the message handler below)
const devices = Devices();

// Handle incoming messages. router.receive() decodes the packet (or returns
// undefined for a malformed one); devices.register() takes that result and the
// sender's address straight through, registering nothing when it's undefined.
socket.on('message', (message, remote) => {
  const result = router.receive(message);
  devices.register(remote.port, remote.address, result);
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
import { GetServiceCommand, SetPowerCommand } from 'lifxlan';

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
import { SetColorCommand } from 'lifxlan';

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
2. **Client** - High-level interface for sending commands with timeouts and response correlation  
3. **Devices** - Registry that tracks discovered LIFX devices on your network

Each `Client` gets a unique **source** id from the `Router` and tracks a per-device **sequence** number internally; together they correlate responses with their requests, so many clients can share one router and socket. Sequence is managed for you; a `Device` is just a network descriptor.

### Bring Your Own Socket

This library doesn't include UDP socket implementation - you provide it. This makes it work across different server-side JavaScript runtimes:

- **Node.js**: Use `dgram.createSocket('udp4')`
- **Bun**: Use `Bun.udpSocket()` (or `node:dgram`, which Bun also implements)
- **Deno**: Use `Deno.listenDatagram()`

### Buffer Ownership

For performance, decoding is zero-copy: the buffer you pass to `router.receive()` is consumed, not copied. Decoded values — `header.target`, `payload`, and the results resolved by `client.send()` — are views into that buffer. Node's `dgram`, Bun's `udpSocket`, and Deno's `listenDatagram` all allocate a fresh buffer per datagram, so the examples in this README are safe as-is. If your socket layer reuses a receive buffer, pass a copy to `router.receive()` (e.g. `message.slice()`), and copy any decoded bytes you intend to keep long-term.

### Response Mode Control

The `client.send()` method supports flexible response modes with **full type safety** - the return type changes based on the response mode you choose:

```javascript
// Use command defaults (recommended)
const color = await client.send(GetColorCommand(), device);     // Promise<LightState>
await client.send(SetPowerCommand(true), device);              // Promise<void> (Set commands default to ack-only)

// Override response behavior with type-safe returns
await client.send(command, device, { responseMode: 'ack-only' });  // Promise<void>
const data = await client.send(command, device, { responseMode: 'response' }); // Promise<T>
const result = await client.send(command, device, { responseMode: 'both' });   // Promise<T>

// With abort signal
const response = await client.send(GetColorCommand(), device, { 
  responseMode: 'both',     // returns Promise<LightState>
  signal: abortController.signal 
});
console.log(response.hue);    // response is typed as LightState
```

**Response Modes:**
- `'auto'` - Use the command's default behavior (recommended) → `Promise<T>`
- `'ack-only'` - Wait for acknowledgment packet (confirms receipt) → `Promise<void>`
- `'response'` - Wait for response data packet (Get commands) → `Promise<T>`
- `'both'` - Wait for both ack and response → `Promise<T>`

**Command Defaults:**
- **Get commands** (GetColor, GetPower, etc.) default to `'response'`
- **Set commands** (SetColor, SetPower, etc.) default to `'ack-only'`

**Fire-and-forget:** Use `client.unicast()` for commands that don't need confirmation

**Type Safety:** The return type changes based on your response mode choice, so no type assertions are needed.

## Examples by Runtime

### Node.js / Bun

```javascript
import dgram from 'node:dgram';
import { Client, Router, Devices, GetServiceCommand } from 'lifxlan';

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
  // Forward received messages to the router and register the responder.
  // router.receive() returns undefined for malformed packets, and
  // devices.register() registers nothing when handed undefined.
  devices.register(remote.port, remote.address, router.receive(message));
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

### Bun (native socket)

The `node:dgram` example above works in Bun as-is, but Bun also has a native
UDP socket API. Incoming datagrams arrive through the `data` callback instead
of a `'message'` event:

```javascript
import { Client, Router, Devices, GetServiceCommand } from 'lifxlan';

const router = Router({
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

const devices = Devices({
  onAdded(device) {
    console.log(device);
  },
});

const socket = await Bun.udpSocket({
  socket: {
    data(_socket, message, port, address) {
      devices.register(port, address, router.receive(message));
    },
  },
});

socket.setBroadcast(true);

const client = Client({ router });

client.broadcast(GetServiceCommand());

setTimeout(() => {
  socket.close();
}, 1000);
```

#### Batching sends with `sendMany`

Bun's `socket.sendMany()` can send multiple datagrams in a single syscall on
supported operating systems. Buffer outgoing messages in `onSend` and flush them
on a microtask to collapse every send issued in the same tick into one
`sendMany`. Ordinary `send()`, `unicast()`, `broadcast()`, and `Promise.all`
fan-outs then batch automatically, with no API changes:

```javascript
const socket = await Bun.udpSocket({});

const queue = [];
let scheduled = false;

const router = Router({
  onSend(message, port, address) {
    queue.push(message, port, address);
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        const batch = queue.slice(); // copy before clearing
        queue.length = 0;
        socket.sendMany(batch);
      });
    }
  },
});
```

This replaces one syscall per packet with one per tick, reducing send-path
overhead when pushing frequent updates to many devices (such as color
animations across a group). Benchmark it against your own workload to decide
whether it is worth wiring up.

### Deno

```javascript
import { Client, Router, Devices, GetServiceCommand } from 'lifxlan';

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
  devices.register(remote.port, remote.hostname, router.receive(message));
}
```

## Common Patterns

### Discovery Helper

The optional `lifxlan/discovery` subpath packages the broadcast-on-an-interval loop from the Quick Start. `discover()` broadcasts `GetService` immediately and on an interval, yielding devices as your handler registers them — known devices first, then new arrivals. End to end:

```javascript
import dgram from 'node:dgram';
import { Devices, Router } from 'lifxlan';
import { discover } from 'lifxlan/discovery';

const socket = dgram.createSocket('udp4');
const router = Router({ onSend: (msg, port, address) => socket.send(msg, port, address) });
const devices = Devices();

// Registration stays yours: feed received packets into the registry.
socket.on('message', (msg, remote) => {
  devices.register(remote.port, remote.address, router.receive(msg));
});

await new Promise((resolve) => {
  socket.once('listening', resolve);
  socket.bind();
});
socket.setBroadcast(true);

for await (const device of discover(router, devices, { timeoutMs: 3000 })) {
  console.log('found', device.serialNumber, device.address);
}

socket.close();
```

`discover()` owns its broadcast timer and a client, releasing both when iteration ends — which is never an error. A `timeoutMs` budget or aborted `signal` ends it after draining already-queued devices; `break` or `dispose()` end it at once and discard the rest. Either way the timer is cleared, so the loop can't leak it. (Contrast `devices.get()`, where abort *rejects* — there it means the lookup failed; here it just means "stop collecting".)

The iterator is `Disposable`, so `using` stops discovery at end of scope:

```javascript
using discovery = discover(router, devices);
const device = await devices.get('d07123456789');
```

Writing `using` needs TypeScript ≥ 5.2 with `Disposable` in scope (a `lib` that includes `esnext.disposable`, or `@types/node`, which Node ≥ 22 projects already have); otherwise call `dispose()` directly. With no `timeoutMs` it runs until disposed, keeping the registry fresh as DHCP addresses change. Internally it uses the public `devices.subscribe({ onAdded, onChanged, onRemoved })`, which observes registry events and returns an unsubscribe function.

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

### Timeouts and Cancellation

Every `client.send()` is covered by a timeout (3 seconds by default — UDP packets get lost, so a call never hangs forever). Override it per client or per call:

```javascript
const client = Client({ router, defaultTimeoutMs: 5000 });

// Per-call override
await client.send(GetColorCommand(), device, { timeoutMs: 100 });
```

An `AbortSignal` can be passed for cancellation. The signal is *additive* to the timeout — it does not replace it — and the promise rejects with the signal's reason:

```javascript
const controller = new AbortController();

const promise = client.send(GetColorCommand(), device, { signal: controller.signal });

controller.abort(new Error('user navigated away'));

try {
  await promise;
} catch (err) {
  console.log(err.message); // 'user navigated away'
}
```

Pass `timeoutMs: 0` to disable the timeout for a call, leaving the signal (or a response) as the only way to settle it. `devices.get()` accepts the same options: `devices.get(serialNumber, { signal, timeoutMs })`.

**`send()` never throws synchronously.** Every failure — a disposed client, an aborted signal, a missing decoder, a throwing transport, or sequence exhaustion — is delivered through the returned promise, so `Promise.all(devices.map(d => client.send(cmd, d)))` observes failures uniformly. (The fire-and-forget `broadcast()` and `unicast()` throw synchronously instead, since they have no promise to reject.)

Each client can have up to 255 requests in flight per device; sequence numbers are recycled as responses arrive, skipping any still held by pending requests. If all 255 are genuinely in flight, `send()` rejects with `SequenceExhaustionError`.

### Use Without Device Discovery

```javascript
import { Client, Device, Router, SetPowerCommand } from 'lifxlan';

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
client1.broadcast(GetServiceCommand());
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
  responseMode: 'both'     // returns Promise<LightState>
});
console.log('Confirmed color:', state.hue);

// Fast mode: fire-and-forget for animations (no promise)
for (let i = 0; i < 360; i += 10) {
  client.unicast(SetColorCommand(i * 182, 65535, 65535, 3500, 100), device);
  await new Promise(resolve => setTimeout(resolve, 50));
}

// Confirmation only (void return)
await client.send(SetColorCommand(120, 100, 100, 3500, 0), device, { 
  responseMode: 'ack-only' // returns Promise<void>
});

// Get response data (typed return)
const currentState = await client.send(SetColorCommand(120, 100, 100, 3500, 0), device, { 
  responseMode: 'response' // returns Promise<LightState>
});
console.log('Light is now:', currentState.hue);
```

## Advanced Examples

### Device Groups

```javascript
import { Groups, GetGroupCommand, GetLabelCommand } from 'lifxlan';

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
  [48241, 65535, 65535, 3500], // Violet
  [43690, 49151, 65535, 3500], // Soft blue
  [54612, 65535, 65535, 3500], // Magenta
  [43690, 65535, 65535, 3500], // Blue
  [38956, 55704, 65535, 3500], // Azure
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

### Product Capabilities

Not every device supports every command — multizone, extended multizone, HEV, infrared, relays, and buttons are all product-specific. The optional `lifxlan/products` subpath resolves the vendor/product ids from a `GetVersionCommand` (plus, optionally, the firmware version from `GetHostFirmwareCommand`) against the official [products.json](https://github.com/LIFX/products) registry:

```javascript
import { PRODUCTS_URL, GetVersionCommand, GetHostFirmwareCommand } from 'lifxlan';
import { Products } from 'lifxlan/products';

// Bring your own data: fetch it at runtime or vendor the file.
const products = Products(await (await fetch(PRODUCTS_URL)).json());

const version = await client.send(GetVersionCommand(), device);
const firmware = await client.send(GetHostFirmwareCommand(), device);

const features = products.features(version.vendor, version.product, firmware);
if (features?.extended_multizone) {
  // safe to use SetExtendedColorZonesCommand
}
```

### LIFX Switch (Relays and Buttons)

```javascript
import { GetRPowerCommand, SetRPowerCommand, GetButtonCommand, SetButtonCommand, ButtonGesture, ButtonTargetType } from 'lifxlan';

// Toggle relay 0
const { level } = await client.send(GetRPowerCommand(0), device);
await client.send(SetRPowerCommand(0, level > 0 ? 0 : 65535), device);

// Read the button configuration
const state = await client.send(GetButtonCommand(), device);
console.log(state.count, state.buttons[0].actions[0].gesture);
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

`decode` must be stateless — the same command object may be sent multiple times, concurrently, to multiple devices.

### Custom Multi-Response Commands

For commands whose result spans *multiple* response packets, provide `createDecoder` instead of `decode`. It is called once per `send()`, so every exchange gets its own accumulation state and the command object stays safe to reuse. This is how the built-in `GetColorZonesCommand`, `GetExtendedColorZonesCommand`, and `Get64Command` work.

```javascript
function CustomMultiResponseCommand(expectedResponses) {
  return {
    type: 1234,
    createDecoder() {
      // Fresh state for each send()
      const responses = [];
      return (bytes, offsetRef, continuation, responseType) => {
        responses.push({
          responseType,
          value: bytes[offsetRef.current++],
        });
        // Keep the exchange open until every packet has arrived
        continuation.expectMore = responses.length < expectedResponses;
        return responses;
      };
    },
  };
}

const responses = await client.send(CustomMultiResponseCommand(2), device);
console.log(responses.length); // 2
```

### Low-Level Protocol Access

The `lifxlan/encoding` subpath exposes the wire format directly: `encode` builds a full protocol message, `decodeHeader`/`getPayload` and the `getHeader*` accessors take frames apart, and every payload has an `encode*`/`decode*` function (`encodeSetColor`, `decodeStateService`, …). Use it to drive a socket without Router/Client, or to build custom commands from the same primitives the built-in ones use:

```javascript
import { Type, NO_TARGET } from 'lifxlan';
import { encode, decodeHeader, getPayload, decodeStateService } from 'lifxlan/encoding';

// Hand-roll a broadcast GetService and parse the reply yourself
// encode(tagged, source, target, resRequired, ackRequired, sequence, type, payload?)
const message = encode(true, 2, NO_TARGET, true, false, 0, Type.GetService);
socket.send(message, 56700, '255.255.255.255');

socket.on('message', (bytes) => {
  const header = decodeHeader(bytes);
  if (header.type === Type.StateService) {
    const payload = getPayload(bytes);
    console.log(decodeStateService(payload, { current: 0 }));
  }
});
```

The high-level API never requires importing it — `client.send()` already encodes and decodes for you.

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

## Troubleshooting

### Discovery finds no devices

- **Broadcast isn't enabled on the socket.** With Node's `dgram`, call `socket.setBroadcast(true)` *after* the socket is listening (calling it earlier throws). Without it, the `GetServiceCommand` broadcast to `255.255.255.255:56700` never leaves the machine.
- **Discovery packets got lost.** UDP broadcasts are best-effort; a single `client.broadcast(GetServiceCommand())` can simply vanish. Broadcast on an interval (the Quick Start uses 1 second) until you've found what you're looking for.
- **The devices are on a different subnet or VLAN.** The limited broadcast address `255.255.255.255` does not cross routers. Run on the same subnet as the lights, or skip discovery entirely and register devices by IP with `Device({ serialNumber, address })` (see [Use Without Device Discovery](#use-without-device-discovery)).
- **A firewall is dropping the replies.** Devices reply unicast from port 56700 to your socket's ephemeral port; host firewalls that block unsolicited-looking inbound UDP will eat them.
- **Replies arrive but nothing registers.** Registration is your code: the `'message'` handler must call `router.receive()` and pass the result to `devices.register(...)` as in the examples. Verify packets are arriving with `Router({ onMessage })` or a packet capture.
- **Deno needs permissions.** `Deno.listenDatagram` requires `--allow-net --unstable-net`.

### `client.send()` rejects with `TimeoutError`

- **A packet was lost.** UDP is lossy even on a healthy network — wrap sends in a retry loop with backoff (see [Error Handling with Retries](#error-handling-with-retries)).
- **The device's IP changed** (DHCP lease, power cycle). Keep periodic discovery running; `devices.register()` updates the address of a known device in place, and `onChanged` fires when it does.
- **The network is slow.** Raise the timeout per call (`{ timeoutMs: 10000 }`) or per client (`Client({ router, defaultTimeoutMs })`).

### `send()` rejects with `UnhandledCommandError`

The device received the command but doesn't support it — multizone, tile, HEV, infrared, relay, and button commands are all product-specific. Check capabilities first with [`lifxlan/products`](#product-capabilities).

### Decoded values turn into garbage later

Decoded results are views into the datagram's receive buffer rather than copies (see [Buffer Ownership](#buffer-ownership)). The built-in sockets in Node.js, Bun, and Deno allocate a fresh buffer for every datagram, so they are unaffected. But if your socket layer reads each datagram into one reusable buffer, the next datagram overwrites the memory your earlier results still point to, and values you already decoded silently change. Either pass a copy to `router.receive()` (e.g. `router.receive(message.slice())`) or copy any decoded bytes you want to keep.

### `SourceExhaustionError` / `SequenceExhaustionError`

Creating clients in a loop without `client.dispose()` eventually exhausts the router's source ids. Sequence exhaustion means one client has 255 sends genuinely in flight to a single device — await or abort some of them.

## Versioning and Stability

This package is pre-1.0, so any 0.0.x release may still include breaking changes. From version 1.0 onward it follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html), with the semver surface being exactly:

- every export of the package root (`lifxlan`),
- every export of `lifxlan/encoding`,
- every export of `lifxlan/products`,
- every export of `lifxlan/discovery`,
- documented runtime behavior: zero-copy buffer ownership, timeout/abort semantics, and `send()`'s never-throws-synchronously guarantee.

Anything not reachable from those entry points — internal helpers, file layout under `dist/`, undocumented behavior — may change in any release. Specifically:

- **Breaking changes** to the surface above only happen in a major version, are documented in the [release notes](https://github.com/jmmoser/lifxlan/releases), and where practical the old API is marked `@deprecated` for at least one minor version first.
- **Supported runtimes** (Node.js ≥ 22, Bun, Deno 2 — all exercised in CI) are part of the contract; dropping one is a breaking change.
- **Prereleases** are published under the `rc` npm dist-tag, so plain `npm install lifxlan` always resolves to the latest stable release.

## Contributing

This library follows a modular architecture with clear separation between protocol, transport, and application layers. See the source code for implementation details.

## License

MIT © Justin Moser