# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Test**: `bun test --coverage` or `node --test --experimental-test-coverage`
- **Build**: `bun build ./src/index.js --outdir ./dist --minify --entry-naming [dir]/lifxlan.min.[ext]`
- **Type Check**: `tsc` (generates types in `./types` directory)
- **Lint**: `oxlint`

## Project Architecture

This is a JavaScript library for the LIFX LAN protocol that works across Node.js, Bun, and Deno runtimes. The architecture is based on three core abstractions:

### Core Components

- **Router** (`src/router.js`): Message routing system that handles source assignment and message forwarding between clients and the network. Routes response messages back to the originating client using source IDs.

- **Client** (`src/client.js`): High-level interface for device communication. Handles message sending/receiving with timeout and retry logic. Supports both acknowledged and unacknowledged message patterns.

- **Devices** (`src/devices.js`): Device registry that tracks discovered LIFX devices on the network, maintaining their network addresses and connection state.

- **Groups** (`src/groups.js`): Organizes devices into logical groups for batch operations.

### Protocol Layer

- **Commands** (`src/commands.js`): LIFX protocol command definitions with encoding/decoding functions
- **Encoding** (`src/encoding.js`): Low-level protocol message encoding/decoding utilities
- **Constants** (`src/constants.js`): Protocol constants, message types, and network configuration

### Key Patterns

The library uses a "bring your own socket" approach - users provide UDP socket implementations for their runtime. The Router handles message routing using source IDs to correlate requests with responses across multiple concurrent clients.

Device discovery works by broadcasting `GetServiceCommand()` and registering responses via the Devices registry. Each runtime (Node.js/Bun vs Deno) requires different socket setup but uses the same core abstractions.

## TypeScript Support

The project uses JSDoc for type annotations in JavaScript source files. TypeScript declarations are generated automatically via `tsc` into the `./types` directory.

## Check TypeScript type generation

```
npx tsc
```

## Run linter to check code quality

```
bun lint
```