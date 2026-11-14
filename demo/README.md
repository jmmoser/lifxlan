# Browser demo

The library running in a web page, driving four simulated LIFX devices over a simulated network.

A browser cannot open UDP sockets, so the demo supplies the two things the library does not: a network and devices to put on it. Everything else is the library as published — `Router`, `Devices`, `Client`, `discover()`, the command factories, the decoders, `Products` — wired to that network the same way `lifxlan/node` wires them to `node:dgram`.

```bash
bun install
bun run demo            # writes demo/dist/index.html
open demo/dist/index.html
```

The output is one self-contained HTML file (about 160 kB, no server needed). `demo/dist/embed.html` is the same page without the `<html>`/`<head>`/`<body>` shell, for hosts that supply their own document.

## What it shows

- **The room.** Two bulbs, a 32-zone strip, and a chain of five 8×8 tiles, drawn from each simulated device's own state. Dots travelling between the laptop and a device are datagrams in flight.
- **Controls.** Scenes, color sliders, waveforms, zone gradients, the multizone MOVE effect, tile effects, pixel patterns, and painting zones or pixels directly in the room. Each one is a library call.
- **Wire log.** Every call the page made, with its source text and outcome, interleaved with every datagram that crossed the network.
- **Packet inspector.** Any datagram, byte by byte, with each field labelled, next to what the library's decoders return for the same bytes.
- **Raw packet lab.** Type a datagram in hex and send it without the library. The worked example from the LIFX protocol documentation turns every light green.
- **Network conditions.** Latency and packet loss sliders. Loss turns into `TimeoutError`; an unsupported message turns into `UnhandledCommandError`.

## How it is put together

| Path | What it is |
| --- | --- |
| `src/sim/lan.ts` | An in-memory UDP network: sockets bound to an address and port, broadcast, per-datagram delay and loss. |
| `src/sim/firmware.ts` | The device side of the protocol: parses requests, keeps state (fades, waveforms, zone and tile effects), answers with State and Acknowledgement messages. |
| `src/sim/fleet.ts` | The four devices, and the excerpt of products.json that describes them. |
| `src/protocol/layouts.ts` | Byte layouts of each message, written independently of the library. The simulated devices parse and build payloads with them, and the inspector uses them to label bytes. |
| `src/app/session.ts` | The controller: the page's use of the library. Every action ends in a call here. |
| `src/app/*.ts` | The page itself: the canvas, the controls, the wire log, the inspector, the lab. |
| `page.html` | Markup and styles. `build.ts` inlines the bundle into it. |

The simulated devices take only `decodeHeader` and `encode` from `lifxlan/encoding`. Request payloads are parsed, and State payloads built, from the demo's own layout tables — so a request the library encodes only has an effect, and a reply only decodes, when the two agree on the wire format. `tests/demo-sim.test.ts` runs the real client against the simulator for every message the demo uses.

## Checks

```bash
bunx tsc -p demo                    # typecheck (needs the DOM lib, so it has its own tsconfig)
bun test tests/demo-sim.test.ts     # the simulator against the real library
```
