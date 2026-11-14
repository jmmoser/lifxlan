/**
 * The controller: the page's use of the library. A Router, a Devices
 * registry and a Client are wired to a socket exactly the way
 * `lifxlan/node` wires them to `node:dgram` — the socket just happens to be
 * on the in-memory network instead of a real one.
 *
 * Every action the page offers ends in a call made here, and every call is
 * recorded with the source text that produced it, so the wire log can show
 * the line of code next to the datagrams it put on the network.
 */
import {
  Client,
  Devices,
  EchoRequest,
  Get64,
  GetColor,
  GetColorZones,
  GetDeviceChain,
  GetExtendedColorZones,
  GetHostFirmware,
  GetInfrared,
  GetLabel,
  GetVersion,
  GetWifiInfo,
  MultiZoneEffectType,
  Router,
  Set64,
  SetColor,
  SetColorZones,
  SetExtendedColorZones,
  SetLabel,
  SetLightPower,
  SetMultiZoneEffect,
  SetTileEffect,
  SetWaveform,
  TileEffectSkyType,
  TileEffectType,
  TimeoutError,
  Waveform,
  convertSignalToRssi,
} from '../../../src/index.js';
import type { Color, Device, ReceivedMessage } from '../../../src/index.js';
import { discover } from '../../../src/discovery.js';
import type { Discovery } from '../../../src/discovery.js';
import { Products } from '../../../src/products.js';
import type { ProductFeatures } from '../../../src/products.js';
import { PRODUCTS_EXCERPT } from '../sim/fleet.js';
import type { Endpoint, VirtualLan, VirtualSocket } from '../sim/lan.js';
import { hsbk } from './color.js';
import { literal } from './format.js';
import { PALETTES, PATTERNS, plasma, zoneGradient } from './presets.js';
import type { TileAt } from './presets.js';

export type LampKind = 'bulb' | 'strip' | 'tiles';
export type TileEffectName = 'off' | 'morph' | 'dusk' | 'flame' | 'sunrise' | 'sunset' | 'clouds';
export type WaveformName = 'breathe' | 'pulse' | 'strobe' | 'saw' | 'triangle';
export type SceneName = 'sunset' | 'aurora' | 'fireside' | 'focus';

/** What the controller knows about a device — all of it learned over the wire. */
export interface Lamp {
  readonly device: Device;
  /** The variable name the device goes by in the code the log shows. */
  name: string;
  label: string;
  kind: LampKind;
  ready: boolean;
  productName: string;
  features: ProductFeatures | undefined;
  firmware: string;
  rssi: number | undefined;
  power: boolean;
  color: Color;
  /** Strip: the last known color of every zone. */
  zones: Color[];
  moving: boolean;
  /** Tiles: where each tile sits, and the last known frame of each. */
  tiles: TileAt[];
  frames: Color[][];
  tileEffect: TileEffectName;
}

export type CallStatus = 'pending' | 'sent' | 'ok' | 'error';

/** One library call the page made. */
export interface Call {
  readonly id: number;
  code: string;
  readonly at: number;
  status: CallStatus;
  /** How many times a repeated fire-and-forget call has been folded into this record. */
  count: number;
  elapsedMs: number | undefined;
  result: unknown;
  error: unknown;
  readonly streamKey: string | undefined;
}

export interface SessionListener {
  call?(call: Call): void;
  callUpdated?(call: Call): void;
  lampsChanged?(): void;
  /** Every inbound message the Router decoded (its `onMessage` tap). */
  message?(message: ReceivedMessage): void;
}

const camel = (label: string): string => {
  const words = label.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'device';
  const name = words.map((word, i) => (i === 0 ? word.toLowerCase() : word[0]!.toUpperCase() + word.slice(1).toLowerCase())).join('');
  return /^[0-9]/.test(name) ? `device${name}` : name;
};

export class Session {
  readonly endpoint: Endpoint = { address: '192.168.1.10', port: 51700 };
  readonly router: Router;
  readonly devices: Devices;
  readonly client: Client;
  readonly products = Products(PRODUCTS_EXCERPT);
  readonly lamps: Lamp[] = [];
  /** How long `client.send()` waits for a reply before rejecting. */
  readonly timeoutMs = 1500;

  timeouts = 0;
  partying = false;
  plasmaFor: Lamp | undefined;

  private readonly socket: VirtualSocket;
  private readonly listeners = new Set<SessionListener>();
  private discovery: Discovery | undefined;
  private nextCallId = 1;
  /** Fire-and-forget streams still being folded into one record each. */
  private readonly streams = new Map<string, Call>();
  private animation: ReturnType<typeof setInterval> | undefined;
  private effectInstance = 1;

  constructor(lan: VirtualLan) {
    // The same four lines as openLan() in src/node.ts, minus node:dgram.
    this.router = Router({
      onSend: (message, port, address) => this.socket.send(message, port, address),
      onMessage: (message) => this.emit((listener) => listener.message?.(message)),
    });
    this.devices = Devices();
    this.client = Client({ router: this.router, defaultTimeoutMs: this.timeoutMs });
    this.socket = lan.bind(this.endpoint, (bytes, remote) => {
      this.devices.register(remote.port, remote.address, this.router.receive(bytes));
    });
  }

  listen(listener: SessionListener): void {
    this.listeners.add(listener);
  }

  private emit(notify: (listener: SessionListener) => void): void {
    for (const listener of this.listeners) notify(listener);
  }

  private changed(): void {
    this.emit((listener) => listener.lampsChanged?.());
  }

  /** Puts raw bytes on the network from the controller's socket, bypassing the library's encoder. */
  sendRaw(bytes: Uint8Array, address: string, port: number): void {
    this.socket.send(bytes, port, address);
  }

  /* ---------------------------------------------------------------- */
  /* Call recording                                                    */
  /* ---------------------------------------------------------------- */

  private begin(code: string, status: CallStatus, streamKey?: string): Call {
    const call: Call = {
      id: this.nextCallId++, code, at: performance.now(), status, count: 1,
      elapsedMs: undefined, result: undefined, error: undefined, streamKey,
    };
    this.emit((listener) => listener.call?.(call));
    return call;
  }

  /** Runs an awaited library call, recording its source, outcome and duration. */
  async track<R>(code: string, run: () => Promise<R>): Promise<R> {
    this.streams.clear();
    const call = this.begin(code, 'pending');
    try {
      const result = await run();
      call.status = 'ok';
      call.result = result;
      return result;
    } catch (error) {
      call.status = 'error';
      call.error = error;
      if (error instanceof TimeoutError) this.timeouts++;
      throw error;
    } finally {
      call.elapsedMs = performance.now() - call.at;
      this.emit((listener) => listener.callUpdated?.(call));
    }
  }

  /**
   * Runs a fire-and-forget library call. Repeats of the same stream (a
   * slider being dragged, an animation) fold into one record with a count.
   */
  fire(streamKey: string, code: string, run: () => void): void {
    const now = performance.now();
    const open = this.streams.get(streamKey);
    if (open && now - open.at - (open.elapsedMs ?? 0) < 1200) {
      run();
      open.count++;
      open.code = code;
      open.elapsedMs = now - open.at;
      this.emit((listener) => listener.callUpdated?.(open));
      return;
    }
    this.streams.set(streamKey, this.begin(code, 'sent', streamKey));
    run();
  }

  /* ---------------------------------------------------------------- */
  /* Discovery                                                         */
  /* ---------------------------------------------------------------- */

  startDiscovery(): void {
    const discovery = discover(this.router, this.devices);
    this.discovery = discovery;
    this.begin('for await (const device of discover(router, devices)) { … }', 'sent');
    void (async () => {
      for await (const device of discovery) {
        void this.identify(device).catch(() => { /* the failed call is already in the log */ });
      }
    })();
  }

  /** Forgets every device and discovers them again. */
  rescan(): void {
    this.stopAnimation();
    this.discovery?.dispose();
    for (const lamp of this.lamps.splice(0)) this.devices.remove(lamp.device.serialNumber);
    this.changed();
    this.startDiscovery();
  }

  /** Learns what a newly discovered device is by asking it. */
  private async identify(device: Device): Promise<void> {
    const { client } = this;
    const lamp: Lamp = {
      device, name: 'device', label: device.serialNumber, kind: 'bulb', ready: false,
      productName: '', features: undefined, firmware: '', rssi: undefined,
      power: false, color: hsbk(0, 0, 0), zones: [], moving: false, tiles: [], frames: [], tileEffect: 'off',
    };
    this.lamps.push(lamp);
    this.lamps.sort((a, b) => a.device.address.localeCompare(b.device.address, undefined, { numeric: true }));
    this.changed();

    lamp.label = await this.track('await client.send(GetLabel(), device)', () => client.send(GetLabel(), device));
    lamp.name = camel(lamp.label);
    const n = lamp.name;
    this.changed();

    const version = await this.track(`await client.send(GetVersion(), ${n})`, () => client.send(GetVersion(), device));
    const firmware = await this.track(`await client.send(GetHostFirmware(), ${n})`, () => client.send(GetHostFirmware(), device));
    lamp.productName = this.products.get(version.vendor, version.product)?.name ?? `Product ${version.product}`;
    lamp.features = this.products.features(version.vendor, version.product, firmware);
    lamp.firmware = `${firmware.versionMajor}.${firmware.versionMinor}`;
    lamp.kind = lamp.features?.matrix ? 'tiles' : lamp.features?.multizone ? 'strip' : 'bulb';

    const wifi = await this.track(`await client.send(GetWifiInfo(), ${n})`, () => client.send(GetWifiInfo(), device));
    lamp.rssi = convertSignalToRssi(wifi.signal);

    await this.readState(lamp);
    if (lamp.kind === 'strip') await this.readZones(lamp, lamp.features?.extended_multizone === true);
    if (lamp.kind === 'tiles') {
      await this.readChain(lamp);
      await this.readTiles(lamp);
    }
    lamp.ready = true;
    this.changed();
  }

  /* ---------------------------------------------------------------- */
  /* Any light                                                         */
  /* ---------------------------------------------------------------- */

  async readState(lamp: Lamp): Promise<void> {
    const state = await this.track(`await client.send(GetColor(), ${lamp.name})`, () => this.client.send(GetColor(), lamp.device));
    lamp.color = { hue: state.hue, saturation: state.saturation, brightness: state.brightness, kelvin: state.kelvin };
    lamp.power = state.power > 0;
    lamp.label = state.label;
    this.changed();
  }

  /** Sets the whole device to one color and waits for the acknowledgement. */
  async setColor(lamp: Lamp, color: Color, durationMs: number): Promise<void> {
    const options = { ...color, durationMs };
    lamp.color = color;
    lamp.zones = lamp.zones.map(() => color);
    lamp.frames = lamp.frames.map((frame) => frame.map(() => color));
    await this.track(`await client.send(SetColor(${literal(options)}), ${lamp.name})`, () => this.client.send(SetColor(options), lamp.device));
  }

  /** The same change without waiting for anything — for a slider being dragged. */
  streamColor(lamp: Lamp, color: Color, durationMs: number): void {
    const options = { ...color, durationMs };
    lamp.color = color;
    this.fire(`color:${lamp.device.serialNumber}`, `client.sendUnacknowledged(SetColor(${literal(options)}), ${lamp.name})`,
      () => this.client.sendUnacknowledged(SetColor(options), lamp.device));
  }

  async setPower(lamp: Lamp, on: boolean, durationMs: number): Promise<void> {
    lamp.power = on;
    this.changed();
    await this.track(`await client.send(SetLightPower(${on}, ${durationMs}), ${lamp.name})`, () => this.client.send(SetLightPower(on, durationMs), lamp.device));
  }

  async rename(lamp: Lamp, label: string): Promise<void> {
    await this.track(`await client.send(SetLabel(${literal(label)}), ${lamp.name})`, () => this.client.send(SetLabel(label), lamp.device));
    lamp.label = await this.track(`await client.send(GetLabel(), ${lamp.name})`, () => this.client.send(GetLabel(), lamp.device));
    this.changed();
  }

  /** Sends 64 random bytes and checks the device returns the same 64. Resolves with the round-trip time. */
  async ping(lamp: Lamp): Promise<number> {
    const sent = crypto.getRandomValues(new Uint8Array(64));
    const started = performance.now();
    const echoed = await this.track(`await client.send(EchoRequest(randomBytes), ${lamp.name})`, () => this.client.send(EchoRequest(sent), lamp.device));
    if (!sent.every((byte, i) => byte === echoed[i])) throw new Error('the echo did not match what was sent');
    return performance.now() - started;
  }

  async waveform(lamp: Lamp, name: WaveformName): Promise<void> {
    const swing = hsbk(lamp.color.hue / 65535 * 360 + 150, 1, 1, lamp.color.kelvin);
    const shapes = {
      breathe: { waveform: Waveform.SINE, periodMs: 2000, cycles: 3 },
      pulse: { waveform: Waveform.PULSE, periodMs: 600, cycles: 5 },
      strobe: { waveform: Waveform.PULSE, periodMs: 120, cycles: 20, skewRatio: -16000 },
      saw: { waveform: Waveform.SAW, periodMs: 1200, cycles: 4 },
      triangle: { waveform: Waveform.TRIANGLE, periodMs: 1500, cycles: 3 },
    } satisfies Record<WaveformName, { waveform: Waveform; periodMs: number; cycles: number; skewRatio?: number }>;
    const options = { transient: true, ...swing, ...shapes[name] };
    const shown = literal(options).replace(/waveform: \d+/, `waveform: Waveform.${Object.keys(Waveform)[options.waveform]}`);
    await this.track(`await client.send(SetWaveform(${shown}), ${lamp.name})`, () => this.client.send(SetWaveform(options), lamp.device));
  }

  /** Asks a device for something it does not have, to show the rejection. */
  async unsupported(lamp: Lamp): Promise<void> {
    await this.track(`await client.send(GetInfrared(), ${lamp.name})`, () => this.client.send(GetInfrared(), lamp.device));
  }

  /* ---------------------------------------------------------------- */
  /* Strip                                                             */
  /* ---------------------------------------------------------------- */

  async readZones(lamp: Lamp, extended: boolean): Promise<void> {
    const zones = extended
      ? await this.track(`await client.send(GetExtendedColorZones(), ${lamp.name})`, () => this.client.send(GetExtendedColorZones(), lamp.device))
      : await this.track(`await client.send(GetColorZones({ startIndex: 0, endIndex: 255 }), ${lamp.name})`,
        () => this.client.send(GetColorZones({ startIndex: 0, endIndex: 255 }), lamp.device));
    lamp.zones = zones.colors;
    this.changed();
  }

  async setGradient(lamp: Lamp, colors: Color[], durationMs: number): Promise<void> {
    const options = { zoneIndex: 0, colors, durationMs };
    lamp.zones = colors;
    await this.track(`await client.send(SetExtendedColorZones(${literal(options)}), ${lamp.name})`,
      () => this.client.send(SetExtendedColorZones(options), lamp.device));
  }

  paintZone(lamp: Lamp, index: number, color: Color): void {
    const options = { startIndex: index, endIndex: index, ...color };
    lamp.zones[index] = color;
    this.fire(`zone:${lamp.device.serialNumber}`, `client.sendUnacknowledged(SetColorZones(${literal(options)}), ${lamp.name})`,
      () => this.client.sendUnacknowledged(SetColorZones(options), lamp.device));
  }

  async setMove(lamp: Lamp, on: boolean, speedMs: number, forward: boolean): Promise<void> {
    const parameters = new Uint8Array(32);
    parameters[4] = forward ? 1 : 0;
    const options = {
      instanceId: this.effectInstance++,
      effectType: on ? MultiZoneEffectType.MOVE : MultiZoneEffectType.OFF,
      speedMs,
      durationNs: 0n,
      parameters,
    };
    const shown = `{ instanceId: ${options.instanceId}, effectType: MultiZoneEffectType.${on ? 'MOVE' : 'OFF'}, speedMs: ${speedMs}, durationNs: 0n, parameters }`;
    await this.track(`await client.send(SetMultiZoneEffect(${shown}), ${lamp.name})`, () => this.client.send(SetMultiZoneEffect(options), lamp.device));
    lamp.moving = on;
    this.changed();
    // Stopping the effect leaves the zones where they scrolled to.
    if (!on) await this.readZones(lamp, lamp.features?.extended_multizone === true);
  }

  /* ---------------------------------------------------------------- */
  /* Tiles                                                             */
  /* ---------------------------------------------------------------- */

  async readChain(lamp: Lamp): Promise<void> {
    const chain = await this.track(`await client.send(GetDeviceChain(), ${lamp.name})`, () => this.client.send(GetDeviceChain(), lamp.device));
    lamp.tiles = chain.devices.map((tile) => ({ x: tile.userX, y: tile.userY }));
    this.changed();
  }

  async readTiles(lamp: Lamp): Promise<void> {
    const options = { tileIndex: 0, tileCount: lamp.tiles.length };
    const frames = await this.track(`await client.send(Get64(${literal(options)}), ${lamp.name})`, () => this.client.send(Get64(options), lamp.device));
    lamp.frames = frames.map((frame) => frame.colors);
    this.changed();
  }

  async setTileEffect(lamp: Lamp, effect: TileEffectName): Promise<void> {
    if (this.plasmaFor === lamp) this.stopAnimation();
    const base = { instanceId: this.effectInstance++, durationNs: 0n };
    const settings = {
      off: { effectType: TileEffectType.OFF, speedMs: 1000, palette: [] },
      morph: { effectType: TileEffectType.MORPH, speedMs: 6000, palette: PALETTES.aurora },
      dusk: { effectType: TileEffectType.MORPH, speedMs: 9000, palette: PALETTES.dusk },
      flame: { effectType: TileEffectType.FLAME, speedMs: 4000, palette: [] },
      sunrise: { effectType: TileEffectType.SKY, speedMs: 20000, skyType: TileEffectSkyType.SUNRISE, palette: [] },
      sunset: { effectType: TileEffectType.SKY, speedMs: 20000, skyType: TileEffectSkyType.SUNSET, palette: [] },
      clouds: { effectType: TileEffectType.SKY, speedMs: 8000, skyType: TileEffectSkyType.CLOUDS, cloudSaturationMin: 40, cloudSaturationMax: 200, palette: [] },
    } satisfies Record<TileEffectName, object>;
    const options = { ...base, ...settings[effect] };
    const typeName = Object.keys(TileEffectType)[Object.values(TileEffectType).indexOf(options.effectType)] ?? 'OFF';
    const shown = literal(options)
      .replace(/effectType: \d+/, `effectType: TileEffectType.${typeName}`)
      .replace(/skyType: (\d+)/, (_, value: string) => `skyType: TileEffectSkyType.${Object.keys(TileEffectSkyType)[Number(value)]}`)
      .replace('/* 5 colors */ colors', 'aurora')
      .replace('/* 4 colors */ colors', 'dusk');
    await this.track(`await client.send(SetTileEffect(${shown}), ${lamp.name})`, () => this.client.send(SetTileEffect(options), lamp.device));
    lamp.tileEffect = effect;
    this.changed();
  }

  /** Writes one frame per tile, all at once, and waits for every acknowledgement. */
  async setFrames(lamp: Lamp, frames: Color[][], durationMs: number): Promise<void> {
    if (lamp.tileEffect !== 'off') await this.setTileEffect(lamp, 'off');
    lamp.frames = frames;
    const code = `await Promise.all(frames.map((colors, tileIndex) =>\n  client.send(Set64({ tileIndex, colors, durationMs: ${durationMs} }), ${lamp.name})))`;
    await this.track(code, () => Promise.all(frames.map((colors, tileIndex) => this.client.send(Set64({ tileIndex, colors, durationMs }), lamp.device))));
  }

  async setPattern(lamp: Lamp, name: string, durationMs: number): Promise<void> {
    if (this.plasmaFor === lamp) this.stopAnimation();
    const pattern = PATTERNS.find((candidate) => candidate.name === name) ?? PATTERNS[0]!;
    await this.setFrames(lamp, pattern.frames(lamp.tiles), durationMs);
  }

  paintPixel(lamp: Lamp, tileIndex: number, pixel: number, color: Color): void {
    const frame = lamp.frames[tileIndex];
    if (!frame) return;
    frame[pixel] = color;
    this.fire(`pixel:${lamp.device.serialNumber}`, `client.sendUnacknowledged(Set64({ tileIndex: ${tileIndex}, colors }), ${lamp.name})`,
      () => this.client.sendUnacknowledged(Set64({ tileIndex, colors: frame }), lamp.device));
  }

  /* ---------------------------------------------------------------- */
  /* Client-driven animation                                           */
  /* ---------------------------------------------------------------- */

  stopAnimation(): void {
    if (this.animation !== undefined) clearInterval(this.animation);
    this.animation = undefined;
    this.partying = false;
    this.plasmaFor = undefined;
    this.changed();
  }

  private streamFrames(lamp: Lamp, frames: Color[][], key: string): void {
    lamp.frames = frames;
    this.fire(key, `for (const [tileIndex, colors] of frames.entries())\n  client.sendUnacknowledged(Set64({ tileIndex, colors }), ${lamp.name})`, () => {
      frames.forEach((colors, tileIndex) => this.client.sendUnacknowledged(Set64({ tileIndex, colors }), lamp.device));
    });
  }

  /** Streams a plasma animation to the tiles: 5 packets a frame, 12 frames a second, none acknowledged. */
  async startPlasma(lamp: Lamp): Promise<void> {
    this.stopAnimation();
    if (lamp.tileEffect !== 'off') await this.setTileEffect(lamp, 'off');
    this.plasmaFor = lamp;
    const started = performance.now();
    this.animation = setInterval(() => {
      this.streamFrames(lamp, plasma(lamp.tiles, (performance.now() - started) / 1000), `plasma:${lamp.device.serialNumber}`);
    }, 83);
    this.changed();
  }

  /** The hue sweep of examples/color-cycle.ts, across every device at once. */
  async startParty(): Promise<void> {
    this.stopAnimation();
    const lamps = this.lamps.filter((lamp) => lamp.ready);
    await Promise.all(lamps.map(async (lamp) => {
      if (!lamp.power) await this.setPower(lamp, true, 300);
      if (lamp.kind === 'tiles' && lamp.tileEffect !== 'off') await this.setTileEffect(lamp, 'off');
      if (lamp.kind === 'strip' && lamp.moving) await this.setMove(lamp, false, 3000, true);
    }));
    this.partying = true;
    const started = performance.now();
    const frameMs = 100;
    this.animation = setInterval(() => {
      const t = (performance.now() - started) / 1000;
      const hue = (t * 100) % 360;
      lamps.forEach((lamp, i) => {
        if (lamp.kind === 'bulb') {
          this.streamColor(lamp, hsbk(hue + i * 120, 1, 1), frameMs);
        } else if (lamp.kind === 'strip') {
          const colors = lamp.zones.map((_, zone) => hsbk(hue + zone * (360 / lamp.zones.length), 1, 1));
          lamp.zones = colors;
          this.fire(`party:${lamp.device.serialNumber}`, `client.sendUnacknowledged(SetExtendedColorZones({ zoneIndex: 0, colors, durationMs: ${frameMs} }), ${lamp.name})`,
            () => this.client.sendUnacknowledged(SetExtendedColorZones({ zoneIndex: 0, colors, durationMs: frameMs }), lamp.device));
        } else {
          this.streamFrames(lamp, plasma(lamp.tiles, t), `party:${lamp.device.serialNumber}`);
        }
      });
    }, frameMs);
    this.changed();
  }

  /* ---------------------------------------------------------------- */
  /* Scenes                                                            */
  /* ---------------------------------------------------------------- */

  /** Sets every device at once. Each device's calls run in parallel with the others'. */
  async scene(name: SceneName): Promise<void> {
    this.stopAnimation();
    const fade = 1500;
    const bulbColors = {
      sunset: [hsbk(28, 0.9, 0.75), hsbk(8, 0.95, 0.5)],
      aurora: [hsbk(165, 1, 0.45), hsbk(275, 0.9, 0.5)],
      fireside: [hsbk(24, 0.85, 0.55, 2000), hsbk(16, 0.9, 0.35, 2000)],
      focus: [hsbk(0, 0, 1, 5000), hsbk(0, 0, 0.9, 4500)],
    } satisfies Record<SceneName, Color[]>;
    const gradients = { sunset: 'Sunset', aurora: 'Aurora', fireside: 'Ember', focus: 'Reading' } satisfies Record<SceneName, string>;
    const effects = { sunset: 'dusk', aurora: 'morph', fireside: 'flame', focus: 'off' } satisfies Record<SceneName, TileEffectName>;

    let bulb = 0;
    await Promise.all(this.lamps.filter((lamp) => lamp.ready).map(async (lamp) => {
      if (!lamp.power) await this.setPower(lamp, true, fade);
      if (lamp.kind === 'bulb') {
        await this.setColor(lamp, bulbColors[name][bulb++ % 2]!, fade);
      } else if (lamp.kind === 'strip') {
        if (lamp.moving) await this.setMove(lamp, false, 3000, true);
        await this.setGradient(lamp, zoneGradient(gradients[name], lamp.zones.length), fade);
        if (name === 'aurora') await this.setMove(lamp, true, 9000, true);
      } else {
        if (name === 'focus') {
          if (lamp.tileEffect !== 'off') await this.setTileEffect(lamp, 'off');
          await this.setColor(lamp, hsbk(0, 0, 0.35, 4000), fade);
        } else {
          await this.setTileEffect(lamp, effects[name]);
        }
      }
    }));
    this.changed();
  }

  async allPower(on: boolean): Promise<void> {
    if (!on) this.stopAnimation();
    await Promise.all(this.lamps.filter((lamp) => lamp.ready).map((lamp) => this.setPower(lamp, on, 800)));
  }
}
