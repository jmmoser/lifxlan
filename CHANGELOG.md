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
- `router.receive()` no longer throws when a registered handler or the
  `onMessage` tap throws; the error goes to `onError`. Before, such a throw
  was an uncaught exception from the `lifxlan/node` socket, and it ended the
  `lifxlan/deno` read loop, so nothing more was received.
- `Get64` counts distinct tiles instead of packets, so a duplicated `State64`
  no longer finishes the exchange before every tile has replied. Duplicates
  are left out of the result.

## 1.0.0-rc.1

First release candidate. ESM-only package with `lifxlan/node`, `lifxlan/deno`,
`lifxlan/discovery`, `lifxlan/products`, and `lifxlan/encoding` subpath
exports.
