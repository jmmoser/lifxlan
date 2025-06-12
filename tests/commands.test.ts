import { describe, test } from 'bun:test';
import assert from 'node:assert';
import * as Commands from '../src/commands/index.js';
import { Type, Waveform, MultiZoneApplicationRequest, MultiZoneExtendedApplicationRequest, MultiZoneEffectType, TileEffectType, TileEffectSkyType } from '../src/constants/index.js';
import { State64, StateExtendedColorZones } from '../src/encoding.js';

describe('commands', () => {
  test('GetServiceCommand', () => {
    const cmd = Commands.GetServiceCommand();
    assert.equal(cmd.type, Type.GetService);
    assert.ok(!('payload' in cmd));
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetHostFirmwareCommand', () => {
    const cmd = Commands.GetHostFirmwareCommand();
    assert.equal(cmd.type, Type.GetHostFirmware);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetWifiInfoCommand', () => {
    const cmd = Commands.GetWifiInfoCommand();
    assert.equal(cmd.type, Type.GetWifiInfo);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetWifiFirmwareCommand', () => {
    const cmd = Commands.GetWifiFirmwareCommand();
    assert.equal(cmd.type, Type.GetWifiFirmware);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetPowerCommand with boolean true', () => {
    const cmd = Commands.SetPowerCommand(true);
    assert.equal(cmd.type, Type.SetPower);
    assert.equal(cmd.payload.length, 2);
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint16(0, true), 65535);
  });

  test('SetPowerCommand with boolean false', () => {
    const cmd = Commands.SetPowerCommand(false);
    assert.equal(cmd.type, Type.SetPower);
    assert.equal(cmd.payload.length, 2);
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint16(0, true), 0);
  });

  test('SetPowerCommand with number', () => {
    const cmd = Commands.SetPowerCommand(32768);
    assert.equal(cmd.type, Type.SetPower);
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint16(0, true), 32768);
  });

  test('GetLabelCommand', () => {
    const cmd = Commands.GetLabelCommand();
    assert.equal(cmd.type, Type.GetLabel);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetLabelCommand', () => {
    const cmd = Commands.SetLabelCommand('Test Label');
    assert.equal(cmd.type, Type.SetLabel);
    assert.equal(cmd.payload.length, 32);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetVersionCommand', () => {
    const cmd = Commands.GetVersionCommand();
    assert.equal(cmd.type, Type.GetVersion);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetInfoCommand', () => {
    const cmd = Commands.GetInfoCommand();
    assert.equal(cmd.type, Type.GetInfo);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetRebootCommand', () => {
    const cmd = Commands.SetRebootCommand();
    assert.equal(cmd.type, Type.SetReboot);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetLocationCommand', () => {
    const cmd = Commands.GetLocationCommand();
    assert.equal(cmd.type, Type.GetLocation);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetLocationCommand with string UUID', () => {
    const uuid = '4e0352bf-1994-4ff2-b425-1c4455479f33';
    const label = 'Living Room';
    const updatedAt = new Date('2023-01-01T00:00:00Z');
    
    const cmd = Commands.SetLocationCommand(uuid, label, updatedAt);
    assert.equal(cmd.type, Type.SetLocation);
    assert.equal(cmd.payload.length, 56);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetLocationCommand with Uint8Array UUID', () => {
    const uuid = new Uint8Array([0x4e, 0x03, 0x52, 0xbf, 0x19, 0x94, 0x4f, 0xf2, 0xb4, 0x25, 0x1c, 0x44, 0x55, 0x47, 0x9f, 0x33]);
    const label = 'Kitchen';
    const updatedAt = new Date('2023-01-01T00:00:00Z');
    
    const cmd = Commands.SetLocationCommand(uuid, label, updatedAt);
    assert.equal(cmd.type, Type.SetLocation);
    assert.equal(cmd.payload.length, 56);
    assert.deepEqual(cmd.payload.subarray(0, 16), uuid);
  });

  test('GetGroupCommand', () => {
    const cmd = Commands.GetGroupCommand();
    assert.equal(cmd.type, Type.GetGroup);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetGroupCommand with string UUID', () => {
    const uuid = '4e0352bf-1994-4ff2-b425-1c4455479f33';
    const label = 'Bedroom Lights';
    const updatedAt = new Date('2023-01-01T00:00:00Z');
    
    const cmd = Commands.SetGroupCommand(uuid, label, updatedAt);
    assert.equal(cmd.type, Type.SetGroup);
    assert.equal(cmd.payload.length, 56);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetGroupCommand with Uint8Array UUID', () => {
    const uuid = new Uint8Array([0x4e, 0x03, 0x52, 0xbf, 0x19, 0x94, 0x4f, 0xf2, 0xb4, 0x25, 0x1c, 0x44, 0x55, 0x47, 0x9f, 0x33]);
    const label = 'Kitchen Lights';
    const updatedAt = new Date('2023-01-01T00:00:00Z');
    
    const cmd = Commands.SetGroupCommand(uuid, label, updatedAt);
    assert.equal(cmd.type, Type.SetGroup);
    assert.equal(cmd.payload.length, 56);
    assert.deepEqual(cmd.payload.subarray(0, 16), uuid);
  });

  test('EchoRequestCommand', () => {
    const echoing = new Uint8Array([1, 2, 3, 4, 5]);
    const cmd = Commands.EchoRequestCommand(echoing);
    assert.equal(cmd.type, Type.EchoRequest);
    assert.equal(cmd.payload.length, 64);
    assert.deepEqual(cmd.payload.subarray(0, 5), echoing);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetColorCommand', () => {
    const cmd = Commands.GetColorCommand();
    assert.equal(cmd.type, Type.GetColor);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetColorCommand', () => {
    const cmd = Commands.SetColorCommand(120, 65535, 32768, 3500, 1000);
    assert.equal(cmd.type, Type.SetColor);
    assert.ok(cmd.payload instanceof Uint8Array);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetWaveformCommand', () => {
    const cmd = Commands.SetWaveformCommand(
      true, // transient
      120, // hue
      65535, // saturation
      32768, // brightness
      3500, // kelvin
      1000, // period
      5, // cycles
      0, // skewRatio
      Waveform.SINE
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

  test('GetLightPowerCommand', () => {
    const cmd = Commands.GetLightPowerCommand();
    assert.equal(cmd.type, Type.GetLightPower);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetLightPowerCommand with boolean', () => {
    const cmd = Commands.SetLightPowerCommand(true, 1000);
    assert.equal(cmd.type, Type.SetLightPower);
    assert.equal(cmd.payload.length, 6);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint16(0, true), 65535);
    assert.equal(view.getUint32(2, true), 1000);
  });

  test('SetLightPowerCommand with number', () => {
    const cmd = Commands.SetLightPowerCommand(32768, 500);
    assert.equal(cmd.type, Type.SetLightPower);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint16(0, true), 32768);
    assert.equal(view.getUint32(2, true), 500);
  });

  test('SetWaveformOptionalCommand', () => {
    const cmd = Commands.SetWaveformOptionalCommand(
      false, // transient
      240, // hue
      32768, // saturation
      65535, // brightness
      2700, // kelvin
      2000, // period
      3, // cycles
      -100, // skewRatio
      Waveform.TRIANGLE,
      true, // setHue
      false, // setSaturation
      true, // setBrightness
      false // setKelvin
    );
    
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
  });

  test('GetInfraredCommand', () => {
    const cmd = Commands.GetInfraredCommand();
    assert.equal(cmd.type, Type.GetInfrared);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetInfraredCommand', () => {
    const cmd = Commands.SetInfraredCommand(32768);
    assert.equal(cmd.type, Type.SetInfrared);
    assert.equal(cmd.payload.length, 2);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint16(0, true), 32768);
  });

  test('GetHevCycleCommand', () => {
    const cmd = Commands.GetHevCycleCommand();
    assert.equal(cmd.type, Type.GetHevCycle);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetHevCycleCommand', () => {
    const cmd = Commands.SetHevCycleCommand(true, 3600);
    assert.equal(cmd.type, Type.SetHevCycle);
    assert.equal(cmd.payload.length, 5);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 1);
    assert.equal(view.getUint32(1, true), 3600);
  });

  test('GetHevCycleConfigurationCommand', () => {
    const cmd = Commands.GetHevCycleConfigurationCommand();
    assert.equal(cmd.type, Type.GetHevCycleConfiguration);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetHevCycleConfigurationCommand', () => {
    const cmd = Commands.SetHevCycleConfigurationCommand(false, 1800);
    assert.equal(cmd.type, Type.SetHevCycleConfiguration);
    assert.equal(cmd.payload.length, 5);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 0);
    assert.equal(view.getUint32(1, true), 1800);
  });

  test('GetLastHevCycleResultCommand', () => {
    const cmd = Commands.GetLastHevCycleResultCommand();
    assert.equal(cmd.type, Type.GetLastHevCycleResult);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetRPowerCommand', () => {
    const cmd = Commands.GetRPowerCommand(2);
    assert.equal(cmd.type, Type.GetRPower);
    assert.equal(cmd.payload.length, 1);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 2);
  });

  test('SetRPowerCommand', () => {
    const cmd = Commands.SetRPowerCommand(1, 65535);
    assert.equal(cmd.type, Type.SetRPower);
    assert.equal(cmd.payload.length, 3);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 1);
    assert.equal(view.getUint16(1, true), 65535);
  });

  test('GetDeviceChainCommand', () => {
    const cmd = Commands.GetDeviceChainCommand();
    assert.equal(cmd.type, Type.GetDeviceChain);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('Get64Command', () => {
    const cmd = Commands.Get64Command(0, 8, 2, 3, 4);
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

  test('Get64Command with callback', () => {
    const cmd = Commands.Get64Command(0, 3, 0, 0, 8);
    assert.equal(cmd.type, Type.Get64);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('Get64Command decode handles State64 responses', () => {
    const cmd = Commands.Get64Command(0, 2, 0, 0, 8);
    
    // Mock State64 response (Type.State64 = 711)
    const state64Bytes = new Uint8Array(36 + 5 + 64 * 8); // header + basic payload + 64 colors
    const view = new DataView(state64Bytes.buffer);
    view.setUint16(32, Type.State64, true); // message type
    
    // State64 payload: tile_index, reserved6, x, y, width, colors[64]
    view.setUint8(36, 0); // tile_index
    view.setUint8(37, 0); // reserved6
    view.setUint8(38, 0); // x
    view.setUint8(39, 0); // y
    view.setUint8(40, 8); // width
    
    // Add some color data (64 colors)
    for (let i = 0; i < 64; i++) {
      const colorOffset = 41 + (i * 8);
      view.setUint16(colorOffset, 120 + i, true); // hue
      view.setUint16(colorOffset + 2, 65535, true); // saturation
      view.setUint16(colorOffset + 4, 32768, true); // brightness
      view.setUint16(colorOffset + 6, 3500, true); // kelvin
    }
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const result = cmd.decode(state64Bytes, offsetRef, continuation, Type.State64);
    
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 1);
    const tile = result[0];
    assert.equal(tile.tile_index, 0);
    assert.equal(tile.colors.length, 64);
    assert.equal(tile.colors[0].hue, 120);
    assert.equal(continuation.expectMore, true); // Should expect more tiles (0, 1)
  });

  test('Get64Command callback receives responses', () => {
    const receivedResponses: State64[] = [];
    const cmd = Commands.Get64Command(0, 2, 0, 0, 8, (response) => {
      receivedResponses.push(response);
    });
    
    // Mock State64 response for tile 0
    const state64Bytes = new Uint8Array(36 + 5 + 64 * 8);
    const view = new DataView(state64Bytes.buffer);
    view.setUint16(32, Type.State64, true);
    view.setUint8(36, 0); // tile_index
    view.setUint8(37, 0); // reserved6
    view.setUint8(38, 0); // x
    view.setUint8(39, 0); // y
    view.setUint8(40, 8); // width
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    cmd.decode(state64Bytes, offsetRef, continuation, Type.State64);
    
    assert.equal(receivedResponses.length, 1);
    assert.equal(receivedResponses[0].tile_index, 0);
    assert.equal(continuation.expectMore, true); // Still expecting tile 1
  });

  test('Get64Command callback can stop early', () => {
    const receivedResponses: State64[] = [];
    
    const cmd = Commands.Get64Command(0, 3, 0, 0, 8, (response) => {
      receivedResponses.push(response);
      return false; // Stop early
    });
    
    // Mock State64 response for tile 0
    const state64Bytes = new Uint8Array(36 + 5 + 64 * 8);
    const view = new DataView(state64Bytes.buffer);
    view.setUint16(32, Type.State64, true);
    view.setUint8(36, 0); // tile_index
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    cmd.decode(state64Bytes, offsetRef, continuation, Type.State64);
    
    assert.equal(receivedResponses.length, 1);
    assert.equal(continuation.expectMore, false); // Stopped early due to callback returning false
  });

  test('Get64Command accumulates responses correctly', () => {
    const cmd = Commands.Get64Command(0, 2, 0, 0, 8);
    
    // First call should return array with 1 item
    const state64Bytes1 = new Uint8Array(36 + 5 + 64 * 8);
    let view = new DataView(state64Bytes1.buffer);
    view.setUint16(32, Type.State64, true);
    view.setUint8(36, 0); // tile_index
    
    let offsetRef = { current: 36 };
    let continuation = { expectMore: false };
    
    let result1 = cmd.decode(state64Bytes1, offsetRef, continuation, Type.State64);
    assert.equal(result1.length, 1);
    assert.equal(continuation.expectMore, true);
    
    // Second call should return array with 2 items (accumulated)
    const state64Bytes2 = new Uint8Array(36 + 5 + 64 * 8);
    view = new DataView(state64Bytes2.buffer);
    view.setUint16(32, Type.State64, true);
    view.setUint8(36, 1); // tile_index
    
    offsetRef = { current: 36 };
    continuation = { expectMore: false };
    
    let result2 = cmd.decode(state64Bytes2, offsetRef, continuation, Type.State64);
    assert.equal(result2.length, 2);
    assert.equal(result2[0].tile_index, 0);
    assert.equal(result2[1].tile_index, 1);
    assert.equal(continuation.expectMore, false); // Complete
  });

  test('Get64Command ignores unknown response types', () => {
    const cmd = Commands.Get64Command(0, 1, 0, 0, 8);
    
    // Mock unknown response type
    const unknownBytes = new Uint8Array(36 + 10);
    const view = new DataView(unknownBytes.buffer);
    view.setUint16(32, 999, true); // Unknown message type
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const result = cmd.decode(unknownBytes, offsetRef, continuation, 999);
    
    assert.equal(result.length, 0); // No responses added
    assert.equal(continuation.expectMore, true); // Still expecting responses
  });

  test('GetColorZonesCommand basic usage without callback', () => {
    const cmd = Commands.GetColorZonesCommand(0, 15);
    assert.equal(cmd.type, Type.GetColorZones);
    assert.equal(cmd.payload.length, 2);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 0);
    assert.equal(view.getUint8(1), 15);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetColorZonesCommand with callback', () => {
    const responses: Commands.ColorZoneResponse[] = [];
    const cmd = Commands.GetColorZonesCommand(0, 3, (response) => {
      responses.push(response);
    });
    assert.equal(cmd.type, Type.GetColorZones);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetColorZonesCommand decode handles StateZone responses', () => {
    const cmd = Commands.GetColorZonesCommand(0, 2);
    
    // Mock StateZone response (Type.StateZone = 503)
    const stateZoneBytes = new Uint8Array(36 + 13); // header + payload
    const view = new DataView(stateZoneBytes.buffer);
    view.setUint16(32, Type.StateZone, true); // message type
    
    // StateZone payload: zones_count, zone_index, hue, saturation, brightness, kelvin
    view.setUint8(36, 3); // zones_count
    view.setUint8(37, 0); // zone_index
    view.setUint16(38, 120, true); // hue
    view.setUint16(40, 65535, true); // saturation
    view.setUint16(42, 32768, true); // brightness
    view.setUint16(44, 3500, true); // kelvin
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const result = cmd.decode(stateZoneBytes, offsetRef, continuation, Type.StateZone);
    
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 1);
    const zone = result[0];
    assert.equal(zone.zone_index, 0);
    assert.ok('hue' in zone);
    assert.equal(zone.hue, 120);
    assert.equal(continuation.expectMore, true); // Should expect more zones (0, 1, 2)
  });

  test('GetColorZonesCommand decode handles StateMultiZone responses', () => {
    const cmd = Commands.GetColorZonesCommand(0, 2);
    
    // Mock StateMultiZone response (Type.StateMultiZone = 506)
    // StateMultiZone always contains 8 colors (fixed size)
    const stateMultiZoneBytes = new Uint8Array(36 + 2 + 8 * 8); // header + basic payload + 8 colors
    const view = new DataView(stateMultiZoneBytes.buffer);
    view.setUint16(32, Type.StateMultiZone, true); // message type
    
    // StateMultiZone payload
    view.setUint8(36, 3); // zones_count
    view.setUint8(37, 0); // zone_index
    
    // 8 colors (StateMultiZone always has 8 colors)
    for (let i = 0; i < 8; i++) {
      const colorOffset = 38 + (i * 8);
      view.setUint16(colorOffset, 120 + (i * 40), true); // hue
      view.setUint16(colorOffset + 2, 65535, true); // saturation
      view.setUint16(colorOffset + 4, 32768, true); // brightness
      view.setUint16(colorOffset + 6, 3500, true); // kelvin
    }
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const result = cmd.decode(stateMultiZoneBytes, offsetRef, continuation, Type.StateMultiZone);
    
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 1);
    const zone = result[0];
    assert.equal(zone.zone_index, 0);
    assert.ok('colors' in zone);
    assert.equal(zone.colors.length, 8);
    assert.equal(continuation.expectMore, false); // All zones covered (0-7, more than we requested 0-2)
  });

  test('GetColorZonesCommand callback receives responses', () => {
    const receivedResponses: Commands.ColorZoneResponse[] = [];
    const cmd = Commands.GetColorZonesCommand(0, 1, (response) => {
      receivedResponses.push(response);
    });
    
    // Mock StateZone response for zone 0
    const stateZoneBytes = new Uint8Array(36 + 13);
    const view = new DataView(stateZoneBytes.buffer);
    view.setUint16(32, Type.StateZone, true);
    view.setUint8(36, 2); // zones_count
    view.setUint8(37, 0); // zone_index
    view.setUint16(38, 120, true); // hue
    view.setUint16(40, 65535, true); // saturation
    view.setUint16(42, 32768, true); // brightness
    view.setUint16(44, 3500, true); // kelvin
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    cmd.decode(stateZoneBytes, offsetRef, continuation, Type.StateZone);
    
    assert.equal(receivedResponses.length, 1);
    const res = receivedResponses[0];
    assert.equal(res.zone_index, 0);
    assert.ok('hue' in res);
    assert.equal(res.hue, 120);
    assert.equal(continuation.expectMore, true); // Still expecting zone 1
  });

  test('GetColorZonesCommand callback can stop early', () => {
    const receivedResponses: Commands.ColorZoneResponse[] = [];
    
    const cmd = Commands.GetColorZonesCommand(0, 5, (response) => {
      receivedResponses.push(response);
      return false; // Stop early
    });
    
    // Mock StateZone response for zone 0
    const stateZoneBytes = new Uint8Array(36 + 13);
    const view = new DataView(stateZoneBytes.buffer);
    view.setUint16(32, Type.StateZone, true);
    view.setUint8(36, 6); // zones_count
    view.setUint8(37, 0); // zone_index
    view.setUint16(38, 120, true); // hue
    view.setUint16(40, 65535, true); // saturation
    view.setUint16(42, 32768, true); // brightness
    view.setUint16(44, 3500, true); // kelvin
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    cmd.decode(stateZoneBytes, offsetRef, continuation, Type.StateZone);
    
    assert.equal(receivedResponses.length, 1);
    assert.equal(continuation.expectMore, false); // Stopped early due to callback returning false
  });


  test('GetColorZonesCommand accumulates responses correctly', () => {
    const cmd = Commands.GetColorZonesCommand(0, 2);
    
    // First call should return array with 1 item
    const stateZoneBytes1 = new Uint8Array(36 + 13);
    let view = new DataView(stateZoneBytes1.buffer);
    view.setUint16(32, Type.StateZone, true);
    view.setUint8(36, 3); // zones_count
    view.setUint8(37, 0); // zone_index
    
    let offsetRef = { current: 36 };
    let continuation = { expectMore: false };
    
    let result1 = cmd.decode(stateZoneBytes1, offsetRef, continuation, Type.StateZone);
    assert.equal(result1.length, 1);
    assert.equal(continuation.expectMore, true);
    
    // Second call should return array with 2 items (accumulated)
    const stateZoneBytes2 = new Uint8Array(36 + 13);
    view = new DataView(stateZoneBytes2.buffer);
    view.setUint16(32, Type.StateZone, true);
    view.setUint8(36, 3); // zones_count
    view.setUint8(37, 1); // zone_index
    
    offsetRef = { current: 36 };
    continuation = { expectMore: false };
    
    let result2 = cmd.decode(stateZoneBytes2, offsetRef, continuation, Type.StateZone);
    assert.equal(result2.length, 2);
    assert.equal(result2[0].zone_index, 0);
    assert.equal(result2[1].zone_index, 1);
    assert.equal(continuation.expectMore, true); // Still need zone 2
    
    // Third call should return array with 3 items and be complete
    const stateZoneBytes3 = new Uint8Array(36 + 13);
    view = new DataView(stateZoneBytes3.buffer);
    view.setUint16(32, Type.StateZone, true);
    view.setUint8(36, 3); // zones_count
    view.setUint8(37, 2); // zone_index
    
    offsetRef = { current: 36 };
    continuation = { expectMore: false };
    
    let result3 = cmd.decode(stateZoneBytes3, offsetRef, continuation, Type.StateZone);
    assert.equal(result3.length, 3);
    assert.equal(result3[2].zone_index, 2);
    assert.equal(continuation.expectMore, false); // Complete
  });

  test('GetColorZonesCommand ignores unknown response types', () => {
    const cmd = Commands.GetColorZonesCommand(0, 1);
    
    // Mock unknown response type
    const unknownBytes = new Uint8Array(36 + 10);
    const view = new DataView(unknownBytes.buffer);
    view.setUint16(32, 999, true); // Unknown message type
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const result = cmd.decode(unknownBytes, offsetRef, continuation, 999);
    
    assert.equal(result.length, 0); // No responses added
    assert.equal(continuation.expectMore, true); // Still expecting responses
  });

  test('SetColorZonesCommand', () => {
    const cmd = Commands.SetColorZonesCommand(0, 7, 120, 65535, 32768, 3500, 1000, MultiZoneApplicationRequest.APPLY);
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

  test('GetMultiZoneEffectCommand', () => {
    const cmd = Commands.GetMultiZoneEffectCommand();
    assert.equal(cmd.type, Type.GetMultiZoneEffect);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('SetMultiZoneEffectCommand', () => {
    const parameters = new Uint8Array(32).fill(0xAB);
    const cmd = Commands.SetMultiZoneEffectCommand(12345, MultiZoneEffectType.MOVE, 5, 10000n, parameters);
    assert.equal(cmd.type, Type.SetMultiZoneEffect);
    assert.equal(cmd.payload.length, 59);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint32(0, true), 12345); // instanceid
    assert.equal(view.getUint8(4), MultiZoneEffectType.MOVE); // effectType
    assert.equal(view.getUint8(5), 0); // reserved
    assert.equal(view.getUint8(6), 0); // reserved
    assert.equal(view.getUint32(7, true), 5); // speed
    assert.equal(view.getBigUint64(11, true), 10000n); // duration
    assert.deepEqual(cmd.payload.subarray(27, 59), parameters); // parameters
  });

  test('GetExtendedColorZonesCommand', () => {
    const cmd = Commands.GetExtendedColorZonesCommand();
    assert.equal(cmd.type, Type.GetExtendedColorZones);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetExtendedColorZonesCommand with callback', () => {
    const cmd = Commands.GetExtendedColorZonesCommand();
    assert.equal(cmd.type, Type.GetExtendedColorZones);
    assert.equal(typeof cmd.decode, 'function');
  });

  test('GetExtendedColorZonesCommand decode handles StateExtendedColorZones responses for single response', () => {
    const cmd = Commands.GetExtendedColorZonesCommand();
    
    // Mock StateExtendedColorZones response (Type.StateExtendedColorZones = 512)
    // Single response for device with ≤82 zones - decoder always reads 82 colors
    const stateExtendedBytes = new Uint8Array(36 + 5 + 82 * 8); // header + basic payload + 82 colors
    const view = new DataView(stateExtendedBytes.buffer);
    view.setUint16(32, Type.StateExtendedColorZones, true); // message type
    
    // StateExtendedColorZones payload: zones_count, zone_index, colors_count, colors[82]
    view.setUint16(36, 10, true); // zones_count (≤82, so single response)
    view.setUint16(38, 0, true); // zone_index
    view.setUint8(40, 10); // colors_count
    
    // Add color data (must always be 82 colors as per decoder implementation)
    for (let i = 0; i < 82; i++) {
      const colorOffset = 41 + (i * 8);
      view.setUint16(colorOffset, 120 + i * 10, true); // hue
      view.setUint16(colorOffset + 2, 65535, true); // saturation
      view.setUint16(colorOffset + 4, 32768, true); // brightness
      view.setUint16(colorOffset + 6, 3500, true); // kelvin
    }
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const result = cmd.decode(stateExtendedBytes, offsetRef, continuation, Type.StateExtendedColorZones);
    
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 1);
    const zones = result[0];
    assert.equal(zones.zones_count, 10);
    assert.equal(zones.zone_index, 0);
    assert.equal(zones.colors_count, 10);
    assert.equal(zones.colors.length, 82); // Decoder always reads 82 colors
    assert.equal(zones.colors[0].hue, 120);
    assert.equal(continuation.expectMore, false); // Single response, no more expected
  });

  test('GetExtendedColorZonesCommand decode handles StateExtendedColorZones responses for multiple responses', () => {
    const cmd = Commands.GetExtendedColorZonesCommand();
    
    // Mock first StateExtendedColorZones response for device with >82 zones
    const stateExtendedBytes1 = new Uint8Array(36 + 5 + 82 * 8); // header + basic payload + 82 colors
    let view = new DataView(stateExtendedBytes1.buffer);
    view.setUint16(32, Type.StateExtendedColorZones, true); // message type
    
    view.setUint16(36, 150, true); // zones_count (>82, so multiple responses)
    view.setUint16(38, 0, true); // zone_index (first chunk: 0-81)
    view.setUint8(40, 82); // colors_count
    
    // Add 82 colors for first response
    for (let i = 0; i < 82; i++) {
      const colorOffset = 41 + (i * 8);
      view.setUint16(colorOffset, 120 + i, true); // hue
      view.setUint16(colorOffset + 2, 65535, true); // saturation
      view.setUint16(colorOffset + 4, 32768, true); // brightness
      view.setUint16(colorOffset + 6, 3500, true); // kelvin
    }
    
    let offsetRef = { current: 36 };
    let continuation = { expectMore: false };
    
    let result1 = cmd.decode(stateExtendedBytes1, offsetRef, continuation, Type.StateExtendedColorZones);
    
    assert.equal(result1.length, 1);
    assert.equal(result1[0].zone_index, 0);
    assert.equal(result1[0].colors_count, 82);
    assert.equal(continuation.expectMore, true); // Should expect more responses for zones 82-149
    
    // Mock second StateExtendedColorZones response - decoder always reads 82 colors
    const stateExtendedBytes2 = new Uint8Array(36 + 5 + 82 * 8); // header + basic payload + 82 colors
    view = new DataView(stateExtendedBytes2.buffer);
    view.setUint16(32, Type.StateExtendedColorZones, true);
    
    view.setUint16(36, 150, true); // zones_count
    view.setUint16(38, 82, true); // zone_index (second chunk: 82-149)
    view.setUint8(40, 68); // colors_count (only 68 are meaningful)
    
    // Add 82 colors (decoder always reads 82)
    for (let i = 0; i < 82; i++) {
      const colorOffset = 41 + (i * 8);
      view.setUint16(colorOffset, 200 + i, true); // hue
      view.setUint16(colorOffset + 2, 65535, true); // saturation
      view.setUint16(colorOffset + 4, 32768, true); // brightness
      view.setUint16(colorOffset + 6, 3500, true); // kelvin
    }
    
    offsetRef = { current: 36 };
    continuation = { expectMore: false };
    
    let result2 = cmd.decode(stateExtendedBytes2, offsetRef, continuation, Type.StateExtendedColorZones);
    
    assert.equal(result2.length, 2); // Accumulated responses
    assert.equal(result2[1].zone_index, 82);
    assert.equal(result2[1].colors_count, 68);
    assert.equal(result2[1].colors.length, 82); // Decoder always reads 82 colors
    assert.equal(continuation.expectMore, false); // Complete
  });

  test('GetExtendedColorZonesCommand callback receives responses', () => {
    const receivedResponses: StateExtendedColorZones[] = [];
    const cmd = Commands.GetExtendedColorZonesCommand((response) => {
      receivedResponses.push(response);
    });
    
    // Mock StateExtendedColorZones response - decoder always reads 82 colors
    const stateExtendedBytes = new Uint8Array(36 + 5 + 82 * 8);
    const view = new DataView(stateExtendedBytes.buffer);
    view.setUint16(32, Type.StateExtendedColorZones, true);
    view.setUint16(36, 50, true); // zones_count
    view.setUint16(38, 0, true); // zone_index
    view.setUint8(40, 50); // colors_count
    
    // Add 82 colors (decoder always reads 82)
    for (let i = 0; i < 82; i++) {
      const colorOffset = 41 + (i * 8);
      view.setUint16(colorOffset, 120 + i, true); // hue
      view.setUint16(colorOffset + 2, 65535, true); // saturation
      view.setUint16(colorOffset + 4, 32768, true); // brightness
      view.setUint16(colorOffset + 6, 3500, true); // kelvin
    }
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    cmd.decode(stateExtendedBytes, offsetRef, continuation, Type.StateExtendedColorZones);
    
    assert.equal(receivedResponses.length, 1);
    assert.equal(receivedResponses[0].zones_count, 50);
    assert.equal(receivedResponses[0].zone_index, 0);
    assert.equal(continuation.expectMore, false); // Single response for ≤82 zones
  });

  test('GetExtendedColorZonesCommand callback can stop early', () => {
    const receivedResponses: StateExtendedColorZones[] = [];
    const cmd = Commands.GetExtendedColorZonesCommand((response) => {
      receivedResponses.push(response);
      return false; // Stop early
    });
    
    // Mock first response for device with >82 zones
    const stateExtendedBytes = new Uint8Array(36 + 5 + 82 * 8);
    const view = new DataView(stateExtendedBytes.buffer);
    view.setUint16(32, Type.StateExtendedColorZones, true);
    view.setUint16(36, 150, true); // zones_count (>82)
    view.setUint16(38, 0, true); // zone_index
    view.setUint8(40, 82); // colors_count
    
    // Add 82 colors
    for (let i = 0; i < 82; i++) {
      const colorOffset = 41 + (i * 8);
      view.setUint16(colorOffset, 120 + i, true); // hue
      view.setUint16(colorOffset + 2, 65535, true); // saturation
      view.setUint16(colorOffset + 4, 32768, true); // brightness
      view.setUint16(colorOffset + 6, 3500, true); // kelvin
    }
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    cmd.decode(stateExtendedBytes, offsetRef, continuation, Type.StateExtendedColorZones);
    
    assert.equal(receivedResponses.length, 1);
    assert.equal(continuation.expectMore, false); // Stopped early due to callback returning false
  });

  test('GetExtendedColorZonesCommand ignores unknown response types', () => {
    const cmd = Commands.GetExtendedColorZonesCommand();
    
    // Mock unknown response type
    const unknownBytes = new Uint8Array(36 + 10);
    const view = new DataView(unknownBytes.buffer);
    view.setUint16(32, 999, true); // Unknown message type
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const result = cmd.decode(unknownBytes, offsetRef, continuation, 999);
    
    assert.equal(result.length, 0); // No responses added
    assert.equal(continuation.expectMore, false); // No expected responses set up yet, so false
  });

  test('SetExtendedColorZonesCommand', () => {
    const colors = [
      { hue: 120, saturation: 65535, brightness: 32768, kelvin: 3500 },
      { hue: 240, saturation: 32768, brightness: 65535, kelvin: 2700 }
    ];
    const cmd = Commands.SetExtendedColorZonesCommand(1000, MultiZoneExtendedApplicationRequest.APPLY, 0, 2, colors);
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

  test('SetUserPositionCommand', () => {
    const cmd = Commands.SetUserPositionCommand(1, 1.5, -2.7);
    assert.equal(cmd.type, Type.SetUserPosition);
    assert.equal(cmd.payload.length, 11);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 1); // tileIndex
    assert.equal(view.getUint8(1), 0); // reserved
    assert.equal(view.getUint8(2), 0); // reserved
    assert.equal(view.getFloat32(3, true), 1.5); // userX
    assert.ok(Math.abs(view.getFloat32(7, true) - (-2.7)) < 0.001); // userY (floating point comparison)
  });

  test('Set64Command', () => {
    const colors = Array.from({ length: 5 }, (_, i) => ({
      hue: i * 100,
      saturation: 65535,
      brightness: 32768,
      kelvin: 3500
    }));
    
    const cmd = Commands.Set64Command(0, 8, 1, 2, 4, 500, colors);
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

  test('GetTileEffectCommand', () => {
    const cmd = Commands.GetTileEffectCommand();
    assert.equal(cmd.type, Type.GetTileEffect);
    assert.equal(cmd.payload.length, 2);
    assert.equal(cmd.payload[0], 0); // reserved6
    assert.equal(cmd.payload[1], 0); // reserved7
  });

  test('SetTileEffectCommand', () => {
    const palette = Array.from({ length: 3 }, (_, i) => ({
      hue: i * 120,
      saturation: 65535,
      brightness: 32768,
      kelvin: 3500
    }));
    
    const cmd = Commands.SetTileEffectCommand(
      54321, // instanceid
      TileEffectType.FLAME,
      8, // speed
      5000n, // duration
      TileEffectSkyType.SUNSET,
      128, // cloudSaturationMin
      3, // paletteCount
      palette
    );
    
    assert.equal(cmd.type, Type.SetTileEffect);
    assert.equal(cmd.payload.length, 188);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 0); // reserved0
    assert.equal(view.getUint8(1), 0); // reserved1
    assert.equal(view.getUint32(2, true), 54321); // instanceid
    assert.equal(view.getUint8(6), TileEffectType.FLAME); // effectType
    assert.equal(view.getUint32(7, true), 8); // speed
    assert.equal(view.getBigUint64(11, true), 5000n); // duration
    assert.equal(view.getUint8(27), TileEffectSkyType.SUNSET); // skyType
    assert.equal(view.getUint8(31), 128); // cloudSaturationMin
    assert.equal(view.getUint8(59), 3); // paletteCount
    
    // Check first palette color
    assert.equal(view.getUint16(60, true), 0); // hue
    assert.equal(view.getUint16(62, true), 65535); // saturation
    assert.equal(view.getUint16(64, true), 32768); // brightness
    assert.equal(view.getUint16(66, true), 3500); // kelvin
  });

  test('SensorGetAmbientLightCommand', () => {
    const cmd = Commands.SensorGetAmbientLightCommand();
    assert.equal(cmd.type, Type.SensorGetAmbientLight);
    assert.equal(typeof cmd.decode, 'function');
  });
});