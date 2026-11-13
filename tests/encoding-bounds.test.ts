import { describe, test } from 'bun:test';
import assert from 'node:assert';
import * as Encoding from '../src/wire.js';
import { DecodeError, ValidationError } from '../src/errors.js';

/**
 * Every payload decoder must reject a truncated payload with a DecodeError
 * instead of silently producing garbage values. Anyone on the LAN can send a
 * packet, so these are effectively hostile-input tests.
 */
const decoders: Array<{
  name: string;
  size: number;
  decode: (payload: Uint8Array) => unknown;
}> = [
  { name: 'decodeStateService', size: 5, decode: Encoding.decodeStateService },
  { name: 'decodeStateHostFirmware', size: 20, decode: Encoding.decodeStateHostFirmware },
  { name: 'decodeStateWifiInfo', size: 14, decode: Encoding.decodeStateWifiInfo },
  { name: 'decodeStateWifiFirmware', size: 20, decode: Encoding.decodeStateWifiFirmware },
  { name: 'decodeStatePower', size: 2, decode: Encoding.decodeStatePower },
  { name: 'decodeStateLabel', size: 32, decode: Encoding.decodeStateLabel },
  { name: 'decodeStateVersion', size: 8, decode: Encoding.decodeStateVersion },
  { name: 'decodeStateInfo', size: 24, decode: Encoding.decodeStateInfo },
  { name: 'decodeStateLocation', size: 56, decode: Encoding.decodeStateLocation },
  { name: 'decodeStateGroup', size: 56, decode: Encoding.decodeStateGroup },
  { name: 'decodeEchoResponse', size: 64, decode: Encoding.decodeEchoResponse },
  { name: 'decodeStateUnhandled', size: 2, decode: Encoding.decodeStateUnhandled },
  { name: 'decodeLightState', size: 52, decode: Encoding.decodeLightState },
  { name: 'decodeStateLightPower', size: 2, decode: Encoding.decodeStateLightPower },
  { name: 'decodeStateInfrared', size: 2, decode: Encoding.decodeStateInfrared },
  { name: 'decodeStateHevCycle', size: 9, decode: Encoding.decodeStateHevCycle },
  { name: 'decodeStateHevCycleConfiguration', size: 5, decode: Encoding.decodeStateHevCycleConfiguration },
  { name: 'decodeStateLastHevCycleResult', size: 1, decode: Encoding.decodeStateLastHevCycleResult },
  { name: 'decodeStateRPower', size: 3, decode: Encoding.decodeStateRPower },
  { name: 'decodeStateDeviceChain', size: 882, decode: Encoding.decodeStateDeviceChain },
  { name: 'decodeState64', size: 517, decode: Encoding.decodeState64 },
  { name: 'decodeStateZone', size: 10, decode: Encoding.decodeStateZone },
  { name: 'decodeStateMultiZone', size: 66, decode: Encoding.decodeStateMultiZone },
  { name: 'decodeStateMultiZoneEffect', size: 59, decode: Encoding.decodeStateMultiZoneEffect },
  { name: 'decodeStateExtendedColorZones', size: 661, decode: Encoding.decodeStateExtendedColorZones },
  { name: 'decodeStateTileEffect', size: 187, decode: Encoding.decodeStateTileEffect },
  { name: 'decodeSensorStateAmbientLight', size: 4, decode: Encoding.decodeSensorStateAmbientLight },
  { name: 'decodeStateButton', size: 811, decode: Encoding.decodeStateButton },
];

describe('decoder bounds checking', () => {
  for (const { name, size, decode } of decoders) {
    test(`${name} decodes a full-size payload`, () => {
      assert.doesNotThrow(() => decode(new Uint8Array(size)));
    });

    test(`${name} tolerates trailing bytes after its message`, () => {
      // A payload view may run past the message (a datagram with padding);
      // decoders read from the start and ignore the rest.
      assert.deepStrictEqual(decode(new Uint8Array(size + 4)), decode(new Uint8Array(size)));
    });

    test(`${name} rejects an empty payload`, () => {
      assert.throws(() => decode(new Uint8Array(0)), DecodeError);
    });

    test(`${name} rejects a payload truncated by one byte`, () => {
      assert.throws(() => decode(new Uint8Array(size - 1)), DecodeError);
    });

    test(`${name} reports truncation as a DecodeError, never a ValidationError`, () => {
      // Malformed network input is not the caller's bad input.
      try {
        decode(new Uint8Array(size - 1));
        assert.fail('expected the decoder to throw');
      } catch (err) {
        assert.ok(err instanceof DecodeError);
        assert.ok(!(err instanceof ValidationError));
        assert.equal(err.context['expected'], size);
        assert.equal(err.context['available'], size - 1);
      }
    });
  }

  test('decodeHeader rejects a buffer shorter than a header with DecodeError', () => {
    assert.throws(() => Encoding.decodeHeader(new Uint8Array(35)), DecodeError);
  });

  test('decodeHeader rejects a size field outside the buffer with DecodeError', () => {
    const tooBig = new Uint8Array(36);
    tooBig[0] = 37;
    assert.throws(() => Encoding.decodeHeader(tooBig), DecodeError);

    const tooSmall = new Uint8Array(36);
    tooSmall[0] = 35;
    assert.throws(() => Encoding.decodeHeader(tooSmall), DecodeError);
  });
});
