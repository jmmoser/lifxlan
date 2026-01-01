import type { 
  Waveform, 
  MultiZoneApplicationRequest, 
  MultiZoneEffectType, 
  MultiZoneExtendedApplicationRequest, 
  TileEffectType, 
  TileEffectSkyType 
} from './constants/index.js';

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
  const view = new DataView(bytes.buffer, bytes.byteOffset);

  /** Frame Header */

  view.setUint16(0, size, true);

  view.setUint16(2, protocol | (addressable << 12) | (+tagged << 13) | (origin << 14), true);

  view.setUint32(4, source, true);

  /** Frame Address */

  bytes.set(target, 8);

  view.setUint8(22, ((resRequired ? 1 : 0) << 0) | ((ackRequired ? 1 : 0) << 1));

  view.setUint8(23, sequence);

  /** Protocol Header */

  // type
  view.setUint16(32, type, true);

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
  for (let i = 0, j = 0; i < hex.length; i += 2, j++) {
    bytes[offset + j] = parseInt(hex.slice(i, i + 2), 16);
  }
}

const textEncoder = new TextEncoder();

export function encodeStringTo(bytes: Uint8Array, offset: number, value: string, byteLength: number): void {
  textEncoder.encodeInto(value, bytes.subarray(offset));
  if (value.length < byteLength) {
    bytes[offset + value.length] = 0;
  }
}

export function encodeString(value: string, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  encodeStringTo(bytes, 0, value, byteLength);
  return bytes;
}

function decodeBytes(bytes: Uint8Array, offsetRef: OffsetRef, byteLength: number): Uint8Array {
  const subarray = bytes.subarray(offsetRef.current, offsetRef.current + byteLength);
  offsetRef.current += byteLength;
  return subarray;
}

function decodeUuid(bytes: Uint8Array, offsetRef: OffsetRef): string {
  return Array.from(decodeBytes(bytes, offsetRef, 16)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const textDecoder = new TextDecoder();

function decodeString(bytes: Uint8Array, offsetRef: OffsetRef, maxLength: number): string {
  const value = textDecoder.decode(bytes.subarray(offsetRef.current, offsetRef.current + maxLength));
  offsetRef.current += maxLength;
  return value;
}

export function encodeTimestampTo(view: DataView, offset: number, date: Date): void {
  view.setBigUint64(offset, BigInt(date.getTime()) * 1000000n, true);
}

function decodeTimestamp(bytes: Uint8Array, offsetRef: OffsetRef): Date {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const time = new Date(Number(view.getBigUint64(offsetRef.current, true) / 1000000n));
  offsetRef.current += 8;
  return time;
}

export function decodeStateService(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const service = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const port = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  return {
    service,
    port,
  };
}

export function decodeStateHostFirmware(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const build = decodeTimestamp(bytes, offsetRef);
  const reserved = decodeBytes(bytes, offsetRef, 8);
  const version_minor = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const version_major = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return {
    build,
    reserved,
    version_minor,
    version_major,
  };
}

export function decodeStateWifiInfo(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const signal = view.getFloat32(offsetRef.current, true); offsetRef.current += 4;
  const reserved6 = decodeBytes(bytes, offsetRef, 4);
  const reserved7 = decodeBytes(bytes, offsetRef, 4);
  const reserved8 = decodeBytes(bytes, offsetRef, 2);

  return {
    signal,
    reserved6,
    reserved7,
    reserved8,
  };
}

export function decodeStateWifiFirmware(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const build = decodeTimestamp(bytes, offsetRef);
  const reserved6 = decodeBytes(bytes, offsetRef, 8);
  const version_minor = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const version_major = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return {
    build,
    reserved6,
    version_minor,
    version_major,
  };
}

export function decodeStatePower(bytes: Uint8Array, offsetRef: OffsetRef): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const power = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return power;
}

export function decodeStateLabel(bytes: Uint8Array, offsetRef: OffsetRef): string {
  return decodeString(bytes, offsetRef, 32);
}

export function decodeStateVersion(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const vendor = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  const product = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
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
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const type = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return type;
}

export function decodeSetColor(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const reserved = decodeBytes(bytes, offsetRef, 1);
  const hue = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const saturation = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const brightness = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const kelvin = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const duration = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  return {
    reserved,
    hue,
    saturation,
    brightness,
    kelvin,
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
  payload.set(parameters.slice(0, 32), 27);
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
    const color = colors[i] || { hue: 0, saturation: 0, brightness: 0, kelvin: 0 };
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
    const color = colors[i] || { hue: 0, saturation: 0, brightness: 0, kelvin: 0 };
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
    const color = palette[i] || { hue: 0, saturation: 0, brightness: 0, kelvin: 0 };
    const offset = 60 + (i * 8);
    view.setUint16(offset, color.hue, true);
    view.setUint16(offset + 2, color.saturation, true);
    view.setUint16(offset + 4, color.brightness, true);
    view.setUint16(offset + 6, color.kelvin, true);
  }
  
  return payload;
}

export function decodeLightState(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const hue = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const saturation = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const brightness = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const kelvin = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const reserved2 = decodeBytes(bytes, offsetRef, 2);
  const power = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const label = decodeString(bytes, offsetRef, 32);
  const reserved8 = decodeBytes(bytes, offsetRef, 8);

  return {
    hue,
    saturation,
    brightness,
    kelvin,
    power,
    label,
    reserved2,
    reserved8,
  };
}

export function decodeStateLightPower(bytes: Uint8Array, offsetRef: OffsetRef): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const level = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return level;
}

export function decodeStateInfrared(bytes: Uint8Array, offsetRef: OffsetRef): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const brightness = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return brightness;
}

export function decodeStateHevCycle(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const duration_s = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  const remaining_s = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  const last_power = !!view.getUint8(offsetRef.current); offsetRef.current += 1;
  return {
    duration_s,
    remaining_s,
    last_power,
  };
}

export function decodeStateHevCycleConfiguration(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const indication = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const duration_s = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  return {
    indication,
    duration_s,
  };
}

export function decodeStateLastHevCycleResult(bytes: Uint8Array, offsetRef: OffsetRef): number {
  const result = bytes[offsetRef.current]!; offsetRef.current += 1;
  return result;
}

export function decodeStateRPower(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const relay_index = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const level = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return {
    relay_index,
    level,
  };
}

export function decodeStateDeviceChain(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const start_index = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const devices: Array<{
    accel_meas_x: number;
    accel_meas_y: number;
    accel_meas_z: number;
    reserved6: Uint8Array;
    user_x: number;
    user_y: number;
    width: number;
    height: number;
    reserved7: Uint8Array;
    device_version_vendor: number;
    device_version_product: number;
    reserved8: Uint8Array;
    firmware_build: Date;
    reserved9: Uint8Array;
    firmware_version_minor: number;
    firmware_version_major: number;
    reserved10: Uint8Array;
  }> = [];
  for (let i = 0; i < 16; i++) {
    const accel_meas_x = view.getInt16(offsetRef.current, true); offsetRef.current += 2;
    const accel_meas_y = view.getInt16(offsetRef.current, true); offsetRef.current += 2;
    const accel_meas_z = view.getInt16(offsetRef.current, true); offsetRef.current += 2;
    const reserved6 = decodeBytes(bytes, offsetRef, 2);
    const user_x = view.getFloat32(offsetRef.current, true); offsetRef.current += 4;
    const user_y = view.getFloat32(offsetRef.current, true); offsetRef.current += 4;
    const width = view.getUint8(offsetRef.current); offsetRef.current += 1;
    const height = view.getUint8(offsetRef.current); offsetRef.current += 1;
    const reserved7 = decodeBytes(bytes, offsetRef, 1);
    const device_version_vendor = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
    const device_version_product = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
    const reserved8 = decodeBytes(bytes, offsetRef, 4);
    const firmware_build = decodeTimestamp(bytes, offsetRef);
    const reserved9 = decodeBytes(bytes, offsetRef, 8);
    const firmware_version_minor = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const firmware_version_major = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const reserved10 = decodeBytes(bytes, offsetRef, 4);
    devices.push({
      accel_meas_x,
      accel_meas_y,
      accel_meas_z,
      reserved6,
      user_x,
      user_y,
      width,
      height,
      reserved7,
      device_version_vendor,
      device_version_product,
      reserved8,
      firmware_build,
      reserved9,
      firmware_version_minor,
      firmware_version_major,
      reserved10,
    });
  }
  const tile_devices_count = view.getUint8(offsetRef.current); offsetRef.current += 1;
  return {
    start_index,
    devices,
    tile_devices_count,
  };
}

export function decodeState64(bytes: Uint8Array, offsetRef: OffsetRef) {
  const tile_index = bytes[offsetRef.current]!; offsetRef.current += 1;
  const reserved6 = decodeBytes(bytes, offsetRef, 1);
  const x = bytes[offsetRef.current]!; offsetRef.current += 1;
  const y = bytes[offsetRef.current]!; offsetRef.current += 1;
  const width = bytes[offsetRef.current]!; offsetRef.current += 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const colors: Color[] = [];
  for (let i = 0; i < 64; i++) {
    const hue = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const saturation = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const brightness = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const kelvin = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    colors.push({
      hue,
      saturation,
      brightness,
      kelvin,
    });
  }
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
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const zones_count = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const zone_index = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const hue = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const saturation = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const brightness = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const kelvin = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return {
    zones_count,
    zone_index,
    hue,
    saturation,
    brightness,
    kelvin,
  };
}

export function decodeStateMultiZone(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const zones_count = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const zone_index = view.getUint8(offsetRef.current); offsetRef.current += 1;

  const colors: Color[] = [];
  for (let i = 0; i < 8; i++) {
    const hue = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const saturation = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const brightness = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const kelvin = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    colors.push({ hue, saturation, brightness, kelvin });
  }

  return {
    zones_count,
    zone_index,
    colors,
  };
}

export function decodeStateMultiZoneEffect(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const instanceid = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  const type = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const reserved6 = decodeBytes(bytes, offsetRef, 2);
  const speed = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  const duration = view.getBigUint64(offsetRef.current, true); offsetRef.current += 8;
  const reserved7 = decodeBytes(bytes, offsetRef, 4);
  const reserved8 = decodeBytes(bytes, offsetRef, 4);
  const parameters = decodeBytes(bytes, offsetRef, 32);
  return {
    instanceid,
    type,
    reserved6,
    speed,
    duration,
    reserved7,
    reserved8,
    parameters,
  };
}

export function decodeStateExtendedColorZones(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const zones_count = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const zone_index = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const colors_count = view.getUint8(offsetRef.current); offsetRef.current += 1;

  const colors: Color[] = [];
  for (let i = 0; i < 82; i++) {
    const hue = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const saturation = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const brightness = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const kelvin = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    colors.push({ hue, saturation, brightness, kelvin });
  }

  return {
    zones_count,
    zone_index,
    colors_count,
    colors,
  };
}

export function decodeStateTileEffect(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const reserved0 = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const instanceid = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  const type = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const speed = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  const duration = view.getBigUint64(offsetRef.current, true); offsetRef.current += 8;
  const reserved1 = decodeBytes(bytes, offsetRef, 4);
  const reserved2 = decodeBytes(bytes, offsetRef, 4);
  const skyType = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const reserved3 = decodeBytes(bytes, offsetRef, 3);
  const cloudSaturationMin = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const reserved4 = decodeBytes(bytes, offsetRef, 3);
  const cloudSaturationMax = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const reserved5 = decodeBytes(bytes, offsetRef, 23);
  const palette_count = view.getUint8(offsetRef.current); offsetRef.current += 1;

  const palette: Color[] = [];
  for (let i = 0; i < 16; i++) {
    const hue = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const saturation = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const brightness = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    const kelvin = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
    palette.push({ hue, saturation, brightness, kelvin });
  }

  return {
    reserved0,
    instanceid,
    type,
    speed,
    duration,
    reserved1,
    reserved2,
    skyType,
    reserved3,
    cloudSaturationMin,
    reserved4,
    cloudSaturationMax,
    reserved5,
    palette_count,
    palette,
  };
}

export function decodeSensorStateAmbientLight(bytes: Uint8Array, offsetRef: OffsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const lux = view.getFloat32(offsetRef.current, true); offsetRef.current += 4;
  return {
    lux,
  };
}

export const getHeaderSize = (view: DataView, offset = 0): number => view.getUint16(offset, true);

export const getHeaderFlags = (view: DataView, offset = 0): number => view.getUint16(offset + 2, true);

export const getHeaderTagged = (view: DataView, offset = 0): boolean => !!((getHeaderFlags(view, offset) >> 12) & 0b1);

export const getHeaderSource = (view: DataView, offset = 0): number => view.getUint32(offset + 4, true);

export const getHeaderTarget = (bytes: Uint8Array, offset = 0): Uint8Array => bytes.subarray(offset + 8, offset + 14);

export const getHeaderResponseFlags = (view: DataView, offset = 0): number => view.getUint8(offset + 22);

export const getHeaderResponseRequired = (responseFlags: number): boolean => (responseFlags & 0b1) > 0;

export const getHeaderAcknowledgeRequired = (responseFlags: number): boolean => (responseFlags & 0b10) > 0;

export const getHeaderType = (view: DataView, offset = 0): number => view.getUint16(offset + 32, true);

export const getHeaderSequence = (view: DataView, offset = 0): number => view.getUint8(offset + 23);

export const getPayload = (bytes: Uint8Array, offset = 0): Uint8Array => bytes.subarray(offset + 36);

export function decodeHeader(bytes: Uint8Array, offset = 0) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);

  /** Frame Header */
  const size = getHeaderSize(view, offset);
  const flags = getHeaderFlags(view, offset);
  const protocol = flags & 0xFFF;
  const addressable = !!((flags >> 12) & 0b1);
  const tagged = !!((flags >> 13) & 0b1);
  const origin = (flags >> 14) & 0b11;

  const source = getHeaderSource(view, offset);

  /** Frame Address */
  const target = getHeaderTarget(bytes, offset);

  // last 2 bytes of target are reserved
  const reserved1 = () => bytes.subarray(offset + 14, offset + 16);
  const reserved2 = () => bytes.subarray(offset + 16, offset + 22);

  const responseFlags = getHeaderResponseFlags(view, offset);
  const res_required = getHeaderResponseRequired(responseFlags);
  const ack_required = getHeaderAcknowledgeRequired(responseFlags);
  const reserved3 = (responseFlags & 0b11111100) >> 2;

  const sequence = getHeaderSequence(view, offset);

  /** Protocol Header */
  const reserved4 = () => bytes.subarray(offset + 24, offset + 32);

  const type = getHeaderType(view, offset);

  const reserved5 = () => bytes.subarray(offset + 34, offset + 36);

  return {
    size,
    protocol,
    addressable,
    tagged,
    origin,
    source,
    target,
    reserved1,
    reserved2,
    res_required,
    ack_required,
    reserved3,
    reserved4,
    sequence,
    reserved5,
    type,
  };
}