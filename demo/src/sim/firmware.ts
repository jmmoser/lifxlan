/**
 * The device side of the LIFX LAN protocol: a simulated bulb, light strip,
 * or tile chain that listens on the virtual network, parses the requests it
 * is sent, changes its own state, and answers with State and
 * Acknowledgement messages.
 *
 * It is deliberately a separate implementation from the library under
 * test. Request payloads are parsed with the demo's own layout tables
 * (`protocol/layouts.ts`), never with library code; from the library it
 * borrows only the two public framing helpers of `lifxlan/encoding`
 * (`decodeHeader`, `encode`). Nothing here can be reached except through
 * bytes on the network.
 */
import { MultiZoneApplicationRequest, MultiZoneEffectType, PORT, ServiceType, TileEffectSkyType, TileEffectType, Type, Waveform } from '../../../src/index.js';
import { decodeHeader, encode, getPayload } from '../../../src/encoding.js';
import type { Color, Header } from '../../../src/index.js';
import { LAYOUTS, deviceChainLayout, packStruct, readStruct } from '../protocol/layouts.js';
import type { Field, Struct, Value } from '../protocol/layouts.js';
import type { Endpoint, VirtualLan, VirtualSocket } from './lan.js';

export type DeviceKind = 'bulb' | 'strip' | 'tiles';

export interface TilePosition {
  /** Position in tile widths, as SetUserPosition stores it. */
  readonly x: number;
  readonly y: number;
}

export interface DeviceSpec {
  readonly kind: DeviceKind;
  /** 12 hex digits. */
  readonly serial: string;
  readonly address: string;
  readonly label: string;
  readonly product: number;
  readonly firmware: { readonly major: number; readonly minor: number; readonly build: Date };
  /** Wi-Fi signal strength in milliwatts, as StateWifiInfo reports it. */
  readonly signal: number;
  readonly group: { readonly id: string; readonly label: string };
  readonly location: { readonly id: string; readonly label: string };
  /** Zone count of a strip. */
  readonly zones?: number;
  /** One entry per tile of a chain. */
  readonly tiles?: readonly TilePosition[];
  readonly color: Color;
  readonly power: boolean;
}

/** What a device is emitting right now. */
export interface DeviceFrame {
  /** 0 (off) to 1 (on), mid-fade values in between. */
  readonly power: number;
  /** One color per bulb, zone, or tile pixel (tiles: 64 per tile, row-major). */
  readonly colors: readonly Color[];
}

const VENDOR_LIFX = 1;
const TILE_PIXELS = 64;
const TILE_WIDTH = 8;
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Color math                                                          */
/* ------------------------------------------------------------------ */

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Blends two HSBK colors, taking the short way around the hue circle. */
export function mixColor(a: Color, b: Color, t: number): Color {
  let delta = b.hue - a.hue;
  if (delta > 32768) delta -= 65536;
  if (delta < -32768) delta += 65536;
  // A color with no saturation or brightness has no meaningful hue: adopt
  // the other side's so a fade from white does not sweep through a rainbow.
  let hue: number;
  if (a.saturation === 0 || a.brightness === 0) hue = b.hue;
  else if (b.saturation === 0 || b.brightness === 0) hue = a.hue;
  else hue = (a.hue + delta * t + 65536) % 65536;
  return {
    hue,
    saturation: lerp(a.saturation, b.saturation, t),
    brightness: lerp(a.brightness, b.brightness, t),
    kelvin: lerp(a.kelvin, b.kelvin, t),
  };
}

/**
 * Blends two colors as light rather than as numbers: hue and saturation are
 * treated as a point on the color wheel, so blue fading to orange passes
 * through pale tones instead of sweeping through green.
 */
function blendLight(a: Color, b: Color, t: number): Color {
  const point = (c: Color) => {
    const angle = (c.hue / 65536) * TAU;
    return { x: Math.cos(angle) * c.saturation, y: Math.sin(angle) * c.saturation };
  };
  const pa = point(a);
  const pb = point(b);
  const x = lerp(pa.x, pb.x, t);
  const y = lerp(pa.y, pb.y, t);
  return {
    hue: ((Math.atan2(y, x) / TAU) * 65536 + 65536) % 65536,
    saturation: Math.min(65535, Math.hypot(x, y)),
    brightness: lerp(a.brightness, b.brightness, t),
    kelvin: lerp(a.kelvin, b.kelvin, t),
  };
}

function wireColor(c: Color): Color {
  return {
    hue: Math.round(c.hue) % 65536,
    saturation: Math.round(c.saturation),
    brightness: Math.round(c.brightness),
    kelvin: Math.round(c.kelvin),
  };
}

const hsbk = (hueDegrees: number, saturation: number, brightness: number, kelvin = 3500): Color => ({
  hue: (((hueDegrees % 360) + 360) % 360) / 360 * 65535,
  saturation: clamp01(saturation) * 65535,
  brightness: clamp01(brightness) * 65535,
  kelvin,
});

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

/** One emitter and the fade it is in the middle of. */
interface Pixel {
  from: Color;
  to: Color;
  start: number;
  duration: number;
}

interface PowerFade {
  from: number;
  to: number;
  start: number;
  duration: number;
}

interface WaveformState {
  transient: boolean;
  color: Color;
  setHue: boolean;
  setSaturation: boolean;
  setBrightness: boolean;
  setKelvin: boolean;
  periodMs: number;
  cycles: number;
  duty: number;
  waveform: number;
  start: number;
}

interface ZoneEffect {
  instanceId: number;
  type: number;
  speedMs: number;
  durationNs: bigint;
  parameters: Uint8Array;
  start: number;
}

interface TileEffect {
  instanceId: number;
  type: number;
  speedMs: number;
  durationNs: bigint;
  skyType: number;
  cloudSaturationMin: number;
  cloudSaturationMax: number;
  palette: Color[];
  start: number;
}

interface Reply {
  type: number;
  payload?: Uint8Array;
}

function samplePixel(p: Pixel, now: number): Color {
  if (p.duration <= 0 || now >= p.start + p.duration) return p.to;
  return mixColor(p.from, p.to, clamp01((now - p.start) / p.duration));
}

function wave(kind: number, phase: number, duty: number): number {
  switch (kind) {
    case Waveform.SAW: return phase;
    case Waveform.SINE: return (1 - Math.cos(TAU * phase)) / 2;
    case Waveform.HALF_SINE: return Math.sin(Math.PI * phase);
    case Waveform.TRIANGLE: return phase < 0.5 ? phase * 2 : 2 - phase * 2;
    case Waveform.PULSE: return phase < duty ? 1 : 0;
    default: return 0;
  }
}

const serialToTarget = (serial: string): Uint8Array => {
  const target = new Uint8Array(6);
  for (let i = 0; i < 6; i++) target[i] = parseInt(serial.slice(i * 2, i * 2 + 2), 16);
  return target;
};

const uuidBytes = (hex: string): Uint8Array => {
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

const toNs = (ms: number): bigint => BigInt(Math.round(ms)) * 1_000_000n;

/* ------------------------------------------------------------------ */
/* The device                                                          */
/* ------------------------------------------------------------------ */

export class VirtualDevice {
  readonly spec: DeviceSpec;
  /** How many datagrams this device has accepted. */
  received = 0;

  private readonly target: Uint8Array;
  private readonly clock: () => number;
  private readonly bootedAt: number;
  private readonly lan: VirtualLan;
  private socket: VirtualSocket | undefined;
  private address: string;

  private label: string;
  private power: PowerFade;
  private readonly pixels: Pixel[];
  private waveform: WaveformState | undefined;
  private zoneEffect: ZoneEffect | undefined;
  private tileEffect: TileEffect | undefined;
  /** Zone colors buffered by SetColorZones / SetExtendedColorZones with NO_APPLY. */
  private staged: (Color | undefined)[] = [];
  private tilePositions: TilePosition[];
  private group: { id: Uint8Array; label: string; updatedAt: bigint };
  private location: { id: Uint8Array; label: string; updatedAt: bigint };

  constructor(spec: DeviceSpec, lan: VirtualLan, clock: () => number = () => performance.now(), online = true) {
    this.spec = spec;
    this.lan = lan;
    this.clock = clock;
    this.bootedAt = clock();
    this.target = serialToTarget(spec.serial);
    this.address = spec.address;
    this.tilePositions = [...(spec.tiles ?? [])];

    const count = spec.kind === 'strip' ? (spec.zones ?? 16)
      : spec.kind === 'tiles' ? this.tilePositions.length * TILE_PIXELS
        : 1;
    this.pixels = Array.from({ length: count }, () => ({ from: spec.color, to: spec.color, start: 0, duration: 0 }));
    this.label = spec.label;
    this.power = { from: 0, to: 0, start: 0, duration: 0 };
    const stamp = toNs(Date.now());
    this.group = { id: uuidBytes(spec.group.id), label: spec.group.label, updatedAt: stamp };
    this.location = { id: uuidBytes(spec.location.id), label: spec.location.label, updatedAt: stamp };
    this.reset();

    if (online) this.plugIn();
  }

  /** Where the device is on the network right now. */
  get endpoint(): Endpoint {
    return { address: this.address, port: PORT };
  }

  /** Whether the device has mains power and is on the network. */
  get online(): boolean {
    return this.socket !== undefined;
  }

  /** Gives the device mains power: it joins the network, at `address` if given. */
  plugIn(address?: string): void {
    this.unplug();
    if (address !== undefined) this.address = address;
    this.socket = this.lan.bind(this.endpoint, (bytes, remote) => this.receive(bytes, remote));
  }

  /** Cuts mains power: the device goes dark and stops answering. It keeps its settings, as a real one does. */
  unplug(): void {
    this.socket?.close();
    this.socket = undefined;
  }

  /** Restores the state the device shipped with. */
  reset(): void {
    const { spec } = this;
    this.label = spec.label;
    const level = spec.power ? 65535 : 0;
    this.power = { from: level, to: level, start: 0, duration: 0 };
    for (const pixel of this.pixels) {
      pixel.from = spec.color;
      pixel.to = spec.color;
      pixel.start = 0;
      pixel.duration = 0;
    }
    this.waveform = undefined;
    this.zoneEffect = undefined;
    this.tileEffect = undefined;
    this.staged = [];
    this.tilePositions = [...(spec.tiles ?? [])];
  }

  /** Which self-running animations the device is in the middle of. */
  running(now: number = this.clock()): { readonly waveform: boolean; readonly zoneEffect: boolean; readonly tileEffect: number } {
    this.settle(now);
    return {
      waveform: this.waveform !== undefined,
      zoneEffect: this.zoneEffect !== undefined,
      tileEffect: this.tileEffect?.type ?? TileEffectType.OFF,
    };
  }

  get pixelCount(): number {
    return this.pixels.length;
  }

  get tileLayout(): readonly TilePosition[] {
    return this.tilePositions;
  }

  /** The label as the device currently stores it (SetLabel changes it). */
  get currentLabel(): string {
    return this.label;
  }

  /* ---------------------------------------------------------------- */
  /* Network                                                           */
  /* ---------------------------------------------------------------- */

  private receive(bytes: Uint8Array, remote: Endpoint): void {
    let header: Header;
    try {
      header = decodeHeader(bytes);
    } catch {
      return; // not a LIFX frame: a real device drops it without a word
    }
    if (header.protocol !== 1024 || !header.addressable) return;

    const addressedToAll = header.target.every((byte) => byte === 0);
    const addressedToMe = header.target.every((byte, i) => byte === this.target[i]);
    if (!addressedToAll && !addressedToMe) return;

    this.received++;
    const now = this.clock();
    this.settle(now);

    let replies: Reply[];
    try {
      replies = this.handle(header, getPayload(bytes, 0, header.size), now);
    } catch {
      return; // a payload shorter than its message type: dropped
    }

    if (header.ackRequired) {
      this.reply(header, remote, { type: Type.Acknowledgement });
    }
    for (const reply of replies) {
      this.reply(header, remote, reply);
    }
  }

  private reply(request: Header, remote: Endpoint, reply: Reply): void {
    // A reply echoes the request's source and sequence — that is the whole
    // of how a client tells which request it answers.
    const bytes = encode(false, request.source, this.target, false, false, request.sequence, reply.type, reply.payload);
    this.socket?.send(bytes, remote.port, remote.address);
  }

  /* ---------------------------------------------------------------- */
  /* Message handling                                                  */
  /* ---------------------------------------------------------------- */

  private handle(header: Header, payload: Uint8Array, now: number): Reply[] {
    const { type, resRequired } = header;
    const read = (fields: readonly Field[]): Struct => readStruct(fields, payload);
    // A Set answers with its State only when asked to.
    const whenAsked = (reply: Reply): Reply[] => (resRequired ? [reply] : []);

    switch (type) {
      /* Device */
      case Type.GetService:
        return [{ type: Type.StateService, payload: packStruct(LAYOUTS.StateService, { service: ServiceType.UDP, port: PORT }) }];
      case Type.GetHostFirmware:
        return [{ type: Type.StateHostFirmware, payload: this.firmwarePayload() }];
      case Type.GetWifiFirmware:
        return [{ type: Type.StateWifiFirmware, payload: this.firmwarePayload() }];
      case Type.GetWifiInfo:
        return [{ type: Type.StateWifiInfo, payload: packStruct(LAYOUTS.StateWifiInfo, { signal: this.spec.signal }) }];
      case Type.GetPower:
        return [this.statePower(Type.StatePower, now)];
      case Type.SetPower: {
        const reply = this.statePower(Type.StatePower, now);
        this.setPower(read(LAYOUTS.SetPower).number('level'), 0, now);
        return whenAsked(reply);
      }
      case Type.GetLabel:
        return [this.stateLabel()];
      case Type.SetLabel: {
        const reply = this.stateLabel();
        this.label = read(LAYOUTS.SetLabel).text('label');
        return whenAsked(reply);
      }
      case Type.GetVersion:
        return [{ type: Type.StateVersion, payload: packStruct(LAYOUTS.StateVersion, { vendor: VENDOR_LIFX, product: this.spec.product }) }];
      case Type.GetInfo:
        return [{
          type: Type.StateInfo,
          payload: packStruct(LAYOUTS.StateInfo, { time: toNs(Date.now()), uptime: toNs(now - this.bootedAt), downtime: 0n }),
        }];
      case Type.GetLocation:
        return [this.stateLabelledId(Type.StateLocation, LAYOUTS.StateLocation, 'location', this.location)];
      case Type.SetLocation: {
        const reply = this.stateLabelledId(Type.StateLocation, LAYOUTS.StateLocation, 'location', this.location);
        const p = read(LAYOUTS.SetLocation);
        this.location = { id: p.bytes('location'), label: p.text('label'), updatedAt: p.bigint('updated_at') };
        return whenAsked(reply);
      }
      case Type.GetGroup:
        return [this.stateLabelledId(Type.StateGroup, LAYOUTS.StateGroup, 'group', this.group)];
      case Type.SetGroup: {
        const reply = this.stateLabelledId(Type.StateGroup, LAYOUTS.StateGroup, 'group', this.group);
        const p = read(LAYOUTS.SetGroup);
        this.group = { id: p.bytes('group'), label: p.text('label'), updatedAt: p.bigint('updated_at') };
        return whenAsked(reply);
      }
      case Type.EchoRequest:
        return [{ type: Type.EchoResponse, payload: packStruct(LAYOUTS.EchoResponse, { echoing: read(LAYOUTS.EchoRequest).bytes('echoing') }) }];

      /* Light */
      case Type.GetColor:
        return [this.lightState(now)];
      case Type.SetColor: {
        const reply = this.lightState(now);
        const p = read(LAYOUTS.SetColor);
        this.waveform = undefined;
        const target = p.color('color');
        const duration = p.number('duration');
        for (let i = 0; i < this.pixels.length; i++) this.setPixel(i, target, duration, now);
        return whenAsked(reply);
      }
      case Type.SetWaveform:
      case Type.SetWaveformOptional: {
        const reply = this.lightState(now);
        const optional = type === Type.SetWaveformOptional;
        const p = read(optional ? LAYOUTS.SetWaveformOptional : LAYOUTS.SetWaveform);
        // Freeze whatever is showing now: it is the color the waveform
        // swings away from and (when transient) comes back to.
        for (let i = 0; i < this.pixels.length; i++) this.setPixel(i, this.shown(i, now), 0, now);
        this.waveform = {
          transient: p.bool('transient'),
          color: p.color('color'),
          setHue: optional ? p.bool('set_hue') : true,
          setSaturation: optional ? p.bool('set_saturation') : true,
          setBrightness: optional ? p.bool('set_brightness') : true,
          setKelvin: optional ? p.bool('set_kelvin') : true,
          periodMs: Math.max(1, p.number('period')),
          cycles: p.number('cycles'),
          duty: (p.number('skew_ratio') + 32768) / 65535,
          waveform: p.number('waveform'),
          start: now,
        };
        return whenAsked(reply);
      }
      case Type.GetLightPower:
        return [this.statePower(Type.StateLightPower, now)];
      case Type.SetLightPower: {
        const reply = this.statePower(Type.StateLightPower, now);
        const p = read(LAYOUTS.SetLightPower);
        this.setPower(p.number('level'), p.number('duration'), now);
        return whenAsked(reply);
      }
    }

    if (this.spec.kind === 'strip') {
      const replies = this.handleMultiZone(type, read, whenAsked, now);
      if (replies) return replies;
    }
    if (this.spec.kind === 'tiles') {
      const replies = this.handleTile(type, read, whenAsked, now);
      if (replies) return replies;
    }

    // Anything else — infrared on a bulb without it, zones on a bulb, a type
    // from a newer protocol — is answered with StateUnhandled.
    return [{ type: Type.StateUnhandled, payload: packStruct(LAYOUTS.StateUnhandled, { unhandled_type: type }) }];
  }

  private handleMultiZone(
    type: number,
    read: (fields: readonly Field[]) => Struct,
    whenAsked: (reply: Reply) => Reply[],
    now: number,
  ): Reply[] | undefined {
    const count = this.pixels.length;
    switch (type) {
      case Type.GetColorZones: {
        const p = read(LAYOUTS.GetColorZones);
        return this.stateZones(p.number('start_index'), p.number('end_index'), now);
      }
      case Type.SetColorZones: {
        const p = read(LAYOUTS.SetColorZones);
        const start = p.number('start_index');
        const end = Math.min(p.number('end_index'), count - 1);
        const reply = this.stateZones(start, end, now);
        const apply = p.number('apply');
        if (apply !== MultiZoneApplicationRequest.APPLY_ONLY) {
          const target = p.color('color');
          for (let i = start; i <= end; i++) this.staged[i] = target;
        }
        if (apply !== MultiZoneApplicationRequest.NO_APPLY) this.applyStaged(p.number('duration'), now);
        return reply.flatMap(whenAsked);
      }
      case Type.GetExtendedColorZones:
        return [this.stateExtendedZones(now)];
      case Type.SetExtendedColorZones: {
        const reply = this.stateExtendedZones(now);
        const p = read(LAYOUTS.SetExtendedColorZones);
        const apply = p.number('apply');
        if (apply !== MultiZoneApplicationRequest.APPLY_ONLY) {
          const list = p.colors('colors');
          const first = p.number('zone_index');
          const n = Math.min(p.number('colors_count'), list.length);
          for (let i = 0; i < n && first + i < count; i++) this.staged[first + i] = list[i];
        }
        if (apply !== MultiZoneApplicationRequest.NO_APPLY) this.applyStaged(p.number('duration'), now);
        return whenAsked(reply);
      }
      case Type.GetMultiZoneEffect:
        return [this.stateZoneEffect()];
      case Type.SetMultiZoneEffect: {
        const reply = this.stateZoneEffect();
        const p = read(LAYOUTS.SetMultiZoneEffect);
        const effectType = p.number('type');
        // Whatever the running effect is showing becomes the zones' colors,
        // so stopping (or restarting) it does not snap them back.
        this.bakeZoneEffect(now);
        this.zoneEffect = effectType === MultiZoneEffectType.OFF ? undefined : {
          instanceId: p.number('instanceid'),
          type: effectType,
          speedMs: Math.max(1, p.number('speed')),
          durationNs: p.bigint('duration'),
          parameters: p.bytes('parameters'),
          start: now,
        };
        return whenAsked(reply);
      }
    }
    return undefined;
  }

  private handleTile(
    type: number,
    read: (fields: readonly Field[]) => Struct,
    whenAsked: (reply: Reply) => Reply[],
    now: number,
  ): Reply[] | undefined {
    const tiles = this.tilePositions.length;
    switch (type) {
      case Type.GetDeviceChain: {
        const values: Record<string, Value> = { start_index: 0, tile_devices_count: tiles };
        this.tilePositions.forEach((position, i) => {
          const p = `tile[${i}].`;
          values[`${p}accel_meas_z`] = 16384; // hanging flat on a wall
          values[`${p}user_x`] = position.x;
          values[`${p}user_y`] = position.y;
          values[`${p}width`] = TILE_WIDTH;
          values[`${p}height`] = TILE_WIDTH;
          values[`${p}vendor`] = VENDOR_LIFX;
          values[`${p}product`] = this.spec.product;
          values[`${p}firmware_build`] = toNs(this.spec.firmware.build.getTime());
          values[`${p}version_minor`] = this.spec.firmware.minor;
          values[`${p}version_major`] = this.spec.firmware.major;
        });
        return [{ type: Type.StateDeviceChain, payload: packStruct(deviceChainLayout(tiles), values) }];
      }
      case Type.SetUserPosition: {
        const p = read(LAYOUTS.SetUserPosition);
        const index = p.number('tile_index');
        if (index < tiles) this.tilePositions[index] = { x: p.number('user_x'), y: p.number('user_y') };
        return [];
      }
      case Type.Get64: {
        const p = read(LAYOUTS.Get64);
        const first = p.number('tile_index');
        const replies: Reply[] = [];
        for (let t = first; t < first + p.number('length') && t < tiles; t++) {
          const frame: Color[] = [];
          for (let i = 0; i < TILE_PIXELS; i++) frame.push(wireColor(this.shown(t * TILE_PIXELS + i, now)));
          replies.push({
            type: Type.State64,
            payload: packStruct(LAYOUTS.State64, { tile_index: t, x: p.number('x'), y: p.number('y'), width: p.number('width'), colors: frame }),
          });
        }
        return replies;
      }
      case Type.Set64: {
        const p = read(LAYOUTS.Set64);
        const first = p.number('tile_index');
        const width = Math.max(1, p.number('width'));
        const list = p.colors('colors');
        const duration = p.number('duration');
        this.waveform = undefined;
        for (let t = first; t < first + p.number('length') && t < tiles; t++) {
          for (let i = 0; i < list.length; i++) {
            const x = p.number('x') + (i % width);
            const y = p.number('y') + Math.floor(i / width);
            if (x < TILE_WIDTH && y < TILE_WIDTH) this.setPixel(t * TILE_PIXELS + y * TILE_WIDTH + x, list[i]!, duration, now);
          }
        }
        return [];
      }
      case Type.GetTileEffect:
        return [this.stateTileEffect()];
      case Type.SetTileEffect: {
        const reply = this.stateTileEffect();
        const p = read(LAYOUTS.SetTileEffect);
        const effectType = p.number('type');
        this.tileEffect = effectType === TileEffectType.OFF ? undefined : {
          instanceId: p.number('instanceid'),
          type: effectType,
          speedMs: Math.max(1, p.number('speed')),
          durationNs: p.bigint('duration'),
          skyType: p.number('sky_type'),
          cloudSaturationMin: p.number('cloud_saturation_min'),
          cloudSaturationMax: p.number('cloud_saturation_max'),
          palette: p.colors('palette').slice(0, Math.min(16, p.number('palette_count'))),
          start: now,
        };
        return whenAsked(reply);
      }
    }
    return undefined;
  }

  /* ---------------------------------------------------------------- */
  /* State replies                                                     */
  /* ---------------------------------------------------------------- */

  private firmwarePayload(): Uint8Array {
    const { build, minor, major } = this.spec.firmware;
    return packStruct(LAYOUTS.StateHostFirmware, { build: toNs(build.getTime()), version_minor: minor, version_major: major });
  }

  private statePower(type: number, now: number): Reply {
    // Both StatePower and StateLightPower are one uint16 level.
    return { type, payload: packStruct(LAYOUTS.StatePower, { level: this.powerLevel(now) > 0 ? 65535 : 0 }) };
  }

  private stateLabel(): Reply {
    return { type: Type.StateLabel, payload: packStruct(LAYOUTS.StateLabel, { label: this.label }) };
  }

  private stateLabelledId(type: number, layout: readonly Field[], idField: string, value: { id: Uint8Array; label: string; updatedAt: bigint }): Reply {
    return { type, payload: packStruct(layout, { [idField]: value.id, label: value.label, updated_at: value.updatedAt }) };
  }

  private lightState(now: number): Reply {
    return {
      type: Type.LightState,
      payload: packStruct(LAYOUTS.LightState, {
        color: wireColor(this.shown(0, now)),
        power: this.powerLevel(now) > 0 ? 65535 : 0,
        label: this.label,
      }),
    };
  }

  private stateZones(start: number, end: number, now: number): Reply[] {
    const count = this.pixels.length;
    const last = Math.min(end, count - 1);
    if (start > last) return [];
    if (start === last) {
      return [{
        type: Type.StateZone,
        payload: packStruct(LAYOUTS.StateZone, { zones_count: count, zone_index: start, color: wireColor(this.shown(start, now)) }),
      }];
    }
    // More than one zone is answered in packets of 8, aligned to the
    // device's own grid rather than to the requested start.
    const replies: Reply[] = [];
    for (let first = Math.floor(start / 8) * 8; first <= last; first += 8) {
      const group: Color[] = [];
      for (let i = first; i < first + 8 && i < count; i++) group.push(wireColor(this.shown(i, now)));
      replies.push({
        type: Type.StateMultiZone,
        payload: packStruct(LAYOUTS.StateMultiZone, { zones_count: count, zone_index: first, colors: group }),
      });
    }
    return replies;
  }

  private stateExtendedZones(now: number): Reply {
    const count = Math.min(this.pixels.length, 82);
    const list: Color[] = [];
    for (let i = 0; i < count; i++) list.push(wireColor(this.shown(i, now)));
    return {
      type: Type.StateExtendedColorZones,
      payload: packStruct(LAYOUTS.StateExtendedColorZones, { zones_count: this.pixels.length, zone_index: 0, colors_count: count, colors: list }),
    };
  }

  private stateZoneEffect(): Reply {
    const e = this.zoneEffect;
    return {
      type: Type.StateMultiZoneEffect,
      payload: packStruct(LAYOUTS.StateMultiZoneEffect, e ? {
        instanceid: e.instanceId, type: e.type, speed: e.speedMs, duration: e.durationNs, parameters: e.parameters,
      } : { type: MultiZoneEffectType.OFF }),
    };
  }

  private stateTileEffect(): Reply {
    const e = this.tileEffect;
    return {
      type: Type.StateTileEffect,
      payload: packStruct(LAYOUTS.StateTileEffect, e ? {
        instanceid: e.instanceId, type: e.type, speed: e.speedMs, duration: e.durationNs,
        sky_type: e.skyType, cloud_saturation_min: e.cloudSaturationMin, cloud_saturation_max: e.cloudSaturationMax,
        palette_count: e.palette.length, palette: e.palette.map(wireColor),
      } : { type: TileEffectType.OFF }),
    };
  }

  /* ---------------------------------------------------------------- */
  /* State changes                                                     */
  /* ---------------------------------------------------------------- */

  private powerLevel(now: number): number {
    const p = this.power;
    if (p.duration <= 0 || now >= p.start + p.duration) return p.to;
    return lerp(p.from, p.to, clamp01((now - p.start) / p.duration));
  }

  private setPower(level: number, duration: number, now: number): void {
    this.power = { from: this.powerLevel(now), to: level > 0 ? 65535 : 0, start: now, duration };
  }

  private setPixel(index: number, target: Color, duration: number, now: number): void {
    const pixel = this.pixels[index];
    if (!pixel) return;
    pixel.from = samplePixel(pixel, now);
    pixel.to = target;
    pixel.start = now;
    pixel.duration = duration;
  }

  private applyStaged(duration: number, now: number): void {
    this.staged.forEach((target, i) => {
      if (target) this.setPixel(i, target, duration, now);
    });
    this.staged = [];
  }

  private bakeZoneEffect(now: number): void {
    if (!this.zoneEffect) return;
    const showing = this.pixels.map((_, i) => this.shown(i, now));
    this.zoneEffect = undefined;
    showing.forEach((c, i) => this.setPixel(i, c, 0, now));
  }

  /** Ends anything whose time is up: a finished waveform, an expired effect. */
  private settle(now: number): void {
    const w = this.waveform;
    if (w && now >= w.start + w.periodMs * w.cycles) {
      this.waveform = undefined;
      if (!w.transient) {
        for (let i = 0; i < this.pixels.length; i++) {
          this.setPixel(i, this.waveformTarget(w, samplePixel(this.pixels[i]!, now)), 0, now);
        }
      }
    }
    const z = this.zoneEffect;
    if (z && z.durationNs > 0n && now - z.start >= Number(z.durationNs / 1_000_000n)) this.bakeZoneEffect(now);
    const t = this.tileEffect;
    if (t && t.durationNs > 0n && now - t.start >= Number(t.durationNs / 1_000_000n)) this.tileEffect = undefined;
  }

  private waveformTarget(w: WaveformState, base: Color): Color {
    return {
      hue: w.setHue ? w.color.hue : base.hue,
      saturation: w.setSaturation ? w.color.saturation : base.saturation,
      brightness: w.setBrightness ? w.color.brightness : base.brightness,
      kelvin: w.setKelvin ? w.color.kelvin : base.kelvin,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Light output                                                      */
  /* ---------------------------------------------------------------- */

  /** The color emitter `index` is showing at `now`, effects included. */
  private shown(index: number, now: number): Color {
    if (this.tileEffect) return this.tileEffectColor(this.tileEffect, index, now);

    let base: Color;
    const z = this.zoneEffect;
    if (z && z.type === MultiZoneEffectType.MOVE) {
      // One trip along the whole strip per `speed` milliseconds; the second
      // 32-bit parameter is the direction.
      const count = this.pixels.length;
      const forward = z.parameters[4] === 1;
      const shift = ((now - z.start) / z.speedMs) * count * (forward ? 1 : -1);
      const position = (((index - shift) % count) + count) % count;
      const low = Math.floor(position);
      base = mixColor(
        samplePixel(this.pixels[low % count]!, now),
        samplePixel(this.pixels[(low + 1) % count]!, now),
        position - low,
      );
    } else {
      const pixel = this.pixels[index];
      if (!pixel) return hsbk(0, 0, 0);
      base = samplePixel(pixel, now);
    }

    const w = this.waveform;
    if (!w) return base;
    const elapsed = now - w.start;
    if (elapsed >= w.periodMs * w.cycles) return w.transient ? base : this.waveformTarget(w, base);
    const phase = (elapsed % w.periodMs) / w.periodMs;
    return mixColor(base, this.waveformTarget(w, base), wave(w.waveform, phase, w.duty));
  }

  private tileEffectColor(e: TileEffect, index: number, now: number): Color {
    const tile = Math.floor(index / TILE_PIXELS);
    const x = index % TILE_WIDTH;
    const y = Math.floor((index % TILE_PIXELS) / TILE_WIDTH);
    const position = this.tilePositions[tile] ?? { x: 0, y: 0 };
    // Pixel coordinates across the whole chain, so patterns run from tile to tile.
    const gx = position.x * TILE_WIDTH + x;
    const gy = position.y * TILE_WIDTH + y;
    const t = (now - e.start) / e.speedMs;

    switch (e.type) {
      case TileEffectType.MORPH: {
        const palette = e.palette.length > 0 ? e.palette : [hsbk(200, 1, 1), hsbk(300, 1, 1)];
        const field = Math.sin(gx * 0.31 + t * 2.1) + Math.sin(gy * 0.37 - t * 1.7)
          + Math.sin((gx + gy) * 0.22 + t * 1.3) + Math.sin(Math.hypot(gx - 18, gy - 3) * 0.42 - t * 2.6);
        const at = (((field / 8 + 0.5 + t * 0.15) % 1) + 1) % 1 * palette.length;
        const low = Math.floor(at) % palette.length;
        return mixColor(palette[low]!, palette[(low + 1) % palette.length]!, at - Math.floor(at));
      }
      case TileEffectType.FLAME: {
        const height = (TILE_WIDTH - 1 - y) / (TILE_WIDTH - 1);
        const flicker = 0.5 + 0.5 * Math.sin(gx * 1.7 + t * 9 + Math.sin(gx * 0.6 - t * 5) * 2);
        const lick = 0.5 + 0.5 * Math.sin(gx * 0.9 - t * 6.5 + gy * 0.8);
        const heat = clamp01(1.15 - height * (1.1 + 0.9 * flicker) + 0.25 * lick * (1 - height));
        return hsbk(4 + heat * 44, 1 - 0.35 * heat ** 3, heat ** 1.4, 2700);
      }
      case TileEffectType.SKY: {
        const elevation = (TILE_WIDTH - 1 - y) / (TILE_WIDTH - 1);
        if (e.skyType === TileEffectSkyType.CLOUDS) {
          const cloud = clamp01(0.5 + 0.5 * Math.sin(gx * 0.33 + t * 1.6 + Math.sin(gy * 0.9 + t * 0.7) * 1.4) - 0.15 + 0.25 * Math.sin(gx * 0.11 - t));
          const low = e.cloudSaturationMin / 255;
          const high = Math.max(low, e.cloudSaturationMax / 255);
          return hsbk(212, lerp(high, low, cloud), 0.55 + 0.45 * cloud, 6500);
        }
        // The sun climbs (SUNRISE) or sinks (SUNSET) once over `speed` milliseconds.
        const progress = clamp01(t);
        const sun = e.skyType === TileEffectSkyType.SUNSET ? 1 - progress : progress;
        const day = clamp01((sun - 0.12) / 0.5);
        const night = hsbk(236, 0.9, 0.05 + 0.07 * (1 - elevation));
        const noon = hsbk(210, 0.78 - 0.3 * (1 - elevation), 0.55 + 0.45 * (1 - elevation), 6500);
        // Twilight: a band of orange and pink that hugs the horizon while the sun is low.
        const twilight = Math.exp(-(((sun - 0.24) / 0.2) ** 2)) * (1 - elevation) ** 1.3;
        const glow = hsbk(lerp(345, 392, 1 - elevation), 0.95, 0.5 + 0.5 * (1 - elevation), 2700);
        return blendLight(blendLight(night, noon, day), glow, clamp01(twilight * 1.15));
      }
      default:
        return samplePixel(this.pixels[index]!, now);
    }
  }

  /** What the device is emitting right now — the only thing the stage draws. */
  frame(now: number = this.clock()): DeviceFrame {
    this.settle(now);
    const list: Color[] = [];
    for (let i = 0; i < this.pixels.length; i++) list.push(this.shown(i, now));
    // Without mains power nothing shines, whatever the device remembers.
    return { power: this.online ? this.powerLevel(now) / 65535 : 0, colors: list };
  }
}
