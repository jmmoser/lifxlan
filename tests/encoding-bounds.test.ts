import { describe, test } from 'bun:test';
import assert from 'node:assert';
import * as Encoding from '../src/encoding.js';
import { ValidationError } from '../src/errors.js';
import type { OffsetRef } from '../src/encoding.js';

/**
 * Every payload decoder must reject a truncated payload with a
 * ValidationError instead of silently producing garbage values. Anyone on
 * the LAN can send a packet, so these are effectively hostile-input tests.
 */
const decoders: Array<{
  name: string;
  size: number;
  decode: (bytes: Uint8Array, offsetRef: OffsetRef) => unknown;
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
  { name: 'decodeSetColor', size: 13, decode: Encoding.decodeSetColor },
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
      const offsetRef = { current: 0 };
      decode(new Uint8Array(size), offsetRef);
      assert.equal(offsetRef.current, size, 'decoder must consume its full wire size');
    });

    test(`${name} rejects an empty payload`, () => {
      assert.throws(() => decode(new Uint8Array(0), { current: 0 }), ValidationError);
    });

    test(`${name} rejects a payload truncated by one byte`, () => {
      assert.throws(() => decode(new Uint8Array(size - 1), { current: 0 }), ValidationError);
    });

    test(`${name} rejects a truncated payload at a non-zero offset`, () => {
      assert.throws(() => decode(new Uint8Array(size), { current: 1 }), ValidationError);
    });
  }
});
