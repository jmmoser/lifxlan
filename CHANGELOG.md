# Changelog

All notable changes to this project are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased] — 1.0.0

### Added

- Button messages for LIFX Switch devices: `GetButtonCommand`,
  `SetButtonCommand`, the `ButtonGesture`/`ButtonTargetType` enums, and the
  underlying `encodeSetButton`/`decodeStateButton` codecs, per the official
  [public-protocol](https://github.com/LIFX/public-protocol) definition.
- `lifxlan/products` subpath export: resolves vendor/product ids (and
  optionally a host firmware version) to product capabilities — multizone,
  extended multizone, matrix, relays, buttons, HEV, infrared, temperature
  range — from the official
  [products.json](https://github.com/LIFX/products) registry. Bring your own
  data; the core remains fetch-free.
- `SequenceExhaustionError`, rejected when all 255 per-device sequence
  numbers are tied up by in-flight requests.
- Source maps (with embedded TypeScript sources) and declaration maps are
  published; stack traces from the minified output resolve to the original
  source.
- CI on GitHub Actions: lint, typecheck, and the full test suite on Bun,
  plus build-and-import smoke tests on Node 18/20/22/24 and Deno 2; releases
  publish to npm with provenance.
- `engines`, `homepage`, and `bugs` package metadata.

### Changed

- `client.send()` never throws synchronously: disposed clients, pre-aborted
  signals, missing decoders, sequence exhaustion, and synchronously throwing
  transports all reject the returned promise instead. `broadcast()` and
  `unicast()` still throw, as they return no promise.
- Sequence numbers are allocated from free slots: a `send()` skips sequences
  held by still-pending requests instead of colliding with them on
  wrap-around (previously `MessageConflictError`).
- A `response`/`both`-mode `send()` of a command without `decode`/
  `createDecoder` rejects immediately with `ValidationError` instead of
  timing out.
- Every payload decoder now validates input length and throws
  `ValidationError` on truncated packets, instead of silently producing
  garbage values for some message types.

### Removed

- `MessageConflictError` — made unreachable by free-slot sequence
  allocation; superseded by `SequenceExhaustionError`.

## [0.0.84] - 2026-06-09

Pre-1.0 development. Highlights from the 0.0.x line:

- Router/Client/Devices/Groups architecture with bring-your-own-socket
  transport, working across Node.js, Bun, and Deno (#14, #17).
- Typed response modes: `send()`'s return type follows the effective
  response mode (`response`, `ack-only`, `both`) (#9).
- Reusable command objects; multi-packet commands (`GetColorZones`,
  `GetExtendedColorZones`, `Get64`) accumulate state per send via
  `createDecoder` (#17).
- Timeout semantics: default timeout always arms, `timeoutMs: 0` disables,
  `AbortSignal` is additive; pre-aborted signals reject immediately
  (#15, #17).
- Curated export surface as the explicit semver boundary (#17).
- Allocation-conscious decoding: direct little-endian byte access, lazy
  reserved fields, BigInt-free timestamps, table-driven hex (#3, #5, #6,
  #11, #12).
- Minified published output (#6); root package export (#7); `sendMany`
  batching pattern documented (#16).
