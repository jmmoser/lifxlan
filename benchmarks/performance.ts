/**
 * Performance benchmark suite for lifxlan core operations.
 * Run with: bun run bench
 *
 * Payloads carry realistic counts (a full strip, a five-tile chain, a
 * four-button switch): the decoders skip the wire format's padding, so an
 * all-zero payload would measure nothing but the bounds check.
 */

import { bench, group, run } from 'mitata';
import {
  encode,
  decodeHeader,
  decodeLightState,
  decodeStateMultiZone,
  decodeStateExtendedColorZones,
  decodeStateTileEffect,
  decodeStateDeviceChain,
  decodeState64,
  decodeStateButton,
  decodeStateInfo,
  decodeStateGroup,
  decodeStateMultiZoneEffect,
  decodeStateHostFirmware,
  decodeStateWifiInfo,
} from '../src/wire.js';
import type { Color, Header } from '../src/wire.js';
import { Router } from '../src/router.js';
import { Client } from '../src/client.js';
import { Devices, Device } from '../src/devices.js';
import {
  GetColor,
  GetColorZones,
  GetExtendedColorZones,
  Get64,
  GetPower,
  GetService,
  Set64,
  SetColor,
  SetColorZones,
  SetExtendedColorZones,
  SetPower,
  SetTileEffect,
  SetWaveform,
} from '../src/commands/index.js';
import { NO_TARGET } from '../src/constants/core.js';
import { TileEffectType, Waveform } from '../src/constants/index.js';
import { Type } from '../src/constants/types.js';

const device = Device({
  serialNumber: 'abcdef123456',
  port: 1234,
  address: '1.2.3.4',
});

function colors(count: number): Color[] {
  return Array.from({ length: count }, (_, i) => ({
    hue: (i * 800) % 65536,
    saturation: 65535,
    brightness: 32768,
    kelvin: 3500,
  }));
}

/* ---- wire payloads ---- */

const statePower = new Uint8Array([0xFF, 0xFF]);

const lightState = new Uint8Array(52);
new DataView(lightState.buffer).setUint16(0, 21845, true);
lightState.set(new TextEncoder().encode('Kitchen Light'), 12);

function multiZone(zonesCount: number, zoneIndex: number): Uint8Array {
  const payload = new Uint8Array(66);
  payload[0] = zonesCount;
  payload[1] = zoneIndex;
  return payload;
}

const extendedZones = new Uint8Array(5 + 82 * 8);
new DataView(extendedZones.buffer).setUint16(0, 82, true);
extendedZones[4] = 82;

const tileEffect = new Uint8Array(187);
tileEffect[58] = 16;

function deviceChain(count: number): Uint8Array {
  const payload = new Uint8Array(882);
  payload[881] = count;
  return payload;
}

function state64(tileIndex: number): Uint8Array {
  const payload = new Uint8Array(5 + 64 * 8);
  payload[0] = tileIndex;
  payload[4] = 8;
  return payload;
}

const stateButton = new Uint8Array(3 + 8 * 101);
stateButton[0] = 4;
stateButton[2] = 4;
for (let i = 0; i < 4; i++) {
  stateButton[3 + i * 101] = 2;
}

/**
 * A client whose router answers every request synchronously: `reply` is
 * handed the request header and a function that delivers one response
 * packet.
 */
function loopback(reply: (header: Header, respond: (type: number, payload?: Uint8Array) => void) => void) {
  const client = Client({
    defaultTimeoutMs: 0,
    router: Router({
      onSend(message) {
        const header = decodeHeader(message);
        reply(header, (type, payload) => {
          client.router.receive(
            encode(false, header.source, header.target, false, false, header.sequence, type, payload),
          );
        });
      },
    }),
  });
  return client;
}

group('Framing', () => {
  const getPower = GetPower();
  bench('encode', () => {
    encode(false, 1, device.target, true, false, 0, getPower.type, undefined);
  });

  const message = encode(true, 12345, NO_TARGET, true, true, 42, 102, new Uint8Array(13));
  bench('decodeHeader', () => {
    decodeHeader(message);
  });

  const router = Router({ onSend() {} });
  bench('router.receive', () => {
    router.receive(message);
  });

  const devices = Devices();
  const stateService = router.receive(
    encode(false, 2, device.target, false, false, 0, Type.StateService, new Uint8Array(5)),
  );
  bench('devices.register (known device)', () => {
    devices.register(56700, '1.2.3.4', stateService);
  });
});

group('Client', () => {
  const getPower = GetPower();
  const getColor = GetColor();
  const setPower = SetPower(true);

  const powerClient = loopback((_header, respond) => respond(Type.StatePower, statePower));
  bench('send GetPower', async () => {
    await powerClient.send(getPower, device);
  });

  const colorClient = loopback((_header, respond) => respond(Type.LightState, lightState));
  bench('send GetColor', async () => {
    await colorClient.send(getColor, device);
  });

  const ackClient = loopback((_header, respond) => respond(Type.Acknowledgement));
  bench('send SetPower (ack)', async () => {
    await ackClient.send(setPower, device);
  });

  const quiet = Client({ router: Router({ onSend() {} }) });
  bench('sendUnacknowledged', () => {
    quiet.sendUnacknowledged(setPower, device);
  });

  const getService = GetService();
  bench('broadcast', () => {
    quiet.broadcast(getService);
  });
});

group('Multi-packet exchanges', () => {
  const zonePackets = Array.from({ length: 10 }, (_, i) => multiZone(80, i * 8));
  const zonesClient = loopback((_header, respond) => {
    for (const packet of zonePackets) respond(Type.StateMultiZone, packet);
  });
  const getZones = GetColorZones({ startIndex: 0, endIndex: 255 });
  bench('GetColorZones (80 zones, 10 packets)', async () => {
    await zonesClient.send(getZones, device);
  });

  const extendedClient = loopback((_header, respond) => respond(Type.StateExtendedColorZones, extendedZones));
  const getExtended = GetExtendedColorZones();
  bench('GetExtendedColorZones (82 zones)', async () => {
    await extendedClient.send(getExtended, device);
  });

  const tilePackets = Array.from({ length: 5 }, (_, i) => state64(i));
  const tilesClient = loopback((_header, respond) => {
    for (const packet of tilePackets) respond(Type.State64, packet);
  });
  const get64 = Get64({ tileIndex: 0, tileCount: 5 });
  bench('Get64 (5 tiles)', async () => {
    await tilesClient.send(get64, device);
  });
});

group('Command construction', () => {
  const colors64 = colors(64);
  const colors82 = colors(82);
  const palette = colors(16);

  bench('SetPower', () => {
    SetPower(true);
  });
  bench('SetColor', () => {
    SetColor({ hue: 21845, saturation: 65535, brightness: 65535, kelvin: 3500, durationMs: 1000 });
  });
  bench('SetWaveform', () => {
    SetWaveform({ hue: 1, saturation: 2, brightness: 3, kelvin: 3500, periodMs: 1000, cycles: 3, waveform: Waveform.SINE });
  });
  bench('SetColorZones', () => {
    SetColorZones({ startIndex: 0, endIndex: 7, hue: 1, saturation: 2, brightness: 3, kelvin: 3500 });
  });
  bench('SetExtendedColorZones (82 colors)', () => {
    SetExtendedColorZones({ zoneIndex: 0, colors: colors82 });
  });
  bench('Set64 (64 colors)', () => {
    Set64({ tileIndex: 0, colors: colors64 });
  });
  bench('SetTileEffect (16 palette)', () => {
    SetTileEffect({ instanceId: 1, effectType: TileEffectType.MORPH, speedMs: 1000, durationNs: 0n, palette });
  });
});

group('Payload decoders', () => {
  bench('decodeLightState', () => {
    decodeLightState(lightState);
  });

  const multiZonePayload = multiZone(80, 0);
  bench('decodeStateMultiZone (8 colors)', () => {
    decodeStateMultiZone(multiZonePayload);
  });

  bench('decodeStateExtendedColorZones (82 colors)', () => {
    decodeStateExtendedColorZones(extendedZones);
  });

  bench('decodeStateTileEffect (16 palette)', () => {
    decodeStateTileEffect(tileEffect);
  });

  const multiZoneEffectPayload = new Uint8Array(59);
  bench('decodeStateMultiZoneEffect', () => {
    decodeStateMultiZoneEffect(multiZoneEffectPayload);
  });

  const chain = deviceChain(5);
  bench('decodeStateDeviceChain (5 devices)', () => {
    decodeStateDeviceChain(chain);
  });

  const tile = state64(0);
  bench('decodeState64', () => {
    decodeState64(tile);
  });

  bench('decodeStateButton (4 buttons)', () => {
    decodeStateButton(stateButton);
  });

  const stateInfoPayload = new Uint8Array(24);
  bench('decodeStateInfo', () => {
    decodeStateInfo(stateInfoPayload);
  });

  const stateGroupPayload = new Uint8Array(56);
  bench('decodeStateGroup', () => {
    decodeStateGroup(stateGroupPayload);
  });

  const hostFirmwarePayload = new Uint8Array(20);
  bench('decodeStateHostFirmware', () => {
    decodeStateHostFirmware(hostFirmwarePayload);
  });

  const wifiInfoPayload = new Uint8Array(14);
  bench('decodeStateWifiInfo', () => {
    decodeStateWifiInfo(wifiInfoPayload);
  });
});

await run();
