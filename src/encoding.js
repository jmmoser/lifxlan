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

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {string} uuid
 */
export function encodeUuidTo(bytes, offset, uuid) {
  const hex = uuid.replace(/-/g, '');
  for (let i = 0, j = 0; i < hex.length; i += 2, j++) {
    bytes[offset + j] = parseInt(hex.slice(i, i + 2), 16);
  }
}

const textEncoder = new TextEncoder();

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {string} value
 * @param {number} byteLength
 */
export function encodeStringTo(bytes, offset, value, byteLength) {
  textEncoder.encodeInto(value, bytes);
  if (value.length < byteLength) {
    bytes[offset + value.length] = 0;
  }
}

/**
 * @param {string} value
 * @param {number} byteLength
 */
export function encodeString(value, byteLength) {
  const bytes = new Uint8Array(byteLength);
  encodeStringTo(bytes, 0, value, byteLength);
  return bytes;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 * @param {number} byteLength
 */
function decodeBytes(bytes, offsetRef, byteLength) {
  const subarray = bytes.subarray(offsetRef.current, offsetRef.current + byteLength);
  offsetRef.current += byteLength;
  return subarray;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
function decodeUuid(bytes, offsetRef) {
  return Array.from(decodeBytes(bytes, offsetRef, 16)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const textDecoder = new TextDecoder();

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
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

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
function decodeTimestamp(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const time = new Date(Number(view.getBigUint64(offsetRef.current, true) / 1000000n));
  offsetRef.current += 8;
  return time;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateService(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const service = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const port = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  return {
    service,
    port,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateHostFirmware(bytes, offsetRef) {
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

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateWifiInfo(bytes, offsetRef) {
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

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateWifiFirmware(bytes, offsetRef) {
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

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStatePower(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const power = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return power;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateLabel(bytes, offsetRef) {
  return decodeString(bytes, offsetRef, 32);
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
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
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateInfo(bytes, offsetRef) {
  const time = decodeTimestamp(bytes, offsetRef);
  const uptime = decodeTimestamp(bytes, offsetRef);
  const downtime = decodeTimestamp(bytes, offsetRef);
  return {
    time,
    uptime,
    downtime,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
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
 * @param {{ current: number; }} offsetRef
 * @returns {{
 *   group: string;
 *   label: string;
 *   updated_at: bigint;
 * }}
 */
export function decodeStateGroup(bytes, offsetRef) {
  const group = decodeUuid(bytes, offsetRef);
  const label = decodeString(bytes, offsetRef, 32);
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const updated_at = view.getBigUint64(offsetRef.current, true); offsetRef.current += 8;

  return {
    group,
    label,
    updated_at,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeEchoResponse(bytes, offsetRef) {
  const payload = decodeBytes(bytes, offsetRef, 64);
  return payload;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateUnhandled(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const type = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return type;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeSetColor(bytes, offsetRef) {
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

/**
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} duration
 */
export function encodeSetColor(hue, saturation, brightness, kelvin, duration) {
  const payload = new Uint8Array(13);
  const view = new DataView(payload.buffer);
  view.setUint16(1, hue, true);
  view.setUint16(3, saturation, true);
  view.setUint16(5, brightness, true);
  view.setUint16(7, kelvin, true);
  view.setUint32(9, duration, true);
  return payload;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
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
    saturation,
    brightness,
    kelvin,
    power,
    label,
    reserved2,
    reserved8,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateLightPower(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const level = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return level;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateInfrared(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const brightness = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return brightness;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateHevCycle(bytes, offsetRef) {
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

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateHevCycleConfiguration(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const indication = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const duration_s = view.getUint32(offsetRef.current, true); offsetRef.current += 4;
  return {
    indication,
    duration_s,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateLastHevCycleResult(bytes, offsetRef) {
  const result = bytes[offsetRef.current]; offsetRef.current += 1;
  return result;
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateRPower(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const relay_index = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const level = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return {
    relay_index,
    level,
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateDeviceChain(bytes, offsetRef) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const start_index = view.getUint8(offsetRef.current); offsetRef.current += 1;
  const devices = [];
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
    const reversed9 = decodeBytes(bytes, offsetRef, 8);
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
      reversed9,
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

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeState64(bytes, offsetRef) {
  const tile_index = bytes[offsetRef.current]; offsetRef.current += 1;
  const reserved6 = decodeBytes(bytes, offsetRef, 1);
  const x = bytes[offsetRef.current]; offsetRef.current += 1;
  const y = bytes[offsetRef.current]; offsetRef.current += 1;
  const width = bytes[offsetRef.current]; offsetRef.current += 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  /**
   * @type {{
   *   hue: number;
   *   saturation: number;
   *   brightness: number;
   *   kelvin: number;
   * }[]}
   */
  const colors = [];
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

/**
 * @param {DataView} view
 * @param {number} [offset]
 */
export const getHeaderSize = (view, offset = 0) => view.getUint16(offset, true);

/**
 * @param {DataView} view
 * @param {number} [offset]
 */
export const getHeaderFlags = (view, offset = 0) => view.getUint16(offset + 2, true);

/**
 * @param {DataView} view
 * @param {number} [offset]
 */
export const getHeaderTagged = (view, offset = 0) => !!((getHeaderFlags(view, offset) >> 12) & 0b1);

/**
 * @param {DataView} view
 * @param {number} [offset]
 */
export const getHeaderSource = (view, offset = 0) => view.getUint32(offset + 4, true);

/**
 * @param {Uint8Array} bytes
 * @param {number} [offset]
 */
export const getHeaderTarget = (bytes, offset = 0) => bytes.subarray(offset + 8, offset + 14);

/**
 * @param {DataView} view
 * @param {number} [offset]
 */
export const getHeaderResponseFlags = (view, offset = 0) => view.getUint8(offset + 22);

/**
 * @param {number} responseFlags
 */
export const getHeaderResponseRequired = (responseFlags) => (responseFlags & 0b1) > 0;

/**
 * @param {number} responseFlags
 */
export const getHeaderAcknowledgeRequired = (responseFlags) => (responseFlags & 0b10) > 0;

/**
 * @param {DataView} view
 * @param {number} [offset]
 */
export const getHeaderType = (view, offset = 0) => view.getUint16(offset + 32, true);

/**
 * @param {DataView} view
 * @param {number} [offset]
 */
export const getHeaderSequence = (view, offset = 0) => view.getUint8(offset + 23);

/**
 * @param {Uint8Array} bytes
 * @param {number} [offset]
 */
export const getPayload = (bytes, offset = 0) => bytes.subarray(offset + 36);

/**
 * @param {Uint8Array} bytes
 * @param {number} [offset]
 */
export function decodeHeader(bytes, offset = 0) {
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
  const reserved1 = bytes.subarray(offset + 14, offset + 16);
  const reserved2 = bytes.subarray(offset + 16, offset + 22);

  const responseFlags = getHeaderResponseFlags(view, offset);
  const res_required = getHeaderResponseRequired(responseFlags);
  const ack_required = getHeaderAcknowledgeRequired(responseFlags);
  const reserved3 = (responseFlags & 0b11111100) >> 2;

  const sequence = getHeaderSequence(view, offset);

  /** Protocol Header */
  const reserved4 = bytes.subarray(offset + 24, offset + 32);

  const type = getHeaderType(view, offset);

  const reserved5 = bytes.subarray(offset + 34, offset + 36);

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
    res_required,
    ack_required,
    reserved3,
    reserved4,
    sequence,
    reserved5,
    type,
  };
}
