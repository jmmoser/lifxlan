# Changelog

Notable changes to the public API. The package is at a 1.0 release candidate,
so breaking changes still land between candidates; each one is listed here so
upgrading is a matter of reading this file.

## Unreleased

### Breaking

- `GetColorZones(startIndex, endIndex, onResponse?)` is now
  `GetColorZones({ startIndex, endIndex, onResponse? })`, and
  `GetExtendedColorZones(onResponse?)` is now
  `GetExtendedColorZones({ onResponse? })`. The option types are exported as
  `GetColorZonesOptions` and `GetExtendedColorZonesOptions`.
- `Device()` requires a `serialNumber` or a `target` alongside `address`. An
  address-only device could send but never match a reply, so every `send()` to
  it timed out; it is now a `ValidationError` at construction (and a type
  error).
- `StateLocation.location` is a 32-hex-digit string, matching
  `StateGroup.group`, instead of a 16-byte `Uint8Array`. `SetLocation()` still
  accepts either form.
- `client.sendUnacknowledged()` shares the device's sequence space with
  `send()` and skips sequence numbers held by in-flight exchanges. It throws
  `SequenceExhaustionError` when all 255 are in flight, where it previously
  could not fail.
- `devices.remove()` rejects any pending `devices.get()` for that serial with
  the new `DeviceRemovedError`. Before, such a lookup was left to its timeout
  or signal, and one with neither hung forever.
- `router.receive()` no longer throws when a registered handler or the
  `onMessage` tap throws; the error goes to `onError` instead, and is
  discarded when no `onError` is given. Before, such a throw was an uncaught
  exception from the `lifxlan/node` socket and ended the `lifxlan/deno` read
  loop, so nothing more was received. Code that wrapped `receive()` in
  try/catch to observe these errors must pass `onError` now; `openLan()` on
  both runtimes accepts and forwards a new `onError` option.
- `Device({ serialNumber, target })` throws `ValidationError` when both are
  given and the serial is not valid hex or names a different device than the
  target. Such a device sent to one device while correlating replies under
  another serial, so every `send()` timed out.
- `router.register(handler, source)` rejects a non-integer `source` with a
  `ValidationError`.

### Added

- `Command.responseType`: the State packet type a command's reply arrives in.
  `send()` ignores a reply of any other type instead of handing it to `decode`,
  so a late packet on a reused sequence number cannot resolve an exchange with
  the wrong data. Every built-in command that decodes a reply declares it
  (except `GetColorZones`, whose decoder tells its two reply types apart). A
  `StateUnhandled` naming a request type other than the command's own is
  ignored the same way.
- `Get64` and `Set64` default `width` to 8, the row width of every current
  LIFX tile device.
- The decoded-message types (`Header`, `LightState`, `StateHostFirmware`,
  `StateWifiInfo`, `StateWifiFirmware`, `StateMultiZoneEffect`,
  `StateTileEffect`, `DeviceChainDevice`) are plain interfaces, so tests and
  mocks can satisfy them with object literals.

### Fixed

- An `'ack-only'` exchange no longer decodes the State packet a device sends
  anyway (Get messages are always answered), so a failing decoder or a
  throwing `onResponse` callback can no longer reject a call that only asked
  for the acknowledgement.
- `devices.register()` copies a new device's `target` out of the received
  datagram instead of keeping a view into it, so a socket layer that reuses
  its receive buffer can no longer silently re-address a registered device.
- `GetColorZones` throws `ValidationError` for a `startIndex` or `endIndex`
  outside the uint8 wire range. Before, `endIndex: 256` encoded as 0 while the
  decoder waited on zones the device was never asked for, so the call timed
  out.
- `SetLocation()`/`SetGroup()` throw `ValidationError` for a byte id that is
  not 16 bytes (a shorter one was zero-padded; a longer one left its extra
  bytes in the label field past the terminator, or threw a bare `RangeError`
  past 56 bytes), for an invalid `updatedAt` (previously a bare
  `RangeError`), and for one outside the wire
  field's 1970–2554 range, which silently wrapped to an unrelated timestamp.
  `SetMultiZoneEffect()`/`SetTileEffect()` likewise reject a `duration`
  outside the uint64 range instead of wrapping it (`-1n` encoded as an effect
  that never ends). `EchoRequest()` throws `ValidationError` for more than 64
  bytes instead of a `RangeError`.
- The uint32 time fields — every `duration`, the waveform `period`, effect
  `speed`, and the HEV `durationSeconds` — throw `ValidationError` for a
  negative or out-of-range value instead of wrapping it (`-1` encoded as
  0xFFFFFFFF: a ~49.7 day transition, or a ~136 year HEV cycle).
- Timeouts and discovery intervals above 2^31 - 1 ms (about 24.8 days),
  `Infinity` included, are clamped to that. Node and Bun run a larger
  `setTimeout` delay after ~1ms instead, so `timeoutMs: Infinity` on `send()`
  or `devices.get()` rejected with `TimeoutError` at once, a large discovery
  `timeoutMs` ended discovery at once, and a large `intervalMs` (or a
  `maxIntervalMs` the backoff eventually reached) rebroadcast `GetService` to
  the whole LAN about once a millisecond until disposed. `discover()` now
  throws `ValidationError` for a `NaN` `intervalMs` or `maxIntervalMs` (or an
  untyped value such as `'1s'` that coerces to one), which flooded the same
  way.
- `openLan()` (`lifxlan/node`) closes its socket when `bind()` throws
  synchronously (e.g. a non-string `address` from an untyped caller), not
  only when binding fails asynchronously. `discover()` leaves no registry
  subscription behind when the router's `register()` throws; before, that
  subscription queued every later registration with nothing to drain it.
  `discover()` also arms no broadcast timer when its initial broadcast ends
  discovery (e.g. `onSend` aborting the signal); that timer was never
  cleared and held the process open for up to a full interval.
- A `NaN` or negative timeout — `defaultTimeoutMs` on
  `Client()`/`Devices()`/`openLan()`, or `timeoutMs` on `send()`,
  `devices.get()`, or `discover()` — is rejected with `ValidationError` (a
  rejected promise from `send()`/`get()`). Before, it failed the `> 0` arming
  check exactly like the documented `0` and silently disabled the timeout, so
  e.g. `Number()` of an unset environment variable, or a spent
  `deadline - Date.now()` budget, left every lost packet pending forever.
- `Get64` throws `ValidationError` for a `tileIndex` outside 0–255 or a
  `tileCount` outside 1–255 or not an integer. These fields are uint8 on the
  wire, and the decoder compared replies against the unwrapped values: a
  wrapped value (`tileCount: 256` encodes as 0) asked for tiles the decoder
  never accepted, and a fractional count (`1.5` sends 1) left it waiting for
  a fraction of a tile, so the call always timed out. It also rejects a range
  with `tileIndex + tileCount` past 256, which names tiles that cannot exist.
- `devices.get()` rejects with `ValidationError` for a serial that is not 12
  hex digits (e.g. the MAC-style `d0:73:d5:12:34:56`). Registry keys are
  derived from the wire, so such a lookup could never match and waited out
  its timeout, or forever with `timeoutMs: 0`. The all-zero serial (the
  broadcast address, which `register()` never registers) is rejected the
  same way, and `client.send()` rejects a device whose target is all zeros:
  its reply carries the device's real serial, so it could only time out.
  `sendUnacknowledged()` to such a device still works.
- `Device()` rejects a `NaN` or fractional `port`, which slipped past the
  range check.
- `devices.register()` registers only from message types devices send (State
  replies, `Acknowledgement`, `EchoResponse`) and ignores everything else. A
  socket bound to 56700 also receives other controllers' requests, including
  targeted ones broadcast to reach a device by serial; their target names the
  device but their sender is the controller, so registering from them
  re-addressed the device to the other controller and every later `send()`
  timed out. A message type missing from `Type` is ignored too, so a reply
  of an unlisted type no longer registers or moves a device.
  `RegistrationMessage.header` gains an optional `type` for this; a custom
  pipeline that omits it keeps the previous behavior.
- `devices.register()` ignores a datagram from an invalid source port (UDP
  allows port 0, and anyone on the LAN can send one) instead of throwing.
  The throw came out of the socket's receive path: an uncaught exception that
  crashed a `lifxlan/node` process, and the end of all reception for
  `lifxlan/deno`. Such a datagram from a known device also no longer
  re-addresses it to an unusable port.
- A truncated `StateUnhandled` packet, which anyone on the LAN can send, no
  longer throws out of `router.receive()` inside the socket's receive path; it
  rejects the exchange it targets instead.
- `GetColorZones` completes once every zone the device actually has in the
  requested range has been reported, so the LIFX-documented `0..255` request
  for all zones no longer waits for its timeout.
- `devices.register()` ignores messages whose target is all zeros (other
  controllers' `GetService` broadcasts) instead of registering a phantom device
  with serial `000000000000`.
- Serial numbers are case-insensitive. `Device()` stores the serial in
  lowercase, and `devices.get()` and `devices.remove()` accept either case.
  Before, a serial written in uppercase (as printed on labels and in the LIFX
  app) never matched the lowercase serial derived from replies, so every
  `send()` to that device timed out and `devices.get()` never resolved.
- `Get64` counts distinct tiles in the requested range instead of packets, so
  a duplicated `State64`, or a stray one for another tile, no longer finishes
  the exchange before every requested tile has replied. Such packets are left
  out of the result and do not reach `onResponse`.

## 1.0.0-rc.1

First release candidate. ESM-only package with `lifxlan/node`, `lifxlan/deno`,
`lifxlan/discovery`, `lifxlan/products`, and `lifxlan/encoding` subpath
exports.
