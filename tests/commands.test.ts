import { describe, test } from 'bun:test';
import assert from 'node:assert';
import * as Commands from '../src/commands/index.js';
import { Type, Waveform, MultiZoneApplicationRequest, MultiZoneExtendedApplicationRequest, MultiZoneEffectType, TileEffectType, TileEffectSkyType } from '../src/constants/index.js';
import { State64, StateExtendedColorZones } from '../src/encoding.js';

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
    const cmd = Commands.SetColor({ hue: 120, saturation: 65535, brightness: 32768, kelvin: 3500, duration: 1000 });
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
        period: 1000,
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
      period: 2000,
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
      { hue: 0, saturation: 0, brightness: 0, kelvin: 0, period: 0, cycles: 0, waveform: Waveform.SAW },
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

  test('Get64 with callback', () => {
    const cmd = Commands.Get64({ tileIndex: 0, tileCount: 3, width: 8 });
    assert.equal(cmd.type, Type.Get64);
    assert.equal(typeof cmd.createDecoder, 'function');
  });

  test('Get64 decode handles State64 responses', () => {
    const cmd = Commands.Get64({ tileIndex: 0, tileCount: 2, width: 8 });
    
    // Mock State64 response (Type.State64 = 711)
    const state64Bytes = new Uint8Array(36 + 5 + 64 * 8); // header + basic payload + 64 colors
    const view = new DataView(state64Bytes.buffer);
    view.setUint16(32, Type.State64, true); // message type
    
    // State64 payload: tileIndex, reserved6, x, y, width, colors[64]
    view.setUint8(36, 0); // tileIndex
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
    
    const decode = cmd.createDecoder();
    const result = decode(state64Bytes, offsetRef, continuation, Type.State64);
    
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 1);
    const tile = result[0];
    assert.ok(tile);
    assert.equal(tile.tileIndex, 0);
    assert.equal(tile.colors.length, 64);
    assert.equal(tile.colors[0]?.hue, 120);
    assert.equal(continuation.expectMore, true); // Should expect more tiles (0, 1)
  });

  test('Get64 callback receives responses', () => {
    const receivedResponses: State64[] = [];
    const cmd = Commands.Get64({ tileIndex: 0, tileCount: 2, width: 8, onResponse: (response) => {
      receivedResponses.push(response);
    } });
    
    // Mock State64 response for tile 0
    const state64Bytes = new Uint8Array(36 + 5 + 64 * 8);
    const view = new DataView(state64Bytes.buffer);
    view.setUint16(32, Type.State64, true);
    view.setUint8(36, 0); // tileIndex
    view.setUint8(37, 0); // reserved6
    view.setUint8(38, 0); // x
    view.setUint8(39, 0); // y
    view.setUint8(40, 8); // width
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const decode = cmd.createDecoder();
    decode(state64Bytes, offsetRef, continuation, Type.State64);
    
    assert.equal(receivedResponses.length, 1);
    assert.equal(receivedResponses[0]?.tileIndex, 0);
    assert.equal(continuation.expectMore, true); // Still expecting tile 1
  });

  test('Get64 callback can stop early', () => {
    const receivedResponses: State64[] = [];
    
    const cmd = Commands.Get64({ tileIndex: 0, tileCount: 3, width: 8, onResponse: (response) => {
      receivedResponses.push(response);
      return false; // Stop early
    } });
    
    // Mock State64 response for tile 0
    const state64Bytes = new Uint8Array(36 + 5 + 64 * 8);
    const view = new DataView(state64Bytes.buffer);
    view.setUint16(32, Type.State64, true);
    view.setUint8(36, 0); // tileIndex
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const decode = cmd.createDecoder();
    decode(state64Bytes, offsetRef, continuation, Type.State64);
    
    assert.equal(receivedResponses.length, 1);
    assert.equal(continuation.expectMore, false); // Stopped early due to callback returning false
  });

  test('Get64 accumulates responses correctly', () => {
    const cmd = Commands.Get64({ tileIndex: 0, tileCount: 2, width: 8 });
    
    // First call should return array with 1 item
    const state64Bytes1 = new Uint8Array(36 + 5 + 64 * 8);
    let view = new DataView(state64Bytes1.buffer);
    view.setUint16(32, Type.State64, true);
    view.setUint8(36, 0); // tileIndex
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const decode = cmd.createDecoder();
    const result1 = decode(state64Bytes1, offsetRef, continuation, Type.State64);
    assert.equal(result1.length, 1);
    assert.equal(continuation.expectMore, true);
    
    // Second call should return array with 2 items (accumulated)
    const state64Bytes2 = new Uint8Array(36 + 5 + 64 * 8);
    view = new DataView(state64Bytes2.buffer);
    view.setUint16(32, Type.State64, true);
    view.setUint8(36, 1); // tileIndex
    
    offsetRef.current = 36;
    continuation.expectMore = false;
    
    const result2 = decode(state64Bytes2, offsetRef, continuation, Type.State64);
    assert.equal(result2.length, 2);
    assert.equal(result2[0]?.tileIndex, 0);
    assert.equal(result2[1]?.tileIndex, 1);
    assert.equal(continuation.expectMore, false); // Complete
  });

  test('Get64 ignores unknown response types', () => {
    const cmd = Commands.Get64({ tileIndex: 0, tileCount: 1, width: 8 });
    
    // Mock unknown response type
    const unknownBytes = new Uint8Array(36 + 10);
    const view = new DataView(unknownBytes.buffer);
    view.setUint16(32, 999, true); // Unknown message type
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const decode = cmd.createDecoder();
    const result = decode(unknownBytes, offsetRef, continuation, 999);
    
    assert.equal(result.length, 0); // No responses added
    assert.equal(continuation.expectMore, true); // Still expecting responses
  });

  test('GetColorZones basic usage without callback', () => {
    const cmd = Commands.GetColorZones(0, 15);
    assert.equal(cmd.type, Type.GetColorZones);
    assert.equal(cmd.payload.length, 2);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 0);
    assert.equal(view.getUint8(1), 15);
    assert.equal(typeof cmd.createDecoder, 'function');
  });

  test('GetColorZones with callback', () => {
    const responses: Commands.ColorZoneResponse[] = [];
    const cmd = Commands.GetColorZones(0, 3, (response) => {
      responses.push(response);
    });
    assert.equal(cmd.type, Type.GetColorZones);
    assert.equal(typeof cmd.createDecoder, 'function');
  });

  test('GetColorZones decode handles StateZone responses', () => {
    const cmd = Commands.GetColorZones(0, 2);
    
    // Mock StateZone response (Type.StateZone = 503)
    const stateZoneBytes = new Uint8Array(36 + 13); // header + payload
    const view = new DataView(stateZoneBytes.buffer);
    view.setUint16(32, Type.StateZone, true); // message type
    
    // StateZone payload: zonesCount, zoneIndex, hue, saturation, brightness, kelvin
    view.setUint8(36, 3); // zonesCount
    view.setUint8(37, 0); // zoneIndex
    view.setUint16(38, 120, true); // hue
    view.setUint16(40, 65535, true); // saturation
    view.setUint16(42, 32768, true); // brightness
    view.setUint16(44, 3500, true); // kelvin
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const decode = cmd.createDecoder();
    const result = decode(stateZoneBytes, offsetRef, continuation, Type.StateZone);
    
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 1);
    const zone = result[0];
    assert.ok(zone);
    assert.equal(zone.zoneIndex, 0);
    assert.ok('hue' in zone);
    assert.equal(zone.hue, 120);
    assert.equal(continuation.expectMore, true); // Should expect more zones (0, 1, 2)
  });

  test('GetColorZones decode handles StateMultiZone responses', () => {
    const cmd = Commands.GetColorZones(0, 2);
    
    // Mock StateMultiZone response (Type.StateMultiZone = 506)
    // StateMultiZone always contains 8 colors (fixed size)
    const stateMultiZoneBytes = new Uint8Array(36 + 2 + 8 * 8); // header + basic payload + 8 colors
    const view = new DataView(stateMultiZoneBytes.buffer);
    view.setUint16(32, Type.StateMultiZone, true); // message type
    
    // StateMultiZone payload
    view.setUint8(36, 3); // zonesCount
    view.setUint8(37, 0); // zoneIndex
    
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
    
    const decode = cmd.createDecoder();
    const result = decode(stateMultiZoneBytes, offsetRef, continuation, Type.StateMultiZone);
    
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 1);
    const zone = result[0];
    assert.ok(zone);
    assert.equal(zone.zoneIndex, 0);
    assert.ok('colors' in zone);
    assert.equal(zone.colors.length, 8);
    assert.equal(continuation.expectMore, false); // All zones covered (0-7, more than we requested 0-2)
  });

  test('GetColorZones callback receives responses', () => {
    const receivedResponses: Commands.ColorZoneResponse[] = [];
    const cmd = Commands.GetColorZones(0, 1, (response) => {
      receivedResponses.push(response);
    });
    
    // Mock StateZone response for zone 0
    const stateZoneBytes = new Uint8Array(36 + 13);
    const view = new DataView(stateZoneBytes.buffer);
    view.setUint16(32, Type.StateZone, true);
    view.setUint8(36, 2); // zonesCount
    view.setUint8(37, 0); // zoneIndex
    view.setUint16(38, 120, true); // hue
    view.setUint16(40, 65535, true); // saturation
    view.setUint16(42, 32768, true); // brightness
    view.setUint16(44, 3500, true); // kelvin
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const decode = cmd.createDecoder();
    decode(stateZoneBytes, offsetRef, continuation, Type.StateZone);
    
    assert.equal(receivedResponses.length, 1);
    const res = receivedResponses[0];
    assert.ok(res);
    assert.equal(res.zoneIndex, 0);
    assert.ok('hue' in res);
    assert.equal(res.hue, 120);
    assert.equal(continuation.expectMore, true); // Still expecting zone 1
  });

  test('GetColorZones callback can stop early', () => {
    const receivedResponses: Commands.ColorZoneResponse[] = [];
    
    const cmd = Commands.GetColorZones(0, 5, (response) => {
      receivedResponses.push(response);
      return false; // Stop early
    });
    
    // Mock StateZone response for zone 0
    const stateZoneBytes = new Uint8Array(36 + 13);
    const view = new DataView(stateZoneBytes.buffer);
    view.setUint16(32, Type.StateZone, true);
    view.setUint8(36, 6); // zonesCount
    view.setUint8(37, 0); // zoneIndex
    view.setUint16(38, 120, true); // hue
    view.setUint16(40, 65535, true); // saturation
    view.setUint16(42, 32768, true); // brightness
    view.setUint16(44, 3500, true); // kelvin
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const decode = cmd.createDecoder();
    decode(stateZoneBytes, offsetRef, continuation, Type.StateZone);
    
    assert.equal(receivedResponses.length, 1);
    assert.equal(continuation.expectMore, false); // Stopped early due to callback returning false
  });


  test('GetColorZones accumulates responses correctly', () => {
    const cmd = Commands.GetColorZones(0, 2);
    
    // First call should return array with 1 item
    const stateZoneBytes1 = new Uint8Array(36 + 13);
    let view = new DataView(stateZoneBytes1.buffer);
    view.setUint16(32, Type.StateZone, true);
    view.setUint8(36, 3); // zonesCount
    view.setUint8(37, 0); // zoneIndex
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const decode = cmd.createDecoder();
    const result1 = decode(stateZoneBytes1, offsetRef, continuation, Type.StateZone);
    assert.equal(result1.length, 1);
    assert.equal(continuation.expectMore, true);
    
    // Second call should return array with 2 items (accumulated)
    const stateZoneBytes2 = new Uint8Array(36 + 13);
    view = new DataView(stateZoneBytes2.buffer);
    view.setUint16(32, Type.StateZone, true);
    view.setUint8(36, 3); // zonesCount
    view.setUint8(37, 1); // zoneIndex
    
    offsetRef.current = 36;
    continuation.expectMore = false;
    
    const result2 = decode(stateZoneBytes2, offsetRef, continuation, Type.StateZone);
    assert.equal(result2.length, 2);
    assert.equal(result2[0]?.zoneIndex, 0);
    assert.equal(result2[1]?.zoneIndex, 1);
    assert.equal(continuation.expectMore, true); // Still need zone 2
    
    // Third call should return array with 3 items and be complete
    const stateZoneBytes3 = new Uint8Array(36 + 13);
    view = new DataView(stateZoneBytes3.buffer);
    view.setUint16(32, Type.StateZone, true);
    view.setUint8(36, 3); // zonesCount
    view.setUint8(37, 2); // zoneIndex
    
    offsetRef.current = 36;
    continuation.expectMore = false;
    
    const result3 = decode(stateZoneBytes3, offsetRef, continuation, Type.StateZone);
    assert.equal(result3.length, 3);
    assert.equal(result3[2]?.zoneIndex, 2);
    assert.equal(continuation.expectMore, false); // Complete
  });

  test('GetColorZones ignores unknown response types', () => {
    const cmd = Commands.GetColorZones(0, 1);
    
    // Mock unknown response type
    const unknownBytes = new Uint8Array(36 + 10);
    const view = new DataView(unknownBytes.buffer);
    view.setUint16(32, 999, true); // Unknown message type
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const decode = cmd.createDecoder();
    const result = decode(unknownBytes, offsetRef, continuation, 999);
    
    assert.equal(result.length, 0); // No responses added
    assert.equal(continuation.expectMore, true); // Still expecting responses
  });

  test('SetColorZones', () => {
    const cmd = Commands.SetColorZones({
      startIndex: 0,
      endIndex: 7,
      hue: 120,
      saturation: 65535,
      brightness: 32768,
      kelvin: 3500,
      duration: 1000,
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
      speed: 5,
      duration: 10000n,
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
    assert.equal(typeof cmd.createDecoder, 'function');
  });

  test('GetExtendedColorZones with callback', () => {
    const cmd = Commands.GetExtendedColorZones();
    assert.equal(cmd.type, Type.GetExtendedColorZones);
    assert.equal(typeof cmd.createDecoder, 'function');
  });

  test('GetExtendedColorZones decode handles StateExtendedColorZones responses for single response', () => {
    const cmd = Commands.GetExtendedColorZones();
    
    // Mock StateExtendedColorZones response (Type.StateExtendedColorZones = 512)
    // Single response for device with ≤82 zones - decoder always reads 82 colors
    const stateExtendedBytes = new Uint8Array(36 + 5 + 82 * 8); // header + basic payload + 82 colors
    const view = new DataView(stateExtendedBytes.buffer);
    view.setUint16(32, Type.StateExtendedColorZones, true); // message type
    
    // StateExtendedColorZones payload: zonesCount, zoneIndex, colorsCount, colors[82]
    view.setUint16(36, 10, true); // zonesCount (≤82, so single response)
    view.setUint16(38, 0, true); // zoneIndex
    view.setUint8(40, 10); // colorsCount
    
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
    
    const decode = cmd.createDecoder();
    const result = decode(stateExtendedBytes, offsetRef, continuation, Type.StateExtendedColorZones);
    
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 1);
    const zones = result[0];
    assert.equal(zones?.zonesCount, 10);
    assert.equal(zones?.zoneIndex, 0);
    assert.equal(zones?.colorsCount, 10);
    assert.equal(zones?.colors.length, 82); // Decoder always reads 82 colors
    assert.equal(zones?.colors[0]?.hue, 120);
    assert.equal(continuation.expectMore, false); // Single response, no more expected
  });

  test('GetExtendedColorZones decode handles StateExtendedColorZones responses for multiple responses', () => {
    const cmd = Commands.GetExtendedColorZones();
    
    // Mock first StateExtendedColorZones response for device with >82 zones
    const stateExtendedBytes1 = new Uint8Array(36 + 5 + 82 * 8); // header + basic payload + 82 colors
    let view = new DataView(stateExtendedBytes1.buffer);
    view.setUint16(32, Type.StateExtendedColorZones, true); // message type
    
    view.setUint16(36, 150, true); // zonesCount (>82, so multiple responses)
    view.setUint16(38, 0, true); // zoneIndex (first chunk: 0-81)
    view.setUint8(40, 82); // colorsCount
    
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
    
    const decode = cmd.createDecoder();
    const result1 = decode(stateExtendedBytes1, offsetRef, continuation, Type.StateExtendedColorZones);
    
    assert.equal(result1.length, 1);
    assert.equal(result1[0]?.zoneIndex, 0);
    assert.equal(result1[0]?.colorsCount, 82);
    assert.equal(continuation.expectMore, true); // Should expect more responses for zones 82-149
    
    // Mock second StateExtendedColorZones response - decoder always reads 82 colors
    const stateExtendedBytes2 = new Uint8Array(36 + 5 + 82 * 8); // header + basic payload + 82 colors
    view = new DataView(stateExtendedBytes2.buffer);
    view.setUint16(32, Type.StateExtendedColorZones, true);
    
    view.setUint16(36, 150, true); // zonesCount
    view.setUint16(38, 82, true); // zoneIndex (second chunk: 82-149)
    view.setUint8(40, 68); // colorsCount (only 68 are meaningful)
    
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
    
    const result2 = decode(stateExtendedBytes2, offsetRef, continuation, Type.StateExtendedColorZones);
    
    assert.equal(result2.length, 2); // Accumulated responses
    assert.equal(result2[1]?.zoneIndex, 82);
    assert.equal(result2[1]?.colorsCount, 68);
    assert.equal(result2[1]?.colors.length, 82); // Decoder always reads 82 colors
    assert.equal(continuation.expectMore, false); // Complete
  });

  test('GetExtendedColorZones callback receives responses', () => {
    const receivedResponses: StateExtendedColorZones[] = [];
    const cmd = Commands.GetExtendedColorZones((response) => {
      receivedResponses.push(response);
    });
    
    // Mock StateExtendedColorZones response - decoder always reads 82 colors
    const stateExtendedBytes = new Uint8Array(36 + 5 + 82 * 8);
    const view = new DataView(stateExtendedBytes.buffer);
    view.setUint16(32, Type.StateExtendedColorZones, true);
    view.setUint16(36, 50, true); // zonesCount
    view.setUint16(38, 0, true); // zoneIndex
    view.setUint8(40, 50); // colorsCount
    
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
    
    const decode = cmd.createDecoder();
    decode(stateExtendedBytes, offsetRef, continuation, Type.StateExtendedColorZones);
    
    assert.equal(receivedResponses.length, 1);
    assert.equal(receivedResponses[0]?.zonesCount, 50);
    assert.equal(receivedResponses[0]?.zoneIndex, 0);
    assert.equal(continuation.expectMore, false); // Single response for ≤82 zones
  });

  test('GetExtendedColorZones callback can stop early', () => {
    const receivedResponses: StateExtendedColorZones[] = [];
    const cmd = Commands.GetExtendedColorZones((response) => {
      receivedResponses.push(response);
      return false; // Stop early
    });
    
    // Mock first response for device with >82 zones
    const stateExtendedBytes = new Uint8Array(36 + 5 + 82 * 8);
    const view = new DataView(stateExtendedBytes.buffer);
    view.setUint16(32, Type.StateExtendedColorZones, true);
    view.setUint16(36, 150, true); // zonesCount (>82)
    view.setUint16(38, 0, true); // zoneIndex
    view.setUint8(40, 82); // colorsCount
    
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
    
    const decode = cmd.createDecoder();
    decode(stateExtendedBytes, offsetRef, continuation, Type.StateExtendedColorZones);
    
    assert.equal(receivedResponses.length, 1);
    assert.equal(continuation.expectMore, false); // Stopped early due to callback returning false
  });

  test('GetExtendedColorZones ignores unknown response types', () => {
    const cmd = Commands.GetExtendedColorZones();
    
    // Mock unknown response type
    const unknownBytes = new Uint8Array(36 + 10);
    const view = new DataView(unknownBytes.buffer);
    view.setUint16(32, 999, true); // Unknown message type
    
    const offsetRef = { current: 36 };
    const continuation = { expectMore: false };
    
    const decode = cmd.createDecoder();
    const result = decode(unknownBytes, offsetRef, continuation, 999);
    
    assert.equal(result.length, 0); // No responses added
    assert.equal(continuation.expectMore, false); // No expected responses set up yet, so false
  });

  test('SetExtendedColorZones', () => {
    const colors = [
      { hue: 120, saturation: 65535, brightness: 32768, kelvin: 3500 },
      { hue: 240, saturation: 32768, brightness: 65535, kelvin: 2700 }
    ];
    const cmd = Commands.SetExtendedColorZones({
      duration: 1000,
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
    
    const cmd = Commands.Set64({ tileIndex: 0, tileCount: 8, x: 1, y: 2, width: 4, duration: 500, colors });
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
      speed: 8,
      duration: 5000n,
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
});