/**
 * LIFX LAN wire-format implementation: every payload encoder and decoder.
 *
 * Internal module. The curated public slice — `encode`, `decodeHeader`,
 * `getPayload`, the `decodeState*` family, and the decoded-message types —
 * is re-exported by './encoding.ts' (the 'lifxlan/encoding' subpath). The
 * `encode*` payload builders here back the command factories and are not
 * public: a command's `payload` is the supported way to obtain those bytes.
 */
import type {
  Waveform,
  MultiZoneApplicationRequest,
  MultiZoneEffectType,
  MultiZoneExtendedApplicationRequest,
  TileEffectType,
  TileEffectSkyType
} from './constants/index.js';
import { DecodeError, ValidationError } from './errors.js';
import { HEX_BYTES } from './utils/core.js';

const HEX_CHARS = /^[0-9a-fA-F]+$/;

/** A color as the four unsigned 16-bit HSBK components the protocol uses. */
export interface Color {
  /** Hue as an unsigned 16-bit value (0-65535 maps to 0-360 degrees). */
  hue: number;
  /** Saturation as an unsigned 16-bit value (0-65535 maps to 0-100%). */
  saturation: number;
  /** Brightness as an unsigned 16-bit value (0-65535 maps to 0-100%). */
  brightness: number;
  /** Color temperature in Kelvin. */
  kelvin: number;
}

/**
 * A decoded frame header. A plain object, so a test or mock can satisfy it
 * with an object literal.
 */
export interface Header {
  /** Total message size in bytes, header included. */
  readonly size: number;
  readonly protocol: number;
  readonly addressable: boolean;
  /** Whether the message addresses every device (the target is then all zeros). */
  readonly tagged: boolean;
  readonly origin: number;
  /** The source id of the client the message belongs to. */
  readonly source: number;
  /**
   * The 6-byte device serial. A zero-copy view into the decoded buffer — copy
   * it (`new Uint8Array(header.target)`) to keep it past the datagram.
   */
  readonly target: Uint8Array;
  readonly resRequired: boolean;
  readonly ackRequired: boolean;
  readonly sequence: number;
  /** The message type; see `Type`. */
  readonly type: number;
}

export interface StateService {
  /** The service the device exposes; see `ServiceType`. */
  readonly service: number;
  /** The UDP port the service listens on. */
  readonly port: number;
}

export interface StateHostFirmware {
  /** When the firmware was built. */
  readonly build: Date;
  readonly versionMinor: number;
  readonly versionMajor: number;
}

export interface StateWifiInfo {
  /** Raw signal strength; see `convertSignalToRssi`. */
  readonly signal: number;
}

export interface StateWifiFirmware {
  /** When the firmware was built. */
  readonly build: Date;
  readonly versionMinor: number;
  readonly versionMajor: number;
}

export interface StateVersion {
  /** The vendor id; pair with `product` for a `lifxlan/products` lookup. */
  readonly vendor: number;
  /** The product id. */
  readonly product: number;
}

export interface StateInfo {
  /** The device's current time. */
  readonly time: Date;
  /** Time since the device was powered on, in nanoseconds. */
  readonly uptimeNs: bigint;
  /** Length of the device's last power-off period, in nanoseconds. */
  readonly downtimeNs: bigint;
}

export interface StateLocation {
  /** The location's id as 32 lowercase hex digits. */
  readonly location: string;
  readonly label: string;
  /** When the location was last assigned; the newest label wins. */
  readonly updatedAt: Date;
}

export interface StateGroup {
  /** The group's id as 32 lowercase hex digits. */
  readonly group: string;
  readonly label: string;
  /** When the group was last assigned; the newest label wins. */
  readonly updatedAt: Date;
}

export interface LightState {
  /** Hue as an unsigned 16-bit value (0-65535 maps to 0-360 degrees). */
  readonly hue: number;
  /** Saturation as an unsigned 16-bit value (0-65535 maps to 0-100%). */
  readonly saturation: number;
  /** Brightness as an unsigned 16-bit value (0-65535 maps to 0-100%). */
  readonly brightness: number;
  /** Color temperature in Kelvin. */
  readonly kelvin: number;
  /** Power level: 0 is off, 65535 is on. */
  readonly power: number;
  readonly label: string;
}

export interface StateHevCycle {
  /** Total length of the cycle, in seconds. */
  readonly durationSeconds: number;
  /** Time left in the running cycle, in seconds; 0 when none is running. */
  readonly remainingSeconds: number;
  /** Whether the light returns to on when the cycle ends. */
  readonly lastPower: boolean;
}

export interface StateHevCycleConfiguration {
  /** Whether the light gives a short flashing indication at the end of a cycle. */
  readonly indication: boolean;
  /** The default cycle length, in seconds. */
  readonly durationSeconds: number;
}

export interface StateRPower {
  readonly relayIndex: number;
  /** Power level: 0 is off, any other value is on. */
  readonly level: number;
}

export interface DeviceChainDevice {
  readonly accelMeasX: number;
  readonly accelMeasY: number;
  readonly accelMeasZ: number;
  readonly userX: number;
  readonly userY: number;
  /** Pixel columns. */
  readonly width: number;
  /** Pixel rows. */
  readonly height: number;
  readonly deviceVersionVendor: number;
  readonly deviceVersionProduct: number;
  readonly firmwareBuild: Date;
  readonly firmwareVersionMinor: number;
  readonly firmwareVersionMajor: number;
}

export interface StateDeviceChain {
  /** Chain index of `devices[0]`. */
  readonly startIndex: number;
  /**
   * The devices in the chain — only the entries the device reports as
   * present, not the fixed 16 slots the wire message carries.
   */
  readonly devices: DeviceChainDevice[];
}

export interface State64 {
  /** Chain index of the tile this frame belongs to. */
  readonly tileIndex: number;
  readonly x: number;
  readonly y: number;
  /** Pixel-grid row width the frame was read with. */
  readonly width: number;
  /** The 64 colors of the frame, in row-major order. */
  readonly colors: Color[];
}

export interface StateZone {
  /** Total number of zones on the device. */
  readonly zonesCount: number;
  /** The zone this color belongs to. */
  readonly zoneIndex: number;
  /** Hue as an unsigned 16-bit value (0-65535 maps to 0-360 degrees). */
  readonly hue: number;
  /** Saturation as an unsigned 16-bit value (0-65535 maps to 0-100%). */
  readonly saturation: number;
  /** Brightness as an unsigned 16-bit value (0-65535 maps to 0-100%). */
  readonly brightness: number;
  /** Color temperature in Kelvin. */
  readonly kelvin: number;
}

export interface StateMultiZone {
  /** Total number of zones on the device. */
  readonly zonesCount: number;
  /** The zone `colors[0]` belongs to. */
  readonly zoneIndex: number;
  /**
   * Colors of consecutive zones starting at `zoneIndex` — up to 8, and only
   * the zones the device has (a 12-zone strip's second packet carries 4).
   */
  readonly colors: Color[];
}

export interface StateMultiZoneEffect {
  readonly instanceId: number;
  /** The running effect; see `MultiZoneEffectType`. */
  readonly effectType: number;
  /** Time one cycle of the effect takes, in milliseconds. */
  readonly speedMs: number;
  /** How long the effect runs, in nanoseconds. 0 means until changed. */
  readonly durationNs: bigint;
  /**
   * The 32-byte effect parameter block. A zero-copy view into the decoded
   * buffer — copy it to keep it past the datagram.
   */
  readonly parameters: Uint8Array;
}

export interface StateExtendedColorZones {
  /** Total number of zones on the device. */
  readonly zonesCount: number;
  /** The zone `colors[0]` belongs to. */
  readonly zoneIndex: number;
  /**
   * Colors of consecutive zones starting at `zoneIndex` — only the entries
   * the device reports as valid (up to 82), not the fixed 82 slots the wire
   * message carries.
   */
  readonly colors: Color[];
}

export interface StateTileEffect {
  readonly instanceId: number;
  /** The running effect; see `TileEffectType`. */
  readonly effectType: number;
  /** Time one cycle of the effect takes, in milliseconds. */
  readonly speedMs: number;
  /** How long the effect runs, in nanoseconds. 0 means until changed. */
  readonly durationNs: bigint;
  /** SKY effect only; see `TileEffectSkyType`. */
  readonly skyType: number;
  readonly cloudSaturationMin: number;
  readonly cloudSaturationMax: number;
  /**
   * The colors the effect draws from — only the entries the device reports
   * as in use (up to 16), not the fixed 16 slots the wire message carries.
   */
  readonly palette: Color[];
}

export interface SensorStateAmbientLight {
  /** Ambient light level in lux. */
  readonly lux: number;
}

export interface ButtonAction {
  /** See `ButtonGesture`. */
  readonly gesture: number;
  /** See `ButtonTargetType`. */
  readonly targetType: number;
  /**
   * 16 bytes; interpretation depends on targetType (relays, serial,
   * location/group/scene id). A zero-copy view into the decoded buffer —
   * copy it to keep it past the datagram.
   */
  readonly target: Uint8Array;
}

export interface Button {
  /** The actions configured on the button (up to 5). */
  readonly actions: ButtonAction[];
}

export interface StateButton {
  /** Total number of buttons on the device. */
  readonly count: number;
  /** Index of `buttons[0]`. */
  readonly index: number;
  /**
   * The buttons in this message — only the entries the device reports as
   * present (up to 8), not the fixed 8 slots the wire message carries.
   */
  readonly buttons: Button[];
}

export interface ButtonActionInput {
  gesture: number;
  targetType: number;
  /** Up to 16 bytes; interpretation depends on targetType. Zero-filled when omitted. */
  target?: Uint8Array;
}

export interface ButtonInput {
  /** Up to 5 actions; remaining slots are zero-filled. */
  actions: readonly ButtonActionInput[];
}

/* ------------------------------------------------------------------ */
/* Field writers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Every writer range-checks before it writes. A typed-array store (like
 * DataView's setters) wraps an out-of-range value modulo the field width
 * instead of failing, so `brightness: -1` would encode as full brightness
 * and `startIndex: 256` as zone 0. NaN fails every comparison below, so it
 * is rejected by the same check; the typeof guard keeps an untyped caller's
 * string or boolean from being coerced, and a bigint from throwing a bare
 * TypeError.
 *
 * Magnitudes (color components, levels, durations) may be fractional — a
 * computed `hue` rarely lands on an integer — and are truncated toward zero
 * by the store, exactly as DataView would. Indices, counts, and enum values
 * must be integers: half a zone is a bug, not a rounding matter.
 */
function writeUint8(bytes: Uint8Array, offset: number, value: number, parameter: string): void {
  if (!(typeof value === 'number' && value >= 0 && value <= 0xFF)) {
    throw new ValidationError(parameter, value, 'must be between 0 and 255');
  }
  bytes[offset] = value;
}

function writeIndex(bytes: Uint8Array, offset: number, value: number, parameter: string): void {
  if (!(Number.isInteger(value) && value >= 0 && value <= 0xFF)) {
    throw new ValidationError(parameter, value, 'must be an integer between 0 and 255');
  }
  bytes[offset] = value;
}

function writeUint16(bytes: Uint8Array, offset: number, value: number, parameter: string): void {
  if (!(typeof value === 'number' && value >= 0 && value <= 0xFFFF)) {
    throw new ValidationError(parameter, value, 'must be between 0 and 65535');
  }
  bytes[offset] = value;
  bytes[offset + 1] = value >>> 8;
}

function writeInt16(bytes: Uint8Array, offset: number, value: number, parameter: string): void {
  if (!(typeof value === 'number' && value >= -0x8000 && value <= 0x7FFF)) {
    throw new ValidationError(parameter, value, 'must be between -32768 and 32767');
  }
  bytes[offset] = value;
  bytes[offset + 1] = value >> 8;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number, parameter: string): void {
  if (!(typeof value === 'number' && value >= 0 && value <= 0xFFFFFFFF)) {
    throw new ValidationError(parameter, value, 'must be between 0 and 4294967295');
  }
  bytes[offset] = value;
  bytes[offset + 1] = value >>> 8;
  bytes[offset + 2] = value >>> 16;
  bytes[offset + 3] = value >>> 24;
}

/**
 * Float32 and BigUint64 cannot be assembled with plain integer math, so they
 * pass through a single module-level scratch view. It is allocated once and
 * reused, so these reads and writes remain allocation-free per call.
 */
const scratch = new DataView(new ArrayBuffer(8));
const scratchBytes = new Uint8Array(scratch.buffer);

function writeFloat32(bytes: Uint8Array, offset: number, value: number, parameter: string): void {
  // Math.fround: a finite double past the float32 range (1e40) would
  // otherwise land on the wire as Infinity.
  if (typeof value !== 'number' || !Number.isFinite(Math.fround(value))) {
    throw new ValidationError(parameter, value, 'must be a finite 32-bit float');
  }
  scratch.setFloat32(0, value, true);
  bytes[offset] = scratchBytes[0]!;
  bytes[offset + 1] = scratchBytes[1]!;
  bytes[offset + 2] = scratchBytes[2]!;
  bytes[offset + 3] = scratchBytes[3]!;
}

const MAX_UINT64 = 0xFFFFFFFFFFFFFFFFn;

function writeUint64(bytes: Uint8Array, offset: number, value: bigint, parameter: string): void {
  if (typeof value !== 'bigint' || value < 0n || value > MAX_UINT64) {
    throw new ValidationError(parameter, value, 'must be a bigint between 0 and 2^64 - 1');
  }
  scratch.setBigUint64(0, value, true);
  for (let i = 0; i < 8; i++) {
    bytes[offset + i] = scratchBytes[i]!;
  }
}

function writeColor(bytes: Uint8Array, offset: number, color: Color): void {
  writeUint16(bytes, offset, color.hue, 'hue');
  writeUint16(bytes, offset + 2, color.saturation, 'saturation');
  writeUint16(bytes, offset + 4, color.brightness, 'brightness');
  writeUint16(bytes, offset + 6, color.kelvin, 'kelvin');
}

function writeHsbk(bytes: Uint8Array, offset: number, hue: number, saturation: number, brightness: number, kelvin: number): void {
  writeUint16(bytes, offset, hue, 'hue');
  writeUint16(bytes, offset + 2, saturation, 'saturation');
  writeUint16(bytes, offset + 4, brightness, 'brightness');
  writeUint16(bytes, offset + 6, kelvin, 'kelvin');
}

function writeTimestamp(bytes: Uint8Array, offset: number, date: Date): void {
  const ms = date.getTime();
  // The wire field is unsigned nanoseconds since the epoch. An invalid Date
  // (NaN) would throw a bare RangeError from BigInt(), and a date before 1970
  // or after the field's range (~2554) would silently wrap to another date.
  if (Number.isNaN(ms)) {
    throw new ValidationError('date', date, 'must be a valid date');
  }
  const ns = BigInt(ms) * 1000000n;
  if (ns < 0n || ns > MAX_UINT64) {
    throw new ValidationError('date', date, 'must be between 1970-01-01 and 2554-07-21');
  }
  scratch.setBigUint64(0, ns, true);
  for (let i = 0; i < 8; i++) {
    bytes[offset + i] = scratchBytes[i]!;
  }
}

/** A boolean power is the protocol's on/off pair; a number is sent as given. */
function powerLevel(level: number | boolean): number {
  return typeof level === 'number' ? level : level ? 65535 : 0;
}

/* ------------------------------------------------------------------ */
/* Message framing                                                     */
/* ------------------------------------------------------------------ */

/**
 * Encodes a complete LIFX protocol message: the 36-byte header followed by
 * `payload`. The low-level counterpart of `client.send()`, for driving a
 * socket without Router/Client.
 *
 * @param tagged Whether the message addresses every device (pass an all-zero target).
 * @param source The sender's source id; devices echo it in replies.
 * @param target The destination's 6-byte serial (or 8 with reserved padding).
 * @param resRequired Ask the device for its State reply.
 * @param ackRequired Ask the device for an Acknowledgement.
 * @param sequence 0-255, echoed in replies.
 * @param type The message type; see `Type`.
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
 * The payload of a message: a zero-copy view of the bytes after the 36-byte
 * header (up to `size`, the header's size field, when given).
 */
export const getPayload = (bytes: Uint8Array, offset = 0, size?: number): Uint8Array => (
  size != null ? bytes.subarray(offset + 36, offset + size) : bytes.subarray(offset + 36)
);

const readUint16 = (bytes: Uint8Array, offset: number): number =>
  bytes[offset]! | (bytes[offset + 1]! << 8);

const readUint32 = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0;

const readInt16 = (bytes: Uint8Array, offset: number): number =>
  (readUint16(bytes, offset) << 16) >> 16;

/**
 * Decodes the 36-byte header of a message. Throws {@link DecodeError} when
 * the buffer is too short or its size field is out of range.
 */
export function decodeHeader(bytes: Uint8Array, offset = 0): Header {
  const available = bytes.byteLength - offset;
  if (offset < 0 || available < 36) {
    throw new DecodeError(`a message needs at least 36 bytes for its header, got ${available}`, { available });
  }

  const size = readUint16(bytes, offset);
  if (size < 36 || size > available) {
    throw new DecodeError(`header size field ${size} is out of range (${available} bytes available)`, { size, available });
  }

  const flags = readUint16(bytes, offset + 2);
  const responseFlags = bytes[offset + 22]!;

  return {
    /** Frame Header */
    size,
    protocol: flags & 0xFFF,
    addressable: (flags & 0x1000) !== 0,
    tagged: (flags & 0x2000) !== 0,
    origin: flags >>> 14,
    source: readUint32(bytes, offset + 4),
    /** Frame Address */
    target: bytes.subarray(offset + 8, offset + 14),
    resRequired: (responseFlags & 0b1) !== 0,
    ackRequired: (responseFlags & 0b10) !== 0,
    sequence: bytes[offset + 23]!,
    /** Protocol Header */
    type: readUint16(bytes, offset + 32),
  };
}

/* ------------------------------------------------------------------ */
/* Field readers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Asserts that a payload carries at least `byteLength` bytes. Every payload
 * decoder calls this before reading so a truncated or malformed packet always
 * surfaces as a DecodeError instead of silently producing garbage values
 * (e.g. `undefined` on a field typed `number`). Anyone on the LAN can send a
 * packet, so decoders must never trust the advertised size.
 */
function ensureSize(payload: Uint8Array, byteLength: number): void {
  if (payload.length < byteLength) {
    throw new DecodeError(`expected a payload of at least ${byteLength} bytes, got ${payload.length}`, { expected: byteLength, available: payload.length });
  }
}

function readColors(bytes: Uint8Array, offset: number, count: number): Color[] {
  const colors: Color[] = new Array(count);
  // The hot loop of every zone, tile, and palette decode: the reads are
  // written out rather than delegated so both V8 and JavaScriptCore keep
  // them in one frame.
  for (let i = 0; i < count; i++, offset += 8) {
    colors[i] = {
      hue: bytes[offset]! | (bytes[offset + 1]! << 8),
      saturation: bytes[offset + 2]! | (bytes[offset + 3]! << 8),
      brightness: bytes[offset + 4]! | (bytes[offset + 5]! << 8),
      kelvin: bytes[offset + 6]! | (bytes[offset + 7]! << 8),
    };
  }
  return colors;
}

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

function readUuid(bytes: Uint8Array, offset: number): string {
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += HEX_BYTES[bytes[offset + i]!];
  }
  return result;
}

function readTimestamp(bytes: Uint8Array, offset: number): Date {
  const lo = readUint32(bytes, offset);
  const hi = readUint32(bytes, offset + 4);
  // Nanoseconds since epoch is a 64-bit value (hi * 2**32 + lo). Convert to
  // milliseconds without BigInt: 2**32 === 4294 * 1e6 + 967296, so
  // floor(ns / 1e6) === hi * 4294 + floor((hi * 967296 + lo) / 1e6). Both
  // terms stay below Number.MAX_SAFE_INTEGER, so the result is exact and
  // matches a BigInt computation.
  const ms = hi * 4294 + Math.floor((hi * 967296 + lo) / 1000000);
  return new Date(ms);
}

/* ------------------------------------------------------------------ */
/* Payload encoders (internal — reach them through a command's payload)  */
/* ------------------------------------------------------------------ */

const textEncoder = new TextEncoder();

function writeString(bytes: Uint8Array, offset: number, value: string, byteLength: number): void {
  const target = bytes.subarray(offset, offset + byteLength);
  const { written } = textEncoder.encodeInto(value, target);
  if (written < byteLength) {
    bytes[offset + written] = 0;
  }
}

/** Encodes a string into a fixed-width, zero-padded field (truncating whole characters that do not fit). */
export function encodeString(value: string, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  writeString(bytes, 0, value, byteLength);
  return bytes;
}

function writeUuid(bytes: Uint8Array, offset: number, uuid: string): void {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32 || !HEX_CHARS.test(hex)) {
    throw new ValidationError('uuid', uuid, 'must be a 32-character hex string with optional dashes');
  }
  for (let i = 0, j = 0; i < hex.length; i += 2, j++) {
    bytes[offset + j] = parseInt(hex.slice(i, i + 2), 16);
  }
}

export function encodeSetColor(hue: number, saturation: number, brightness: number, kelvin: number, durationMs: number): Uint8Array {
  const payload = new Uint8Array(13);
  writeHsbk(payload, 1, hue, saturation, brightness, kelvin);
  writeUint32(payload, 9, durationMs, 'durationMs');
  return payload;
}

export function encodeSetPower(power: number | boolean): Uint8Array {
  const payload = new Uint8Array(2);
  writeUint16(payload, 0, powerLevel(power), 'power');
  return payload;
}

function encodeLabelledId(parameter: string, id: Uint8Array | string, label: string, updatedAt: Date): Uint8Array {
  const payload = new Uint8Array(56);

  if (typeof id === 'string') {
    writeUuid(payload, 0, id);
  } else {
    // A shorter id would be silently zero-padded, and a longer one would
    // leave its extra bytes in the label field past the label's terminator
    // (or throw a bare RangeError past 56 bytes).
    if (id.length !== 16) {
      throw new ValidationError(parameter, id.length, 'must be 16 bytes');
    }
    payload.set(id, 0);
  }

  writeString(payload, 16, label, 32);
  writeTimestamp(payload, 48, updatedAt);

  return payload;
}

export function encodeSetLocation(location: Uint8Array | string, label: string, updatedAt: Date): Uint8Array {
  return encodeLabelledId('location', location, label, updatedAt);
}

export function encodeSetGroup(group: Uint8Array | string, label: string, updatedAt: Date): Uint8Array {
  return encodeLabelledId('group', group, label, updatedAt);
}

export function encodeEchoRequest(echoing: Uint8Array): Uint8Array {
  if (echoing.length > 64) {
    throw new ValidationError('echoing', echoing.length, 'must be at most 64 bytes');
  }
  const payload = new Uint8Array(64);
  payload.set(echoing);
  return payload;
}

function writeWaveform(
  payload: Uint8Array,
  transient: boolean,
  hue: number,
  saturation: number,
  brightness: number,
  kelvin: number,
  periodMs: number,
  cycles: number,
  skewRatio: number,
  waveform: Waveform,
): void {
  payload[1] = transient ? 1 : 0;
  writeHsbk(payload, 2, hue, saturation, brightness, kelvin);
  writeUint32(payload, 10, periodMs, 'periodMs');
  writeFloat32(payload, 14, cycles, 'cycles');
  writeInt16(payload, 18, skewRatio, 'skewRatio');
  writeIndex(payload, 20, waveform, 'waveform');
}

export function encodeSetWaveform(
  transient: boolean,
  hue: number,
  saturation: number,
  brightness: number,
  kelvin: number,
  periodMs: number,
  cycles: number,
  skewRatio: number,
  waveform: Waveform,
): Uint8Array {
  const payload = new Uint8Array(21);
  writeWaveform(payload, transient, hue, saturation, brightness, kelvin, periodMs, cycles, skewRatio, waveform);
  return payload;
}

export function encodeSetLightPower(level: number | boolean, durationMs: number): Uint8Array {
  const payload = new Uint8Array(6);
  writeUint16(payload, 0, powerLevel(level), 'level');
  writeUint32(payload, 2, durationMs, 'durationMs');
  return payload;
}

export function encodeSetWaveformOptional(
  transient: boolean,
  hue: number,
  saturation: number,
  brightness: number,
  kelvin: number,
  periodMs: number,
  cycles: number,
  skewRatio: number,
  waveform: Waveform,
  setHue: boolean,
  setSaturation: boolean,
  setBrightness: boolean,
  setKelvin: boolean,
): Uint8Array {
  const payload = new Uint8Array(25);
  writeWaveform(payload, transient, hue, saturation, brightness, kelvin, periodMs, cycles, skewRatio, waveform);
  payload[21] = setHue ? 1 : 0;
  payload[22] = setSaturation ? 1 : 0;
  payload[23] = setBrightness ? 1 : 0;
  payload[24] = setKelvin ? 1 : 0;
  return payload;
}

export function encodeSetInfrared(brightness: number): Uint8Array {
  const payload = new Uint8Array(2);
  writeUint16(payload, 0, brightness, 'brightness');
  return payload;
}

export function encodeSetHevCycle(enable: boolean, durationSeconds: number): Uint8Array {
  const payload = new Uint8Array(5);
  payload[0] = enable ? 1 : 0;
  writeUint32(payload, 1, durationSeconds, 'durationSeconds');
  return payload;
}

export function encodeSetHevCycleConfiguration(indication: boolean, durationSeconds: number): Uint8Array {
  const payload = new Uint8Array(5);
  payload[0] = indication ? 1 : 0;
  writeUint32(payload, 1, durationSeconds, 'durationSeconds');
  return payload;
}

export function encodeGetRPower(relayIndex: number): Uint8Array {
  const payload = new Uint8Array(1);
  writeIndex(payload, 0, relayIndex, 'relayIndex');
  return payload;
}

export function encodeSetRPower(relayIndex: number, level: number | boolean): Uint8Array {
  const payload = new Uint8Array(3);
  writeIndex(payload, 0, relayIndex, 'relayIndex');
  writeUint16(payload, 1, powerLevel(level), 'level');
  return payload;
}

export function encodeGet64(tileIndex: number, tileCount: number, x: number, y: number, width: number): Uint8Array {
  const payload = new Uint8Array(6);
  writeIndex(payload, 0, tileIndex, 'tileIndex');
  writeIndex(payload, 1, tileCount, 'tileCount');
  // payload[2] is reserved
  writeIndex(payload, 3, x, 'x');
  writeIndex(payload, 4, y, 'y');
  writeIndex(payload, 5, width, 'width');
  return payload;
}

export function encodeGetColorZones(startIndex: number, endIndex: number): Uint8Array {
  const payload = new Uint8Array(2);
  writeIndex(payload, 0, startIndex, 'startIndex');
  writeIndex(payload, 1, endIndex, 'endIndex');
  return payload;
}

export function encodeSetColorZones(startIndex: number, endIndex: number, hue: number, saturation: number, brightness: number, kelvin: number, durationMs: number, apply: MultiZoneApplicationRequest): Uint8Array {
  const payload = new Uint8Array(15);
  writeIndex(payload, 0, startIndex, 'startIndex');
  writeIndex(payload, 1, endIndex, 'endIndex');
  writeHsbk(payload, 2, hue, saturation, brightness, kelvin);
  writeUint32(payload, 10, durationMs, 'durationMs');
  writeIndex(payload, 14, apply, 'apply');
  return payload;
}

export function encodeSetMultiZoneEffect(instanceId: number, effectType: MultiZoneEffectType, speedMs: number, durationNs: bigint, parameters: Uint8Array): Uint8Array {
  if (parameters.length > 32) {
    throw new ValidationError('parameters', parameters.length, 'must be at most 32 bytes');
  }
  const payload = new Uint8Array(59);
  writeUint32(payload, 0, instanceId, 'instanceId');
  writeIndex(payload, 4, effectType, 'effectType');
  // payload[5..7] is reserved
  writeUint32(payload, 7, speedMs, 'speedMs');
  writeUint64(payload, 11, durationNs, 'durationNs');
  // payload[19..27] is reserved
  payload.set(parameters, 27);
  return payload;
}

export function encodeSetExtendedColorZones(durationMs: number, apply: MultiZoneExtendedApplicationRequest, zoneIndex: number, colors: readonly Color[]): Uint8Array {
  if (colors.length < 1 || colors.length > 82) {
    throw new ValidationError('colors', colors.length, 'must contain between 1 and 82 colors');
  }
  const payload = new Uint8Array(664);
  writeUint32(payload, 0, durationMs, 'durationMs');
  writeIndex(payload, 4, apply, 'apply');
  if (!(Number.isInteger(zoneIndex) && zoneIndex >= 0 && zoneIndex <= 0xFFFF)) {
    throw new ValidationError('zoneIndex', zoneIndex, 'must be an integer between 0 and 65535');
  }
  writeUint16(payload, 5, zoneIndex, 'zoneIndex');
  payload[7] = colors.length;

  for (let i = 0; i < colors.length; i++) {
    const color = colors[i];
    if (!color) continue;
    writeColor(payload, 8 + (i * 8), color);
  }

  return payload;
}

export function encodeSetUserPosition(tileIndex: number, userX: number, userY: number): Uint8Array {
  const payload = new Uint8Array(11);
  writeIndex(payload, 0, tileIndex, 'tileIndex');
  // payload[1..3] is reserved
  writeFloat32(payload, 3, userX, 'userX');
  writeFloat32(payload, 7, userY, 'userY');
  return payload;
}

export function encodeSet64(tileIndex: number, tileCount: number, x: number, y: number, width: number, durationMs: number, colors: readonly Color[]): Uint8Array {
  if (colors.length > 64) {
    throw new ValidationError('colors', colors.length, 'must contain at most 64 colors');
  }
  const payload = new Uint8Array(522);
  writeIndex(payload, 0, tileIndex, 'tileIndex');
  writeIndex(payload, 1, tileCount, 'tileCount');
  // payload[2] is reserved
  writeIndex(payload, 3, x, 'x');
  writeIndex(payload, 4, y, 'y');
  writeIndex(payload, 5, width, 'width');
  writeUint32(payload, 6, durationMs, 'durationMs');

  for (let i = 0; i < colors.length; i++) {
    const color = colors[i];
    if (!color) continue;
    writeColor(payload, 10 + (i * 8), color);
  }

  return payload;
}

export function encodeGetTileEffect(): Uint8Array {
  // Two reserved bytes.
  return new Uint8Array(2);
}

export function encodeSetTileEffect(instanceId: number, effectType: TileEffectType, speedMs: number, durationNs: bigint, skyType: TileEffectSkyType, cloudSaturationMin: number, cloudSaturationMax: number, palette: readonly Color[]): Uint8Array {
  if (palette.length > 16) {
    throw new ValidationError('palette', palette.length, 'must contain at most 16 colors');
  }
  const payload = new Uint8Array(188);
  // payload[0..2] is reserved
  writeUint32(payload, 2, instanceId, 'instanceId');
  writeIndex(payload, 6, effectType, 'effectType');
  writeUint32(payload, 7, speedMs, 'speedMs');
  writeUint64(payload, 11, durationNs, 'durationNs');
  // payload[19..27] is reserved
  // The 32-byte effect parameters block (27..59). Only the SKY effect uses
  // it; bytes 28..30, 32..34, and 36..58 are reserved and stay zero.
  writeIndex(payload, 27, skyType, 'skyType');
  writeUint8(payload, 31, cloudSaturationMin, 'cloudSaturationMin');
  writeUint8(payload, 35, cloudSaturationMax, 'cloudSaturationMax');
  payload[59] = palette.length;

  for (let i = 0; i < palette.length; i++) {
    const color = palette[i];
    if (!color) continue;
    writeColor(payload, 60 + (i * 8), color);
  }

  return payload;
}

/**
 * Button wire format (https://github.com/LIFX/public-protocol):
 * a ButtonAction is gesture (uint16) + targetType (uint16) + a 16-byte
 * target whose interpretation depends on targetType; a Button is an action
 * count followed by 5 actions; Set/StateButton carry a fixed array of 8
 * buttons.
 */
const BUTTON_ACTION_SIZE = 20;
const BUTTON_ACTIONS_PER_BUTTON = 5;
const BUTTON_SIZE = 1 + BUTTON_ACTIONS_PER_BUTTON * BUTTON_ACTION_SIZE;
const BUTTONS_PER_MESSAGE = 8;
const SET_BUTTON_SIZE = 2 + BUTTONS_PER_MESSAGE * BUTTON_SIZE;
const STATE_BUTTON_SIZE = 3 + BUTTONS_PER_MESSAGE * BUTTON_SIZE;

export function encodeSetButton(index: number, buttons: readonly ButtonInput[]): Uint8Array {
  if (buttons.length > BUTTONS_PER_MESSAGE) {
    throw new ValidationError('buttons', buttons.length, `must contain at most ${BUTTONS_PER_MESSAGE} buttons`);
  }
  const payload = new Uint8Array(SET_BUTTON_SIZE);
  writeIndex(payload, 0, index, 'index');
  payload[1] = buttons.length;

  let buttonOffset = 2;
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    if (button) {
      const { actions } = button;
      if (actions.length > BUTTON_ACTIONS_PER_BUTTON) {
        throw new ValidationError('actions', actions.length, `must contain at most ${BUTTON_ACTIONS_PER_BUTTON} actions`);
      }
      payload[buttonOffset] = actions.length;
      let actionOffset = buttonOffset + 1;
      for (let j = 0; j < actions.length; j++) {
        const action = actions[j];
        if (action) {
          writeUint16(payload, actionOffset, action.gesture, 'gesture');
          writeUint16(payload, actionOffset + 2, action.targetType, 'targetType');
          if (action.target) {
            if (action.target.length > 16) {
              throw new ValidationError('target', action.target.length, 'must be at most 16 bytes');
            }
            payload.set(action.target, actionOffset + 4);
          }
        }
        actionOffset += BUTTON_ACTION_SIZE;
      }
    }
    buttonOffset += BUTTON_SIZE;
  }

  return payload;
}

/* ------------------------------------------------------------------ */
/* Payload decoders                                                    */
/* ------------------------------------------------------------------ */

/*
 * Every decoder takes a message's payload (what `getPayload()` returns and
 * what a router tap receives) and reads from its start. Each throws
 * DecodeError for a payload shorter than its message.
 */

export function decodeStateService(payload: Uint8Array): StateService {
  ensureSize(payload, 5);
  return {
    service: payload[0]!,
    port: readUint32(payload, 1),
  };
}

function decodeFirmware(payload: Uint8Array): StateHostFirmware {
  ensureSize(payload, 20);
  return {
    build: readTimestamp(payload, 0),
    // payload[8..16] is reserved
    versionMinor: readUint16(payload, 16),
    versionMajor: readUint16(payload, 18),
  };
}

export function decodeStateHostFirmware(payload: Uint8Array): StateHostFirmware {
  return decodeFirmware(payload);
}

export function decodeStateWifiInfo(payload: Uint8Array): StateWifiInfo {
  ensureSize(payload, 14);
  // payload[4..14] is reserved
  return { signal: readFloat32(payload, 0) };
}

export function decodeStateWifiFirmware(payload: Uint8Array): StateWifiFirmware {
  return decodeFirmware(payload);
}

export function decodeStatePower(payload: Uint8Array): number {
  ensureSize(payload, 2);
  return readUint16(payload, 0);
}

export function decodeStateLabel(payload: Uint8Array): string {
  ensureSize(payload, 32);
  return readString(payload, 0, 32);
}

export function decodeStateVersion(payload: Uint8Array): StateVersion {
  ensureSize(payload, 8);
  return {
    vendor: readUint32(payload, 0),
    product: readUint32(payload, 4),
  };
}

export function decodeStateInfo(payload: Uint8Array): StateInfo {
  ensureSize(payload, 24);
  // `time` is an absolute timestamp (nanoseconds since epoch), so it decodes
  // to a Date; `uptime`/`downtime` are durations in nanoseconds, so they
  // stay raw uint64 values, suffixed with their unit.
  return {
    time: readTimestamp(payload, 0),
    uptimeNs: readBigUint64(payload, 8),
    downtimeNs: readBigUint64(payload, 16),
  };
}

export function decodeStateLocation(payload: Uint8Array): StateLocation {
  ensureSize(payload, 56);
  return {
    location: readUuid(payload, 0),
    label: readString(payload, 16, 32),
    updatedAt: readTimestamp(payload, 48),
  };
}

export function decodeStateGroup(payload: Uint8Array): StateGroup {
  ensureSize(payload, 56);
  return {
    group: readUuid(payload, 0),
    label: readString(payload, 16, 32),
    updatedAt: readTimestamp(payload, 48),
  };
}

/**
 * The 64 echoed bytes. A zero-copy view into the decoded buffer — copy it to
 * keep it past the datagram.
 */
export function decodeEchoResponse(payload: Uint8Array): Uint8Array {
  ensureSize(payload, 64);
  return payload.subarray(0, 64);
}

/** The type of the request the device could not handle. */
export function decodeStateUnhandled(payload: Uint8Array): number {
  ensureSize(payload, 2);
  return readUint16(payload, 0);
}

export function decodeLightState(payload: Uint8Array): LightState {
  ensureSize(payload, 52);
  return {
    hue: readUint16(payload, 0),
    saturation: readUint16(payload, 2),
    brightness: readUint16(payload, 4),
    kelvin: readUint16(payload, 6),
    // payload[8..10] is reserved
    power: readUint16(payload, 10),
    label: readString(payload, 12, 32),
    // payload[44..52] is reserved
  };
}

export function decodeStateLightPower(payload: Uint8Array): number {
  ensureSize(payload, 2);
  return readUint16(payload, 0);
}

export function decodeStateInfrared(payload: Uint8Array): number {
  ensureSize(payload, 2);
  return readUint16(payload, 0);
}

export function decodeStateHevCycle(payload: Uint8Array): StateHevCycle {
  ensureSize(payload, 9);
  return {
    durationSeconds: readUint32(payload, 0),
    remainingSeconds: readUint32(payload, 4),
    lastPower: payload[8] !== 0,
  };
}

export function decodeStateHevCycleConfiguration(payload: Uint8Array): StateHevCycleConfiguration {
  ensureSize(payload, 5);
  return {
    indication: payload[0] !== 0,
    durationSeconds: readUint32(payload, 1),
  };
}

/** The result of the last HEV cycle; see `LightLastHevCycleResult`. */
export function decodeStateLastHevCycleResult(payload: Uint8Array): number {
  ensureSize(payload, 1);
  return payload[0]!;
}

export function decodeStateRPower(payload: Uint8Array): StateRPower {
  ensureSize(payload, 3);
  return {
    relayIndex: payload[0]!,
    level: readUint16(payload, 1),
  };
}

const DEVICE_CHAIN_DEVICE_SIZE = 55;
const DEVICE_CHAIN_SLOTS = 16;

function readChainDevice(bytes: Uint8Array, offset: number): DeviceChainDevice {
  return {
    accelMeasX: readInt16(bytes, offset),
    accelMeasY: readInt16(bytes, offset + 2),
    accelMeasZ: readInt16(bytes, offset + 4),
    // reserved: offset + 6 .. offset + 8
    userX: readFloat32(bytes, offset + 8),
    userY: readFloat32(bytes, offset + 12),
    width: bytes[offset + 16]!,
    height: bytes[offset + 17]!,
    // reserved: offset + 18 .. offset + 19
    deviceVersionVendor: readUint32(bytes, offset + 19),
    deviceVersionProduct: readUint32(bytes, offset + 23),
    // reserved: offset + 27 .. offset + 31
    firmwareBuild: readTimestamp(bytes, offset + 31),
    // reserved: offset + 39 .. offset + 47
    firmwareVersionMinor: readUint16(bytes, offset + 47),
    firmwareVersionMajor: readUint16(bytes, offset + 49),
    // reserved: offset + 51 .. offset + 55
  };
}

export function decodeStateDeviceChain(payload: Uint8Array): StateDeviceChain {
  const countOffset = 1 + DEVICE_CHAIN_SLOTS * DEVICE_CHAIN_DEVICE_SIZE;
  ensureSize(payload, countOffset + 1);
  // The message always carries 16 slots; only the first tile_devices_count
  // describe real devices, so the rest are never decoded.
  const count = Math.min(payload[countOffset]!, DEVICE_CHAIN_SLOTS);
  const devices: DeviceChainDevice[] = new Array(count);
  let offset = 1;
  for (let i = 0; i < count; i++) {
    devices[i] = readChainDevice(payload, offset);
    offset += DEVICE_CHAIN_DEVICE_SIZE;
  }
  return {
    startIndex: payload[0]!,
    devices,
  };
}

export function decodeState64(payload: Uint8Array): State64 {
  ensureSize(payload, 5 + 64 * 8);
  return {
    tileIndex: payload[0]!,
    // payload[1] is reserved
    x: payload[2]!,
    y: payload[3]!,
    width: payload[4]!,
    colors: readColors(payload, 5, 64),
  };
}

export function decodeStateZone(payload: Uint8Array): StateZone {
  ensureSize(payload, 10);
  return {
    zonesCount: payload[0]!,
    zoneIndex: payload[1]!,
    hue: readUint16(payload, 2),
    saturation: readUint16(payload, 4),
    brightness: readUint16(payload, 6),
    kelvin: readUint16(payload, 8),
  };
}

export function decodeStateMultiZone(payload: Uint8Array): StateMultiZone {
  ensureSize(payload, 2 + 8 * 8);
  const zonesCount = payload[0]!;
  const zoneIndex = payload[1]!;
  // The message always carries 8 colors; those past the device's last zone
  // are padding.
  const count = Math.max(0, Math.min(8, zonesCount - zoneIndex));
  return {
    zonesCount,
    zoneIndex,
    colors: readColors(payload, 2, count),
  };
}

export function decodeStateMultiZoneEffect(payload: Uint8Array): StateMultiZoneEffect {
  ensureSize(payload, 59);
  return {
    instanceId: readUint32(payload, 0),
    effectType: payload[4]!,
    // payload[5..7] is reserved
    speedMs: readUint32(payload, 7),
    durationNs: readBigUint64(payload, 11),
    // payload[19..27] is reserved
    parameters: payload.subarray(27, 59),
  };
}

export function decodeStateExtendedColorZones(payload: Uint8Array): StateExtendedColorZones {
  ensureSize(payload, 5 + 82 * 8);
  // The message always carries 82 colors; only the first colors_count are
  // valid.
  const count = Math.min(payload[4]!, 82);
  return {
    zonesCount: readUint16(payload, 0),
    zoneIndex: readUint16(payload, 2),
    colors: readColors(payload, 5, count),
  };
}

/**
 * The fixed part of a StateTileEffect is 59 bytes, followed by a 16-entry
 * palette (128 bytes), for 187 bytes on the wire.
 */
const TILE_EFFECT_HEADER_SIZE = 59;
const TILE_EFFECT_PALETTE_SLOTS = 16;

export function decodeStateTileEffect(payload: Uint8Array): StateTileEffect {
  ensureSize(payload, TILE_EFFECT_HEADER_SIZE + TILE_EFFECT_PALETTE_SLOTS * 8);
  return {
    // payload[0] is reserved
    instanceId: readUint32(payload, 1),
    effectType: payload[5]!,
    speedMs: readUint32(payload, 6),
    durationNs: readBigUint64(payload, 10),
    // payload[18..26] is reserved
    skyType: payload[26]!,
    // payload[27..30] is reserved
    cloudSaturationMin: payload[30]!,
    // payload[31..34] is reserved
    cloudSaturationMax: payload[34]!,
    // payload[35..58] is reserved
    palette: readColors(payload, TILE_EFFECT_HEADER_SIZE, Math.min(payload[58]!, TILE_EFFECT_PALETTE_SLOTS)),
  };
}

export function decodeSensorStateAmbientLight(payload: Uint8Array): SensorStateAmbientLight {
  ensureSize(payload, 4);
  return { lux: readFloat32(payload, 0) };
}

export function decodeStateButton(payload: Uint8Array): StateButton {
  ensureSize(payload, STATE_BUTTON_SIZE);
  // The message always carries 8 buttons of 5 actions each; only the
  // reported counts are decoded.
  const buttonsCount = Math.min(payload[2]!, BUTTONS_PER_MESSAGE);

  const buttons: Button[] = new Array(buttonsCount);
  let buttonOffset = 3;
  for (let i = 0; i < buttonsCount; i++) {
    const actionsCount = Math.min(payload[buttonOffset]!, BUTTON_ACTIONS_PER_BUTTON);
    const actions: ButtonAction[] = new Array(actionsCount);
    let actionOffset = buttonOffset + 1;
    for (let j = 0; j < actionsCount; j++) {
      actions[j] = {
        gesture: readUint16(payload, actionOffset),
        targetType: readUint16(payload, actionOffset + 2),
        target: payload.subarray(actionOffset + 4, actionOffset + BUTTON_ACTION_SIZE),
      };
      actionOffset += BUTTON_ACTION_SIZE;
    }
    buttons[i] = { actions };
    buttonOffset += BUTTON_SIZE;
  }

  return {
    count: payload[0]!,
    index: payload[1]!,
    buttons,
  };
}
