# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup

Run `bun install` before anything else: tests, lint, and typecheck all need it. In Claude Code on the web this happens automatically via the SessionStart hook (`.claude/hooks/session-start.sh`). Bun is the primary toolchain; the test suite runs on `bun:test`.

## Development Commands

- **Test**: `bun run test` (full suite with coverage)
- **Test one file**: `bun test tests/client.test.ts`
- **Type Check**: `npx tsc`
- **Lint**: `bun run lint` (oxlint)
- **Build**: `bun run build` (ESM-only minified bundle into `dist/`; CommonJS consumers rely on Node's require(esm) interop)
- **Docs**: `bun run docs` (typedoc; broken `{@link}` references fail CI)
- **Benchmarks**: `bun run bench`

Do NOT run `bun run test:integration`: it sends UDP traffic to real LIFX devices on the local network and will hang or fail in a sandbox.

## Check code quality

Before committing, this must pass:

```
bun run lint && npx tsc && bun run test
```

CI (`.github/workflows/ci.yml`) additionally builds the typedoc site and runs smoke tests (`scripts/smoke.mjs` for ESM import, `scripts/smoke.cjs` for CommonJS require(esm) interop, `scripts/smoke-node.mjs` and `scripts/smoke-deno.mjs` for the `lifxlan/node` / `lifxlan/deno` helpers over loopback UDP) against the built package on Node 22/24 and Deno.

## Project Architecture

This is a TypeScript library for the LIFX LAN protocol that works across Node.js, Bun, and Deno runtimes. The architecture is based on three core abstractions:

### Core Components

- **Router** (`src/router.ts`): Message routing system that handles source assignment and message forwarding between clients and the network. Routes response messages back to the originating client using source IDs.

- **Client** (`src/client.ts`): High-level interface for device communication. Handles message sending/receiving with timeout handling and response correlation. Tracks a per-device sequence number internally. Supports both acknowledged and unacknowledged message patterns.

- **Devices** (`src/devices.ts`): Device registry that tracks discovered LIFX devices on the network, maintaining their network addresses and connection state.

There is deliberately no group registry: a device's group (UUID + label, set by `SetGroup()`, reported as `StateGroup` via `GetGroup()`) is just a device property, and collecting devices by group is left to callers (see the README's Device Groups recipe).

### Protocol Layer

- **Commands** (`src/commands/`): LIFX protocol command definitions with encoding/decoding functions, split by device capability (`device.ts`, `light.ts`, `multizone.ts`, `tile.ts`, `relay.ts`, `button.ts`, `sensor.ts`)
- **Encoding** (`src/encoding.ts`): Low-level protocol message encoding/decoding utilities
- **Constants** (`src/constants/`): Protocol constants, message types, and network configuration
- **Errors** (`src/errors.ts`): `LifxError` subclasses with a structured `context` object

### Subpath Exports

The package root (`src/index.ts`) contains only passive building blocks. Optional pieces live behind subpath exports so unused code costs nothing:

- `lifxlan/node` (`src/node.ts`): batteries-included socket wiring for Node.js/Bun: `openLan()` binds a `node:dgram` socket and returns a Router + Devices + Client connected to it
- `lifxlan/deno` (`src/deno.ts`): the Deno twin of `lifxlan/node`, over `Deno.listenDatagram`; declares its own minimal structural Deno types so the Node toolchain typechecks it (unit-tested in bun via a mocked `Deno` global, runtime-tested by `scripts/smoke-deno.mjs`)
- `lifxlan/discovery` (`src/discovery.ts`): the one timer-driven helper; it repeats the GetService broadcast on a widening backoff (default 1s, ×4 per broadcast, capped at 1 minute)
- `lifxlan/products` (`src/products.ts`): capability lookup from the official LIFX products.json; takes parsed data, never fetches
- `lifxlan/encoding`: the low-level encoding utilities

### Key Patterns

The library uses a "bring your own socket" approach - users provide UDP socket implementations for their runtime (or use `lifxlan/node`, which does that wiring with `node:dgram` for Node.js/Bun). The Router handles message routing using source IDs to correlate requests with responses across multiple concurrent clients.

Device discovery works by broadcasting `GetService()` and registering responses via the Devices registry. Each runtime (Node.js/Bun vs Deno) requires different socket setup but uses the same core abstractions.

### Where Things Live

- `tests/`: unit tests (`*.test.ts`) plus `helpers.ts`, type-level checks (`send-return-types.ts`), and the device-requiring `integration.ts`
- `examples/`: self-contained runnable scripts (see `examples/README.md`); they import `lifxlan` by self-reference, so `bun run build` first
- `docs/`: hand-written protocol guides (field types, querying, changing device state)
- `scripts/`: build minification and the Node/Deno smoke tests CI runs against `dist/`

## TypeScript Support

The project is written in TypeScript with full type safety. TypeScript declarations and JavaScript files are compiled to the `./dist` directory for publication to npm.

## Rules

- Do not use typescript's `any` or `as`
