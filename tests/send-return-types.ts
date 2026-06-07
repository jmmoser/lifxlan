/**
 * Type-level regression tests for `client.send()` return types.
 *
 * These assertions are verified by `npx tsc` (tsconfig `include` covers
 * `tests/**`), NOT by `bun test`. The filename intentionally avoids the
 * `*.test.ts` pattern so the runtime runner skips it — there is nothing here
 * to execute, only types to check. A failing assertion is a *compile* error.
 *
 * They guard the contract that the awaited result of send() follows the
 * *effective* response mode: an 'ack-only' exchange resolves with no payload
 * (`void`), every other mode resolves the decoded payload. Without this, an
 * ack-only-default command was mistyped as resolving its decoder's payload
 * even though it resolves `undefined` at runtime.
 */
import type { ClientInstance, DeviceResponse } from '../src/client.js';
import type { Device } from '../src/devices.js';
import type { LightState } from '../src/encoding.js';
import { SetPowerCommand, GetColorCommand } from '../src/commands/index.js';

/** True iff X and Y are the exact same type. */
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

/** Compiles only when the argument type is exactly `true`. */
type Expect<T extends true> = T;

declare const client: ClientInstance;
declare const device: Device;

// --- Command defaults ------------------------------------------------------

// GetColor defaults to 'response' → resolves the decoded LightState.
const getColor = () => client.send(GetColorCommand(), device);
export type _getColorIsLightState = Expect<Equal<Awaited<ReturnType<typeof getColor>>, LightState>>;

// SetPower defaults to 'ack-only' → resolves nothing, matching runtime.
const setPower = () => client.send(SetPowerCommand(true), device);
export type _setPowerIsVoid = Expect<Equal<Awaited<ReturnType<typeof setPower>>, void>>;

// --- Explicit overrides win over the command default -----------------------

// Force a response out of a Set command → the decoded payload (number here).
const setPowerResponse = () => client.send(SetPowerCommand(true), device, { responseMode: 'response' });
export type _setPowerResponseIsNumber = Expect<Equal<Awaited<ReturnType<typeof setPowerResponse>>, number>>;

const setPowerBoth = () => client.send(SetPowerCommand(true), device, { responseMode: 'both' });
export type _setPowerBothIsNumber = Expect<Equal<Awaited<ReturnType<typeof setPowerBoth>>, number>>;

// Downgrade a Get command to ack-only → void.
const getColorAckOnly = () => client.send(GetColorCommand(), device, { responseMode: 'ack-only' });
export type _getColorAckOnlyIsVoid = Expect<Equal<Awaited<ReturnType<typeof getColorAckOnly>>, void>>;

// Explicit 'auto' behaves exactly like omitting options (uses the default).
const setPowerAuto = () => client.send(SetPowerCommand(true), device, { responseMode: 'auto' });
export type _setPowerAutoIsVoid = Expect<Equal<Awaited<ReturnType<typeof setPowerAuto>>, void>>;

// --- Multi-device fan-out: sendEach yields device-tagged outcomes ----------

declare const devices: Iterable<Device>;

// Many devices + a 'response'-default Get → one outcome carrying LightState per device.
const getColorEach = () => client.sendEach(GetColorCommand(), devices);
export type _getColorEachIsDeviceResponseLightState =
  Expect<Equal<Awaited<ReturnType<typeof getColorEach>>, DeviceResponse<LightState>[]>>;

// Many devices + an 'ack-only'-default Set → one outcome carrying void per device.
const setPowerEach = () => client.sendEach(SetPowerCommand(true), devices);
export type _setPowerEachIsDeviceResponseVoid =
  Expect<Equal<Awaited<ReturnType<typeof setPowerEach>>, DeviceResponse<void>[]>>;

// Overrides apply per device too: force a response out of a Set command.
const setPowerEachResponse = () => client.sendEach(SetPowerCommand(true), devices, { responseMode: 'response' });
export type _setPowerEachResponseIsDeviceResponseNumber =
  Expect<Equal<Awaited<ReturnType<typeof setPowerEachResponse>>, DeviceResponse<number>[]>>;

// unicast()/unicastEach() both return void.
const unicastOne = () => client.unicast(SetPowerCommand(true), device);
export type _unicastOneIsVoid = Expect<Equal<ReturnType<typeof unicastOne>, void>>;
const unicastEach = () => client.unicastEach(SetPowerCommand(true), devices);
export type _unicastEachIsVoid = Expect<Equal<ReturnType<typeof unicastEach>, void>>;
