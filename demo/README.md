# Nightwire — the browser demo

A game played with the real library. Shades creep through a house at night toward the router; the only weapons are the lights, and every shot is a LIFX LAN message that `lifxlan` encodes, sends, and waits on.

A browser cannot open UDP sockets, so the demo supplies the two things the library does not: a network and devices to put on it. Everything else is the library as published — `Router`, `Devices`, `Client`, `discover()`, the command factories, the decoders, `Products` — wired to that network the same way `lifxlan/node` wires them to `node:dgram`.

```bash
bun install
bun run demo            # writes demo/dist/index.html
open demo/dist/index.html
```

The output is one self-contained HTML file (about 250 kB, no server needed). `demo/dist/embed.html` is the same page without the `<html>`/`<head>`/`<body>` shell, for hosts that supply their own document.

## How it plays

Shades burn only in light of their own colour. Load a colour (keys `1`–`6`, the scroll wheel, or click a shade to pick up its colour), then click a light: a bulb, a section of the strip, or one tile. Right-click a light (or hover and press Space) for the effect it runs by itself. `R` scans for devices, `B` fires the broadcast once it is charged, `P` pauses. Without a pointer, the left and right arrows step the aim through the lights and Enter fires.

Each of the eight nights is built around one part of the protocol, and the rules are that part's real behaviour:

| Night | What it teaches | How it shows up in play |
| --- | --- | --- |
| 1 First light | `SetColor`, `Acknowledgement` | One click is one packet; the bulb changes when it arrives |
| 2 Discovery | `GetService` broadcast, `StateService`, the registry | A new bulb cannot be used until you scan and the library identifies it |
| 3 One packet, many flashes | `SetWaveform` | A bulb strobes by itself from a single message |
| 4 Thirty-two zones | `SetColorZones`, `SetMultiZoneEffect` | One strip, four clickable sections of eight zones; a timed MOVE effect |
| 5 Lost in the air | Packet loss, `TimeoutError`, retries | Jammers drop packets; shots time out and are sent again |
| 6 Sixty-four pixels | `Set64`, `SetTileEffect` | Five tiles around the router, each coloured by one 558-byte packet |
| 7 Everyone at once | Tagged frames, the broadcast address | One packet strobes every light in the house |
| 8 The Outage | Power loss, address changes, `onChanged` | Lights go dark or move to a new IP until a scan finds them again |

What a light is doing is read from the simulated device's own output, never from what the player asked for. A shade only burns if a packet reached the device and the device acted on it; a shot lost on the network changes nothing.

Beside the house, the **wire log** lists every library call with its source text and outcome, interleaved with every datagram. Pausing and clicking a row opens it in the **packet inspector**, byte by byte, next to what the library's decoders return for the same bytes.

**Sandbox** mode removes the shades and adds manual controls for every device (colour sliders, waveforms, zone gradients, tile effects, pixel painting), latency and loss sliders, and a **raw packet lab** for sending hand-typed hex without the library.

## How it is put together

| Path | What it is |
| --- | --- |
| `src/sim/lan.ts` | An in-memory UDP network: sockets bound to an address and port, broadcast, per-datagram delay and loss. |
| `src/sim/firmware.ts` | The device side of the protocol: parses requests, keeps state (fades, waveforms, zone and tile effects), answers with State and Acknowledgement messages. Can lose power and change address. |
| `src/sim/fleet.ts` | The six devices in the house, and the excerpt of products.json that describes them. |
| `src/protocol/layouts.ts` | Byte layouts of each message, written independently of the library. The simulated devices parse and build payloads with them, and the inspector uses them to label bytes. |
| `src/app/session.ts` | The controller: the page's use of the library. Every action, in the game or the sandbox, ends in a call here. |
| `src/app/*.ts` | The wire log, packet inspector, raw packet lab, and sandbox controls. |
| `src/game/world.ts` | The house: walls, furniture, where each light is, what it can reach, and the routes shades take. |
| `src/game/game.ts` | The rules: shades, damage from the devices' real output, abilities, the boss. |
| `src/game/waves.ts` | The campaign: what attacks each night and what the night teaches. |
| `src/game/render.ts` | Drawing: a light map built each frame from the devices' output, shades, particles, packets in flight. |
| `src/game/audio.ts` | Music and effects, synthesised with Web Audio. |
| `page.html` | Markup and styles. `build.ts` inlines the bundle into it. |

The simulated devices take only `decodeHeader` and `encode` from `lifxlan/encoding`. Request payloads are parsed, and State payloads built, from the demo's own layout tables — so a request the library encodes only has an effect, and a reply only decodes, when the two agree on the wire format.

## Checks

```bash
bunx tsc -p demo                    # typecheck (needs the DOM lib, so it has its own tsconfig)
bun test tests/demo-sim.test.ts     # the simulator against the real library, message by message
bun test tests/demo-game.test.ts    # the game rules, headless, with the real library driving the devices
```

Open the built page with `#debug` on the end of the address to get the game objects on `window.nightwire`.
