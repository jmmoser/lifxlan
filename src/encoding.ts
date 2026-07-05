/**
 * Low-level LIFX LAN wire-format encoding and decoding.
 *
 * This module is published as the 'lifxlan/encoding' subpath entry point and
 * every export is public semver surface. It is the layer to reach for when
 * writing custom commands, custom routing, or driving sockets directly; the
 * high-level API in the package root never requires importing it.
 */
import type {
  Waveform,
  MultiZoneApplicationRequest,
  MultiZoneEffectType,
  MultiZoneExtendedApplicationRequest,
  TileEffectType,
  TileEffectSkyType
} from './constants/index.js';
import { Type } from './constants/index.js';
import { ValidationError } from './errors.js';
import { HEX_BYTES } from './utils/core.js';

const HEX_CHARS = /^[0-9a-fA-F]+$/;

export interface Color {
  hue: number;
  saturation: number;
  brightness: number;
  kelvin: number;
}

export interface OffsetRef {
  current: number;
}

export type Header = ReturnType<typeof decodeHeader>;

export type StateService = ReturnType<typeof decodeStateService>;

export type StateHostFirmware = ReturnType<typeof decodeStateHostFirmware>;

export type StateWifiInfo = ReturnType<typeof decodeStateWifiInfo>;

export type StateWifiFirmware = ReturnType<typeof decodeStateWifiFirmware>;

export type StateVersion = ReturnType<typeof decodeStateVersion>;

export type StateInfo = ReturnType<typeof decodeStateInfo>;

export type StateLocation = ReturnType<typeof decodeStateLocation>;

export type StateGroup = ReturnType<typeof decodeStateGroup>;

export type SetColor = ReturnType<typeof decodeSetColor>;

export type LightState = ReturnType<typeof decodeLightState>;

export type StateHevCycle = ReturnType<typeof decodeStateHevCycle>;

export type StateHevCycleConfiguration = ReturnType<typeof decodeStateHevCycleConfiguration>;

export type StateRPower = ReturnType<typeof decodeStateRPower>;

export type StateDeviceChain = ReturnType<typeof decodeStateDeviceChain>;
export type DeviceChainDevice = StateDeviceChain['devices'][0];

export type State64 = ReturnType<typeof decodeState64>;

export type StateZone = ReturnType<typeof decodeStateZone>;

export type StateMultiZone = ReturnType<typeof decodeStateMultiZone>;

export type StateMultiZoneEffect = ReturnType<typeof decodeStateMultiZoneEffect>;

export type StateExtendedColorZones = ReturnType<typeof decodeStateExtendedColorZones>;

export type StateTileEffect = ReturnType<typeof decodeStateTileEffect>;

export type SensorStateAmbientLight = ReturnType<typeof decodeSensorStateAmbientLight>;

export type StateButton = ReturnType<typeof decodeStateButton>;

/**
 * Encodes a LIFX protocol message into a binary format.
 * 
 * This is the core encoding function that creates properly formatted LIFX LAN protocol messages.
 * The encoding follows the official LIFX protocol specification with optimized binary operations.
 */
export function encode(
  tagged: boolean,
  source: number,
  target: Uint8Array,
  resRequired: boolean,
  ackRequired: boolean,
  sequence: number,
  type: number,
  payload?: Uint8Array,
): Uint8Array {
  const protocol = 1024;
  const addressable = 1;
  const origin = 0;

  const size = 36 + (payload != null ? payload.byteLength : 0);

  const bytes = new Uint8Array(size);

  /** Frame Header */

  bytes[0] = size & 0xFF;
  bytes[1] = (size >>> 8) & 0xFF;

  const flags = protocol | (addressable << 12) | (+tagged << 13) | (origin << 14);
  bytes[2] = flags & 0xFF;
  bytes[3] = (flags >>> 8) & 0xFF;

  bytes[4] = source & 0xFF;
  bytes[5] = (source >>> 8) & 0xFF;
  bytes[6] = (source >>> 16) & 0xFF;
  bytes[7] = (source >>> 24) & 0xFF;

  /** Frame Address */

  bytes.set(target, 8);

  bytes[22] = ((resRequired ? 1 : 0) << 0) | ((ackRequired ? 1 : 0) << 1);

  bytes[23] = sequence;

  /** Protocol Header */

  // type
  bytes[32] = type & 0xFF;
  bytes[33] = (type >>> 8) & 0xFF;

  if (payload) {
    bytes.set(payload, 36);
  }

  return bytes;
}

/**
 * Encodes a UUID string directly into a byte array at the specified offset.
 * 
 * Efficiently converts UUID format (e.g., "550e8400-e29b-41d4-a716-446655440000")
 * into 16 bytes at the target location. Optimized for minimal string allocations.
 */
export function encodeUuidTo(bytes: Uint8Array, offset: number, uuid: string): void {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32 || !HEX_CHARS.test(hex)) {
    throw new ValidationError('uuid', uuid, 'must be a 32-character hex string with optional dashes');
  }
  for (let i = 0, j = 0; i < hex.length; i += 2, j++) {
    bytes[offset + j] = parseInt(hex.slice(i, i + 2), 16);
  }
}

const textEncoder = new TextEncoder();

export function encodeStringTo(bytes: Uint8Array, offset: number, value: string, byteLength: number): void {
  const target = bytes.subarray(offset, offset + byteLength);
  const { written } = textEncoder.encodeInto(value, target);
  if (written < byteLength) {
    bytes[offset + written] = 0;
  }
}

export function encodeString(value: string, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  encodeStringTo(bytes, 0, value, byteLength);
  return bytes;
}

/**
 * Asserts that `byteLength` bytes are available at `offset`. Every payload
 * decoder calls this before reading so a truncated or malformed packet always
 * surfaces as a ValidationError instead of silently producing garbage values
 * (e.g. `undefined` on a field typed `number`). Anyone on the LAN can send a
 * packet, so decoders must never trust the advertised size.
 */
function ensureSize(bytes: Uint8Array, offset: number, byteLength: number): void {
  if (offset + byteLength > bytes.length) {
    throw new ValidationError('payload', bytes.length, `expected ${byteLength} bytes at offset ${offset}, only ${bytes.length - offset} available`);
  }
}

function decodeBytes(bytes: Uint8Array, offsetRef: OffsetRef, byteLength: number): Uint8Array {
  ensureSize(bytes, offsetRef.current, byteLength);
  const subarray = bytes.subarray(offsetRef.current, offsetRef.current + byteLength);
  offsetRef.current += byteLength;
  return subarray;
}

function decodeUuid(bytes: Uint8Array, offsetRef: OffsetRef): string {
  const o = offsetRef.current;
  ensureSize(bytes, o, 16);
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += HEX_BYTES[bytes[o + i]!];
  }
  offsetRef.current = o + 16;
  return result;
}

const readUint16 = (bytes: Uint8Array, offset: number): number =>
  bytes[offset]! | (bytes[offset + 1]! << 8);

const readUint32 = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0;

const readInt16 = (bytes: Uint8Array, offset: number): number =>
  (readUint16(bytes, offset) << 16) >> 16;

const readColor = (bytes: Uint8Array, offset: number): Color => ({
  hue: readUint16(bytes, offset),
  saturation: readUint16(bytes, offset + 2),
  brightness: readUint16(bytes, offset + 4),
  kelvin: readUint16(bytes, offset + 6),
});

/**
 * Float32 and BigUint64 cannot be assembled with plain integer math, so they
 * read through a single module-level scratch view. The scratch DataView is
 * allocated once and reused, so these reads remain allocation-free per call.
 */
const scratch = new DataView(new ArrayBuffer(8));
const scratchBytes = new Uint8Array(scratch.buffer);

const readFloat32 = (bytes: Uint8Array, offset: number): number => {
  scratchBytes[0] = bytes[offset]!;
  scratchBytes[1] = bytes[offset + 1]!;
  scratchBytes[2] = bytes[offset + 2]!;
  scratchBytes[3] = bytes[offset + 3]!;
  return scratch.getFloat32(0, true);
};

const readBigUint64 = (bytes: Uint8Array, offset: number): bigint => {
  for (let i = 0; i < 8; i++) {
    scratchBytes[i] = bytes[offset + i]!;
  }
  return scratch.getBigUint64(0, true);
};

const textDecoder = new TextDecoder();

function readString(bytes: Uint8Array, start: number, maxLength: number): string {
  const limit = Math.min(start + maxLength, bytes.length);
  let end = start;
  while (end < limit && bytes[end] !== 0) {
    end++;
  }
  return textDecoder.decode(bytes.subarray(start, end));
}

function decodeString(bytes: Uint8Array, offsetRef: OffsetRef, maxLength: number): string {
  ensureSize(bytes, offsetRef.current, maxLength);
  const value = readString(bytes, offsetRef.current, maxLength);
  offsetRef.current += maxLength;
  return value;
}

export function encodeTimestampTo(view: DataView, offset: number, date: Date): void {
  view.setBigUint64(offset, BigInt(date.getTime()) * 1000000n, true);
}

function readTimestamp(bytes: Uint8Array, offset: number): Date {
  const lo = readUint32(bytes, offset);
  const hi = readUint32(bytes, offset + 4);
  // Nanoseconds since epoch is a 64-bit value (hi * 2**32 + lo). Convert to
  // milliseconds without BigInt: 2**32 === 4294 * 1e6 + 967296, so
  // floor(ns / 1e6) === hi * 4294 + floor((hi * 967296 + lo) / 1e6). Both
  // terms stay below Number.MAX_SAFE_INTEGER, so the result is exact and
  // matches the previous BigInt computation.
  const ms = hi * 4294 + Math.floor((hi * 967296 + lo) / 1000000);
  return new Date(ms);
}

function decodeTimestamp(bytes: Uint8Array, offsetRef: OffsetRef): Date {
  ensureSize(bytes, offsetRef.current, 8);
  const time = readTimestamp(bytes, offsetRef.current);
  offsetRef.current += 8;
  return time;
}

export function decodeStateService(bytes: Uint8Array, offsetRef: OffsetRef) {
  const o = offsetRef.current;
  ensureSize(bytes, o, 5);
  const service = bytes[o]!;
  const port = readUint32(bytes, o + 1);
  offsetRef.current = o + 5;
  return {
    service,
    port,
  };
}

const FIRMWARE_SIZE = 20;

/**
 * A StateHostFirmware response (20 bytes on the wire). Scalar fields are
 * decoded eagerly; the reserved padding is exposed as a lazy accessor so the
 * common path allocates no reserved subarrays. Mirrors the DecodedHeader
 * pattern.
 */
class HostFirmwareMessage {
  readonly build: Date;
  readonly version_minor: number;
  readonly version_major: number;

  readonly #bytes: Uint8Array;
  readonly #offset: number;

  constructor(bytes: Uint8Array, offset: number) {
    this.#bytes = bytes;
    this.#offset = offset;

    this.build = readTimestamp(bytes, offset);
    // reserved: offset + 8 .. offset + 16
    this.version_minor = readUint16(bytes, offset + 16);
    this.version_major = readUint16(bytes, offset + 18);
  }

  reserved(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 8, this.#offset + 16);
  }
}

export function decodeStateHostFirmware(bytes: Uint8Array, offsetRef: OffsetRef): HostFirmwareMessage {
  const o = offsetRef.current;
  ensureSize(bytes, o, FIRMWARE_SIZE);
  offsetRef.current = o + FIRMWARE_SIZE;
  return new HostFirmwareMessage(bytes, o);
}

const WIFI_INFO_SIZE = 14;

/**
 * A StateWifiInfo response (14 bytes on the wire). The `signal` reading is
 * decoded eagerly; the reserved padding is exposed as lazy accessors so the
 * common path allocates no reserved subarrays. Mirrors the DecodedHeader
 * pattern.
 */
class WifiInfoMessage {
  readonly signal: number;

  readonly #bytes: Uint8Array;
  readonly #offset: number;

  constructor(bytes: Uint8Array, offset: number) {
    this.#bytes = bytes;
    this.#offset = offset;

    this.signal = readFloat32(bytes, offset);
    // reserved6: offset + 4 .. offset + 8
    // reserved7: offset + 8 .. offset + 12
    // reserved8: offset + 12 .. offset + 14
  }

  reserved6(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 4, this.#offset + 8);
  }

  reserved7(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 8, this.#offset + 12);
  }

  reserved8(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 12, this.#offset + 14);
  }
}

export function decodeStateWifiInfo(bytes: Uint8Array, offsetRef: OffsetRef): WifiInfoMessage {
  const o = offsetRef.current;
  ensureSize(bytes, o, WIFI_INFO_SIZE);
  offsetRef.current = o + WIFI_INFO_SIZE;
  return new WifiInfoMessage(bytes, o);
}

/**
 * A StateWifiFirmware response (20 bytes on the wire). Same layout as
 * StateHostFirmware. Scalar fields are decoded eagerly; the reserved padding
 * is exposed as a lazy accessor. Mirrors the DecodedHeader pattern.
 */
class WifiFirmwareMessage {
  readonly build: Date;
  readonly version_minor: number;
  readonly version_major: number;

  readonly #bytes: Uint8Array;
  readonly #offset: number;

  constructor(bytes: Uint8Array, offset: number) {
    this.#bytes = bytes;
    this.#offset = offset;

    this.build = readTimestamp(bytes, offset);
    // reserved6: offset + 8 .. offset + 16
    this.version_minor = readUint16(bytes, offset + 16);
    this.version_major = readUint16(bytes, offset + 18);
  }

  reserved6(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 8, this.#offset + 16);
  }
}

export function decodeStateWifiFirmware(bytes: Uint8Array, offsetRef: OffsetRef): WifiFirmwareMessage {
  const o = offsetRef.current;
  ensureSize(bytes, o, FIRMWARE_SIZE);
  offsetRef.current = o + FIRMWARE_SIZE;
  return new WifiFirmwareMessage(bytes, o);
}

export function decodeStatePower(bytes: Uint8Array, offsetRef: OffsetRef): number {
  const offset = offsetRef.current;
  ensureSize(bytes, offset, 2);
  const power = readUint16(bytes, offset);
  offsetRef.current += 2;
  return power;
}

export function decodeStateLabel(bytes: Uint8Array, offsetRef: OffsetRef): string {
  return decodeString(bytes, offsetRef, 32);
}

export function decodeStateVersion(bytes: Uint8Array, offsetRef: OffsetRef) {
  const o = offsetRef.current;
  ensureSize(bytes, o, 8);
  const vendor = readUint32(bytes, o);
  const product = readUint32(bytes, o + 4);
  offsetRef.current = o + 8;
  return {
    vendor,
    product,
  };
}

export function decodeStateInfo(bytes: Uint8Array, offsetRef: OffsetRef) {
  const time = decodeTimestamp(bytes, offsetRef);
  const uptime = decodeTimestamp(bytes, offsetRef);
  const downtime = decodeTimestamp(bytes, offsetRef);
  return {
    time,
    uptime,
    downtime,
  };
}

export function decodeStateLocation(bytes: Uint8Array, offsetRef: OffsetRef) {
  const location = decodeBytes(bytes, offsetRef, 16);
  const label = decodeString(bytes, offsetRef, 32);
  const updated_at = decodeTimestamp(bytes, offsetRef);
  return {
    location,
    label,
    updated_at,
  };
}

export function decodeStateGroup(bytes: Uint8Array, offsetRef: OffsetRef) {
  const group = decodeUuid(bytes, offsetRef);
  const label = decodeString(bytes, offsetRef, 32);
  const updated_at = decodeTimestamp(bytes, offsetRef);

  return {
    group,
    label,
    updated_at,
  };
}

export function decodeEchoResponse(bytes: Uint8Array, offsetRef: OffsetRef): Uint8Array {
  const payload = decodeBytes(bytes, offsetRef, 64);
  return payload;
}

export function decodeStateUnhandled(bytes: Uint8Array, offsetRef: OffsetRef): number {
  const o = offsetRef.current;
  ensureSize(bytes, o, 2);
  const type = readUint16(bytes, o);
  offsetRef.current = o + 2;
  return type;
}

export function decodeSetColor(bytes: Uint8Array, offsetRef: OffsetRef) {
  ensureSize(bytes, offsetRef.current, 13);
  const reserved = decodeBytes(bytes, offsetRef, 1);
  const o = offsetRef.current;
  const color = readColor(bytes, o);
  const duration = readUint32(bytes, o + 8);
  offsetRef.current = o + 12;
  return {
    reserved,
    hue: color.hue,
    saturation: color.saturation,
    brightness: color.brightness,
    kelvin: color.kelvin,
    duration,
  };
}

export function encodeSetColor(hue: number, saturation: number, brightness: number, kelvin: number, duration: number): Uint8Array {
  const payload = new Uint8Array(13);
  const view = new DataView(payload.buffer);
  view.setUint16(1, hue, true);
  view.setUint16(3, saturation, true);
  view.setUint16(5, brightness, true);
  view.setUint16(7, kelvin, true);
  view.setUint32(9, duration, true);
  return payload;
}

export function encodeSetPower(power: number | boolean): Uint8Array {
  const payload = new Uint8Array(2);
  const view = new DataView(payload.buffer);
  view.setUint16(
    0,
    typeof power === 'number'
      ? power
      : power ? 65535 : 0,
    true,
  );
  return payload;
}

export function encodeSetLocation(location: Uint8Array | string, label: string, updatedAt: Date): Uint8Array {
  const payload = new Uint8Array(56);
  const view = new DataView(payload.buffer);

  if (typeof location === 'string') {
    encodeUuidTo(payload, 0, location);
  } else {
    payload.set(location, 0);
  }

  encodeStringTo(payload, 16, label, 32);
  encodeTimestampTo(view, 48, updatedAt);

  return payload;
}

export function encodeSetGroup(group: Uint8Array | string, label: string, updatedAt: Date): Uint8Array {
  const payload = new Uint8Array(56);
  const view = new DataView(payload.buffer);

  if (typeof group === 'string') {
    encodeUuidTo(payload, 0, group);
  } else {
    payload.set(group, 0);
  }

  encodeStringTo(payload, 16, label, 32);
  encodeTimestampTo(view, 48, updatedAt);

  return payload;
}

export function encodeEchoRequest(echoing: Uint8Array): Uint8Array {
  const payload = new Uint8Array(64);
  payload.set(echoing);
  return payload;
}

export function encodeSetWaveform(
  transient: boolean,
  hue: number,
  saturation: number,
  brightness: number,
  kelvin: number,
  period: number,
  cycles: number,
  skewRatio: number,
  waveform: Waveform,
): Uint8Array {
  const payload = new Uint8Array(21);
  const view = new DataView(payload.buffer);
  payload[1] = transient ? 1 : 0;
  view.setUint16(2, hue, true);
  view.setUint16(4, saturation, true);
  view.setUint16(6, brightness, true);
  view.setUint16(8, kelvin, true);
  view.setUint32(10, period, true);
  view.setFloat32(14, cycles, true);
  view.setInt16(18, skewRatio, true);
  view.setUint8(20, waveform);
  return payload;
}

export function encodeSetLightPower(level: number | boolean, duration: number): Uint8Array {
  const payload = new Uint8Array(6);
  const view = new DataView(payload.buffer);
  const value = typeof level === 'number'
    ? level
    : level ? 65535 : 0;
  view.setUint16(0, value, true);
  view.setUint32(2, duration, true);
  return payload;
}

export function encodeSetWaveformOptional(
  transient: boolean,
  hue: number,
  saturation: number,
  brightness: number,
  kelvin: number,
  period: number,
  cycles: number,
  skewRatio: number,
  waveform: Waveform,
  setHue: boolean,
  setSaturation: boolean,
  setBrightness: boolean,
  setKelvin: boolean,
): Uint8Array {
  const payload = new Uint8Array(25);
  const view = new DataView(payload.buffer);
  payload[1] = transient ? 1 : 0;
  view.setUint16(2, hue, true);
  view.setUint16(4, saturation, true);
  view.setUint16(6, brightness, true);
  view.setUint16(8, kelvin, true);
  view.setUint32(10, period, true);
  view.setFloat32(14, cycles, true);
  view.setInt16(18, skewRatio, true);
  view.setUint8(20, waveform);
  payload[21] = setHue ? 1 : 0;
  payload[22] = setSaturation ? 1 : 0;
  payload[23] = setBrightness ? 1 : 0;
  payload[24] = setKelvin ? 1 : 0;
  return payload;
}

export function encodeSetInfrared(brightness: number): Uint8Array {
  const payload = new Uint8Array(2);
  const view = new DataView(payload.buffer);
  view.setUint16(0, brightness, true);
  return payload;
}

export function encodeSetHevCycle(enable: boolean, durationSeconds: number): Uint8Array {
  const payload = new Uint8Array(5);
  const view = new DataView(payload.buffer);
  view.setUint8(0, enable ? 1 : 0);
  view.setUint32(1, durationSeconds, true);
  return payload;
}

export function encodeSetHevCycleConfiguration(indication: boolean, durationSeconds: number): Uint8Array {
  const payload = new Uint8Array(5);
  const view = new DataView(payload.buffer);
  view.setUint8(0, indication ? 1 : 0);
  view.setUint32(1, durationSeconds, true);
  return payload;
}

export function encodeGetRPower(relayIndex: number): Uint8Array {
  const payload = new Uint8Array(1);
  const view = new DataView(payload.buffer);
  view.setUint8(0, relayIndex);
  return payload;
}

export function encodeSetRPower(relayIndex: number, level: number): Uint8Array {
  const payload = new Uint8Array(3);
  const view = new DataView(payload.buffer);
  view.setUint8(0, relayIndex);
  view.setUint16(1, level, true);
  return payload;
}

export function encodeGet64(tileIndex: number, length: number, x: number, y: number, width: number): Uint8Array {
  const payload = new Uint8Array(6);
  const view = new DataView(payload.buffer);
  view.setUint8(0, tileIndex);
  view.setUint8(1, length);
  view.setUint8(2, 0); // reserved
  view.setUint8(3, x);
  view.setUint8(4, y);
  view.setUint8(5, width);
  return payload;
}

export function encodeGetColorZones(startIndex: number, endIndex: number): Uint8Array {
  const payload = new Uint8Array(2);
  const view = new DataView(payload.buffer);
  view.setUint8(0, startIndex);
  view.setUint8(1, endIndex);
  return payload;
}

export function encodeSetColorZones(startIndex: number, endIndex: number, hue: number, saturation: number, brightness: number, kelvin: number, duration: number, apply: MultiZoneApplicationRequest): Uint8Array {
  const payload = new Uint8Array(15);
  const view = new DataView(payload.buffer);
  view.setUint8(0, startIndex);
  view.setUint8(1, endIndex);
  view.setUint16(2, hue, true);
  view.setUint16(4, saturation, true);
  view.setUint16(6, brightness, true);
  view.setUint16(8, kelvin, true);
  view.setUint32(10, duration, true);
  view.setUint8(14, apply);
  return payload;
}

export function encodeSetMultiZoneEffect(instanceid: number, effectType: MultiZoneEffectType, speed: number, duration: bigint, parameters: Uint8Array): Uint8Array {
  const payload = new Uint8Array(59);
  const view = new DataView(payload.buffer);
  view.setUint32(0, instanceid, true);
  view.setUint8(4, effectType);
  view.setUint8(5, 0); // reserved
  view.setUint8(6, 0); // reserved
  view.setUint32(7, speed, true);
  view.setBigUint64(11, duration, true);
  view.setUint32(19, 0); // reserved
  view.setUint32(23, 0); // reserved
  payload.set(parameters.subarray(0, 32), 27);
  return payload;
}

export function encodeSetExtendedColorZones(duration: number, apply: MultiZoneExtendedApplicationRequest, zoneIndex: number, colorsCount: number, colors: Color[]): Uint8Array {
  const payload = new Uint8Array(664);
  const view = new DataView(payload.buffer);
  view.setUint32(0, duration, true);
  view.setUint8(4, apply);
  view.setUint16(5, zoneIndex, true);
  view.setUint8(7, colorsCount);
  
  for (let i = 0; i < 82; i++) {
    const color = colors[i];
    if (!color) continue;
    const offset = 8 + (i * 8);
    view.setUint16(offset, color.hue, true);
    view.setUint16(offset + 2, color.saturation, true);
    view.setUint16(offset + 4, color.brightness, true);
    view.setUint16(offset + 6, color.kelvin, true);
  }

  return payload;
}

export function encodeSetUserPosition(tileIndex: number, userX: number, userY: number): Uint8Array {
  const payload = new Uint8Array(11);
  const view = new DataView(payload.buffer);
  view.setUint8(0, tileIndex);
  view.setUint8(1, 0); // reserved
  view.setUint8(2, 0); // reserved
  view.setFloat32(3, userX, true);
  view.setFloat32(7, userY, true);
  return payload;
}

export function encodeSet64(tileIndex: number, length: number, x: number, y: number, width: number, duration: number, colors: Color[]): Uint8Array {
  const payload = new Uint8Array(522);
  const view = new DataView(payload.buffer);
  view.setUint8(0, tileIndex);
  view.setUint8(1, length);
  view.setUint8(2, 0); // reserved
  view.setUint8(3, x);
  view.setUint8(4, y);
  view.setUint8(5, width);
  view.setUint32(6, duration, true);
  
  for (let i = 0; i < 64; i++) {
    const color = colors[i];
    if (!color) continue;
    const offset = 10 + (i * 8);
    view.setUint16(offset, color.hue, true);
    view.setUint16(offset + 2, color.saturation, true);
    view.setUint16(offset + 4, color.brightness, true);
    view.setUint16(offset + 6, color.kelvin, true);
  }

  return payload;
}

export function encodeGetTileEffect(): Uint8Array {
  const payload = new Uint8Array(2);
  payload[0] = 0; // reserved6
  payload[1] = 0; // reserved7
  return payload;
}

export function encodeSetTileEffect(instanceid: number, effectType: TileEffectType, speed: number, duration: bigint, skyType: TileEffectSkyType, cloudSaturationMin: number, paletteCount: number, palette: Color[]): Uint8Array {
  const payload = new Uint8Array(188);
  const view = new DataView(payload.buffer);
  view.setUint8(0, 0); // reserved0
  view.setUint8(1, 0); // reserved1
  view.setUint32(2, instanceid, true);
  view.setUint8(6, effectType);
  view.setUint32(7, speed, true);
  view.setBigUint64(11, duration, true);
  view.setUint32(19, 0); // reserved2
  view.setUint32(23, 0); // reserved3
  view.setUint8(27, skyType);
  view.setUint8(28, 0); // reserved4[0]
  view.setUint8(29, 0); // reserved4[1]
  view.setUint8(30, 0); // reserved4[2]
  view.setUint8(31, cloudSaturationMin);
  view.setUint32(32, 0); // reserved5 (first 3 bytes)
  view.setUint32(35, 0); // reserved6 (24 bytes, filling with zeros)
  view.setUint32(51, 0); 
  view.setUint32(55, 0);
  view.setUint8(59, paletteCount);
  
  for (let i = 0; i < 16; i++) {
    const color = palette[i];
    if (!color) continue;
    const offset = 60 + (i * 8);
    view.setUint16(offset, color.hue, true);
    view.setUint16(offset + 2, color.saturation, true);
    view.setUint16(offset + 4, color.brightness, true);
    view.setUint16(offset + 6, color.kelvin, true);
  }

  return payload;
}

const LIGHT_STATE_SIZE = 52;

/**
 * A LightState (GetColor) response. Scalar fields are decoded eagerly; the
 * reserved padding is exposed as lazy accessors so the common path allocates
 * no reserved subarrays. Mirrors the DecodedHeader pattern.
 */
class LightStateMessage {
  readonly hue: number;
  readonly saturation: number;
  readonly brightness: number;
  readonly kelvin: number;
  readonly power: number;
  readonly label: string;

  readonly #bytes: Uint8Array;
  readonly #offset: number;

  constructor(bytes: Uint8Array, offset: number) {
    this.#bytes = bytes;
    this.#offset = offset;

    this.hue = readUint16(bytes, offset);
    this.saturation = readUint16(bytes, offset + 2);
    this.brightness = readUint16(bytes, offset + 4);
    this.kelvin = readUint16(bytes, offset + 6);
    // reserved2: offset + 8 .. offset + 10
    this.power = readUint16(bytes, offset + 10);
    this.label = readString(bytes, offset + 12, 32);
    // reserved8: offset + 44 .. offset + 52
  }

  reserved2(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 8, this.#offset + 10);
  }

  reserved8(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 44, this.#offset + 52);
  }
}

export function decodeLightState(bytes: Uint8Array, offsetRef: OffsetRef): LightStateMessage {
  const o = offsetRef.current;
  ensureSize(bytes, o, LIGHT_STATE_SIZE);
  offsetRef.current = o + LIGHT_STATE_SIZE;
  return new LightStateMessage(bytes, o);
}

export function decodeStateLightPower(bytes: Uint8Array, offsetRef: OffsetRef): number {
  const o = offsetRef.current;
  ensureSize(bytes, o, 2);
  const level = readUint16(bytes, o);
  offsetRef.current = o + 2;
  return level;
}

export function decodeStateInfrared(bytes: Uint8Array, offsetRef: OffsetRef): number {
  const o = offsetRef.current;
  ensureSize(bytes, o, 2);
  const brightness = readUint16(bytes, o);
  offsetRef.current = o + 2;
  return brightness;
}

export function decodeStateHevCycle(bytes: Uint8Array, offsetRef: OffsetRef) {
  const o = offsetRef.current;
  ensureSize(bytes, o, 9);
  const duration_s = readUint32(bytes, o);
  const remaining_s = readUint32(bytes, o + 4);
  const last_power = !!bytes[o + 8]!;
  offsetRef.current = o + 9;
  return {
    duration_s,
    remaining_s,
    last_power,
  };
}

export function decodeStateHevCycleConfiguration(bytes: Uint8Array, offsetRef: OffsetRef) {
  const o = offsetRef.current;
  ensureSize(bytes, o, 5);
  const indication = bytes[o]!;
  const duration_s = readUint32(bytes, o + 1);
  offsetRef.current = o + 5;
  return {
    indication,
    duration_s,
  };
}

export function decodeStateLastHevCycleResult(bytes: Uint8Array, offsetRef: OffsetRef): number {
  ensureSize(bytes, offsetRef.current, 1);
  const result = bytes[offsetRef.current]!; offsetRef.current += 1;
  return result;
}

export function decodeStateRPower(bytes: Uint8Array, offsetRef: OffsetRef) {
  const o = offsetRef.current;
  ensureSize(bytes, o, 3);
  const relay_index = bytes[o]!;
  const level = readUint16(bytes, o + 1);
  offsetRef.current = o + 3;
  return {
    relay_index,
    level,
  };
}

/**
 * A single entry in a StateDeviceChain response (55 bytes on the wire).
 *
 * Scalar fields are decoded eagerly in the constructor. The reserved padding
 * fields are exposed as lazy accessors that slice the backing buffer on
 * demand, so decoding a 16-tile chain allocates no reserved subarrays in the
 * common path where they are never read. Mirrors the DecodedHeader pattern.
 */
const DEVICE_CHAIN_DEVICE_SIZE = 55;

class DeviceChainEntry {
  readonly accel_meas_x: number;
  readonly accel_meas_y: number;
  readonly accel_meas_z: number;
  readonly user_x: number;
  readonly user_y: number;
  readonly width: number;
  readonly height: number;
  readonly device_version_vendor: number;
  readonly device_version_product: number;
  readonly firmware_build: Date;
  readonly firmware_version_minor: number;
  readonly firmware_version_major: number;

  readonly #bytes: Uint8Array;
  readonly #offset: number;

  constructor(bytes: Uint8Array, offset: number) {
    this.#bytes = bytes;
    this.#offset = offset;

    this.accel_meas_x = readInt16(bytes, offset);
    this.accel_meas_y = readInt16(bytes, offset + 2);
    this.accel_meas_z = readInt16(bytes, offset + 4);
    // reserved6: offset + 6 .. offset + 8
    this.user_x = readFloat32(bytes, offset + 8);
    this.user_y = readFloat32(bytes, offset + 12);
    this.width = bytes[offset + 16]!;
    this.height = bytes[offset + 17]!;
    // reserved7: offset + 18 .. offset + 19
    this.device_version_vendor = readUint32(bytes, offset + 19);
    this.device_version_product = readUint32(bytes, offset + 23);
    // reserved8: offset + 27 .. offset + 31
    this.firmware_build = readTimestamp(bytes, offset + 31);
    // reserved9: offset + 39 .. offset + 47
    this.firmware_version_minor = readUint16(bytes, offset + 47);
    this.firmware_version_major = readUint16(bytes, offset + 49);
    // reserved10: offset + 51 .. offset + 55
  }

  reserved6(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 6, this.#offset + 8);
  }

  reserved7(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 18, this.#offset + 19);
  }

  reserved8(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 27, this.#offset + 31);
  }

  reserved9(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 39, this.#offset + 47);
  }

  reserved10(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 51, this.#offset + 55);
  }
}

export function decodeStateDeviceChain(bytes: Uint8Array, offsetRef: OffsetRef) {
  ensureSize(bytes, offsetRef.current, 1 + 16 * DEVICE_CHAIN_DEVICE_SIZE + 1);
  const start_index = bytes[offsetRef.current]!; offsetRef.current += 1;
  const devices: DeviceChainEntry[] = new Array(16);
  for (let i = 0; i < 16; i++) {
    const o = offsetRef.current;
    devices[i] = new DeviceChainEntry(bytes, o);
    offsetRef.current = o + DEVICE_CHAIN_DEVICE_SIZE;
  }
  const tile_devices_count = bytes[offsetRef.current]!; offsetRef.current += 1;
  return {
    start_index,
    devices,
    tile_devices_count,
  };
}

export function decodeState64(bytes: Uint8Array, offsetRef: OffsetRef) {
  ensureSize(bytes, offsetRef.current, 5 + 64 * 8);
  const tile_index = bytes[offsetRef.current]!; offsetRef.current += 1;
  const reserved6 = decodeBytes(bytes, offsetRef, 1);
  const x = bytes[offsetRef.current]!; offsetRef.current += 1;
  const y = bytes[offsetRef.current]!; offsetRef.current += 1;
  const width = bytes[offsetRef.current]!; offsetRef.current += 1;
  const colors: Color[] = new Array(64);
  let o = offsetRef.current;
  for (let i = 0; i < 64; i++) {
    colors[i] = readColor(bytes, o);
    o += 8;
  }
  offsetRef.current = o;
  return {
    tile_index,
    reserved6,
    x,
    y,
    width,
    colors,
  };
}

export function decodeStateZone(bytes: Uint8Array, offsetRef: OffsetRef) {
  const o = offsetRef.current;
  ensureSize(bytes, o, 10);
  const zones_count = bytes[o]!;
  const zone_index = bytes[o + 1]!;
  const color = readColor(bytes, o + 2);
  offsetRef.current = o + 10;
  return {
    zones_count,
    zone_index,
    hue: color.hue,
    saturation: color.saturation,
    brightness: color.brightness,
    kelvin: color.kelvin,
  };
}

export function decodeStateMultiZone(bytes: Uint8Array, offsetRef: OffsetRef) {
  let o = offsetRef.current;
  ensureSize(bytes, o, 2 + 8 * 8);
  const zones_count = bytes[o]!;
  const zone_index = bytes[o + 1]!;
  o += 2;

  const colors: Color[] = new Array(8);
  for (let i = 0; i < 8; i++) {
    colors[i] = readColor(bytes, o);
    o += 8;
  }
  offsetRef.current = o;

  return {
    zones_count,
    zone_index,
    colors,
  };
}

const MULTIZONE_EFFECT_SIZE = 59;

/**
 * A StateMultiZoneEffect response (59 bytes on the wire). Scalar fields and the
 * real `parameters` payload are decoded eagerly; the reserved padding is exposed
 * as lazy accessors so the common path allocates no reserved subarrays. Mirrors
 * the DecodedHeader pattern.
 */
class MultiZoneEffectMessage {
  readonly instanceid: number;
  readonly type: number;
  readonly speed: number;
  readonly duration: bigint;
  readonly parameters: Uint8Array;

  readonly #bytes: Uint8Array;
  readonly #offset: number;

  constructor(bytes: Uint8Array, offset: number) {
    this.#bytes = bytes;
    this.#offset = offset;

    this.instanceid = readUint32(bytes, offset);
    this.type = bytes[offset + 4]!;
    // reserved6: offset + 5 .. offset + 7
    this.speed = readUint32(bytes, offset + 7);
    this.duration = readBigUint64(bytes, offset + 11);
    // reserved7: offset + 19 .. offset + 23
    // reserved8: offset + 23 .. offset + 27
    this.parameters = bytes.subarray(offset + 27, offset + 59);
  }

  reserved6(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 5, this.#offset + 7);
  }

  reserved7(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 19, this.#offset + 23);
  }

  reserved8(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 23, this.#offset + 27);
  }
}

export function decodeStateMultiZoneEffect(bytes: Uint8Array, offsetRef: OffsetRef): MultiZoneEffectMessage {
  const o = offsetRef.current;
  ensureSize(bytes, o, MULTIZONE_EFFECT_SIZE);
  offsetRef.current = o + MULTIZONE_EFFECT_SIZE;
  return new MultiZoneEffectMessage(bytes, o);
}

export function decodeStateExtendedColorZones(bytes: Uint8Array, offsetRef: OffsetRef) {
  let o = offsetRef.current;
  ensureSize(bytes, o, 5 + 82 * 8);
  const zones_count = readUint16(bytes, o);
  const zone_index = readUint16(bytes, o + 2);
  const colors_count = bytes[o + 4]!;
  o += 5;

  const colors: Color[] = new Array(82);
  for (let i = 0; i < 82; i++) {
    colors[i] = readColor(bytes, o);
    o += 8;
  }
  offsetRef.current = o;

  return {
    zones_count,
    zone_index,
    colors_count,
    colors,
  };
}

/**
 * A StateTileEffect response. The fixed header is 59 bytes, followed by a
 * 16-entry palette (128 bytes), for 187 bytes consumed on the wire.
 *
 * Scalar fields and the palette are decoded eagerly; the reserved padding is
 * exposed as lazy accessors so the common path allocates no reserved subarrays.
 * Mirrors the DecodedHeader pattern.
 */
const TILE_EFFECT_HEADER_SIZE = 59;
const TILE_EFFECT_PALETTE_COUNT = 16;
const TILE_EFFECT_SIZE = TILE_EFFECT_HEADER_SIZE + TILE_EFFECT_PALETTE_COUNT * 8;

class TileEffectMessage {
  readonly reserved0: number;
  readonly instanceid: number;
  readonly type: number;
  readonly speed: number;
  readonly duration: bigint;
  readonly skyType: number;
  readonly cloudSaturationMin: number;
  readonly cloudSaturationMax: number;
  readonly palette_count: number;
  readonly palette: Color[];

  readonly #bytes: Uint8Array;
  readonly #offset: number;

  constructor(bytes: Uint8Array, offset: number) {
    this.#bytes = bytes;
    this.#offset = offset;

    this.reserved0 = bytes[offset]!;
    this.instanceid = readUint32(bytes, offset + 1);
    this.type = bytes[offset + 5]!;
    this.speed = readUint32(bytes, offset + 6);
    this.duration = readBigUint64(bytes, offset + 10);
    // reserved1: offset + 18 .. offset + 22
    // reserved2: offset + 22 .. offset + 26
    this.skyType = bytes[offset + 26]!;
    // reserved3: offset + 27 .. offset + 30
    this.cloudSaturationMin = bytes[offset + 30]!;
    // reserved4: offset + 31 .. offset + 34
    this.cloudSaturationMax = bytes[offset + 34]!;
    // reserved5: offset + 35 .. offset + 58
    this.palette_count = bytes[offset + 58]!;

    const palette: Color[] = new Array(TILE_EFFECT_PALETTE_COUNT);
    let po = offset + TILE_EFFECT_HEADER_SIZE;
    for (let i = 0; i < TILE_EFFECT_PALETTE_COUNT; i++) {
      palette[i] = readColor(bytes, po);
      po += 8;
    }
    this.palette = palette;
  }

  reserved1(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 18, this.#offset + 22);
  }

  reserved2(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 22, this.#offset + 26);
  }

  reserved3(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 27, this.#offset + 30);
  }

  reserved4(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 31, this.#offset + 34);
  }

  reserved5(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 35, this.#offset + 58);
  }
}

export function decodeStateTileEffect(bytes: Uint8Array, offsetRef: OffsetRef): TileEffectMessage {
  const o = offsetRef.current;
  ensureSize(bytes, o, TILE_EFFECT_SIZE);
  offsetRef.current = o + TILE_EFFECT_SIZE;
  return new TileEffectMessage(bytes, o);
}

export function decodeSensorStateAmbientLight(bytes: Uint8Array, offsetRef: OffsetRef) {
  ensureSize(bytes, offsetRef.current, 4);
  const lux = readFloat32(bytes, offsetRef.current); offsetRef.current += 4;
  return {
    lux,
  };
}

/**
 * Button wire format (https://github.com/LIFX/public-protocol):
 * a ButtonAction is gesture (uint16) + target_type (uint16) + a 16-byte
 * target whose interpretation depends on target_type; a Button is an action
 * count followed by 5 actions; Set/StateButton carry a fixed array of 8
 * buttons.
 */
const BUTTON_ACTION_SIZE = 20;
const BUTTON_ACTIONS_PER_BUTTON = 5;
const BUTTON_SIZE = 1 + BUTTON_ACTIONS_PER_BUTTON * BUTTON_ACTION_SIZE;
const BUTTONS_PER_MESSAGE = 8;
const SET_BUTTON_SIZE = 2 + BUTTONS_PER_MESSAGE * BUTTON_SIZE;
const STATE_BUTTON_SIZE = 3 + BUTTONS_PER_MESSAGE * BUTTON_SIZE;

export interface ButtonAction {
  gesture: number;
  target_type: number;
  /** 16 bytes; interpretation depends on target_type (relays, serial, location/group/scene id). */
  target: Uint8Array;
}

export interface Button {
  actions_count: number;
  actions: ButtonAction[];
}

export interface ButtonActionInput {
  gesture: number;
  targetType: number;
  /** Up to 16 bytes; interpretation depends on targetType. Zero-filled when omitted. */
  target?: Uint8Array;
}

export interface ButtonInput {
  /** Up to 5 actions; remaining slots are zero-filled. */
  actions: ButtonActionInput[];
}

export function decodeStateButton(bytes: Uint8Array, offsetRef: OffsetRef) {
  const o = offsetRef.current;
  ensureSize(bytes, o, STATE_BUTTON_SIZE);
  const count = bytes[o]!;
  const index = bytes[o + 1]!;
  const buttons_count = bytes[o + 2]!;

  const buttons: Button[] = new Array(BUTTONS_PER_MESSAGE);
  let buttonOffset = o + 3;
  for (let i = 0; i < BUTTONS_PER_MESSAGE; i++) {
    const actions_count = bytes[buttonOffset]!;
    const actions: ButtonAction[] = new Array(BUTTON_ACTIONS_PER_BUTTON);
    let actionOffset = buttonOffset + 1;
    for (let j = 0; j < BUTTON_ACTIONS_PER_BUTTON; j++) {
      actions[j] = {
        gesture: readUint16(bytes, actionOffset),
        target_type: readUint16(bytes, actionOffset + 2),
        target: bytes.subarray(actionOffset + 4, actionOffset + BUTTON_ACTION_SIZE),
      };
      actionOffset += BUTTON_ACTION_SIZE;
    }
    buttons[i] = { actions_count, actions };
    buttonOffset += BUTTON_SIZE;
  }

  offsetRef.current = o + STATE_BUTTON_SIZE;
  return {
    count,
    index,
    buttons_count,
    buttons,
  };
}

export function encodeSetButton(index: number, buttons: readonly ButtonInput[]): Uint8Array {
  const payload = new Uint8Array(SET_BUTTON_SIZE);
  const view = new DataView(payload.buffer);
  view.setUint8(0, index);
  view.setUint8(1, Math.min(buttons.length, BUTTONS_PER_MESSAGE));

  let buttonOffset = 2;
  for (let i = 0; i < BUTTONS_PER_MESSAGE; i++) {
    const button = buttons[i];
    if (button) {
      view.setUint8(buttonOffset, Math.min(button.actions.length, BUTTON_ACTIONS_PER_BUTTON));
      let actionOffset = buttonOffset + 1;
      for (let j = 0; j < BUTTON_ACTIONS_PER_BUTTON; j++) {
        const action = button.actions[j];
        if (action) {
          view.setUint16(actionOffset, action.gesture, true);
          view.setUint16(actionOffset + 2, action.targetType, true);
          if (action.target) {
            payload.set(action.target.subarray(0, 16), actionOffset + 4);
          }
        }
        actionOffset += BUTTON_ACTION_SIZE;
      }
    }
    buttonOffset += BUTTON_SIZE;
  }

  return payload;
}

export const getHeaderSize = (bytes: Uint8Array, offset = 0): number => readUint16(bytes, offset);

export const getHeaderFlags = (bytes: Uint8Array, offset = 0): number => readUint16(bytes, offset + 2);

export const getHeaderTagged = (bytes: Uint8Array, offset = 0): boolean => !!((getHeaderFlags(bytes, offset) >> 12) & 0b1);

export const getHeaderSource = (bytes: Uint8Array, offset = 0): number => readUint32(bytes, offset + 4);

export const getHeaderTarget = (bytes: Uint8Array, offset = 0): Uint8Array => bytes.subarray(offset + 8, offset + 14);

export const getHeaderResponseFlags = (bytes: Uint8Array, offset = 0): number => bytes[offset + 22]!;

export const getHeaderResponseRequired = (responseFlags: number): boolean => (responseFlags & 0b1) > 0;

export const getHeaderAcknowledgeRequired = (responseFlags: number): boolean => (responseFlags & 0b10) > 0;

export const getHeaderType = (bytes: Uint8Array, offset = 0): number => readUint16(bytes, offset + 32);

export const getHeaderSequence = (bytes: Uint8Array, offset = 0): number => bytes[offset + 23]!;

export const getPayload = (bytes: Uint8Array, offset = 0, size?: number): Uint8Array => (
  size != null ? bytes.subarray(offset + 36, offset + size) : bytes.subarray(offset + 36)
);

class DecodedHeader {
  readonly size: number;
  readonly protocol: number;
  readonly addressable: boolean;
  readonly tagged: boolean;
  readonly origin: number;
  readonly source: number;
  readonly target: Uint8Array;
  readonly res_required: boolean;
  readonly ack_required: boolean;
  readonly reserved3: number;
  readonly sequence: number;
  readonly type: number;

  readonly #bytes: Uint8Array;
  readonly #offset: number;

  constructor(bytes: Uint8Array, offset: number) {
    this.#bytes = bytes;
    this.#offset = offset;

    /** Frame Header */
    this.size = getHeaderSize(bytes, offset);
    const flags = getHeaderFlags(bytes, offset);
    this.protocol = flags & 0xFFF;
    this.addressable = !!((flags >> 12) & 0b1);
    this.tagged = !!((flags >> 13) & 0b1);
    this.origin = (flags >> 14) & 0b11;

    this.source = getHeaderSource(bytes, offset);

    /** Frame Address */
    this.target = getHeaderTarget(bytes, offset);

    const responseFlags = getHeaderResponseFlags(bytes, offset);
    this.res_required = getHeaderResponseRequired(responseFlags);
    this.ack_required = getHeaderAcknowledgeRequired(responseFlags);
    this.reserved3 = (responseFlags & 0b11111100) >> 2;

    this.sequence = getHeaderSequence(bytes, offset);

    /** Protocol Header */
    this.type = getHeaderType(bytes, offset);
  }

  // last 2 bytes of target are reserved
  reserved1(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 14, this.#offset + 16);
  }

  reserved2(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 16, this.#offset + 22);
  }

  reserved4(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 24, this.#offset + 32);
  }

  reserved5(): Uint8Array {
    return this.#bytes.subarray(this.#offset + 34, this.#offset + 36);
  }
}

export function decodeHeader(bytes: Uint8Array, offset = 0): DecodedHeader {
  if (offset < 0 || bytes.byteLength - offset < 36) {
    throw new ValidationError('message', bytes.byteLength, `must be at least 36 bytes from offset ${offset} for LIFX header`);
  }

  const size = getHeaderSize(bytes, offset);
  if (size < 36 || size > bytes.byteLength - offset) {
    throw new ValidationError('size', size, `header size field is out of range (buffer has ${bytes.byteLength - offset} bytes available)`);
  }

  return new DecodedHeader(bytes, offset);
}

/**
 * The result of {@link decodePayload}: a discriminated union over every
 * device-to-client payload this module can decode, tagged with the same
 * literal values as {@link Type} so a `type` comparison narrows `value`
 * with no assertions.
 */
export type DecodedPayload =
  | { type: typeof Type.StateService; value: StateService }
  | { type: typeof Type.StateHostFirmware; value: StateHostFirmware }
  | { type: typeof Type.StateWifiInfo; value: StateWifiInfo }
  | { type: typeof Type.StateWifiFirmware; value: StateWifiFirmware }
  | { type: typeof Type.StatePower; value: number }
  | { type: typeof Type.StateLabel; value: string }
  | { type: typeof Type.StateVersion; value: StateVersion }
  | { type: typeof Type.StateInfo; value: StateInfo }
  | { type: typeof Type.StateLocation; value: StateLocation }
  | { type: typeof Type.StateGroup; value: StateGroup }
  | { type: typeof Type.EchoResponse; value: Uint8Array }
  | { type: typeof Type.StateUnhandled; value: number }
  | { type: typeof Type.LightState; value: LightState }
  | { type: typeof Type.StateLightPower; value: number }
  | { type: typeof Type.StateInfrared; value: number }
  | { type: typeof Type.StateHevCycle; value: StateHevCycle }
  | { type: typeof Type.StateHevCycleConfiguration; value: StateHevCycleConfiguration }
  | { type: typeof Type.StateLastHevCycleResult; value: number }
  | { type: typeof Type.StateZone; value: StateZone }
  | { type: typeof Type.StateMultiZone; value: StateMultiZone }
  | { type: typeof Type.StateMultiZoneEffect; value: StateMultiZoneEffect }
  | { type: typeof Type.StateExtendedColorZones; value: StateExtendedColorZones }
  | { type: typeof Type.StateDeviceChain; value: StateDeviceChain }
  | { type: typeof Type.State64; value: State64 }
  | { type: typeof Type.StateTileEffect; value: StateTileEffect }
  | { type: typeof Type.StateRPower; value: StateRPower }
  | { type: typeof Type.StateButton; value: StateButton }
  | { type: typeof Type.SensorStateAmbientLight; value: SensorStateAmbientLight };

/**
 * Dispatches a payload to the decoder for its message type, so a tap —
 * `RouterOptions.onMessage`, or the return value of `router.receive()` in
 * the socket handler — can turn observed traffic into typed data without
 * hand-maintaining a switch over the `decodeState*` functions:
 *
 * ```javascript
 * const message = decodePayload(header.type, payload);
 * if (message?.type === Type.LightState) {
 *   message.value.power; // narrowed to LightState
 * }
 * ```
 *
 * Covers every device-to-client payload (`State*`, `LightState`,
 * `EchoResponse`, ...). Returns `undefined` for anything else — requests,
 * `Acknowledgement` (which has no payload), and unknown types — leaving the
 * caller `header.type` to tell those apart. Throws, like the underlying
 * decoders, if the payload is truncated or malformed.
 *
 * Messages whose full result spans multiple packets (`StateZone`,
 * `StateMultiZone`, `State64`, `StateDeviceChain`) decode here as their
 * single-packet shape; accumulating across packets is what `client.send()`
 * does via a command's `createDecoder`.
 */
export function decodePayload(type: number, bytes: Uint8Array, offsetRef: OffsetRef = { current: 0 }): DecodedPayload | undefined {
  switch (type) {
    case Type.StateService: return { type: Type.StateService, value: decodeStateService(bytes, offsetRef) };
    case Type.StateHostFirmware: return { type: Type.StateHostFirmware, value: decodeStateHostFirmware(bytes, offsetRef) };
    case Type.StateWifiInfo: return { type: Type.StateWifiInfo, value: decodeStateWifiInfo(bytes, offsetRef) };
    case Type.StateWifiFirmware: return { type: Type.StateWifiFirmware, value: decodeStateWifiFirmware(bytes, offsetRef) };
    case Type.StatePower: return { type: Type.StatePower, value: decodeStatePower(bytes, offsetRef) };
    case Type.StateLabel: return { type: Type.StateLabel, value: decodeStateLabel(bytes, offsetRef) };
    case Type.StateVersion: return { type: Type.StateVersion, value: decodeStateVersion(bytes, offsetRef) };
    case Type.StateInfo: return { type: Type.StateInfo, value: decodeStateInfo(bytes, offsetRef) };
    case Type.StateLocation: return { type: Type.StateLocation, value: decodeStateLocation(bytes, offsetRef) };
    case Type.StateGroup: return { type: Type.StateGroup, value: decodeStateGroup(bytes, offsetRef) };
    case Type.EchoResponse: return { type: Type.EchoResponse, value: decodeEchoResponse(bytes, offsetRef) };
    case Type.StateUnhandled: return { type: Type.StateUnhandled, value: decodeStateUnhandled(bytes, offsetRef) };
    case Type.LightState: return { type: Type.LightState, value: decodeLightState(bytes, offsetRef) };
    case Type.StateLightPower: return { type: Type.StateLightPower, value: decodeStateLightPower(bytes, offsetRef) };
    case Type.StateInfrared: return { type: Type.StateInfrared, value: decodeStateInfrared(bytes, offsetRef) };
    case Type.StateHevCycle: return { type: Type.StateHevCycle, value: decodeStateHevCycle(bytes, offsetRef) };
    case Type.StateHevCycleConfiguration: return { type: Type.StateHevCycleConfiguration, value: decodeStateHevCycleConfiguration(bytes, offsetRef) };
    case Type.StateLastHevCycleResult: return { type: Type.StateLastHevCycleResult, value: decodeStateLastHevCycleResult(bytes, offsetRef) };
    case Type.StateZone: return { type: Type.StateZone, value: decodeStateZone(bytes, offsetRef) };
    case Type.StateMultiZone: return { type: Type.StateMultiZone, value: decodeStateMultiZone(bytes, offsetRef) };
    case Type.StateMultiZoneEffect: return { type: Type.StateMultiZoneEffect, value: decodeStateMultiZoneEffect(bytes, offsetRef) };
    case Type.StateExtendedColorZones: return { type: Type.StateExtendedColorZones, value: decodeStateExtendedColorZones(bytes, offsetRef) };
    case Type.StateDeviceChain: return { type: Type.StateDeviceChain, value: decodeStateDeviceChain(bytes, offsetRef) };
    case Type.State64: return { type: Type.State64, value: decodeState64(bytes, offsetRef) };
    case Type.StateTileEffect: return { type: Type.StateTileEffect, value: decodeStateTileEffect(bytes, offsetRef) };
    case Type.StateRPower: return { type: Type.StateRPower, value: decodeStateRPower(bytes, offsetRef) };
    case Type.StateButton: return { type: Type.StateButton, value: decodeStateButton(bytes, offsetRef) };
    case Type.SensorStateAmbientLight: return { type: Type.SensorStateAmbientLight, value: decodeSensorStateAmbientLight(bytes, offsetRef) };
    default: return undefined;
  }
}