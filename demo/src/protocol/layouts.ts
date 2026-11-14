/**
 * Byte layouts of the LIFX LAN messages the demo touches, written out
 * independently of the library from the public protocol documentation.
 *
 * Two things use them:
 *
 * - the simulated devices (`sim/firmware.ts`), which parse requests and
 *   build State replies with `readStruct()` / `packStruct()`;
 * - the packet inspector, which labels every byte of a captured datagram.
 *
 * The library never sees this file. It encodes requests and decodes replies
 * with its own code (`src/wire.ts`), so the two only agree if both speak
 * the same wire format — `tests/demo-sim.test.ts` holds them to it.
 */
import { Type } from '../../../src/index.js';
import type { Color } from '../../../src/index.js';

export type Kind =
  | 'u8' | 'u16' | 'u32' | 'i16' | 'f32' | 'u64'
  | 'bool' | 'string' | 'bytes' | 'time'
  | 'color' | 'colors' | 'reserved';

export interface Field {
  readonly name: string;
  readonly kind: Kind;
  /** Width in bytes. */
  readonly size: number;
}

export type Value = number | bigint | boolean | string | Uint8Array | Color | Color[];

const field = (kind: Kind, size: number) => (name: string): Field => ({ name, kind, size });

export const u8 = field('u8', 1);
export const u16 = field('u16', 2);
export const u32 = field('u32', 4);
export const i16 = field('i16', 2);
export const f32 = field('f32', 4);
export const u64 = field('u64', 8);
export const bool = field('bool', 1);
/** Nanoseconds since the epoch, as a uint64. */
export const time = field('time', 8);
export const color = field('color', 8);
export const text = (name: string, size: number): Field => ({ name, kind: 'string', size });
export const bytes = (name: string, size: number): Field => ({ name, kind: 'bytes', size });
export const colors = (name: string, count: number): Field => ({ name, kind: 'colors', size: count * 8 });
export const reserved = (size: number): Field => ({ name: 'reserved', kind: 'reserved', size });

export function sizeOf(fields: readonly Field[]): number {
  let size = 0;
  for (const f of fields) size += f.size;
  return size;
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export interface Entry {
  readonly field: Field;
  readonly offset: number;
  /** `undefined` for reserved bytes. */
  readonly value: Value | undefined;
}

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function readColor(view: DataView, offset: number): Color {
  return {
    hue: view.getUint16(offset, true),
    saturation: view.getUint16(offset + 2, true),
    brightness: view.getUint16(offset + 4, true),
    kelvin: view.getUint16(offset + 6, true),
  };
}

function readValue(f: Field, payload: Uint8Array, view: DataView, offset: number): Value | undefined {
  switch (f.kind) {
    case 'u8': return view.getUint8(offset);
    case 'u16': return view.getUint16(offset, true);
    case 'u32': return view.getUint32(offset, true);
    case 'i16': return view.getInt16(offset, true);
    case 'f32': return view.getFloat32(offset, true);
    case 'u64':
    case 'time': return view.getBigUint64(offset, true);
    case 'bool': return view.getUint8(offset) !== 0;
    case 'string': {
      let end = offset;
      while (end < offset + f.size && payload[end] !== 0) end++;
      return textDecoder.decode(payload.subarray(offset, end));
    }
    case 'bytes': return payload.slice(offset, offset + f.size);
    case 'color': return readColor(view, offset);
    case 'colors': {
      const list: Color[] = [];
      for (let i = 0; i < f.size; i += 8) list.push(readColor(view, offset + i));
      return list;
    }
    case 'reserved': return undefined;
  }
}

function isColor(value: Value | undefined): value is Color {
  return typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array);
}

/** A parsed payload: every field with its offset, plus typed lookups by name. */
export class Struct {
  constructor(readonly entries: readonly Entry[]) {}

  private value(name: string): Value | undefined {
    for (const entry of this.entries) {
      if (entry.field.name === name) return entry.value;
    }
    throw new Error(`no field named ${name}`);
  }

  number(name: string): number {
    const value = this.value(name);
    if (typeof value !== 'number') throw new Error(`${name} is not a number`);
    return value;
  }

  bigint(name: string): bigint {
    const value = this.value(name);
    if (typeof value !== 'bigint') throw new Error(`${name} is not a uint64`);
    return value;
  }

  bool(name: string): boolean {
    const value = this.value(name);
    if (typeof value !== 'boolean') throw new Error(`${name} is not a bool`);
    return value;
  }

  text(name: string): string {
    const value = this.value(name);
    if (typeof value !== 'string') throw new Error(`${name} is not a string`);
    return value;
  }

  bytes(name: string): Uint8Array {
    const value = this.value(name);
    if (!(value instanceof Uint8Array)) throw new Error(`${name} is not a byte array`);
    return value;
  }

  color(name: string): Color {
    const value = this.value(name);
    if (!isColor(value)) throw new Error(`${name} is not a color`);
    return value;
  }

  colors(name: string): Color[] {
    const value = this.value(name);
    if (!Array.isArray(value)) throw new Error(`${name} is not a color array`);
    return value;
  }
}

/** Parses `payload` against `fields`. Throws when the payload is too short. */
export function readStruct(fields: readonly Field[], payload: Uint8Array): Struct {
  const need = sizeOf(fields);
  if (payload.length < need) {
    throw new Error(`payload is ${payload.length} bytes, the message needs ${need}`);
  }
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const entries: Entry[] = [];
  let offset = 0;
  for (const f of fields) {
    entries.push({ field: f, offset, value: readValue(f, payload, view, offset) });
    offset += f.size;
  }
  return new Struct(entries);
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

function writeColor(view: DataView, offset: number, c: Color): void {
  view.setUint16(offset, Math.round(c.hue), true);
  view.setUint16(offset + 2, Math.round(c.saturation), true);
  view.setUint16(offset + 4, Math.round(c.brightness), true);
  view.setUint16(offset + 6, Math.round(c.kelvin), true);
}

/**
 * Builds a payload from named values. Fields without a value (and every
 * reserved field) stay zero; a value of the wrong type for its field throws.
 */
export function packStruct(fields: readonly Field[], values: Readonly<Record<string, Value>>): Uint8Array {
  const out = new Uint8Array(sizeOf(fields));
  const view = new DataView(out.buffer);
  let offset = 0;
  for (const f of fields) {
    const value = f.kind === 'reserved' ? undefined : values[f.name];
    if (value !== undefined) {
      const mismatch = () => new Error(`${f.name}: wrong value type for ${f.kind}`);
      switch (f.kind) {
        case 'u8': case 'u16': case 'u32': case 'i16': case 'f32':
          if (typeof value !== 'number') throw mismatch();
          if (f.kind === 'u8') view.setUint8(offset, value);
          else if (f.kind === 'u16') view.setUint16(offset, value, true);
          else if (f.kind === 'u32') view.setUint32(offset, value, true);
          else if (f.kind === 'i16') view.setInt16(offset, value, true);
          else view.setFloat32(offset, value, true);
          break;
        case 'u64': case 'time':
          if (typeof value !== 'bigint') throw mismatch();
          view.setBigUint64(offset, value, true);
          break;
        case 'bool':
          if (typeof value !== 'boolean') throw mismatch();
          view.setUint8(offset, value ? 1 : 0);
          break;
        case 'string':
          if (typeof value !== 'string') throw mismatch();
          textEncoder.encodeInto(value, out.subarray(offset, offset + f.size));
          break;
        case 'bytes':
          if (!(value instanceof Uint8Array)) throw mismatch();
          out.set(value.subarray(0, f.size), offset);
          break;
        case 'color':
          if (!isColor(value)) throw mismatch();
          writeColor(view, offset, value);
          break;
        case 'colors':
          if (!Array.isArray(value)) throw mismatch();
          for (let i = 0; i < value.length && i * 8 < f.size; i++) {
            const c = value[i];
            if (c) writeColor(view, offset + i * 8, c);
          }
          break;
        case 'reserved':
          break;
      }
    }
    offset += f.size;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The 36-byte header                                                  */
/* ------------------------------------------------------------------ */

export const HEADER_SIZE = 36;

export const HEADER_FIELDS: readonly Field[] = [
  u16('size'),
  u16('protocol + flags'),
  u32('source'),
  bytes('target', 8),
  reserved(6),
  u8('res / ack'),
  u8('sequence'),
  reserved(8),
  u16('type'),
  reserved(2),
];

/* ------------------------------------------------------------------ */
/* Payload layouts                                                     */
/* ------------------------------------------------------------------ */

const LABELLED_ID = (id: string): readonly Field[] => [bytes(id, 16), text('label', 32), time('updated_at')];
const FIRMWARE: readonly Field[] = [time('build'), reserved(8), u16('version_minor'), u16('version_major')];
const WAVEFORM: readonly Field[] = [
  reserved(1), bool('transient'), color('color'), u32('period'), f32('cycles'), i16('skew_ratio'), u8('waveform'),
];
const MULTIZONE_EFFECT: readonly Field[] = [
  u32('instanceid'), u8('type'), reserved(2), u32('speed'), u64('duration'), reserved(4), reserved(4), bytes('parameters', 32),
];
const TILE_EFFECT_BODY: readonly Field[] = [
  u32('instanceid'), u8('type'), u32('speed'), u64('duration'), reserved(4), reserved(4),
  u8('sky_type'), reserved(3), u8('cloud_saturation_min'), reserved(3), u8('cloud_saturation_max'), reserved(23),
  u8('palette_count'), colors('palette', 16),
];

export const TILE_SLOTS = 16;

function chainTile(i: number): Field[] {
  const p = `tile[${i}].`;
  return [
    i16(`${p}accel_meas_x`), i16(`${p}accel_meas_y`), i16(`${p}accel_meas_z`), reserved(2),
    f32(`${p}user_x`), f32(`${p}user_y`), u8(`${p}width`), u8(`${p}height`), reserved(1),
    u32(`${p}vendor`), u32(`${p}product`), reserved(4),
    time(`${p}firmware_build`), reserved(8), u16(`${p}version_minor`), u16(`${p}version_major`), reserved(4),
  ];
}

/**
 * StateDeviceChain always carries 16 tile slots; only the first `count` are
 * spelled out field by field, the rest are one block of unused bytes each.
 */
export function deviceChainLayout(count: number): readonly Field[] {
  const fields: Field[] = [u8('start_index')];
  for (let i = 0; i < TILE_SLOTS; i++) {
    if (i < count) fields.push(...chainTile(i));
    else fields.push(reserved(55));
  }
  fields.push(u8('tile_devices_count'));
  return fields;
}

export const LAYOUTS = {
  StateService: [u8('service'), u32('port')],
  StateHostFirmware: FIRMWARE,
  StateWifiInfo: [f32('signal'), reserved(4), reserved(4), reserved(2)],
  StateWifiFirmware: FIRMWARE,
  SetPower: [u16('level')],
  StatePower: [u16('level')],
  SetLabel: [text('label', 32)],
  StateLabel: [text('label', 32)],
  StateVersion: [u32('vendor'), u32('product'), reserved(4)],
  StateInfo: [time('time'), u64('uptime'), u64('downtime')],
  SetLocation: LABELLED_ID('location'),
  StateLocation: LABELLED_ID('location'),
  SetGroup: LABELLED_ID('group'),
  StateGroup: LABELLED_ID('group'),
  EchoRequest: [bytes('echoing', 64)],
  EchoResponse: [bytes('echoing', 64)],
  StateUnhandled: [u16('unhandled_type')],

  SetColor: [reserved(1), color('color'), u32('duration')],
  SetWaveform: WAVEFORM,
  LightState: [color('color'), reserved(2), u16('power'), text('label', 32), reserved(8)],
  SetLightPower: [u16('level'), u32('duration')],
  StateLightPower: [u16('level')],
  SetWaveformOptional: [...WAVEFORM, bool('set_hue'), bool('set_saturation'), bool('set_brightness'), bool('set_kelvin')],

  SetColorZones: [u8('start_index'), u8('end_index'), color('color'), u32('duration'), u8('apply')],
  GetColorZones: [u8('start_index'), u8('end_index')],
  StateZone: [u8('zones_count'), u8('zone_index'), color('color')],
  StateMultiZone: [u8('zones_count'), u8('zone_index'), colors('colors', 8)],
  SetMultiZoneEffect: MULTIZONE_EFFECT,
  StateMultiZoneEffect: MULTIZONE_EFFECT,
  SetExtendedColorZones: [u32('duration'), u8('apply'), u16('zone_index'), u8('colors_count'), colors('colors', 82)],
  StateExtendedColorZones: [u16('zones_count'), u16('zone_index'), u8('colors_count'), colors('colors', 82)],

  SetUserPosition: [u8('tile_index'), reserved(2), f32('user_x'), f32('user_y')],
  Get64: [u8('tile_index'), u8('length'), reserved(1), u8('x'), u8('y'), u8('width')],
  State64: [u8('tile_index'), reserved(1), u8('x'), u8('y'), u8('width'), colors('colors', 64)],
  Set64: [u8('tile_index'), u8('length'), reserved(1), u8('x'), u8('y'), u8('width'), u32('duration'), colors('colors', 64)],
  GetTileEffect: [reserved(1), reserved(1)],
  SetTileEffect: [reserved(1), reserved(1), ...TILE_EFFECT_BODY],
  StateTileEffect: [reserved(1), ...TILE_EFFECT_BODY],
} satisfies Record<string, readonly Field[]>;

const NO_FIELDS: readonly Field[] = [];

const TYPE_NAMES = new Map<number, string>();
for (const [name, type] of Object.entries(Type)) TYPE_NAMES.set(type, name);

const LAYOUTS_BY_NAME = new Map<string, readonly Field[]>(Object.entries(LAYOUTS));

/** The `Type` constant's name for a message type, e.g. 102 → "SetColor". */
export function typeName(type: number): string {
  return TYPE_NAMES.get(type) ?? `Unknown(${type})`;
}

/** Whether the type is one devices send (a State, an Acknowledgement, an EchoResponse). */
export function isDeviceMessage(type: number): boolean {
  return /^(Sensor)?State|^LightState$|^Acknowledgement$|^EchoResponse$/.test(typeName(type));
}

/**
 * The field layout for a message's payload. Types without a payload (every
 * plain Get, Acknowledgement) have no fields; a type the demo has no layout
 * for is shown as one opaque block.
 */
export function layoutFor(type: number, payload: Uint8Array): readonly Field[] {
  if (type === Type.StateDeviceChain) {
    const count = payload.length >= 882 ? Math.min(payload[881]!, TILE_SLOTS) : 0;
    return deviceChainLayout(count);
  }
  const known = LAYOUTS_BY_NAME.get(typeName(type));
  if (known) return known;
  return payload.length > 0 ? [bytes('payload', payload.length)] : NO_FIELDS;
}
