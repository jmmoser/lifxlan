import { getRssiStatus } from './utils.js';

/**
 * @typedef {{ current: number; }} OffsetRef
 */

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
  const view = new DataView(bytes.buffer);

  /** Frame Header */

  view.setUint16(0, size, true);

  view.setUint16(2, protocol | (addressable << 12) | (+tagged << 13) | (origin << 14), true);

  view.setUint32(4, source, true);

  /** Frame Address */

  bytes.set(target, 8);

  // last 2 bytes of target are always 0
  view.setUint16(14, 0, true);

  // reserved
  for (let i = 0; i < 6; i++) {
    view.setUint8(16 + i, 0);
  }

  view.setUint8(22, ((resRequired ? 1 : 0) << 0) | ((resRequired ? 1 : 0) << 1));

  view.setUint8(23, sequence);

  /** Protocol Header */

  // reserved - 64 bit timestamp
  view.setBigUint64(24, 0n, true);

  // type
  view.setUint16(32, type, true);

  // rervered
  view.setUint16(34, 0, true);

  if (payload) {
    bytes.set(payload, 36);
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
  const view = new DataView(bytes.buffer);
  const time = new Date(Number(view.getBigUint64(offsetRef.current, true) / 1000000n));
  offsetRef.current += 8;
  return time;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateService(bytes, offsetRef) {
  const view = new DataView(bytes.buffer);
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
  const view = new DataView(bytes.buffer);
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
  const view = new DataView(bytes.buffer);
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
    hue_level: hue / 65535,
    saturation,
    saturation_level: saturation / 65535,
    brightness,
    brightness_level: brightness / 65535,
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
  const view = new DataView(bytes.buffer);
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
export function decodeStateAccessPoint(bytes, offsetRef) {
  const view = new DataView(bytes.buffer);
  const iface = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const ssid = decodeString(bytes, offsetRef, 32);
  const securityProtocol = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const strength = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const channel = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return {
    iface,
    ssid,
    securityProtocol,
    strength,
    channel,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateUnhandled(bytes, offsetRef) {
  const view = new DataView(bytes.buffer);
  const type = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return type;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateTime(bytes, offsetRef) {
  return decodeTimestamp(bytes, offsetRef);
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateMeshInfo(bytes, offsetRef) {
  const view = new DataView(bytes.buffer);
  const signal = view.getFloat32(offsetRef.current, true); offsetRef.current += 4;
  const tx = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  const rx = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  const mcuTemperature = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return {
    signal,
    tx,
    rx,
    mcuTemperature: mcuTemperature !== 0
      ? `${((mcuTemperature / 100) * 1.8 + 32).toFixed(1)} °F`
      : 'Unknown',
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateWifiInfo(bytes, offsetRef) {
  const view = new DataView(bytes.buffer);
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
export function decodeStateInfrared(bytes, offsetRef) {
  const view = new DataView(bytes.buffer);
  const brightness = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return brightness;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateLightPower(bytes, offsetRef) {
  const view = new DataView(bytes.buffer);
  const level = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return level;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateMCURailVoltage(bytes, offsetRef) {
  const view = new DataView(bytes.buffer);
  const voltage = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  return voltage;
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
  const view = new DataView(bytes.buffer);
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
  const view = new DataView(bytes.buffer);
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
  const view = new DataView(bytes.buffer);

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
  const reservedTarget2 = decodeBytes(bytes, offsetRef, 2);

  const reveredSiteMacAddress = decodeMacAddress(bytes, offsetRef);

  const responseBin = view.getUint8(offsetRef.current); offsetRef.current += 1;

  const resRequired = !!(responseBin & 0b1);
  const ackRequired = !!((responseBin >> 1) & 0b1);

  const sequence = view.getUint8(offsetRef.current); offsetRef.current += 1;

  /** Protocol Header */

  const reservedTimestamp = decodeBytes(bytes, offsetRef, 8);

  const type = view.getUint16(offsetRef.current, true); offsetRef.current += 2;

  const reservedProtocolHeader2 = decodeBytes(bytes, offsetRef, 2);

  return {
    buffer: bytes.buffer,
    size,
    protocol,
    addressable,
    tagged,
    origin,
    source,
    target,
    reservedTarget2,
    reveredSiteMacAddress,
    resRequired,
    ackRequired,
    sequence,
    reserved_timestamp: {
      buffer: reservedTimestamp,
      decoded: new DataView(reservedTimestamp.buffer).getBigUint64(0, true),
    },
    reservedProtocolHeader2,
    type,
  };
}
