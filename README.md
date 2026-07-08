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
- 🔗 **Read and assign device groups** (see the [Device Groups](#device-groups) recipe for batch operations)
- ⚡ **High performance** - optimized for speed
- 🚀 **Zero dependencies** - batteries-included socket setup for Node.js, Bun, and Deno — or bring your own UDP socket if you want
- 🎛️ **Direct packet control** - each client operation sends exactly one packet with no hidden behavior

Runnable scripts for every runtime live in [`examples/`](examples/).

## Quick Start

### Installation

```bash
npm install lifxlan
```

### Turn a light on

```javascript
import { SetPower } from 'lifxlan';
import { openLan } from 'lifxlan/node';
import { discover } from 'lifxlan/discovery';

// Bind a UDP socket and get a router, device registry, and client wired to it
const { client, devices, router, close } = await openLan();

// Discover devices in the background (broadcasts GetService on a backoff)
using discovery = discover(router, devices);

// Wait for a specific device (replace with your device's serial number)
const device = await devices.get('d07123456789');

// Turn the light on!
await client.send(SetPower(true), device);

await close();
```

[`openLan()`](#the-openlan-helper) is the shortcut: one call binds a UDP socket and returns the library's three building blocks connected to it (`lifxlan/node` on Node.js/Bun, `lifxlan/deno` on Deno — same call, same shape). It adds no abstraction of its own — the whole helper is [a screenful of the same public API](#the-openlan-helper) you can just as well write yourself, which is how the library runs over a custom transport (see [Examples by Runtime](#examples-by-runtime)). Everything below the socket is identical either way.

### Discover and control all devices

```javascript
import { SetPower } from 'lifxlan';
import { openLan } from 'lifxlan/node';
import { discover } from 'lifxlan/discovery';

const { client, devices, router, close } = await openLan();

// Discover for a few seconds, turning each light on as it's found
for await (const device of discover(router, devices, { timeoutMs: 3000 })) {
  await client.send(SetPower(true), device);
}

await close();
```

### Change light color

```javascript
import { SetColor } from 'lifxlan';

// Set to bright red
await client.send(
  SetColor(0, 65535, 65535, 3500, 0), // hue, saturation, brightness, kelvin, duration
  device
);

// Set to blue with 2-second transition
await client.send(
  SetColor(43690, 65535, 65535, 3500, 2000),
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

The core library doesn't include a UDP socket implementation - you provide it. This makes it work across different server-side JavaScript runtimes:

- **Node.js**: Use `dgram.createSocket('udp4')`
- **Bun**: Use `Bun.udpSocket()` (or `node:dgram`, which Bun also implements)
- **Deno**: Use `Deno.listenDatagram()`

The optional [`lifxlan/node`](#the-openlan-helper) (Node.js/Bun) and [`lifxlan/deno`](#the-openlan-helper) (Deno) subpaths package that wiring behind one call — `openLan()` — so providing your own socket is a choice (custom transports, per-device sockets, batching), not a prerequisite.

### Buffer Ownership

For performance, decoding is zero-copy: the buffer you pass to `router.receive()` is consumed, not copied. Decoded values — `header.target`, `payload`, and the results resolved by `client.send()` — are views into that buffer. Node's `dgram`, Bun's `udpSocket`, and Deno's `listenDatagram` all allocate a fresh buffer per datagram, so the examples in this README are safe as-is. If your socket layer reuses a receive buffer, pass a copy to `router.receive()` (e.g. `message.slice()`), and copy any decoded bytes you intend to keep long-term.

### Response Mode Control

The `client.send()` method supports flexible response modes with **full type safety** - the return type changes based on the response mode you choose:

```javascript
// Use command defaults (recommended)
const color = await client.send(GetColor(), device);     // Promise<LightState>
await client.send(SetPower(true), device);              // Promise<void> (Set commands default to ack-only)

// Override response behavior with type-safe returns
await client.send(command, device, { responseMode: 'ack-only' });  // Promise<void>
const data = await client.send(command, device, { responseMode: 'response' }); // Promise<T>
const result = await client.send(command, device, { responseMode: 'both' });   // Promise<T>

// With abort signal
const response = await client.send(GetColor(), device, { 
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

Each runtime has a different socket API, but the `Router`, `Devices`, and `Client` abstractions stay the same. These examples show the manual wiring — the library's actual surface; [`openLan()`](#the-openlan-helper) is nothing more than this wiring, packaged per runtime. They broadcast `GetService` directly; in your own code you can pass `router` and `devices` to [`discover()`](#discovery-helper) once the socket is listening rather than managing the broadcast loop by hand.

### Node.js / Bun

```javascript
import dgram from 'node:dgram';
import { Client, Router, Devices, GetService } from 'lifxlan';

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
  // Decode each message and register the device it came from.
  // router.receive() returns undefined for malformed packets, and
  // devices.register() registers nothing when handed undefined.
  devices.register(remote.port, remote.address, router.receive(message));
});

// Client handles communication with devices
const client = Client({ router });

socket.once('listening', () => {
  socket.setBroadcast(true);
  // Discover devices on the network
  client.broadcast(GetService());
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
import { Client, Router, Devices, GetService } from 'lifxlan';

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

client.broadcast(GetService());

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

`openLan()` from [`lifxlan/deno`](#the-openlan-helper) packages this wiring; here is the manual equivalent:

```javascript
import { Client, Router, Devices, GetService } from 'lifxlan';

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

client.broadcast(GetService());

setTimeout(() => {
  socket.close();
}, 1000);

for await (const [message, remote] of socket) {
  devices.register(remote.port, remote.hostname, router.receive(message));
}
```

## Common Patterns

### The `openLan()` Helper

The optional `lifxlan/node` (Node.js/Bun) and `lifxlan/deno` (Deno) subpaths remove the socket boilerplate. Each exports the same `openLan()`: it creates the runtime's UDP socket (`node:dgram` or `Deno.listenDatagram`), wires it up — `Router` sends through it, inbound datagrams flow through `router.receive()` into `devices.register()` — binds it (an ephemeral port by default), and resolves to the same three building blocks. On Deno it needs `--allow-net --unstable-net`, exactly like the manual wiring it replaces.

```javascript
import { openLan } from 'lifxlan/node';

const lan = await openLan({
  onAdded(device) {
    console.log('registered', device.serialNumber);
  },
});

// lan.router, lan.devices, lan.client — the same three building blocks
// every other section of this README uses.

await lan.close();
```

**Which should you use — the helper or the core?** When one plain UDP socket is all you need (which is almost everyone, almost always): `openLan()`. Wire the socket yourself the moment you want the seam — [batching](#batching-sends-with-sendmany), [throttling](#rate-limits), [split sockets](#separate-sockets-for-broadcastunicast), Bun's [native socket API](#bun-native-socket), or any custom transport. There is no third consideration, and no migration cost in either direction: both paths hand you the same `Router`, `Devices`, and `Client`, so nothing you build or learn is specific to one of them.

That works because `openLan()` is not a layer over the library — it *is* the library, applied. Aside from option forwarding and `close()` bookkeeping, this is the whole helper, written in the same public API you'd otherwise write yourself:

```javascript
import dgram from 'node:dgram';
import { Client, Devices, Router } from 'lifxlan';

const socket = dgram.createSocket('udp4');

const router = Router({
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

const devices = Devices();

socket.on('message', (message, remote) => {
  devices.register(remote.port, remote.address, router.receive(message));
});

await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.once('listening', resolve);
  socket.bind();
});
socket.setBroadcast(true);

const client = Client({ router });
```

Outgrow the helper and that block is the exit: paste it, delete the import, keep everything else — if you destructured (`const { client, devices, router } = await openLan()`), even the variable names line up. (The Deno flavor is the same dozen lines over `Deno.listenDatagram` — shown in [Examples by Runtime](#deno).)

Everything `openLan()` returns is the ordinary public API, so every recipe in this README composes with it unchanged: pass the router and registry to [`discover()`](#discovery-helper), create extra clients with `Client({ router })`, iterate the registry, tap traffic with the `onMessage` option. Nothing on the returned object relies on `this`, so destructuring is always safe (including `close`) — that's how the Quick Start writes it; keep the object form when you want `await using` or the `socket` escape hatch. The options:

- `port` / `address` — the local bind; the default (ephemeral port, all interfaces) is right for almost everyone, since devices reply to whatever port the request came from.
- `defaultTimeoutMs` — forwarded to the [`Client`](#timeouts-and-cancellation).
- `onAdded` / `onChanged` / `onRemoved` — forwarded to the [`Devices`](#discovery-helper) registry.
- `onMessage` — the router-level [message tap](#message-callbacks).
- `onSocketError` — observes asynchronous send failures and socket errors after setup. When omitted they're discarded, matching the library's UDP-is-best-effort semantics: a lost packet already surfaces as `TimeoutError` on acknowledged sends. (Setup failures — a bind error, missing Deno permissions — instead reject the `openLan()` promise.)

The raw socket is exposed as `lan.socket` for anything the options don't cover (multicast, TTL, the bound port via `lan.socket.address()` on Node/Bun or `lan.socket.addr` on Deno). `lan.close()` disposes the client — pending sends reject with `DisposedClientError` rather than dangling until their timeouts — and closes the socket; it's idempotent, and `Symbol.asyncDispose` means `await using lan = await openLan()` closes at end of scope (same TypeScript ≥ 5.2 requirement as `using`). It returns a promise because socket teardown is genuinely asynchronous — it settles once the OS has released the socket (Node) or the background read loop has fully stopped (Deno). Teardown *starts* synchronously, so awaiting is optional: await when you need the port free again or a hard guarantee that no more callbacks will fire. The zero-copy [buffer ownership](#buffer-ownership) caveat never applies here, because both runtimes allocate a fresh buffer per datagram.

Bun runs the `lifxlan/node` module through its `node:dgram` implementation, so the helper works there unchanged.

### Discovery Helper

The optional `lifxlan/discovery` subpath packages the repeat-broadcast loop from the Quick Start. `discover()` broadcasts `GetService` immediately and then on a widening backoff — starting at `intervalMs` (default 1s), quadrupling per broadcast, and settling at `maxIntervalMs` (default 1 minute), so with the defaults broadcasts go out immediately, then after 1s, 4s, 16s, and every minute from there — yielding devices as your handler registers them: known devices first, then new arrivals. The burst defeats UDP loss when it matters most; the capped heartbeat keeps a long-lived stream from broadcasting to every device on the network once a second. Set `maxIntervalMs` equal to `intervalMs` for a fixed interval. End to end:

```javascript
import { openLan } from 'lifxlan/node';
import { discover } from 'lifxlan/discovery';

const { devices, router, close } = await openLan(); // or wire the socket yourself — discover() only needs a router and a registry

for await (const device of discover(router, devices, { timeoutMs: 3000 })) {
  console.log('found', device.serialNumber, device.address);
}

await close();
```

`discover()` owns its broadcast timer and a client, releasing both when iteration ends — which is never an error. A `timeoutMs` budget or aborted `signal` ends it after draining already-queued devices; `break` or `dispose()` end it at once and discard the rest. Either way the timer is cleared, so the loop can't leak it. (Contrast `devices.get()`, where abort *rejects* — there it means the lookup failed; here it just means "stop collecting".)

The iterator is `Disposable`, so `using` stops discovery at end of scope:

```javascript
using discovery = discover(router, devices);
const device = await devices.get('d07123456789');
```

The same shape grabs the *first* device found — no loop, no serial number — by calling the iterator directly:

```javascript
using discovery = discover(router, devices, { timeoutMs: 3000 });
const { value: device } = await discovery.next();
if (!device) throw new Error('no devices found within 3s');
```

The `undefined` check is only needed because of the `timeoutMs` budget (or a `signal`): the stream only ever yields real devices, so iteration ending before yielding anything is the one way `value` comes back `undefined`. Without a budget, the promise simply stays pending until the first device registers.

Writing `using` needs TypeScript ≥ 5.2 with `Disposable` in scope (a `lib` that includes `esnext.disposable`, or `@types/node`, which Node ≥ 22 projects already have); otherwise call `dispose()` directly. With no `timeoutMs` it runs until disposed, broadcasting at the backed-off `maxIntervalMs` cadence and keeping the registry fresh as DHCP addresses change. Internally it uses the public `devices.subscribe({ onAdded, onChanged, onRemoved })`, which observes registry events and returns an unsubscribe function.

### Manually Controlling Discovery

`discover()` is purely a convenience: it owns a timer and a `Client` and broadcasts `GetService` for you. When you want full control over *when* and *how often* discovery runs — folding it into an existing timer, applying custom backoff, or broadcasting only on demand — drive it yourself with `client.broadcast(GetService())`. The only fixed part is registration: however you broadcast, your socket handler feeds `router.receive()` into `devices.register()`, exactly as in the examples above.

```javascript
import { Client, GetService } from 'lifxlan';

// ... router, devices, and socket setup as above ...

const client = Client({ router });

// Broadcast GetService yourself, on whatever schedule you like.
client.broadcast(GetService());
const scan = setInterval(() => client.broadcast(GetService()), 1000);

// Wait for one specific device...
const device = await devices.get('d07123456789');
clearInterval(scan);

// ...or scan for a fixed window, then act on everything discovered:
//   await new Promise((resolve) => setTimeout(resolve, 3000));
//   clearInterval(scan);
//   for (const device of devices) { /* ... */ }
```

A single broadcast can be lost (UDP is best-effort), so repeat on an interval until you've found what you're looking for. `devices.get()` resolves as soon as a matching device registers; for "all devices", broadcast for a few seconds, then iterate the `devices` registry. Because `devices.register()` updates a known device's address in place, leaving a slow interval running also tracks devices whose IP changes (DHCP) — the same reason `discover()` keeps broadcasting until disposed.

### Error Handling with Retries

```javascript
for (let i = 0; i < 3; i++) {
  try {
    console.log(await client.send(GetColor(), device));
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
await client.send(GetColor(), device, { timeoutMs: 100 });
```

An `AbortSignal` can be passed for cancellation. The signal is *additive* to the timeout — it does not replace it — and the promise rejects with the signal's reason:

```javascript
const controller = new AbortController();

const promise = client.send(GetColor(), device, { signal: controller.signal });

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

### Rate Limits

LIFX's guidance is to send **at most 20 messages per second to any single device**. The library deliberately does not throttle — every operation maps to exactly one packet, and pacing policy (drop, queue, coalesce) belongs to your application — so staying under the limit is your code's job:

- For animations, space per-device updates at least 50ms apart; the [Party Mode](#party-mode-animated-colors) example's 100ms cadence stays comfortably inside the limit.
- Exceeding it doesn't produce an error — the protocol has no signal for overrun. LIFX documents the consequence only as "unexpected device or protocol message behavior"; in practice an overdriven device delays or silently discards messages, which surfaces as `TimeoutError` on acknowledged sends and skipped frames on `unicast()`.
- Broadcasts multiply: one `GetService` broadcast elicits a reply from *every* device on the network, so discovery traffic scales with fleet size — this is why `discover()` backs its broadcast interval off to once a minute.
- If you need a real throttle (a token bucket, per-device queues), `Router({ onSend })` is the seam: every outgoing packet passes through it, and the `serialNumber` argument identifies the destination device for per-device pacing. The [`sendMany` batching example](#batching-sends-with-sendmany) uses the same seam for the opposite purpose.

### Use Without Device Discovery

```javascript
import { Device, SetPower } from 'lifxlan';
import { openLan } from 'lifxlan/node';

const { client, close } = await openLan();

// Create the device directly — no discovery round trip needed
const device = Device({
  serialNumber: 'd07123456789',
  address: '192.168.1.50',
});

await client.send(SetPower(true), device);
await close();
```

### Multiple Clients

```javascript
const client1 = Client({ router });
const client2 = Client({ router });

// Both clients share the same router and can operate independently
client1.broadcast(GetService());
await client2.send(SetPower(true), device);
```

### Resource Management for Many Clients

```javascript
while (true) {
  const client = Client({ router });

  console.log(await client.send(GetPower(), device));

  // When creating a lot of clients, call dispose to avoid running out of source values
  client.dispose();
}
```

A client also implements `Symbol.dispose`, so a `using` declaration disposes it at the end of scope (same TypeScript ≥ 5.2 / Node ≥ 22 requirements as `discover()`):

```javascript
{
  using client = Client({ router });
  console.log(await client.send(GetPower(), device));
} // client.dispose() runs here automatically
```

### Response Mode Control Examples

```javascript
// High-reliability mode: wait for both ack and response (typed return)
const state = await client.send(SetColor(120, 100, 100, 3500, 1000), device, { 
  responseMode: 'both'     // returns Promise<LightState>
});
console.log('Confirmed color:', state.hue);

// Fast mode: fire-and-forget for animations (no promise)
for (let i = 0; i < 360; i += 10) {
  client.unicast(SetColor(i * 182, 65535, 65535, 3500, 100), device);
  await new Promise(resolve => setTimeout(resolve, 50));
}

// Confirmation only (void return)
await client.send(SetColor(120, 100, 100, 3500, 0), device, { 
  responseMode: 'ack-only' // returns Promise<void>
});

// Get response data (typed return)
const currentState = await client.send(SetColor(120, 100, 100, 3500, 0), device, { 
  responseMode: 'response' // returns Promise<LightState>
});
console.log('Light is now:', currentState.hue);
```

## Advanced Examples

### Device Groups

Groups are a property stored on each device: a UUID + label assigned by a
`SetGroup` message (the LIFX app does this, and so can this library via
`SetGroup()`) and reported back through `GetGroup()`. The
library deliberately has no group registry or group-send helper — collecting
devices by their reported group is a few lines of your own code, and batch
operations are just a fan-out over the members:

```javascript
import { GetGroup, SetPower } from 'lifxlan';

const byGroup = new Map(); // group uuid -> { label, devices: Map<serial, Device> }

const devices = Devices({
  async onAdded(device) {
    const state = await client.send(GetGroup(), device);
    let group = byGroup.get(state.group);
    if (!group) {
      group = { label: state.label, devices: new Map() };
      byGroup.set(state.group, group);
    }
    group.devices.set(device.serialNumber, device);
  },
});

// Send a command to every device in a group
for (const group of byGroup.values()) {
  await Promise.all(
    Array.from(group.devices.values(), (device) =>
      client.send(SetPower(true), device),
    ),
  );
}
```

One protocol subtlety if you track labels: devices can disagree about a
group's label, because a rename only reaches devices that were powered on at
the time. `StateGroup` carries an `updated_at` timestamp for exactly this —
the label reported with the newest `updated_at` is the current one, so keep
the newest timestamp per UUID and ignore label reports older than it.

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
      SetColor(hue, saturation, brightness, kelvin, 1000), 
      device
    );
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

### Product Capabilities

Not every device supports every command — multizone, extended multizone, HEV, infrared, relays, and buttons are all product-specific. The optional `lifxlan/products` subpath resolves the vendor/product ids from a `GetVersion` (plus, optionally, the firmware version from `GetHostFirmware`) against the official [products.json](https://github.com/LIFX/products) registry:

```javascript
import { PRODUCTS_URL, GetVersion, GetHostFirmware } from 'lifxlan';
import { Products } from 'lifxlan/products';

// Bring your own data: fetch it at runtime or vendor the file.
const products = Products(await (await fetch(PRODUCTS_URL)).json());

const version = await client.send(GetVersion(), device);
const firmware = await client.send(GetHostFirmware(), device);

const features = products.features(version.vendor, version.product, firmware);
if (features?.extended_multizone) {
  // safe to use SetExtendedColorZones
}
```

### LIFX Switch (Relays and Buttons)

```javascript
import { GetRPower, SetRPower, GetButton, SetButton, ButtonGesture, ButtonTargetType } from 'lifxlan';

// Toggle relay 0
const { level } = await client.send(GetRPower(0), device);
await client.send(SetRPower(0, level > 0 ? 0 : 65535), device);

// Read the button configuration
const state = await client.send(GetButton(), device);
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

For commands whose result spans *multiple* response packets, provide `createDecoder` instead of `decode`. It is called once per `send()`, so every exchange gets its own accumulation state and the command object stays safe to reuse. This is how the built-in `GetColorZones`, `GetExtendedColorZones`, and `Get64` work.

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
// Router-level message callback (every decoded inbound message)
const router = Router({
  onMessage(header, payload, serialNumber) {
    console.log('Received:', header.type, 'from', serialNumber);
  },
});
```

To watch a single client's traffic, compare sources inside the tap: `header.source === client.source`.

To turn tapped messages into typed data, switch on `header.type` and call the matching `decode*` function from `lifxlan/encoding` — every device-to-client message has one (`decodeStateService`, `decodeLightState`, `decodeStateGroup`, …), named after its `Type` constant:

```javascript
import { Type } from 'lifxlan';
import { decodeLightState, decodeStateGroup } from 'lifxlan/encoding';

const router = Router({
  onMessage(header, payload, serialNumber) {
    switch (header.type) {
      case Type.LightState: {
        const state = decodeLightState(payload, { current: 0 });
        console.log(serialNumber, 'reports power', state.power);
        break;
      }
      case Type.StateGroup: {
        const group = decodeStateGroup(payload, { current: 0 });
        console.log(serialNumber, 'is in group', group.label);
        break;
      }
    }
  },
});
```

This is the building block for an event-driven state cache: every `State*` response that reaches your socket flows through one tap, whichever client's request produced it, and payloads outside your `switch` are never decoded at all. The same pattern works on `router.receive()`'s return value if you'd rather tap in your socket handler. Multi-packet results (`StateZone`, `StateMultiZone`, `State64`, `StateDeviceChain`) decode as their single-packet shape here — accumulating a full result across packets is what `client.send()` does for you.

One deliberate redundancy to be aware of: a response that settles a `client.send()` promise is decoded twice on this path — once by the command's decoder for the awaiting caller, once by the tap. Sharing a single decode would couple every client to the tap's lifecycle, and at LAN message rates (bounded by the [rate limit](#rate-limits)) a second zero-copy decode of a ≤100-byte payload is noise.

## Troubleshooting

### Discovery finds no devices

- **Broadcast isn't enabled on the socket.** With Node's `dgram`, call `socket.setBroadcast(true)` *after* the socket is listening (calling it earlier throws). Without it, the `GetService` broadcast to `255.255.255.255:56700` never leaves the machine. ([`openLan()`](#the-openlan-helper) handles this for you.)
- **Discovery packets got lost.** UDP broadcasts are best-effort; a single `client.broadcast(GetService())` can simply vanish. Broadcast repeatedly (`discover()` starts at every 1 second, backing off to every minute) until you've found what you're looking for.
- **The devices are on a different subnet or VLAN.** The limited broadcast address `255.255.255.255` does not cross routers. Run on the same subnet as the lights, or skip discovery entirely and register devices by IP with `Device({ serialNumber, address })` (see [Use Without Device Discovery](#use-without-device-discovery)).
- **A firewall is dropping the replies.** Devices reply unicast from port 56700 to your socket's ephemeral port; host firewalls that block unsolicited-looking inbound UDP will eat them.
- **Replies arrive but nothing registers.** With manual socket wiring, registration is your code: the `'message'` handler must call `router.receive()` and pass the result to `devices.register(...)` as in the examples (`openLan()` attaches this handler for you). Verify packets are arriving with `Router({ onMessage })` (the `onMessage` option of `openLan()`) or a packet capture.
- **Deno needs permissions.** `Deno.listenDatagram` — and therefore `openLan()` from `lifxlan/deno` — requires `--allow-net --unstable-net`.

### `client.send()` rejects with `TimeoutError`

- **A packet was lost.** UDP is lossy even on a healthy network — wrap sends in a retry loop with backoff (see [Error Handling with Retries](#error-handling-with-retries)).
- **The device's IP changed** (DHCP lease, power cycle). Keep periodic discovery running; `devices.register()` updates the address of a known device in place, and `onChanged` fires when it does.
- **The network is slow.** Raise the timeout per call (`{ timeoutMs: 10000 }`) or per client (`Client({ router, defaultTimeoutMs })`).
- **You're sending faster than the device can absorb.** Past the recommended 20 messages per second, LIFX promises only "unexpected behavior" — in practice requests get delayed or silently discarded (see [Rate Limits](#rate-limits)), and a discarded request looks identical to a lost packet.

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
- every export of `lifxlan/node`,
- every export of `lifxlan/deno`,
- documented runtime behavior: zero-copy buffer ownership, timeout/abort semantics, and `send()`'s never-throws-synchronously guarantee.

Anything not reachable from those entry points — internal helpers, file layout under `dist/`, undocumented behavior — may change in any release. Specifically:

- **Breaking changes** to the surface above only happen in a major version, are documented in the [release notes](https://github.com/jmmoser/lifxlan/releases), and where practical the old API is marked `@deprecated` for at least one minor version first.
- **Supported runtimes** (Node.js ≥ 22.12, Bun, Deno 2 — all exercised in CI) are part of the contract; dropping one is a breaking change.
- **Module format**: the package is published as ESM only. CommonJS consumers on supported Node versions can still load it with `require('lifxlan')` via Node's [`require(esm)`](https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require) interop, which CI exercises.
- **Prereleases** are published under the `rc` npm dist-tag, so plain `npm install lifxlan` always resolves to the latest stable release.

## Contributing

This library follows a modular architecture with clear separation between protocol, transport, and application layers. See the source code for implementation details.

## License

MIT © Justin Moser