import { describe, test } from 'bun:test';
import assert from 'node:assert';
import * as Commands from '../src/commands/index.js';
import { Type, Waveform, MultiZoneApplicationRequest, MultiZoneExtendedApplicationRequest, MultiZoneEffectType, TileEffectType, TileEffectSkyType } from '../src/constants/index.js';
import { DecodeError, ValidationError } from '../src/errors.js';
import type { State64, StateExtendedColorZones } from '../src/wire.js';

/**
 * Wire payload builders for the multi-packet replies. Every color's hue is
 * `1000 + <absolute zone index>` (or `1000 + tileIndex * 100 + pixel` for
 * tiles), so an assembled result can be checked against the zone it claims
 * to describe.
 */
const zoneHue = (zone: number) => 1000 + zone;

function writeColor(view: DataView, offset: number, hue: number): void {
  view.setUint16(offset, hue, true);
  view.setUint16(offset + 2, 65535, true);
  view.setUint16(offset + 4, 32768, true);
  view.setUint16(offset + 6, 3500, true);
}

const zoneColor = (zone: number) => ({ hue: zoneHue(zone), saturation: 65535, brightness: 32768, kelvin: 3500 });

const zoneHues = (first: number, count: number) => Array.from({ length: count }, (_, i) => zoneHue(first + i));

function stateZone(zonesCount: number, zoneIndex: number): Uint8Array {
  const payload = new Uint8Array(10);
  payload[0] = zonesCount;
  payload[1] = zoneIndex;
  writeColor(new DataView(payload.buffer), 2, zoneHue(zoneIndex));
  return payload;
}

/** Always carries 8 colors, like the wire message — including padding past the last zone. */
function stateMultiZone(zonesCount: number, zoneIndex: number): Uint8Array {
  const payload = new Uint8Array(2 + 8 * 8);
  payload[0] = zonesCount;
  payload[1] = zoneIndex;
  const view = new DataView(payload.buffer);
  for (let i = 0; i < 8; i++) {
    writeColor(view, 2 + i * 8, zoneHue(zoneIndex + i));
  }
  return payload;
}

/** Always carries 82 colors, like the wire message; only `colorsCount` are valid. */
function stateExtendedColorZones(zonesCount: number, zoneIndex: number, colorsCount: number): Uint8Array {
  const payload = new Uint8Array(5 + 82 * 8);
  const view = new DataView(payload.buffer);
  view.setUint16(0, zonesCount, true);
  view.setUint16(2, zoneIndex, true);
  view.setUint8(4, colorsCount);
  for (let i = 0; i < 82; i++) {
    writeColor(view, 5 + i * 8, zoneHue(zoneIndex + i));
  }
  return payload;
}

function state64(tileIndex: number): Uint8Array {
  const payload = new Uint8Array(5 + 64 * 8);
  payload[0] = tileIndex;
  payload[1] = 0xAA; // reserved, must not leak into the result
  payload[4] = 8; // width
  const view = new DataView(payload.buffer);
  for (let i = 0; i < 64; i++) {
    writeColor(view, 5 + i * 8, 1000 + tileIndex * 100 + i);
  }
  return payload;
}

/** Asserts `fn` throws a ValidationError naming `parameter`. */
function assertInvalid(fn: () => unknown, parameter: string): void {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof ValidationError, `expected a ValidationError for ${parameter}, got ${String(err)}`);
    assert.equal(err.parameter, parameter);
    return true;
  });
}

describe('commands', () => {
  test('GetService', () => {
    const cmd = Commands.GetService();
    assert.equal(cmd.type, Type.GetService);
    assert.ok(!('payload' in cmd));
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetHostFirmware', () => {
    const cmd = Commands.GetHostFirmware();
    assert.equal(cmd.type, Type.GetHostFirmware);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetWifiInfo', () => {
    const cmd = Commands.GetWifiInfo();
    assert.equal(cmd.type, Type.GetWifiInfo);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetWifiFirmware', () => {
    const cmd = Commands.GetWifiFirmware();
    assert.equal(cmd.type, Type.GetWifiFirmware);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetPower with boolean true', () => {
    const cmd = Commands.SetPower(true);
    assert.equal(cmd.type, Type.SetPower);
    assert.equal(cmd.payload.length, 2);
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint16(0, true), 65535);
  });

  test('SetPower with boolean false', () => {
    const cmd = Commands.SetPower(false);
    assert.equal(cmd.type, Type.SetPower);
    assert.equal(cmd.payload.length, 2);
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint16(0, true), 0);
  });

  test('SetPower with number', () => {
    const cmd = Commands.SetPower(32768);
    assert.equal(cmd.type, Type.SetPower);
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint16(0, true), 32768);
  });

  test('GetLabel', () => {
    const cmd = Commands.GetLabel();
    assert.equal(cmd.type, Type.GetLabel);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetLabel', () => {
    const cmd = Commands.SetLabel('Test Label');
    assert.equal(cmd.type, Type.SetLabel);
    assert.equal(cmd.payload.length, 32);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetVersion', () => {
    const cmd = Commands.GetVersion();
    assert.equal(cmd.type, Type.GetVersion);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetInfo', () => {
    const cmd = Commands.GetInfo();
    assert.equal(cmd.type, Type.GetInfo);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetReboot', () => {
    const cmd = Commands.SetReboot();
    assert.equal(cmd.type, Type.SetReboot);
    // No decoder: SetReboot has no State response, so forcing
    // responseMode 'response' must reject with ValidationError instead of
    // resolving undefined.
    assert.equal('decode' in cmd, false);
  });

  test('GetLocation', () => {
    const cmd = Commands.GetLocation();
    assert.equal(cmd.type, Type.GetLocation);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetLocation with string UUID', () => {
    const uuid = '4e0352bf-1994-4ff2-b425-1c4455479f33';
    const label = 'Living Room';
    const updatedAt = new Date('2023-01-01T00:00:00Z');
    
    const cmd = Commands.SetLocation(uuid, label, updatedAt);
    assert.equal(cmd.type, Type.SetLocation);
    assert.equal(cmd.payload.length, 56);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetLocation with Uint8Array UUID', () => {
    const uuid = new Uint8Array([0x4e, 0x03, 0x52, 0xbf, 0x19, 0x94, 0x4f, 0xf2, 0xb4, 0x25, 0x1c, 0x44, 0x55, 0x47, 0x9f, 0x33]);
    const label = 'Kitchen';
    const updatedAt = new Date('2023-01-01T00:00:00Z');
    
    const cmd = Commands.SetLocation(uuid, label, updatedAt);
    assert.equal(cmd.type, Type.SetLocation);
    assert.equal(cmd.payload.length, 56);
    assert.deepEqual(cmd.payload.subarray(0, 16), uuid);
  });

  test('GetGroup', () => {
    const cmd = Commands.GetGroup();
    assert.equal(cmd.type, Type.GetGroup);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetGroup with string UUID', () => {
    const uuid = '4e0352bf-1994-4ff2-b425-1c4455479f33';
    const label = 'Bedroom Lights';
    const updatedAt = new Date('2023-01-01T00:00:00Z');
    
    const cmd = Commands.SetGroup(uuid, label, updatedAt);
    assert.equal(cmd.type, Type.SetGroup);
    assert.equal(cmd.payload.length, 56);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetGroup with Uint8Array UUID', () => {
    const uuid = new Uint8Array([0x4e, 0x03, 0x52, 0xbf, 0x19, 0x94, 0x4f, 0xf2, 0xb4, 0x25, 0x1c, 0x44, 0x55, 0x47, 0x9f, 0x33]);
    const label = 'Kitchen Lights';
    const updatedAt = new Date('2023-01-01T00:00:00Z');
    
    const cmd = Commands.SetGroup(uuid, label, updatedAt);
    assert.equal(cmd.type, Type.SetGroup);
    assert.equal(cmd.payload.length, 56);
    assert.deepEqual(cmd.payload.subarray(0, 16), uuid);
  });

  test('EchoRequest', () => {
    const echoing = new Uint8Array([1, 2, 3, 4, 5]);
    const cmd = Commands.EchoRequest(echoing);
    assert.equal(cmd.type, Type.EchoRequest);
    assert.equal(cmd.payload.length, 64);
    assert.deepEqual(cmd.payload.subarray(0, 5), echoing);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetColor', () => {
    const cmd = Commands.GetColor();
    assert.equal(cmd.type, Type.GetColor);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetColor', () => {
    const cmd = Commands.SetColor({ hue: 120, saturation: 65535, brightness: 32768, kelvin: 3500, durationMs: 1000 });
    assert.equal(cmd.type, Type.SetColor);
    assert.ok(cmd.payload instanceof Uint8Array);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetWaveform', () => {
    const cmd = Commands.SetWaveform(
      {
        transient: true,
        hue: 120,
        saturation: 65535,
        brightness: 32768,
        kelvin: 3500,
        periodMs: 1000,
        cycles: 5,
        skewRatio: 0,
        waveform: Waveform.SINE,
      }
    );
    assert.equal(cmd.type, Type.SetWaveform);
    assert.equal(cmd.payload.length, 21);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(cmd.payload[1], 1); // transient
    assert.equal(view.getUint16(2, true), 120); // hue
    assert.equal(view.getUint16(4, true), 65535); // saturation
    assert.equal(view.getUint16(6, true), 32768); // brightness
    assert.equal(view.getUint16(8, true), 3500); // kelvin
    assert.equal(view.getUint32(10, true), 1000); // period
    assert.equal(view.getFloat32(14, true), 5); // cycles
    assert.equal(view.getInt16(18, true), 0); // skewRatio
    assert.equal(view.getUint8(20), Waveform.SINE); // waveform
  });

  test('GetLightPower', () => {
    const cmd = Commands.GetLightPower();
    assert.equal(cmd.type, Type.GetLightPower);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetLightPower with boolean', () => {
    const cmd = Commands.SetLightPower(true, 1000);
    assert.equal(cmd.type, Type.SetLightPower);
    assert.equal(cmd.payload.length, 6);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint16(0, true), 65535);
    assert.equal(view.getUint32(2, true), 1000);
  });

  test('SetLightPower with number', () => {
    const cmd = Commands.SetLightPower(32768, 500);
    assert.equal(cmd.type, Type.SetLightPower);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint16(0, true), 32768);
    assert.equal(view.getUint32(2, true), 500);
  });

  test('SetWaveformOptional', () => {
    const cmd = Commands.SetWaveformOptional({
      transient: false,
      hue: 240,
      saturation: 32768,
      brightness: 65535,
      kelvin: 2700,
      periodMs: 2000,
      cycles: 3,
      skewRatio: -100,
      waveform: Waveform.TRIANGLE,
      setHue: true,
      setSaturation: false,
      setBrightness: true,
      setKelvin: false,
    });
    
    assert.equal(cmd.type, Type.SetWaveformOptional);
    assert.equal(cmd.payload.length, 25);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(cmd.payload[1], 0); // transient false
    assert.equal(view.getUint16(2, true), 240); // hue
    assert.equal(view.getUint16(4, true), 32768); // saturation
    assert.equal(view.getUint16(6, true), 65535); // brightness
    assert.equal(view.getUint16(8, true), 2700); // kelvin
    assert.equal(view.getUint32(10, true), 2000); // period
    assert.equal(view.getFloat32(14, true), 3); // cycles
    assert.equal(view.getInt16(18, true), -100); // skewRatio
    assert.equal(view.getUint8(20), Waveform.TRIANGLE); // waveform
    assert.equal(cmd.payload[21], 1); // setHue true
    assert.equal(cmd.payload[22], 0); // setSaturation false
    assert.equal(cmd.payload[23], 1); // setBrightness true
    assert.equal(cmd.payload[24], 0); // setKelvin false

    // The device answers SetWaveformOptional with a LightState (107), the
    // same response SetWaveform gets — not a StateLightPower.
    assert.equal(cmd.decode, Commands.SetWaveform(
      { hue: 0, saturation: 0, brightness: 0, kelvin: 0, periodMs: 0, cycles: 0, waveform: Waveform.SAW },
    ).decode);
  });

  test('GetInfrared', () => {
    const cmd = Commands.GetInfrared();
    assert.equal(cmd.type, Type.GetInfrared);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetInfrared', () => {
    const cmd = Commands.SetInfrared(32768);
    assert.equal(cmd.type, Type.SetInfrared);
    assert.equal(cmd.payload.length, 2);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint16(0, true), 32768);
  });

  test('GetHevCycle', () => {
    const cmd = Commands.GetHevCycle();
    assert.equal(cmd.type, Type.GetHevCycle);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetHevCycle', () => {
    const cmd = Commands.SetHevCycle(true, 3600);
    assert.equal(cmd.type, Type.SetHevCycle);
    assert.equal(cmd.payload.length, 5);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 1);
    assert.equal(view.getUint32(1, true), 3600);
  });

  test('GetHevCycleConfiguration', () => {
    const cmd = Commands.GetHevCycleConfiguration();
    assert.equal(cmd.type, Type.GetHevCycleConfiguration);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetHevCycleConfiguration', () => {
    const cmd = Commands.SetHevCycleConfiguration(false, 1800);
    assert.equal(cmd.type, Type.SetHevCycleConfiguration);
    assert.equal(cmd.payload.length, 5);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 0);
    assert.equal(view.getUint32(1, true), 1800);
  });

  test('GetLastHevCycleResult', () => {
    const cmd = Commands.GetLastHevCycleResult();
    assert.equal(cmd.type, Type.GetLastHevCycleResult);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetRPower', () => {
    const cmd = Commands.GetRPower(2);
    assert.equal(cmd.type, Type.GetRPower);
    assert.equal(cmd.payload.length, 1);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 2);
  });

  test('SetRPower', () => {
    const cmd = Commands.SetRPower(1, 65535);
    assert.equal(cmd.type, Type.SetRPower);
    assert.equal(cmd.payload.length, 3);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 1);
    assert.equal(view.getUint16(1, true), 65535);
  });

  test('SetRPower accepts a boolean like SetPower and SetLightPower', () => {
    assert.deepEqual(Commands.SetRPower(1, true).payload, new Uint8Array([1, 0xFF, 0xFF]));
    assert.deepEqual(Commands.SetRPower(1, false).payload, new Uint8Array([1, 0, 0]));
    // A number is sent as given.
    assert.deepEqual(Commands.SetRPower(2, 1).payload, new Uint8Array([2, 1, 0]));
  });

  test('GetDeviceChain', () => {
    const cmd = Commands.GetDeviceChain();
    assert.equal(cmd.type, Type.GetDeviceChain);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('Get64', () => {
    const cmd = Commands.Get64({ tileIndex: 0, tileCount: 8, x: 2, y: 3, width: 4 });
    assert.equal(cmd.type, Type.Get64);
    assert.equal(cmd.payload.length, 6);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 0); // tileIndex
    assert.equal(view.getUint8(1), 8); // length
    assert.equal(view.getUint8(2), 0); // reserved
    assert.equal(view.getUint8(3), 2); // x
    assert.equal(view.getUint8(4), 3); // y
    assert.equal(view.getUint8(5), 4); // width
  });

  test('Get64 collects its reply instead of decoding a single packet', () => {
    const cmd = Commands.Get64({ tileIndex: 0, tileCount: 3, width: 8 });
    assert.equal(cmd.type, Type.Get64);
    assert.equal(typeof cmd.collect, 'function');
    assert.ok(!('decode' in cmd));
  });

  test('Get64 resolves one State64 per tile once every tile has reported', () => {
    const collector = Commands.Get64({ tileIndex: 0, tileCount: 2, width: 8 }).collect();

    assert.equal(collector.add(state64(0), Type.State64), false); // tile 1 outstanding
    assert.equal(collector.add(state64(1), Type.State64), true);

    const tiles = collector.result();
    assert.equal(tiles.length, 2);
    const [first, second] = tiles;
    assert.ok(first && second);
    assert.equal(first.tileIndex, 0);
    assert.equal(first.width, 8);
    assert.equal(first.colors.length, 64);
    assert.deepEqual(first.colors[0], { hue: 1000, saturation: 65535, brightness: 32768, kelvin: 3500 });
    assert.equal(first.colors[63]?.hue, 1063);
    assert.equal(second.tileIndex, 1);
    assert.equal(second.colors[0]?.hue, 1100);
    // The reserved byte is not part of the decoded tile.
    assert.deepEqual(Object.keys(first).sort(), ['colors', 'tileIndex', 'width', 'x', 'y']);
  });

  test('Get64 orders tiles by tileIndex whatever order the packets arrive in', () => {
    const collector = Commands.Get64({ tileIndex: 1, tileCount: 3 }).collect();

    assert.equal(collector.add(state64(3), Type.State64), false);
    assert.equal(collector.add(state64(1), Type.State64), false);
    assert.equal(collector.add(state64(2), Type.State64), true);
    assert.deepEqual(collector.result().map((tile) => tile.tileIndex), [1, 2, 3]);
  });

  test('Get64 ignores a duplicate State64 when counting tiles', () => {
    const collector = Commands.Get64({ tileIndex: 0, tileCount: 2, width: 8 }).collect();

    assert.equal(collector.add(state64(0), Type.State64), false);
    // UDP can deliver the same packet twice; tile 1 is still outstanding.
    assert.equal(collector.add(state64(0), Type.State64), false);
    assert.equal(collector.add(state64(1), Type.State64), true);
    assert.deepEqual(collector.result().map((tile) => tile.tileIndex), [0, 1]);
  });

  test('Get64 ignores State64 for tiles outside the requested range', () => {
    const seen: number[] = [];
    const collector = Commands.Get64({ tileIndex: 2, tileCount: 2, width: 8, onResponse: (response) => {
      seen.push(response.tileIndex);
    } }).collect();

    assert.equal(collector.add(state64(2), Type.State64), false);
    assert.equal(collector.add(state64(0), Type.State64), false);
    assert.equal(collector.add(state64(4), Type.State64), false);
    assert.equal(collector.add(state64(3), Type.State64), true);
    assert.deepEqual(collector.result().map((tile) => tile.tileIndex), [2, 3]);
    // Strays never reach the callback either.
    assert.deepEqual(seen, [2, 3]);
  });

  test('Get64 callback receives each tile as it arrives', () => {
    const receivedResponses: State64[] = [];
    const collector = Commands.Get64({ tileIndex: 0, tileCount: 2, width: 8, onResponse: (response) => {
      receivedResponses.push(response);
    } }).collect();

    assert.equal(collector.add(state64(0), Type.State64), false); // still expecting tile 1
    assert.equal(receivedResponses.length, 1);
    assert.equal(receivedResponses[0]?.tileIndex, 0);
    // Returning nothing keeps the exchange open; only `false` stops it.
    assert.equal(collector.add(state64(1), Type.State64), true);
    assert.equal(receivedResponses.length, 2);
  });

  test('Get64 callback can stop early', () => {
    const receivedResponses: State64[] = [];
    const collector = Commands.Get64({ tileIndex: 0, tileCount: 3, width: 8, onResponse: (response) => {
      receivedResponses.push(response);
      return false; // Stop early
    } }).collect();

    assert.equal(collector.add(state64(0), Type.State64), true); // complete: the caller stopped it
    assert.equal(receivedResponses.length, 1);
    assert.deepEqual(collector.result().map((tile) => tile.tileIndex), [0]);
  });

  test('Get64 stopped early resolves with the tiles received, leaving out the missing ones', () => {
    let calls = 0;
    const collector = Commands.Get64({ tileIndex: 0, tileCount: 4, onResponse: () => ++calls < 2 }).collect();

    assert.equal(collector.add(state64(3), Type.State64), false);
    assert.equal(collector.add(state64(1), Type.State64), true); // second callback returned false

    const tiles = collector.result();
    // In tile order, with no holes for tiles 0 and 2.
    assert.equal(tiles.length, 2);
    assert.deepEqual(tiles.map((tile) => tile.tileIndex), [1, 3]);
    assert.ok(tiles.every((tile) => tile !== undefined));
  });

  test('Get64 ignores unknown response types', () => {
    const seen: number[] = [];
    const collector = Commands.Get64({ tileIndex: 0, tileCount: 1, width: 8, onResponse: (response) => {
      seen.push(response.tileIndex);
    } }).collect();

    // Not decoded at all: far too short to be a State64, yet no throw.
    assert.equal(collector.add(new Uint8Array(10), 999), false);
    assert.deepEqual(seen, []);
    assert.equal(collector.add(state64(0), Type.State64), true);
    assert.equal(collector.result().length, 1);
  });

  test('Get64 rejects a truncated State64 with DecodeError', () => {
    const collector = Commands.Get64({ tileIndex: 0 }).collect();
    assert.throws(() => collector.add(new Uint8Array(100), Type.State64), DecodeError);
  });

  test('Get64 gives every collect() call its own accumulation state', () => {
    const cmd = Commands.Get64({ tileIndex: 0, tileCount: 2 });
    const first = cmd.collect();
    const second = cmd.collect();

    assert.equal(first.add(state64(0), Type.State64), false);
    // The second exchange has seen nothing yet: tile 1 alone does not finish it.
    assert.equal(second.add(state64(1), Type.State64), false);
    assert.equal(first.add(state64(1), Type.State64), true);
    assert.equal(second.add(state64(0), Type.State64), true);

    assert.deepEqual(first.result().map((tile) => tile.tileIndex), [0, 1]);
    assert.deepEqual(second.result().map((tile) => tile.tileIndex), [0, 1]);
    assert.notEqual(first.result(), second.result());
  });

  test('Get64 rejects a tileIndex or tileCount the uint8 wire fields would wrap', () => {
    // Each would ask the device for tiles the collector never accepts.
    assert.throws(() => Commands.Get64({ tileIndex: 0, tileCount: 256 }), /Invalid tileCount: 256/);
    assert.throws(() => Commands.Get64({ tileIndex: 0, tileCount: 1.5 }), /Invalid tileCount: 1.5/);
    assert.throws(() => Commands.Get64({ tileIndex: 0, tileCount: 0 }), /Invalid tileCount: 0/);
    assert.throws(() => Commands.Get64({ tileIndex: 256 }), /Invalid tileIndex: 256/);
    // -1 would go out as tile 255 while the collector waited for tile -1.
    assert.throws(() => Commands.Get64({ tileIndex: -1 }), /Invalid tileIndex: -1/);
    assert.throws(() => Commands.Get64({ tileIndex: 0.5 }), /Invalid tileIndex: 0.5/);
    // A range running past tile 255 names tiles that cannot exist.
    assert.throws(() => Commands.Get64({ tileIndex: 200, tileCount: 100 }), /tileIndex \+ tileCount must not exceed 256/);
    assert.throws(() => Commands.Get64({ tileIndex: 255, tileCount: 2 }), /tileIndex \+ tileCount must not exceed 256/);
    assert.equal(Commands.Get64({ tileIndex: 255, tileCount: 1 }).type, Type.Get64);
    assert.equal(Commands.Get64({ tileIndex: 0, tileCount: 255 }).type, Type.Get64);
  });

  test('SetHevCycle defaults durationSeconds to 0 (the configured default)', () => {
    // Turning HEV off needs no duration. SetHevCycleConfiguration keeps it
    // required: its duration *is* the stored default, so a default of 0
    // would silently erase it.
    assert.deepEqual(Commands.SetHevCycle(false).payload, new Uint8Array([0, 0, 0, 0, 0]));
    // Guard the required parameter (tsc checks tests): if a default crept
    // back in, this directive would be unused and fail the typecheck. At
    // runtime the omitted duration is rejected, not encoded as 0.
    // @ts-expect-error -- durationSeconds is required on SetHevCycleConfiguration
    assert.throws(() => Commands.SetHevCycleConfiguration(true), /Invalid durationSeconds/);
  });

  test('GetColorZones rejects indices outside the uint8 wire range', () => {
    // 256 would encode as 0 while the collector waited on zones 1..255.
    assert.throws(() => Commands.GetColorZones({ startIndex: 0, endIndex: 256 }), /Invalid endIndex: 256/);
    assert.throws(() => Commands.GetColorZones({ startIndex: -1, endIndex: 7 }), /Invalid startIndex: -1/);
    assert.throws(() => Commands.GetColorZones({ startIndex: 0.5, endIndex: 7 }), /Invalid startIndex: 0.5/);
    assert.equal(Commands.GetColorZones({ startIndex: 0, endIndex: 255 }).type, Type.GetColorZones);
  });

  test('GetColorZones basic usage without callback', () => {
    const cmd = Commands.GetColorZones({ startIndex: 0, endIndex: 15 });
    assert.equal(cmd.type, Type.GetColorZones);
    assert.equal(cmd.payload.length, 2);

    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 0);
    assert.equal(view.getUint8(1), 15);
    assert.equal(typeof cmd.collect, 'function');
    assert.ok(!('decode' in cmd));
  });

  test('GetColorZones assembles StateZone replies into one zone-ordered result', () => {
    const collector = Commands.GetColorZones({ startIndex: 0, endIndex: 2 }).collect();

    assert.equal(collector.add(stateZone(3, 0), Type.StateZone), false);
    assert.equal(collector.add(stateZone(3, 1), Type.StateZone), false); // still need zone 2
    assert.equal(collector.add(stateZone(3, 2), Type.StateZone), true);

    assert.deepEqual(collector.result(), {
      zonesCount: 3,
      zoneIndex: 0,
      colors: [zoneColor(0), zoneColor(1), zoneColor(2)],
    });
  });

  test('GetColorZones assembles a StateMultiZone reply, dropping the padding past the last zone', () => {
    const collector = Commands.GetColorZones({ startIndex: 0, endIndex: 2 }).collect();

    // The wire message always carries 8 colors; the device has 3 zones.
    assert.equal(collector.add(stateMultiZone(3, 0), Type.StateMultiZone), true);

    assert.deepEqual(collector.result(), {
      zonesCount: 3,
      zoneIndex: 0,
      colors: [zoneColor(0), zoneColor(1), zoneColor(2)],
    });
  });

  test('GetColorZones assembles a reply split across several StateMultiZone packets', () => {
    // The LIFX-documented way to read every zone: 0..255.
    const collector = Commands.GetColorZones({ startIndex: 0, endIndex: 255 }).collect();

    assert.equal(collector.add(stateMultiZone(20, 0), Type.StateMultiZone), false);
    assert.equal(collector.add(stateMultiZone(20, 8), Type.StateMultiZone), false);
    assert.equal(collector.add(stateMultiZone(20, 16), Type.StateMultiZone), true); // carries zones 16..19

    const zones = collector.result();
    assert.equal(zones.zonesCount, 20);
    assert.equal(zones.zoneIndex, 0);
    assert.deepEqual(zones.colors.map((color) => color.hue), zoneHues(0, 20));
  });

  test('GetColorZones orders zones by index whatever order the packets arrive in', () => {
    const collector = Commands.GetColorZones({ startIndex: 0, endIndex: 255 }).collect();

    assert.equal(collector.add(stateMultiZone(24, 16), Type.StateMultiZone), false);
    assert.equal(collector.add(stateMultiZone(24, 0), Type.StateMultiZone), false);
    assert.equal(collector.add(stateMultiZone(24, 8), Type.StateMultiZone), true);

    assert.deepEqual(collector.result().colors.map((color) => color.hue), zoneHues(0, 24));
  });

  test('GetColorZones keeps only the requested zones of a packet that carries more', () => {
    // Devices answer in 8-zone packets aligned to their own grid: asking for
    // zones 10..12 of a 16-zone strip is answered with zones 8..15.
    const inside = Commands.GetColorZones({ startIndex: 10, endIndex: 12 }).collect();
    assert.equal(inside.add(stateMultiZone(16, 8), Type.StateMultiZone), true);
    assert.deepEqual(inside.result(), {
      zonesCount: 16,
      zoneIndex: 10,
      colors: [zoneColor(10), zoneColor(11), zoneColor(12)],
    });

    // A range straddling two packets needs both, and takes part of each.
    const straddling = Commands.GetColorZones({ startIndex: 6, endIndex: 9 }).collect();
    assert.equal(straddling.add(stateMultiZone(16, 0), Type.StateMultiZone), false);
    assert.equal(straddling.add(stateMultiZone(16, 8), Type.StateMultiZone), true);
    const zones = straddling.result();
    assert.equal(zones.zoneIndex, 6);
    assert.deepEqual(zones.colors.map((color) => color.hue), zoneHues(6, 4));

    // A packet entirely outside the range contributes nothing.
    const outside = Commands.GetColorZones({ startIndex: 0, endIndex: 3 }).collect();
    assert.equal(outside.add(stateMultiZone(16, 8), Type.StateMultiZone), false);
    assert.equal(outside.add(stateMultiZone(16, 0), Type.StateMultiZone), true);
    assert.deepEqual(outside.result().colors.map((color) => color.hue), zoneHues(0, 4));
  });

  test('GetColorZones stops expecting zones the device does not have', () => {
    const collector = Commands.GetColorZones({ startIndex: 0, endIndex: 255 }).collect();

    // A 3-zone device answering with StateZone packets (single zone each).
    for (const zoneIndex of [0, 1]) {
      assert.equal(collector.add(stateZone(3, zoneIndex), Type.StateZone), false, `zone ${zoneIndex}`);
    }
    // zones 3..255 will never arrive
    assert.equal(collector.add(stateZone(3, 2), Type.StateZone), true);
    assert.equal(collector.result().colors.length, 3);
  });

  test('GetColorZones for a range entirely past the device resolves with no colors', () => {
    const collector = Commands.GetColorZones({ startIndex: 20, endIndex: 30 }).collect();

    // Whatever the device answers with, it reports 16 zones: none requested exist.
    assert.equal(collector.add(stateMultiZone(16, 8), Type.StateMultiZone), true);
    assert.deepEqual(collector.result(), { zonesCount: 16, zoneIndex: 20, colors: [] });
  });

  test('GetColorZones ignores a duplicate packet when counting zones', () => {
    const multi = Commands.GetColorZones({ startIndex: 0, endIndex: 255 }).collect();
    assert.equal(multi.add(stateMultiZone(16, 0), Type.StateMultiZone), false);
    // UDP can deliver the same packet twice; zones 8..15 are still outstanding.
    assert.equal(multi.add(stateMultiZone(16, 0), Type.StateMultiZone), false);
    assert.equal(multi.add(stateMultiZone(16, 8), Type.StateMultiZone), true);
    assert.deepEqual(multi.result().colors.map((color) => color.hue), zoneHues(0, 16));

    const single = Commands.GetColorZones({ startIndex: 0, endIndex: 1 }).collect();
    assert.equal(single.add(stateZone(2, 0), Type.StateZone), false);
    assert.equal(single.add(stateZone(2, 0), Type.StateZone), false);
    assert.equal(single.add(stateZone(2, 1), Type.StateZone), true);
    assert.deepEqual(single.result().colors, [zoneColor(0), zoneColor(1)]);
  });

  test('GetColorZones callback receives each packet as it arrives', () => {
    const receivedResponses: Commands.ColorZoneResponse[] = [];
    const collector = Commands.GetColorZones({ startIndex: 0, endIndex: 1, onResponse: (response) => {
      receivedResponses.push(response);
    } }).collect();

    assert.equal(collector.add(stateZone(2, 0), Type.StateZone), false); // still expecting zone 1

    assert.equal(receivedResponses.length, 1);
    const res = receivedResponses[0];
    assert.ok(res);
    assert.equal(res.zoneIndex, 0);
    assert.ok('hue' in res);
    assert.equal(res.hue, zoneHue(0));

    assert.equal(collector.add(stateMultiZone(2, 0), Type.StateMultiZone), true);
    const multi = receivedResponses[1];
    assert.ok(multi && 'colors' in multi);
    // The packet the callback sees is trimmed to the device's zones too.
    assert.equal(multi.colors.length, 2);
  });

  test('GetColorZones callback can stop early', () => {
    const receivedResponses: Commands.ColorZoneResponse[] = [];
    const collector = Commands.GetColorZones({ startIndex: 0, endIndex: 5, onResponse: (response) => {
      receivedResponses.push(response);
      return false; // Stop early
    } }).collect();

    assert.equal(collector.add(stateZone(6, 0), Type.StateZone), true); // complete: the caller stopped it
    assert.equal(receivedResponses.length, 1);
    assert.deepEqual(collector.result(), { zonesCount: 6, zoneIndex: 0, colors: [zoneColor(0)] });
  });

  test('GetColorZones stopped early resolves with the zones up to the first one missing', () => {
    let calls = 0;
    const collector = Commands.GetColorZones({ startIndex: 0, endIndex: 255, onResponse: () => ++calls < 2 }).collect();

    assert.equal(collector.add(stateMultiZone(24, 0), Type.StateMultiZone), false);
    assert.equal(collector.add(stateMultiZone(24, 16), Type.StateMultiZone), true); // second callback returned false

    // Zones 16..23 arrived, but zones 8..15 did not: colors[i] must stay
    // "zone zoneIndex + i", so the result ends at the gap.
    const zones = collector.result();
    assert.equal(zones.zonesCount, 24);
    assert.equal(zones.zoneIndex, 0);
    assert.deepEqual(zones.colors.map((color) => color.hue), zoneHues(0, 8));

    // Stopped before the first requested zone arrived: nothing contiguous yet.
    const headless = Commands.GetColorZones({ startIndex: 0, endIndex: 255, onResponse: () => false }).collect();
    assert.equal(headless.add(stateMultiZone(24, 8), Type.StateMultiZone), true);
    assert.deepEqual(headless.result(), { zonesCount: 24, zoneIndex: 0, colors: [] });
  });

  test('GetColorZones ignores unknown response types', () => {
    const seen: Commands.ColorZoneResponse[] = [];
    const collector = Commands.GetColorZones({ startIndex: 0, endIndex: 1, onResponse: (response) => {
      seen.push(response);
    } }).collect();

    assert.equal(collector.add(new Uint8Array(10), 999), false); // still expecting responses
    assert.equal(seen.length, 0);
    assert.equal(collector.add(stateMultiZone(2, 0), Type.StateMultiZone), true);
    assert.equal(collector.result().colors.length, 2);
  });

  test('GetColorZones rejects a truncated reply with DecodeError', () => {
    const collector = Commands.GetColorZones({ startIndex: 0, endIndex: 7 }).collect();
    assert.throws(() => collector.add(new Uint8Array(20), Type.StateMultiZone), DecodeError);
    assert.throws(() => collector.add(new Uint8Array(4), Type.StateZone), DecodeError);
  });

  test('GetColorZones gives every collect() call its own accumulation state', () => {
    const cmd = Commands.GetColorZones({ startIndex: 0, endIndex: 255 });
    const first = cmd.collect();
    const second = cmd.collect();

    assert.equal(first.add(stateMultiZone(16, 0), Type.StateMultiZone), false);
    // The second exchange has seen nothing yet: zones 8..15 alone do not finish it.
    assert.equal(second.add(stateMultiZone(16, 8), Type.StateMultiZone), false);
    // ...and a different device's zone count does not leak across either.
    const third = cmd.collect();
    assert.equal(third.add(stateMultiZone(4, 0), Type.StateMultiZone), true);
    assert.equal(third.result().zonesCount, 4);

    assert.equal(first.add(stateMultiZone(16, 8), Type.StateMultiZone), true);
    assert.equal(second.add(stateMultiZone(16, 0), Type.StateMultiZone), true);
    assert.deepEqual(first.result().colors.map((color) => color.hue), zoneHues(0, 16));
    assert.deepEqual(second.result().colors.map((color) => color.hue), zoneHues(0, 16));
    assert.notEqual(first.result().colors, second.result().colors);
  });

  test('SetColorZones', () => {
    const cmd = Commands.SetColorZones({
      startIndex: 0,
      endIndex: 7,
      hue: 120,
      saturation: 65535,
      brightness: 32768,
      kelvin: 3500,
      durationMs: 1000,
      apply: MultiZoneApplicationRequest.APPLY,
    });
    assert.equal(cmd.type, Type.SetColorZones);
    assert.equal(cmd.payload.length, 15);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 0); // startIndex
    assert.equal(view.getUint8(1), 7); // endIndex
    assert.equal(view.getUint16(2, true), 120); // hue
    assert.equal(view.getUint16(4, true), 65535); // saturation
    assert.equal(view.getUint16(6, true), 32768); // brightness
    assert.equal(view.getUint16(8, true), 3500); // kelvin
    assert.equal(view.getUint32(10, true), 1000); // duration
    assert.equal(view.getUint8(14), MultiZoneApplicationRequest.APPLY); // apply
  });

  test('GetMultiZoneEffect', () => {
    const cmd = Commands.GetMultiZoneEffect();
    assert.equal(cmd.type, Type.GetMultiZoneEffect);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetMultiZoneEffect', () => {
    const parameters = new Uint8Array(32).fill(0xAB);
    const cmd = Commands.SetMultiZoneEffect({
      instanceId: 12345,
      effectType: MultiZoneEffectType.MOVE,
      speedMs: 5,
      durationNs: 10000n,
      parameters,
    });
    assert.equal(cmd.type, Type.SetMultiZoneEffect);
    assert.equal(cmd.payload.length, 59);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint32(0, true), 12345); // instanceId
    assert.equal(view.getUint8(4), MultiZoneEffectType.MOVE); // effectType
    assert.equal(view.getUint8(5), 0); // reserved
    assert.equal(view.getUint8(6), 0); // reserved
    assert.equal(view.getUint32(7, true), 5); // speed
    assert.equal(view.getBigUint64(11, true), 10000n); // duration
    assert.deepEqual(cmd.payload.subarray(27, 59), parameters); // parameters
  });

  test('GetExtendedColorZones', () => {
    const cmd = Commands.GetExtendedColorZones();
    assert.equal(cmd.type, Type.GetExtendedColorZones);
    assert.equal(cmd.responseType, Type.StateExtendedColorZones);
    assert.equal(typeof cmd.collect, 'function');
    assert.ok(!('decode' in cmd));
    assert.ok(!('payload' in cmd));
  });

  test('GetExtendedColorZones resolves a single-packet reply with only the valid colors', () => {
    const collector = Commands.GetExtendedColorZones().collect();

    // A device with ≤82 zones answers in one packet. The wire message always
    // carries 82 colors; only the first colorsCount are zones.
    assert.equal(collector.add(stateExtendedColorZones(10, 0, 10), Type.StateExtendedColorZones), true);

    const zones = collector.result();
    assert.deepEqual(Object.keys(zones).sort(), ['colors', 'zoneIndex', 'zonesCount']);
    assert.equal(zones.zonesCount, 10);
    assert.equal(zones.zoneIndex, 0);
    assert.equal(zones.colors.length, 10);
    assert.deepEqual(zones.colors[0], zoneColor(0));
    assert.deepEqual(zones.colors.map((color) => color.hue), zoneHues(0, 10));
  });

  test('GetExtendedColorZones resolves a full 82-zone packet in one step', () => {
    const collector = Commands.GetExtendedColorZones().collect();
    assert.equal(collector.add(stateExtendedColorZones(82, 0, 82), Type.StateExtendedColorZones), true);
    assert.deepEqual(collector.result().colors.map((color) => color.hue), zoneHues(0, 82));
  });

  test('GetExtendedColorZones assembles a reply split across packets (more than 82 zones)', () => {
    const collector = Commands.GetExtendedColorZones().collect();

    // zones 0..81
    assert.equal(collector.add(stateExtendedColorZones(150, 0, 82), Type.StateExtendedColorZones), false);
    // zones 82..149: only 68 of the packet's 82 slots are meaningful
    assert.equal(collector.add(stateExtendedColorZones(150, 82, 68), Type.StateExtendedColorZones), true);

    const zones = collector.result();
    assert.equal(zones.zonesCount, 150);
    assert.equal(zones.zoneIndex, 0);
    assert.deepEqual(zones.colors.map((color) => color.hue), zoneHues(0, 150));
  });

  test('GetExtendedColorZones orders zones by index whatever order the packets arrive in', () => {
    const collector = Commands.GetExtendedColorZones().collect();

    assert.equal(collector.add(stateExtendedColorZones(150, 82, 68), Type.StateExtendedColorZones), false);
    assert.equal(collector.add(stateExtendedColorZones(150, 0, 82), Type.StateExtendedColorZones), true);
    assert.deepEqual(collector.result().colors.map((color) => color.hue), zoneHues(0, 150));
  });

  test('GetExtendedColorZones ignores a duplicate packet when counting zones', () => {
    const collector = Commands.GetExtendedColorZones().collect();

    assert.equal(collector.add(stateExtendedColorZones(150, 0, 82), Type.StateExtendedColorZones), false);
    // UDP can deliver the same packet twice; zones 82..149 are still outstanding.
    assert.equal(collector.add(stateExtendedColorZones(150, 0, 82), Type.StateExtendedColorZones), false);
    assert.equal(collector.add(stateExtendedColorZones(150, 82, 68), Type.StateExtendedColorZones), true);
    assert.equal(collector.result().colors.length, 150);
  });

  test('GetExtendedColorZones treats one packet as the whole reply for a device with at most 82 zones', () => {
    // Such a device answers with exactly one packet. Firmware that
    // under-reports colors_count must not leave the exchange waiting for a
    // second packet that will never come.
    const collector = Commands.GetExtendedColorZones().collect();
    assert.equal(collector.add(stateExtendedColorZones(10, 0, 4), Type.StateExtendedColorZones), true);
    const zones = collector.result();
    assert.equal(zones.zonesCount, 10);
    assert.deepEqual(zones.colors.map((color) => color.hue), zoneHues(0, 4));

    // The same holds with an observer attached (which skips the fast path).
    const observed = Commands.GetExtendedColorZones({ onResponse() {} }).collect();
    assert.equal(observed.add(stateExtendedColorZones(10, 0, 4), Type.StateExtendedColorZones), true);
    assert.deepEqual(observed.result().colors.map((color) => color.hue), zoneHues(0, 4));
  });

  test('GetExtendedColorZones waits for every zone of a multi-packet device, not for a packet count', () => {
    const collector = Commands.GetExtendedColorZones().collect();

    // A first packet that carries fewer colors than a full 82.
    assert.equal(collector.add(stateExtendedColorZones(100, 0, 40), Type.StateExtendedColorZones), false);
    assert.equal(collector.add(stateExtendedColorZones(100, 40, 60), Type.StateExtendedColorZones), true);
    assert.deepEqual(collector.result().colors.map((color) => color.hue), zoneHues(0, 100));
  });

  test('GetExtendedColorZones callback receives each packet as it arrives', () => {
    const receivedResponses: StateExtendedColorZones[] = [];
    const collector = Commands.GetExtendedColorZones({ onResponse: (response) => {
      receivedResponses.push(response);
    } }).collect();

    // Single response for ≤82 zones
    assert.equal(collector.add(stateExtendedColorZones(50, 0, 50), Type.StateExtendedColorZones), true);

    assert.equal(receivedResponses.length, 1);
    const packet = receivedResponses[0];
    assert.ok(packet);
    assert.equal(packet.zonesCount, 50);
    assert.equal(packet.zoneIndex, 0);
    assert.equal(packet.colors.length, 50);

    const zones = collector.result();
    assert.deepEqual(zones.colors.map((color) => color.hue), zoneHues(0, 50));
    // The result owns its color list: a callback that keeps (or edits) the
    // packet's list cannot change the resolved one.
    assert.notEqual(zones.colors, packet.colors);
  });

  test('GetExtendedColorZones callback can stop early', () => {
    const receivedResponses: StateExtendedColorZones[] = [];
    const collector = Commands.GetExtendedColorZones({ onResponse: (response) => {
      receivedResponses.push(response);
      return false; // Stop early
    } }).collect();

    // First response of a device with >82 zones
    assert.equal(collector.add(stateExtendedColorZones(150, 0, 82), Type.StateExtendedColorZones), true);

    assert.equal(receivedResponses.length, 1);
    const zones = collector.result();
    assert.equal(zones.zonesCount, 150);
    assert.equal(zones.zoneIndex, 0);
    assert.deepEqual(zones.colors.map((color) => color.hue), zoneHues(0, 82));
  });

  test('GetExtendedColorZones stopped early resolves with the zones up to the first one missing', () => {
    const collector = Commands.GetExtendedColorZones({ onResponse: () => false }).collect();

    // The second chunk arrived first, and the caller stopped there: zone 0
    // is missing, so nothing contiguous can be reported.
    assert.equal(collector.add(stateExtendedColorZones(150, 82, 68), Type.StateExtendedColorZones), true);
    assert.deepEqual(collector.result(), { zonesCount: 150, zoneIndex: 0, colors: [] });
  });

  test('GetExtendedColorZones ignores unknown response types', () => {
    const seen: StateExtendedColorZones[] = [];
    const collector = Commands.GetExtendedColorZones({ onResponse: (response) => {
      seen.push(response);
    } }).collect();

    assert.equal(collector.add(new Uint8Array(10), 999), false);
    assert.equal(seen.length, 0);
    assert.equal(collector.add(stateExtendedColorZones(3, 0, 3), Type.StateExtendedColorZones), true);
    assert.equal(collector.result().colors.length, 3);
  });

  test('GetExtendedColorZones rejects a truncated reply with DecodeError', () => {
    const collector = Commands.GetExtendedColorZones().collect();
    assert.throws(() => collector.add(new Uint8Array(100), Type.StateExtendedColorZones), DecodeError);
  });

  test('GetExtendedColorZones gives every collect() call its own accumulation state', () => {
    const cmd = Commands.GetExtendedColorZones();
    const first = cmd.collect();
    const second = cmd.collect();

    assert.equal(first.add(stateExtendedColorZones(150, 0, 82), Type.StateExtendedColorZones), false);
    // The second exchange has seen nothing yet: the tail alone does not finish it.
    assert.equal(second.add(stateExtendedColorZones(150, 82, 68), Type.StateExtendedColorZones), false);
    assert.equal(first.add(stateExtendedColorZones(150, 82, 68), Type.StateExtendedColorZones), true);
    assert.equal(second.add(stateExtendedColorZones(150, 0, 82), Type.StateExtendedColorZones), true);
    assert.equal(first.result().colors.length, 150);
    assert.equal(second.result().colors.length, 150);
    assert.notEqual(first.result().colors, second.result().colors);
  });

  test('SetExtendedColorZones', () => {
    const colors = [
      { hue: 120, saturation: 65535, brightness: 32768, kelvin: 3500 },
      { hue: 240, saturation: 32768, brightness: 65535, kelvin: 2700 }
    ];
    const cmd = Commands.SetExtendedColorZones({
      durationMs: 1000,
      apply: MultiZoneExtendedApplicationRequest.APPLY,
      zoneIndex: 0,
      colors,
    });
    assert.equal(cmd.type, Type.SetExtendedColorZones);
    assert.equal(cmd.payload.length, 664);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint32(0, true), 1000); // duration
    assert.equal(view.getUint8(4), MultiZoneExtendedApplicationRequest.APPLY); // apply
    assert.equal(view.getUint16(5, true), 0); // zoneIndex
    assert.equal(view.getUint8(7), 2); // colorsCount
    
    // Check first color
    assert.equal(view.getUint16(8, true), 120); // hue
    assert.equal(view.getUint16(10, true), 65535); // saturation
    assert.equal(view.getUint16(12, true), 32768); // brightness
    assert.equal(view.getUint16(14, true), 3500); // kelvin
    
    // Check second color
    assert.equal(view.getUint16(16, true), 240); // hue
    assert.equal(view.getUint16(18, true), 32768); // saturation
    assert.equal(view.getUint16(20, true), 65535); // brightness
    assert.equal(view.getUint16(22, true), 2700); // kelvin
  });

  test('SetUserPosition', () => {
    const cmd = Commands.SetUserPosition(1, 1.5, -2.7);
    assert.equal(cmd.type, Type.SetUserPosition);
    assert.equal(cmd.payload.length, 11);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 1); // tileIndex
    assert.equal(view.getUint8(1), 0); // reserved
    assert.equal(view.getUint8(2), 0); // reserved
    assert.equal(view.getFloat32(3, true), 1.5); // userX
    assert.ok(Math.abs(view.getFloat32(7, true) - (-2.7)) < 0.001); // userY (floating point comparison)
  });

  test('Set64', () => {
    const colors = Array.from({ length: 5 }, (_, i) => ({
      hue: i * 100,
      saturation: 65535,
      brightness: 32768,
      kelvin: 3500
    }));
    
    const cmd = Commands.Set64({ tileIndex: 0, tileCount: 8, x: 1, y: 2, width: 4, durationMs: 500, colors });
    assert.equal(cmd.type, Type.Set64);
    assert.equal(cmd.payload.length, 522);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 0); // tileIndex
    assert.equal(view.getUint8(1), 8); // length
    assert.equal(view.getUint8(2), 0); // reserved
    assert.equal(view.getUint8(3), 1); // x
    assert.equal(view.getUint8(4), 2); // y
    assert.equal(view.getUint8(5), 4); // width
    assert.equal(view.getUint32(6, true), 500); // duration
    
    // Check first few colors
    for (let i = 0; i < 5; i++) {
      const offset = 10 + (i * 8);
      assert.equal(view.getUint16(offset, true), i * 100); // hue
      assert.equal(view.getUint16(offset + 2, true), 65535); // saturation
      assert.equal(view.getUint16(offset + 4, true), 32768); // brightness
      assert.equal(view.getUint16(offset + 6, true), 3500); // kelvin
    }
  });

  test('GetTileEffect', () => {
    const cmd = Commands.GetTileEffect();
    assert.equal(cmd.type, Type.GetTileEffect);
    assert.equal(cmd.payload.length, 2);
    assert.equal(cmd.payload[0], 0); // reserved6
    assert.equal(cmd.payload[1], 0); // reserved7
  });

  test('SetTileEffect', () => {
    const palette = Array.from({ length: 3 }, (_, i) => ({
      hue: i * 120,
      saturation: 65535,
      brightness: 32768,
      kelvin: 3500
    }));
    
    const cmd = Commands.SetTileEffect({
      instanceId: 54321,
      effectType: TileEffectType.FLAME,
      speedMs: 8,
      durationNs: 5000n,
      skyType: TileEffectSkyType.SUNSET,
      cloudSaturationMin: 128,
      cloudSaturationMax: 200,
      palette,
    });
    
    assert.equal(cmd.type, Type.SetTileEffect);
    assert.equal(cmd.payload.length, 188);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 0); // reserved0
    assert.equal(view.getUint8(1), 0); // reserved1
    assert.equal(view.getUint32(2, true), 54321); // instanceId
    assert.equal(view.getUint8(6), TileEffectType.FLAME); // effectType
    assert.equal(view.getUint32(7, true), 8); // speed
    assert.equal(view.getBigUint64(11, true), 5000n); // duration
    assert.equal(view.getUint8(27), TileEffectSkyType.SUNSET); // skyType
    assert.equal(view.getUint8(31), 128); // cloudSaturationMin
    assert.equal(view.getUint8(35), 200); // cloudSaturationMax
    assert.equal(view.getUint8(59), 3); // paletteCount
    
    // Check first palette color
    assert.equal(view.getUint16(60, true), 0); // hue
    assert.equal(view.getUint16(62, true), 65535); // saturation
    assert.equal(view.getUint16(64, true), 32768); // brightness
    assert.equal(view.getUint16(66, true), 3500); // kelvin
  });

  test('SensorGetAmbientLight', () => {
    const cmd = Commands.SensorGetAmbientLight();
    assert.equal(cmd.type, Type.SensorGetAmbientLight);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('Get64 and Set64 default width to 8', () => {
    const get = Commands.Get64({ tileIndex: 1 });
    assert.equal(new DataView(get.payload.buffer).getUint8(5), 8);
    const set = Commands.Set64({ tileIndex: 1, colors: [] });
    assert.equal(new DataView(set.payload.buffer).getUint8(5), 8);
  });

  test('every single-packet command declares the State type of its response', () => {
    const pairs: [{ type: number; responseType?: number }, number][] = [
      [Commands.GetService(), Type.StateService],
      [Commands.GetPower(), Type.StatePower],
      [Commands.SetPower(true), Type.StatePower],
      [Commands.GetLabel(), Type.StateLabel],
      [Commands.SetLabel('x'), Type.StateLabel],
      [Commands.GetColor(), Type.LightState],
      [Commands.SetColor({ hue: 0, saturation: 0, brightness: 0, kelvin: 3500 }), Type.LightState],
      [Commands.EchoRequest(new Uint8Array(0)), Type.EchoResponse],
      [Commands.SetColorZones({ startIndex: 0, endIndex: 0, hue: 0, saturation: 0, brightness: 0, kelvin: 3500 }), Type.StateMultiZone],
      [Commands.GetExtendedColorZones(), Type.StateExtendedColorZones],
      [Commands.Get64({ tileIndex: 0 }), Type.State64],
      [Commands.GetRPower(0), Type.StateRPower],
      [Commands.GetButton(), Type.StateButton],
      [Commands.SensorGetAmbientLight(), Type.SensorStateAmbientLight],
    ];
    for (const [cmd, expected] of pairs) {
      assert.equal(cmd.responseType, expected, `type ${cmd.type}`);
    }
    // Two possible response types: the collector filters instead.
    assert.ok(!('responseType' in Commands.GetColorZones({ startIndex: 0, endIndex: 1 })));
    // No response packet at all.
    assert.ok(!('responseType' in Commands.SetReboot()));
    assert.ok(!('responseType' in Commands.Set64({ tileIndex: 0, colors: [] })));
  });

  test('color components are range-checked by their uint16 wire width', () => {
    const color = { hue: 0, saturation: 0, brightness: 0, kelvin: 3500 };
    // Each of these used to wrap silently: 70000 as hue 4464, -1 as full
    // brightness, NaN as kelvin 0.
    assertInvalid(() => Commands.SetColor({ ...color, hue: 70000 }), 'hue');
    assertInvalid(() => Commands.SetColor({ ...color, saturation: 65536 }), 'saturation');
    assertInvalid(() => Commands.SetColor({ ...color, brightness: -1 }), 'brightness');
    assertInvalid(() => Commands.SetColor({ ...color, kelvin: NaN }), 'kelvin');
    assert.throws(() => Commands.SetColor({ ...color, hue: 70000 }), /Invalid hue: 70000/);
    assert.throws(() => Commands.SetColor({ ...color, kelvin: NaN }), /Invalid kelvin: NaN/);

    // The bounds themselves are valid...
    const max = Commands.SetColor({ hue: 65535, saturation: 65535, brightness: 65535, kelvin: 65535 });
    assert.deepEqual(max.payload.subarray(1, 9), new Uint8Array(8).fill(0xFF));
    // ...and a computed, fractional magnitude is truncated, not rejected.
    const fractional = Commands.SetColor({ ...color, hue: 21845.9 });
    assert.equal(new DataView(fractional.payload.buffer).getUint16(1, true), 21845);

    // The same check guards every command that carries a color.
    assertInvalid(() => Commands.SetColorZones({ startIndex: 0, endIndex: 7, ...color, brightness: 65536 }), 'brightness');
    assertInvalid(() => Commands.SetWaveform({ ...color, hue: -1, periodMs: 1000, cycles: 1, waveform: Waveform.SINE }), 'hue');
    assertInvalid(() => Commands.SetWaveformOptional({ kelvin: 70000, periodMs: 1000, cycles: 1, waveform: Waveform.SINE }), 'kelvin');
    assertInvalid(() => Commands.SetExtendedColorZones({ zoneIndex: 0, colors: [color, { ...color, hue: 70000 }] }), 'hue');
    assertInvalid(() => Commands.Set64({ tileIndex: 0, colors: [{ ...color, brightness: -1 }] }), 'brightness');
    assertInvalid(() => Commands.SetTileEffect({ instanceId: 1, effectType: TileEffectType.MORPH, speedMs: 1, durationNs: 0n, palette: [{ ...color, saturation: NaN }] }), 'saturation');
  });

  test('power levels are range-checked by their uint16 wire width', () => {
    assertInvalid(() => Commands.SetPower(70000), 'power');
    assertInvalid(() => Commands.SetPower(-1), 'power');
    assertInvalid(() => Commands.SetLightPower(65536), 'level');
    assertInvalid(() => Commands.SetRPower(0, 70000), 'level');
    assertInvalid(() => Commands.SetInfrared(-1), 'brightness');
    assert.equal(Commands.SetInfrared(65535).payload.length, 2);
  });

  test('indices, counts, and enum values must be integers within their uint8 wire width', () => {
    const color = { hue: 0, saturation: 0, brightness: 0, kelvin: 3500 };
    // 300 used to encode as zone 44 — while GetColorZones already rejected it.
    assertInvalid(() => Commands.SetColorZones({ startIndex: 300, endIndex: 7, ...color }), 'startIndex');
    assert.throws(() => Commands.SetColorZones({ startIndex: 300, endIndex: 7, ...color }), /Invalid startIndex: 300/);
    assertInvalid(() => Commands.SetColorZones({ startIndex: 0, endIndex: 1.5, ...color }), 'endIndex');
    assertInvalid(() => Commands.SetColorZones({ startIndex: 0, endIndex: -1, ...color }), 'endIndex');
    assertInvalid(() => Commands.GetRPower(256), 'relayIndex');
    assertInvalid(() => Commands.SetRPower(-1, true), 'relayIndex');
    assertInvalid(() => Commands.SetUserPosition(256, 0, 0), 'tileIndex');
    assertInvalid(() => Commands.Set64({ tileIndex: 256, colors: [] }), 'tileIndex');
    assertInvalid(() => Commands.Set64({ tileIndex: 0, tileCount: 0.5, colors: [] }), 'tileCount');
    assertInvalid(() => Commands.Set64({ tileIndex: 0, x: 256, colors: [] }), 'x');
    assertInvalid(() => Commands.Set64({ tileIndex: 0, y: -1, colors: [] }), 'y');
    assertInvalid(() => Commands.Set64({ tileIndex: 0, width: 300, colors: [] }), 'width');
    assertInvalid(() => Commands.Get64({ tileIndex: 0, x: 256 }), 'x');
    assertInvalid(() => Commands.SetExtendedColorZones({ zoneIndex: 70000, colors: [color] }), 'zoneIndex');
    assertInvalid(() => Commands.SetExtendedColorZones({ zoneIndex: 1.5, colors: [color] }), 'zoneIndex');
    // The limits are accepted.
    assert.equal(Commands.SetColorZones({ startIndex: 255, endIndex: 255, ...color }).payload[0], 255);
    assert.equal(Commands.GetRPower(255).payload[0], 255);
  });

  test('waveform fields are validated by their wire types', () => {
    const base = { hue: 0, saturation: 0, brightness: 0, kelvin: 3500, periodMs: 1000, cycles: 1, waveform: Waveform.SINE };
    // skewRatio is a signed 16-bit field.
    assertInvalid(() => Commands.SetWaveform({ ...base, skewRatio: 40000 }), 'skewRatio');
    assertInvalid(() => Commands.SetWaveform({ ...base, skewRatio: -32769 }), 'skewRatio');
    const skewed = Commands.SetWaveform({ ...base, skewRatio: -32768 });
    assert.equal(new DataView(skewed.payload.buffer).getInt16(18, true), -32768);
    // cycles is a float32: any finite number, but not NaN or Infinity.
    assertInvalid(() => Commands.SetWaveform({ ...base, cycles: NaN }), 'cycles');
    assertInvalid(() => Commands.SetWaveform({ ...base, cycles: Infinity }), 'cycles');
    assert.equal(new DataView(Commands.SetWaveform({ ...base, cycles: 2.5 }).payload.buffer).getFloat32(14, true), 2.5);
    assertInvalid(() => Commands.SetWaveform({ ...base, periodMs: -1 }), 'periodMs');
    assertInvalid(() => Commands.SetWaveformOptional({ periodMs: 2 ** 32, cycles: 1, waveform: Waveform.SINE }), 'periodMs');
    assertInvalid(() => Commands.SetUserPosition(0, NaN, 0), 'userX');
    assertInvalid(() => Commands.SetUserPosition(0, 0, Infinity), 'userY');
  });

  test('time fields are named for their unit and range-checked', () => {
    const color = { hue: 0, saturation: 0, brightness: 0, kelvin: 3500 };
    assertInvalid(() => Commands.SetColor({ ...color, durationMs: -1 }), 'durationMs');
    assertInvalid(() => Commands.SetLightPower(true, -1), 'durationMs');
    assertInvalid(() => Commands.SetColorZones({ startIndex: 0, endIndex: 0, ...color, durationMs: NaN }), 'durationMs');
    assertInvalid(() => Commands.SetExtendedColorZones({ zoneIndex: 0, colors: [color], durationMs: 2 ** 32 }), 'durationMs');
    assertInvalid(() => Commands.Set64({ tileIndex: 0, colors: [], durationMs: -1 }), 'durationMs');
    assertInvalid(() => Commands.SetMultiZoneEffect({ instanceId: 1, effectType: MultiZoneEffectType.MOVE, speedMs: -1, durationNs: 0n }), 'speedMs');
    assertInvalid(() => Commands.SetMultiZoneEffect({ instanceId: 1, effectType: MultiZoneEffectType.MOVE, speedMs: 1, durationNs: -1n }), 'durationNs');
    assertInvalid(() => Commands.SetTileEffect({ instanceId: 1, effectType: TileEffectType.MORPH, speedMs: 2 ** 32, durationNs: 0n, palette: [] }), 'speedMs');
    assertInvalid(() => Commands.SetTileEffect({ instanceId: 1, effectType: TileEffectType.MORPH, speedMs: 1, durationNs: 2n ** 64n, palette: [] }), 'durationNs');
    assertInvalid(() => Commands.SetHevCycle(true, -1), 'durationSeconds');

    // Omitted durations still default to 0 (immediate).
    assert.equal(new DataView(Commands.SetColor(color).payload.buffer).getUint32(9, true), 0);
    assert.equal(new DataView(Commands.SetLightPower(true).payload.buffer).getUint32(2, true), 0);
  });

  test('SetMultiZoneEffect zero-pads short parameters and rejects more than 32 bytes', () => {
    const effect = { instanceId: 1, effectType: MultiZoneEffectType.MOVE, speedMs: 5, durationNs: 0n };

    const short = Commands.SetMultiZoneEffect({ ...effect, parameters: new Uint8Array(8).fill(0xAB) });
    assert.deepEqual(short.payload.subarray(27, 35), new Uint8Array(8).fill(0xAB));
    assert.deepEqual(short.payload.subarray(35, 59), new Uint8Array(24));

    // Omitted: all zeros.
    assert.deepEqual(Commands.SetMultiZoneEffect(effect).payload.subarray(27, 59), new Uint8Array(32));

    // A longer block used to be silently truncated to 32 bytes.
    assertInvalid(() => Commands.SetMultiZoneEffect({ ...effect, parameters: new Uint8Array(33) }), 'parameters');
    assertInvalid(() => Commands.SetMultiZoneEffect({ ...effect, instanceId: -1 }), 'instanceId');
  });

  test('color lists are bounded by their wire capacity', () => {
    const color = { hue: 1, saturation: 2, brightness: 3, kelvin: 3500 };
    const colors = (count: number) => Array.from({ length: count }, () => color);

    assertInvalid(() => Commands.SetExtendedColorZones({ zoneIndex: 0, colors: [] }), 'colors');
    assertInvalid(() => Commands.SetExtendedColorZones({ zoneIndex: 0, colors: colors(83) }), 'colors');
    const full = Commands.SetExtendedColorZones({ zoneIndex: 0, colors: colors(82) });
    assert.equal(full.payload[7], 82); // colors_count
    assert.equal(new DataView(full.payload.buffer).getUint16(8 + 81 * 8, true), 1);

    assertInvalid(() => Commands.Set64({ tileIndex: 0, colors: colors(65) }), 'colors');
    const frame = Commands.Set64({ tileIndex: 0, colors: colors(64) });
    assert.equal(new DataView(frame.payload.buffer).getUint16(10 + 63 * 8, true), 1);

    assertInvalid(() => Commands.SetTileEffect({ instanceId: 1, effectType: TileEffectType.MORPH, speedMs: 1, durationNs: 0n, palette: colors(17) }), 'palette');
    const effect = Commands.SetTileEffect({ instanceId: 1, effectType: TileEffectType.MORPH, speedMs: 1, durationNs: 0n, palette: colors(16) });
    assert.equal(effect.payload[59], 16); // palette_count
    assertInvalid(() => Commands.SetTileEffect({ instanceId: 1, effectType: TileEffectType.SKY, speedMs: 1, durationNs: 0n, cloudSaturationMax: 256, palette: [] }), 'cloudSaturationMax');
    assertInvalid(() => Commands.SetTileEffect({ instanceId: 1, effectType: TileEffectType.SKY, speedMs: 1, durationNs: 0n, cloudSaturationMin: -1, palette: [] }), 'cloudSaturationMin');
  });
});
