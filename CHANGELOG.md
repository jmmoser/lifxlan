# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
from `1.0.0` onward. See the [Versioning and stability](README.md#versioning-and-stability)
section of the README for exactly what the semver contract covers.

## [1.0.0-rc.1] - 2026-06-12

Release candidate for 1.0.0. The API is frozen for the 1.0 cycle; only bug
fixes land between this RC and the final release.

### Changed

- **Breaking:** the low-level wire-format functions (`encode`, `decodeHeader`,
  `getPayload`, the `getHeader*` accessors, and every `encode*`/`decode*`
  payload function) moved from the package root to the new `lifxlan/encoding`
  subpath entry point. The root entry keeps the high-level API (Router,
  Client, Devices, Groups, commands, errors, constants, utilities) and all
  decoded message *types* (`LightState`, `StateGroup`, `Header`, `Color`,
  `OffsetRef`, …).

  Migration:

  ```diff
  -import { Client, encode, decodeHeader } from 'lifxlan';
  +import { Client } from 'lifxlan';
  +import { encode, decodeHeader } from 'lifxlan/encoding';
  ```

### Added

- `lifxlan/encoding` subpath export (ESM + CJS, with types), making the wire
  format usable without pulling it through the high-level surface.
- This changelog.
- A versioning/stability policy, a buffer-ownership guarantee, and a
  troubleshooting guide in the README.
- `bun run docs` generates an API reference for all three entry points via
  TypeDoc.
- Prerelease versions publish to npm under the `rc` dist-tag, so
  `npm install lifxlan` keeps resolving to the latest stable release.

## 0.0.x pre-release series

Versions `0.0.1` through `0.0.84` were rapid-iteration pre-releases and were
not individually tracked. Notable changes, newest first:

- Every payload decoder bounds-checks its input before reading, so truncated
  or malicious datagrams reject cleanly instead of decoding garbage.
  ([#18](https://github.com/jmmoser/lifxlan/pull/18))
- Pre-1.0 API hardening ([#17](https://github.com/jmmoser/lifxlan/pull/17)):
  - Timeouts and cancellation are independent: the default timeout always
    applies (override per call with `timeoutMs`; `0` disables), an
    `AbortSignal` is additive rather than replacing the timeout, and aborts
    reject with `signal.reason`.
  - Multi-response commands (`GetColorZonesCommand`,
    `GetExtendedColorZonesCommand`, `Get64Command`) are safe to reuse across
    concurrent sends via the new per-exchange `createDecoder()` factory.
  - The package root exports a curated, deliberate API surface instead of
    star re-exports; broken `./*` wildcard subpath exports were removed and
    `sideEffects: false` enables tree-shaking.
- Pre-aborted `AbortSignal`s reject immediately instead of hanging forever.
  ([#15](https://github.com/jmmoser/lifxlan/pull/15))
- Router/client redesign: atomic source registration, per-client per-device
  sequence tracking. ([#14](https://github.com/jmmoser/lifxlan/pull/14))
- `client.send()` return type follows the effective response mode
  (`'ack-only'` resolves `void`, other modes resolve the decoded payload).
  ([#9](https://github.com/jmmoser/lifxlan/pull/9))
- Root package export added so bare `import ... from 'lifxlan'` works.
  ([#7](https://github.com/jmmoser/lifxlan/pull/7))
- Decoder performance work: direct little-endian byte access instead of
  `DataView` allocation, BigInt-free timestamps, lazy reserved-field
  decoding, minified published output with composed source maps.
  ([#3](https://github.com/jmmoser/lifxlan/pull/3),
  [#5](https://github.com/jmmoser/lifxlan/pull/5),
  [#6](https://github.com/jmmoser/lifxlan/pull/6),
  [#11](https://github.com/jmmoser/lifxlan/pull/11),
  [#12](https://github.com/jmmoser/lifxlan/pull/12))
- The acknowledgment API was reworked into `responseMode`
  (`'auto' | 'ack-only' | 'response' | 'both'`), with fire-and-forget moved
  to `client.unicast()`.

[1.0.0-rc.1]: https://github.com/jmmoser/lifxlan/releases/tag/v1.0.0-rc.1
