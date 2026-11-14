/**
 * Holds the browser demo's simulated devices (demo/src/sim) to the wire
 * format: the real Router/Client/Devices drive them over the in-memory
 * network, so every assertion here is a request the library encoded, a
 * device-side parse written independently of it, and a reply the library
 * decoded.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  Client,
  Devices,
  EchoRequest,
  Get64,
  GetColor,
  GetColorZones,
  GetDeviceChain,
  GetExtendedColorZones,
  GetGroup,
  GetHostFirmware,
  GetInfo,
  GetInfrared,
  GetLabel,
  GetLightPower,
  GetLocation,
  GetMultiZoneEffect,
  GetPower,
  GetTileEffect,
  GetVersion,
  GetWifiInfo,
  MultiZoneApplicationRequest,
  MultiZoneEffectType,
  Router,
  Set64,
  SetColor,
  SetColorZones,
  SetExtendedColorZones,
  SetLabel,
  SetLightPower,
  SetMultiZoneEffect,
  SetPower,
  SetTileEffect,
  SetWaveform,
  TileEffectSkyType,
  TileEffectType,
  TimeoutError,
  UnhandledCommandError,
  Waveform,
  convertSignalToRssi,
} from '../src/index.js';
import type { Color, Device } from '../src/index.js';
import { discover } from '../src/discovery.js';
import { Products } from '../src/products.js';
import { VirtualLan } from '../demo/src/sim/lan.js';
import type { VirtualSocket } from '../demo/src/sim/lan.js';
import { VirtualDevice } from '../demo/src/sim/firmware.js';
import { FLEET, PRODUCTS_EXCERPT } from '../demo/src/sim/fleet.js';
import { RAW_PACKETS } from '../demo/src/app/presets.js';
import { parseHex } from '../demo/src/app/format.js';
import { decodeHeader } from '../src/encoding.js';
import { HEADER_FIELDS, LAYOUTS, layoutFor, readStruct, sizeOf, typeName } from '../demo/src/protocol/layouts.js';

const RED: Color = { hue: 0, saturation: 65535, brightness: 40000, kelvin: 3500 };
const GREEN: Color = { hue: 21845, saturation: 65535, brightness: 50000, kelvin: 3500 };
const BLUE: Color = { hue: 43690, saturation: 65535, brightness: 60000, kelvin: 3500 };

let lan: VirtualLan;
let fleet: VirtualDevice[];
let socket: VirtualSocket;
let router: Router;
let devices: Devices;
let client: Client;

function wire() {
  lan = new VirtualLan();
  lan.latencyMs = 0;
  lan.jitterMs = 0;
  fleet = FLEET.map((spec) => new VirtualDevice(spec, lan));
  router = Router({ onSend: (bytes, port, address) => socket.send(bytes, port, address) });
  devices = Devices();
  client = Client({ router, defaultTimeoutMs: 250 });
  socket = lan.bind({ address: '192.168.1.10', port: 50000 }, (bytes, remote) => {
    devices.register(remote.port, remote.address, router.receive(bytes));
  });
}

async function find(label: string): Promise<Device> {
  const spec = FLEET.find((candidate) => candidate.label === label);
  if (!spec) throw new Error(`no device labelled ${label}`);
  for await (const device of discover(router, devices, { timeoutMs: 200 })) {
    if (device.serialNumber === spec.serial) return device;
  }
  throw new Error(`${label} was not discovered`);
}

beforeEach(wire);
afterEach(() => {
  client.dispose();
  socket.close();
});

describe('demo simulator: discovery and device messages', () => {
  test('discover() finds every simulated device at its address', async () => {
    const found = new Map<string, string>();
    for await (const device of discover(router, devices, { timeoutMs: 100 })) {
      found.set(device.serialNumber, device.address);
    }
    expect(found.size).toBe(FLEET.length);
    for (const spec of FLEET) expect(found.get(spec.serial)).toBe(spec.address);
  });

  test('identity queries decode to what the device was built with', async () => {
    const lamp = await find('Desk Lamp');
    const spec = FLEET[0]!;

    expect(await client.send(GetLabel(), lamp)).toBe('Desk Lamp');
    expect(await client.send(GetVersion(), lamp)).toEqual({ vendor: 1, product: 27 });

    const firmware = await client.send(GetHostFirmware(), lamp);
    expect(firmware).toEqual({ build: spec.firmware.build, versionMinor: 80, versionMajor: 2 });

    const wifi = await client.send(GetWifiInfo(), lamp);
    expect(convertSignalToRssi(wifi.signal)).toBe(-46);

    const info = await client.send(GetInfo(), lamp);
    expect(Math.abs(info.time.getTime() - Date.now())).toBeLessThan(5000);
    expect(info.downtimeNs).toBe(0n);

    expect(await client.send(GetLocation(), lamp)).toMatchObject({ location: spec.location.id, label: 'Studio' });
    expect(await client.send(GetGroup(), lamp)).toMatchObject({ group: spec.group.id, label: 'Lamps' });
  });

  test('the vendored products excerpt resolves each device\'s capabilities', async () => {
    const products = Products(PRODUCTS_EXCERPT);
    const strip = await find('Shelf Strip');
    const version = await client.send(GetVersion(), strip);
    const firmware = await client.send(GetHostFirmware(), strip);
    expect(products.get(version.vendor, version.product)?.name).toBe('LIFX Z');
    expect(products.features(version.vendor, version.product, firmware)).toMatchObject({ multizone: true, extended_multizone: true });
    expect(products.features(1, 55)).toMatchObject({ matrix: true, chain: true });
  });

  test('EchoRequest comes back byte for byte', async () => {
    const lamp = await find('Floor Lamp');
    const sent = Uint8Array.from({ length: 64 }, (_, i) => (i * 37) & 0xFF);
    expect(new Uint8Array(await client.send(EchoRequest(sent), lamp))).toEqual(sent);
  });

  test('SetLabel and SetPower change what the matching Get reports', async () => {
    const lamp = await find('Desk Lamp');
    await client.send(SetLabel('Reading Nook'), lamp);
    expect(await client.send(GetLabel(), lamp)).toBe('Reading Nook');

    expect(await client.send(GetPower(), lamp)).toBe(65535);
    await client.send(SetPower(false), lamp);
    expect(await client.send(GetPower(), lamp)).toBe(0);
    await client.send(SetLightPower(true, 0), lamp);
    expect(await client.send(GetLightPower(), lamp)).toBe(65535);
  });
});

describe('demo simulator: light messages', () => {
  test('SetColor is acknowledged and GetColor reads it back', async () => {
    const lamp = await find('Desk Lamp');
    await client.send(SetColor({ ...GREEN, durationMs: 0 }), lamp);
    expect(await client.send(GetColor(), lamp)).toEqual({ ...GREEN, power: 65535, label: 'Desk Lamp' });
    expect(fleet[0]!.frame().colors[0]).toEqual(GREEN);
  });

  test("responseMode 'both' resolves with the state from before the change", async () => {
    const lamp = await find('Desk Lamp');
    await client.send(SetColor({ ...RED, durationMs: 0 }), lamp);
    const before = await client.send(SetColor({ ...BLUE, durationMs: 0 }), lamp, { responseMode: 'both' });
    expect(before).toMatchObject(RED);
    expect(await client.send(GetColor(), lamp)).toMatchObject(BLUE);
  });

  test('a transition is mid-way when read mid-way', async () => {
    const lamp = await find('Desk Lamp');
    await client.send(SetColor({ hue: 0, saturation: 65535, brightness: 0, kelvin: 3500 }), lamp);
    await client.send(SetColor({ hue: 0, saturation: 65535, brightness: 65535, kelvin: 3500, durationMs: 400 }), lamp);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const { brightness } = await client.send(GetColor(), lamp);
    expect(brightness).toBeGreaterThan(5000);
    expect(brightness).toBeLessThan(60000);
  });

  test('a transient waveform returns to the original color, a lasting one keeps the new one', async () => {
    const lamp = await find('Desk Lamp');
    await client.send(SetColor({ ...RED, durationMs: 0 }), lamp);
    await client.send(SetWaveform({ ...BLUE, transient: true, periodMs: 40, cycles: 1, waveform: Waveform.SINE }), lamp);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(await client.send(GetColor(), lamp)).toMatchObject(RED);

    await client.send(SetWaveform({ ...BLUE, transient: false, periodMs: 40, cycles: 1, waveform: Waveform.SAW }), lamp);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(await client.send(GetColor(), lamp)).toMatchObject(BLUE);
  });

  test('a message the product does not support rejects with UnhandledCommandError', async () => {
    const lamp = await find('Desk Lamp');
    expect(client.send(GetInfrared(), lamp)).rejects.toBeInstanceOf(UnhandledCommandError);
    expect(client.send(GetColorZones({ startIndex: 0, endIndex: 255 }), lamp)).rejects.toBeInstanceOf(UnhandledCommandError);
    expect(client.send(GetDeviceChain(), lamp)).rejects.toBeInstanceOf(UnhandledCommandError);
  });

  test('a lost datagram surfaces as TimeoutError', async () => {
    const lamp = await find('Desk Lamp');
    lan.loss = 1;
    expect(client.send(GetColor(), lamp, { timeoutMs: 40 })).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe('demo simulator: multizone messages', () => {
  test('GetColorZones assembles all 32 zones from four StateMultiZone packets', async () => {
    const strip = await find('Shelf Strip');
    let packets = 0;
    const zones = await client.send(GetColorZones({ startIndex: 0, endIndex: 255, onResponse: () => { packets++; } }), strip);
    expect(packets).toBe(4);
    expect(zones.zonesCount).toBe(32);
    expect(zones.colors).toHaveLength(32);
  });

  test('SetColorZones paints a range; a single zone answers as StateZone', async () => {
    const strip = await find('Shelf Strip');
    await client.send(SetColorZones({ startIndex: 4, endIndex: 9, ...RED }), strip);
    const zones = await client.send(GetColorZones({ startIndex: 0, endIndex: 31 }), strip);
    zones.colors.forEach((zone, i) => {
      if (i >= 4 && i <= 9) expect(zone).toEqual(RED);
      else expect(zone).not.toEqual(RED);
    });
    const one = await client.send(GetColorZones({ startIndex: 9, endIndex: 9 }), strip);
    expect(one).toEqual({ zonesCount: 32, zoneIndex: 9, colors: [RED] });
  });

  test('NO_APPLY buffers a change until a later APPLY', async () => {
    const strip = await find('Shelf Strip');
    await client.send(SetColorZones({ startIndex: 0, endIndex: 3, ...GREEN, apply: MultiZoneApplicationRequest.NO_APPLY }), strip);
    expect((await client.send(GetColorZones({ startIndex: 0, endIndex: 0 }), strip)).colors[0]).not.toEqual(GREEN);
    await client.send(SetColorZones({ startIndex: 31, endIndex: 31, ...BLUE, apply: MultiZoneApplicationRequest.APPLY }), strip);
    const zones = await client.send(GetExtendedColorZones(), strip);
    expect(zones.colors[0]).toEqual(GREEN);
    expect(zones.colors[31]).toEqual(BLUE);
  });

  test('SetExtendedColorZones writes every zone in one packet', async () => {
    const strip = await find('Shelf Strip');
    const gradient = Array.from({ length: 32 }, (_, i): Color => ({ hue: i * 2000, saturation: 65535, brightness: 30000 + i * 1000, kelvin: 3500 }));
    await client.send(SetExtendedColorZones({ zoneIndex: 0, colors: gradient }), strip);
    expect(await client.send(GetExtendedColorZones(), strip)).toEqual({ zonesCount: 32, zoneIndex: 0, colors: gradient });
    expect(fleet[2]!.frame().colors).toEqual(gradient);
  });

  test('the MOVE effect is reported back and scrolls the zones', async () => {
    const strip = await find('Shelf Strip');
    await client.send(SetColorZones({ startIndex: 0, endIndex: 0, ...RED }), strip);
    const parameters = new Uint8Array(32);
    parameters[4] = 1;
    await client.send(SetMultiZoneEffect({ instanceId: 7, effectType: MultiZoneEffectType.MOVE, speedMs: 320, durationNs: 0n, parameters }), strip);
    const effect = await client.send(GetMultiZoneEffect(), strip);
    expect(effect).toMatchObject({ instanceId: 7, effectType: MultiZoneEffectType.MOVE, speedMs: 320, durationNs: 0n });
    expect(effect.parameters[4]).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 60));
    const zones = await client.send(GetExtendedColorZones(), strip);
    expect(zones.colors[0]).not.toEqual(RED);

    await client.send(SetMultiZoneEffect({ instanceId: 8, effectType: MultiZoneEffectType.OFF, speedMs: 1000, durationNs: 0n }), strip);
    expect((await client.send(GetMultiZoneEffect(), strip)).effectType).toBe(MultiZoneEffectType.OFF);
  });
});

describe('demo simulator: tile messages', () => {
  test('GetDeviceChain reports five 8x8 tiles at their positions', async () => {
    const tiles = await find('Wall Tiles');
    const chain = await client.send(GetDeviceChain(), tiles);
    expect(chain.startIndex).toBe(0);
    expect(chain.devices).toHaveLength(5);
    chain.devices.forEach((tile, i) => {
      expect(tile).toMatchObject({
        width: 8,
        height: 8,
        userX: FLEET[3]!.tiles![i]!.x,
        userY: FLEET[3]!.tiles![i]!.y,
        deviceVersionVendor: 1,
        deviceVersionProduct: 55,
        firmwareVersionMajor: 3,
        firmwareVersionMinor: 50,
        firmwareBuild: FLEET[3]!.firmware.build,
      });
    });
  });

  test('Set64 frames come back through Get64, one State64 per tile', async () => {
    const tiles = await find('Wall Tiles');
    const frames = Array.from({ length: 5 }, (_, t) => Array.from({ length: 64 }, (_, i): Color => ({
      hue: (t * 13000 + i * 100) % 65536, saturation: 65535, brightness: 20000 + i * 500, kelvin: 3500,
    })));
    for (let t = 0; t < 5; t++) {
      await client.send(Set64({ tileIndex: t, colors: frames[t]! }), tiles);
    }
    const read = await client.send(Get64({ tileIndex: 0, tileCount: 5 }), tiles);
    expect(read.map((tile) => tile.tileIndex)).toEqual([0, 1, 2, 3, 4]);
    read.forEach((tile, t) => expect(tile.colors).toEqual(frames[t]!));
  });

  test('SetTileEffect is reported back by GetTileEffect, palette included', async () => {
    const tiles = await find('Wall Tiles');
    await client.send(SetTileEffect({
      instanceId: 99,
      effectType: TileEffectType.SKY,
      speedMs: 5000,
      durationNs: 0n,
      skyType: TileEffectSkyType.CLOUDS,
      cloudSaturationMin: 20,
      cloudSaturationMax: 180,
      palette: [RED, BLUE],
    }), tiles);
    expect(await client.send(GetTileEffect(), tiles)).toEqual({
      instanceId: 99,
      effectType: TileEffectType.SKY,
      speedMs: 5000,
      durationNs: 0n,
      skyType: TileEffectSkyType.CLOUDS,
      cloudSaturationMin: 20,
      cloudSaturationMax: 180,
      palette: [RED, BLUE],
    });
    // An effect drives the pixels: the frame is no longer one flat color.
    const frame = fleet[3]!.frame().colors;
    expect(new Set(frame.map((pixel) => Math.round(pixel.brightness))).size).toBeGreaterThan(1);
  });
});

describe('demo protocol layouts', () => {
  test('every layout has the size of the payload the library encodes or requires', () => {
    expect(sizeOf(HEADER_FIELDS)).toBe(36);
    const sizes: Record<string, number> = {
      SetColor: SetColor({ ...RED }).payload.length,
      SetPower: SetPower(true).payload.length,
      SetLabel: SetLabel('x').payload.length,
      SetLightPower: SetLightPower(true).payload.length,
      SetWaveform: SetWaveform({ ...RED, periodMs: 1, cycles: 1, waveform: Waveform.SAW }).payload.length,
      SetColorZones: SetColorZones({ startIndex: 0, endIndex: 0, ...RED }).payload.length,
      GetColorZones: GetColorZones({ startIndex: 0, endIndex: 0 }).payload.length,
      SetExtendedColorZones: SetExtendedColorZones({ zoneIndex: 0, colors: [RED] }).payload.length,
      SetMultiZoneEffect: SetMultiZoneEffect({ instanceId: 1, effectType: MultiZoneEffectType.OFF, speedMs: 1, durationNs: 0n }).payload.length,
      Get64: Get64({ tileIndex: 0 }).payload.length,
      Set64: Set64({ tileIndex: 0, colors: [] }).payload.length,
      SetTileEffect: SetTileEffect({ instanceId: 1, effectType: TileEffectType.OFF, speedMs: 1, durationNs: 0n, palette: [] }).payload.length,
      EchoRequest: EchoRequest(new Uint8Array(1)).payload.length,
      // Replies: the minimum the library's decoders accept.
      LightState: 52,
      StateMultiZone: 66,
      StateExtendedColorZones: 661,
      State64: 517,
      StateTileEffect: 187,
      StateMultiZoneEffect: 59,
    };
    for (const [name, size] of Object.entries(sizes)) {
      const layout = Object.entries(LAYOUTS).find(([key]) => key === name)?.[1];
      expect(layout).toBeDefined();
      expect({ name, size: sizeOf(layout!) }).toEqual({ name, size });
    }
    expect(sizeOf(layoutFor(702, new Uint8Array(882)))).toBe(882);
  });

  test('a library-encoded request parses to the values it was built from', () => {
    const payload = SetWaveform({ ...GREEN, transient: true, periodMs: 1500, cycles: 2.5, skewRatio: -1000, waveform: Waveform.PULSE }).payload;
    const parsed = readStruct(LAYOUTS.SetWaveform, payload);
    expect(parsed.bool('transient')).toBe(true);
    expect(parsed.color('color')).toEqual(GREEN);
    expect(parsed.number('period')).toBe(1500);
    expect(parsed.number('cycles')).toBe(2.5);
    expect(parsed.number('skew_ratio')).toBe(-1000);
    expect(parsed.number('waveform')).toBe(Waveform.PULSE);
    expect(() => readStruct(LAYOUTS.SetWaveform, payload.subarray(0, 20))).toThrow();
  });

  test('typeName follows the Type constants', () => {
    expect(typeName(102)).toBe('SetColor');
    expect(typeName(45)).toBe('Acknowledgement');
    expect(typeName(9999)).toBe('Unknown(9999)');
  });
});

describe('demo raw packet lab', () => {
  const bytesOf = (name: string): Uint8Array => {
    const preset = RAW_PACKETS.find((candidate) => candidate.name === name);
    const bytes = preset && parseHex(preset.hex);
    if (!bytes) throw new Error(`no raw packet named ${name}`);
    return bytes;
  };

  test('the hand-written datagrams are the frames their descriptions claim', () => {
    expect(decodeHeader(bytesOf('All lights green'))).toMatchObject({ size: 49, tagged: true, type: 102, source: 0 });
    expect(readStruct(LAYOUTS.SetColor, bytesOf('All lights green').subarray(36)).color('color'))
      .toEqual({ hue: 0x5555, saturation: 65535, brightness: 65535, kelvin: 3500 });
    expect(decodeHeader(bytesOf('Who is out there?'))).toMatchObject({ size: 36, tagged: true, type: 2, source: 42, resRequired: true });
    expect(decodeHeader(bytesOf('Everything off'))).toMatchObject({ size: 38, tagged: true, type: 21 });
    expect(() => decodeHeader(bytesOf('A broken frame'))).toThrow();
  });

  test('typed bytes sent straight to the network change every device', async () => {
    socket.send(bytesOf('All lights green'), 56700, '255.255.255.255');
    await new Promise((resolve) => setTimeout(resolve, 20));
    for (const device of fleet) {
      for (const pixel of device.frame(performance.now() + 2000).colors) {
        expect(pixel).toEqual({ hue: 0x5555, saturation: 65535, brightness: 65535, kelvin: 3500 });
      }
    }
    // A frame whose size field lies is dropped without changing anything.
    const before = fleet.map((device) => device.received);
    socket.send(bytesOf('A broken frame'), 56700, '255.255.255.255');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fleet.map((device) => device.received)).toEqual(before);
  });
});
