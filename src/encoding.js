import { getRssiStatus } from './utils.js';

/**
 * @param {boolean} tagged
 * @param {number} source
 * @param {Uint8Array} target
 * @param {boolean} res_required
 * @param {boolean} ack_required
 * @param {number} sequence
 * @param {number} type
 * @param {Uint8Array} [payload] 
 */
export function encode(
  tagged, source,
  target, res_required, ack_required, sequence,
  type,
  payload,
) {
  const protocol = 1024;
  const addressable = 1;
  const origin = 0;

  const size = 36 + (payload != null ? payload.byteLength : 0);

  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);

  let offset = 0;

  /** Frame Header */

  view.setUint16(offset, size, true); offset += 2;

  view.setUint16(offset, protocol | addressable << 12 | (tagged ? 1 : 0) << 13 | origin << 14, true); offset += 2;

  view.setUint32(offset, source, true); offset += 4;

  /** Frame Address */

  bytes.set(target, offset); offset += 6;

  // last 2 bytes of target are always 0
  view.setUint16(offset, 0, true); offset += 2;

  // reserved
  for (let i = 0; i < 6; i++) {
    view.setUint8(offset + i, 0);
  }
  offset += 6;

  view.setUint8(offset, (res_required ? 1 : 0) << 0 | (ack_required ? 1 : 0) << 1); offset += 1;

  view.setUint8(offset, sequence); offset += 1;

  /** Protocol Header */

  // reserved - 64 bit timestamp
  view.setBigUint64(offset, 0n, true); offset += 8;

  // type
  view.setUint16(offset, type, true); offset += 2;

  // rervered
  view.setUint16(offset, 0, true); offset += 2;

  if (payload) {
    bytes.set(payload, offset);
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
  const time = new Date(Number(view.getBigUint64(offsetRef.current, true) / 1000000n)); offsetRef.current += 8;
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
  const hue = view.getUint16(offsetRef.current, true) / 65536; offsetRef.current += 2;
  const saturation = view.getUint16(offsetRef.current, true) / 65536; offsetRef.current += 2;
  const brightness = view.getUint16(offsetRef.current, true) / 65536; offsetRef.current += 2;
  const kelvin = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const reserved_2 = decodeBytes(bytes, offsetRef, 2);
  const power = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const label = decodeString(bytes, offsetRef, 32);
  const reserved_8 = decodeBytes(bytes, offsetRef, 8);

  return {
    hue,
    saturation,
    brightness,
    kelvin,
    power: {
      level: power,
      on: power !== 0,
    },
    label,
    reserved_2,
    reserved_8,
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
    mcuTemperature: mcuTemperature !== 0 ?
      `${((mcuTemperature / 100) * 1.8 + 32).toFixed(1)} °F`
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
  const updated_at = decodeBytes(bytes, offsetRef, 8);
  return {
    group,
    label,
    updated_at,
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
    on: power != 0,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateRPower(bytes, offsetRef) {
  const view = new DataView(bytes.buffer);
  const relay_index = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const level = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return {
    relay_index,
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
  const updated_at = decodeTimestamp(bytes, offsetRef);
  return {
    location,
    label,
    updated_at,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeHeader(bytes, offsetRef) {
  const buffer = bytes.buffer;
  const view = new DataView(bytes.buffer);

  /** Frame Header */

  const size = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const flags = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const protocol = flags & 0xFFF;
  const addressable = (flags >> 12) & 0b1 ? true : false;
  const tagged = (flags >> 13) & 0b1 ? true : false;
  const origin = (flags >> 14) & 0b11;

  const source = view.getUint32(offsetRef.current, true); offsetRef.current += 4;

  /** Frame Address */

  const target = decodeMacAddress(bytes, offsetRef);

  // last 2 bytes of target are reserved
  const reserved_target_2 = decodeBytes(bytes, offsetRef, 2);

  const revered_site_mac_address = decodeMacAddress(bytes, offsetRef);

  const responseBin = view.getUint8(offsetRef.current); offsetRef.current += 1;

  const res_required = responseBin & 0b1 ? true : false;
  const ack_required = (responseBin >> 1) & 0b1 ? true : false;

  const sequence = view.getUint8(offsetRef.current); offsetRef.current += 1;

  /** Protocol Header */

  const reserved_timestamp = decodeBytes(bytes, offsetRef, 8);

  const type = view.getUint16(offsetRef.current, true); offsetRef.current += 2;

  const reserved_protocol_header_2 = decodeBytes(bytes, offsetRef, 2);

  return {
    buffer,
    size,
    protocol,
    addressable,
    tagged,
    origin,
    source,
    target,
    reserved_target_2,
    revered_site_mac_address,
    res_required,
    ack_required,
    sequence,
    reserved_timestamp: {
      buffer: reserved_timestamp,
      decoded: new DataView(reserved_timestamp.buffer).getBigUint64(0, true),
    },
    reserved_protocol_header_2,
    type,
  };
}
