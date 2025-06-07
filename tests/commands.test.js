import { describe, test } from 'bun:test';
import assert from 'node:assert';
import * as Commands from '../src/commands.js';
import { Type, Waveform, MultiZoneApplicationRequest, MultiZoneExtendedApplicationRequest, MultiZoneEffectType, TileEffectType, TileEffectSkyType } from '../src/constants.js';

describe('commands', () => {
  test('GetServiceCommand', () => {
    const cmd = Commands.GetServiceCommand();
    assert.equal(cmd.type, Type.GetService);
    assert.equal(cmd.payload, undefined);
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

  test('GetColorZonesCommand', () => {
    const cmd = Commands.GetColorZonesCommand(0, 15);
    assert.equal(cmd.type, Type.GetColorZones);
    assert.equal(cmd.payload.length, 2);
    
    const view = new DataView(cmd.payload.buffer);
    assert.equal(view.getUint8(0), 0);
    assert.equal(view.getUint8(1), 15);
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