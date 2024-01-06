import { getRssiStatus } from './utils.js';

/**
 * @param {boolean} tagged
 * @param {number} source
 * @param {Uint8Array} target
 * @param {boolean} resRequired
 * @param {boolean} ackRequired
 * @param {number} sequence
 * @param {number} type
 * @param {Uint8Array} [payload]
 */
export function encode(
  tagged,
  source,
  target,
  resRequired,
  ackRequired,
  sequence,
  type,
  payload,
) {
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

const textEncoder = new TextEncoder();

export function encodeString(value, length) {
  const bytes = new Uint8Array(length);
  textEncoder.encodeInto(value, bytes);
  if (value.length < length) {
    bytes[value.length] = 0;
  }
  return bytes;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 * @param {number} byteLength
 */
function decodeBytes(bytes, offsetRef, byteLength) {
  const subarray = bytes.subarray(offsetRef.current, offsetRef.current + byteLength);
  offsetRef.current += byteLength;
  return subarray;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
function decodeMacAddress(bytes, offsetRef) {
  const slice = bytes.subarray(offsetRef.current, offsetRef.current + 6);
  offsetRef.current += 6;
  return slice;
}

const textDecoder = new TextDecoder();

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 * @param {number} maxLength
 */
function decodeString(bytes, offsetRef, maxLength) {
  const foundIndex = bytes
    .subarray(offsetRef.current, offsetRef.current + maxLength)
    .findIndex((value) => value === 0);
  const length = foundIndex >= 0 ? foundIndex : maxLength;
  const value = textDecoder.decode(bytes.subarray(offsetRef.current, offsetRef.current + length));
  offsetRef.current += maxLength;
  return value;
}

function decodeTimestamp(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const time = new Date(Number(view.getBigUint64(offsetRef.current, true) / 1000000n));
  offsetRef.current += 8;
  return time;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateService(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const service = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const port = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  return {
    service: {
      code: service,
    },
    port,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateHostFirmware(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const build = decodeTimestamp(bytes, offsetRef);
  const reserved = decodeBytes(bytes, offsetRef, 8);
  const versionMinor = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const versionMajor = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return {
    build,
    reserved,
    version: `${versionMajor}.${versionMinor}`,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeLightState(bytes, offsetRef) {
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
    hueLevel: hue / 65535,
    saturation,
    saturationLevel: saturation / 65535,
    brightness,
    brightnessLevel: brightness / 65535,
    kelvin,
    power: {
      level: power,
      on: power !== 0,
    },
    label,
    reserved2,
    reserved8,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateVersion(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const vendor = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  const product = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  return {
    vendor,
    product,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateLabel(bytes, offsetRef) {
  return decodeString(bytes, offsetRef, 32);
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateUnhandled(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const type = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return type;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateWifiInfo(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const signal = view.getFloat32(offsetRef.current, true); offsetRef.current += 4;
  const reserved6 = decodeBytes(bytes, offsetRef, 4);
  const reserved7 = decodeBytes(bytes, offsetRef, 4);
  const reserved8 = decodeBytes(bytes, offsetRef, 2);

  const rssi = Math.floor(10 * Math.log10(signal) + 0.5);

  return {
    signal: {
      rssi,
      status: getRssiStatus(rssi),
      raw: signal,
    },
    reserved6,
    reserved7,
    reserved8,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateWifiFirmware(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const build = decodeTimestamp(bytes, offsetRef);
  const reserved6 = decodeBytes(bytes, offsetRef, 8);
  const minor = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const major = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return {
    build,
    reserved6,
    version: {
      minor,
      major,
    },
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateInfrared(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const brightness = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return brightness;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateLightPower(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const level = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return level;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateGroup(bytes, offsetRef) {
  const group = Array.from(decodeBytes(bytes, offsetRef, 16)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const label = decodeString(bytes, offsetRef, 32);
  const updatedAt = decodeBytes(bytes, offsetRef, 8);
  return {
    group,
    label,
    updatedAt,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStatePower(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const power = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return {
    power,
    on: power !== 0,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateRPower(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const relayIndex = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const level = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return {
    relayIndex,
    level,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeEchoResponse(bytes, offsetRef) {
  const payload = decodeBytes(bytes, offsetRef, 64);
  return payload;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateLocation(bytes, offsetRef) {
  const location = decodeBytes(bytes, offsetRef, 16);
  const label = decodeString(bytes, offsetRef, 32);
  const updatedAt = decodeTimestamp(bytes, offsetRef);
  return {
    location,
    label,
    updatedAt,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeHeader(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);

  /** Frame Header */

  const size = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const flags = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const protocol = flags & 0xFFF;
  const addressable = !!((flags >> 12) & 0b1);
  const tagged = !!((flags >> 13) & 0b1);
  const origin = (flags >> 14) & 0b11;

  const source = view.getUint32(offsetRef.current, true); offsetRef.current += 4;

  /** Frame Address */

  const target = decodeMacAddress(bytes, offsetRef);

  // last 2 bytes of target are reserved
  const reserved1 = decodeBytes(bytes, offsetRef, 2);

  const reserved2 = decodeBytes(bytes, offsetRef, 6);

  const responseBin = view.getUint8(offsetRef.current); offsetRef.current += 1;

  const resRequired = (responseBin & 0b1) > 0;
  const ackRequired = (responseBin & 0b10) > 0;
  const reserved3 = (responseBin & 0b11111100) >> 2;

  const sequence = view.getUint8(offsetRef.current); offsetRef.current += 1;

  /** Protocol Header */

  const reserved4 = decodeBytes(bytes, offsetRef, 8);

  const type = view.getUint16(offsetRef.current, true); offsetRef.current += 2;

  const reserved5 = decodeBytes(bytes, offsetRef, 2);

  return {
    bytes: bytes.subarray(0, 36),
    size,
    protocol,
    addressable,
    tagged,
    origin,
    source,
    target,
    reserved1,
    reserved2,
    resRequired,
    ackRequired,
    reserved3,
    reserved4,
    sequence,
    reserved5,
    type,
  };
}
