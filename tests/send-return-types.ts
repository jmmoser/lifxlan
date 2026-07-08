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
import type { ClientInstance } from '../src/client.js';
import type { Device } from '../src/devices.js';
import type { LightState } from '../src/encoding.js';
import { SetPower, GetColor } from '../src/commands/index.js';

/** True iff X and Y are the exact same type. */
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

/** Compiles only when the argument type is exactly `true`. */
type Expect<T extends true> = T;

declare const client: ClientInstance;
declare const device: Device;

// --- Command defaults ------------------------------------------------------

// GetColor defaults to 'response' → resolves the decoded LightState.
const getColor = () => client.send(GetColor(), device);
export type _getColorIsLightState = Expect<Equal<Awaited<ReturnType<typeof getColor>>, LightState>>;

// SetPower defaults to 'ack-only' → resolves nothing, matching runtime.
const setPower = () => client.send(SetPower(true), device);
export type _setPowerIsVoid = Expect<Equal<Awaited<ReturnType<typeof setPower>>, void>>;

// --- Explicit overrides win over the command default -----------------------

// Force a response out of a Set command → the decoded payload (number here).
const setPowerResponse = () => client.send(SetPower(true), device, { responseMode: 'response' });
export type _setPowerResponseIsNumber = Expect<Equal<Awaited<ReturnType<typeof setPowerResponse>>, number>>;

const setPowerBoth = () => client.send(SetPower(true), device, { responseMode: 'both' });
export type _setPowerBothIsNumber = Expect<Equal<Awaited<ReturnType<typeof setPowerBoth>>, number>>;

// Downgrade a Get command to ack-only → void.
const getColorAckOnly = () => client.send(GetColor(), device, { responseMode: 'ack-only' });
export type _getColorAckOnlyIsVoid = Expect<Equal<Awaited<ReturnType<typeof getColorAckOnly>>, void>>;

// Passing options without a responseMode leaves the command default in charge.
const setPowerOtherOptions = () => client.send(SetPower(true), device, { timeoutMs: 1000 });
export type _setPowerOtherOptionsIsVoid = Expect<Equal<Awaited<ReturnType<typeof setPowerOtherOptions>>, void>>;

// An explicit `responseMode: undefined` also means "use the command default".
const setPowerUndefinedMode = () => client.send(SetPower(true), device, { responseMode: undefined });
export type _setPowerUndefinedModeIsVoid = Expect<Equal<Awaited<ReturnType<typeof setPowerUndefinedMode>>, void>>;

// --- Multi-response commands (createDecoder) --------------------------------

// A createDecoder-based command infers its payload type the same way decode
// does: GetColorZones resolves the accumulated response array.
import { GetColorZones } from '../src/commands/multizone.js';
import type { ColorZoneResponse } from '../src/commands/multizone.js';

const getZones = () => client.send(GetColorZones(0, 1), device);
export type _getZonesIsResponseArray = Expect<Equal<Awaited<ReturnType<typeof getZones>>, ColorZoneResponse[]>>;
