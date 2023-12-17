export const PORT = 56700;
export const BROADCAST_ADDRESS = '255.255.255.255';

/**
 * @template T
 * @typedef {T extends (...args: any[]) => infer R ? R : any} ReturnType
 */

/**
 * @readonly
 * @enum {number}
 */
export const SERVICE_TYPE = {
  UDP: 1,
  RESERVED2: 2,
  RESERVED3: 3,
  RESERVED4: 4,
  RESERVED5: 5,
};

/**
 * @readonly
 * @enum {number} 
 */
export const TYPE = {
  GetService: 2,
  StateService: 3,
  GetHostFirmware: 14,
  StateHostFirmware: 15,
  GetWifiInfo: 16,
  StateWifiInfo: 17,
  GetWifiFirmware: 18,
  StateWifiFirmware: 19,
  GetPower: 20,
  SetPower: 21,
  StatePower: 22,
  GetLabel: 23,
  SetLabel: 24,
  StateLabel: 25,
  GetVersion: 32,
  StateVersion: 33,
  GetInfo: 34,
  StateInfo: 35,
  SetReboot: 38,
  Acknowledgement: 45,
  GetLocation: 48,
  SetLocation: 49,
  StateLocation: 50,
  GetGroup: 51,
  SetGroup: 52,
  StateGroup: 53,
  EchoRequest: 58,
  EchoResponse: 59,
  StateUnhandled: 223,

  /** Light */
  GetColor: 101,
  SetColor: 102,
  SetWaveform: 103,
  LightState: 107,
  GetLightPower: 116,
  SetLightPower: 117,
  StateLightPower: 118,
  SetWaveformOptional: 119,
  GetInfrared: 120,
  StateInfrared: 121,
  SetInfrared: 122,
  GetHevCycle: 142,
  SetHevCycle: 143,
  StateHevCycle: 144,
  GetHevCycleConfiguration: 145,
  SetHevCycleConfiguration: 146,
  StateHevCycleConfiguration: 147,
  GetLastHevCycleResult: 148,
  StateLastHevCycleResult: 149,

  /** MultiZone */
  SetColorZones: 501,
  GetColorZones: 502,
  StateZone: 503,
  StateMultiZone: 506,
  GetMultiZoneEffect: 507,
  SetMultiZoneEffect: 508,
  StateMultiZoneEffect: 509,
  SetExtendedColorZones: 510,
  GetExtendedColorZones: 511,
  StateExtendedColorZones: 512,

  /** Relay */
  GetRPower: 816,
  SetRPower: 817,
  StateRPower: 818,

  /** Tile */
  GetDeviceChain: 701,
  StateDeviceChain: 702,
  Get64: 707,
  State64: 711,
  Set64: 715,
  GetTileEffect: 718,
  SetTileEffect: 719,
  StateTileEffect: 720,
  SensorGetAmbientLight: 401,
  SensorStateAmbientLight: 402,

  /** Undocumented */
  _SetSite: 1,
  _GetTime: 4,
  _SetTime: 5,
  _StateTime: 6,
  _GetMeshInfo: 12,
  _StateMeshInfo: 13,
  _GetTags: 26,
  _SetTags: 27,
  _StateTags: 28,
  _GetTagLabels: 29,
  _SetTagLabels: 30,
  _StateTagLabels: 31,
  _GetMCURailVoltage: 36,
  _StateMCURailVoltage: 37,
  _SetFactoryTestMode: 39,
  _DisableFactoryTestMode: 40,
  _StateFactoryTestMode: 41,
  _StateReboot: 43,
  _SetDimAbsolute: 104,
  _SetDimRelative: 105,
  _GetLightTemperature: 110,
  _StateLightTemperature: 111,
  _WANConnectPlain: 201,
  _WANConnectKey: 202,
  _WANStateConnect: 203,
  _WANSub: 204,
  _WANUnsub: 205,
  _WANStateSub: 206,
  _GetWifiState: 301,
  _SetWifiState: 302,
  _StateWifiState: 303,
  _GetAccessPoint: 304,
  _SetAccessPoint: 305,
  _StateAccessPoint: 306,
};

const TYPE_NAME = Object.entries(TYPE).reduce((accum, [key, value]) => {
  accum[value] = key;
  return accum;
}, {});

export const NO_TARGET = new Uint8Array([0, 0, 0, 0, 0, 0]);

/**
 * @param {boolean} tagged
 * @param {number} source
 * @param {Uint8Array} target
 * @param {boolean} res_required
 * @param {boolean} ack_required
 * @param {number} sequence
 * @param {number} type
 * @param {Uint8Array} [payload] 
 * @returns 
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

  // reserved
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
  return {
    bytes: slice,
    address: Array.from(slice).map((byte) => byte.toString(16).padStart(2, '0')).join(':'),
  };
}

const textDecoder = new TextDecoder();

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 * @param {number} maxLength
 * @returns 
 */
function decodeString(bytes, offsetRef, maxLength) {
  const foundIndex = bytes
    .subarray(offsetRef.current, offsetRef.current + maxLength)
    .findIndex((value) => value === 0);
  const length = foundIndex >= 0 ? foundIndex : maxLength;
  // const value = String.fromCharCode.apply(null, bytes.subarray(offsetRef.current, offsetRef.current + length));
  const value = textDecoder.decode(bytes.subarray(offsetRef.current, offsetRef.current + length));
  offsetRef.current += maxLength;
  return value;
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
  const build = new Date(Number(view.getBigUint64(offsetRef.current, true) / 1000000n)); offsetRef.current += 8;
  const reserved = decodeBytes(bytes, offsetRef, 8);
  const versionMinor = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const versionMajor = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  return {
    build,
    reserved,
    version_minor: versionMinor,
    version_major: versionMajor,
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
  const reserved_2 = decodeBytes(bytes, offsetRef, 2);
  const power = view.getUint16(offsetRef.current, true); offsetRef.current += 2;
  const label = decodeString(bytes, offsetRef, 32);
  const reserved_8 = decodeBytes(bytes, offsetRef, 8);

  return {
    hue,
    saturation,
    brightness,
    kelvin,
    power,
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
  return {
    type: {
      code: type,
      name: TYPE_NAME[type] ?? 'Unknown',
    },
  };
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateTime(bytes, offsetRef) {
  const view = new DataView(bytes.buffer);
  const time = view.getBigUint64(offsetRef.current, true); offsetRef.current += 8;
  return time;
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
 * @param {number} rssi 
 */
function getRssiStatus(rssi) {
  if (rssi === 200) return 'none';

  if (rssi < -80 || rssi === 4 || rssi === 5 || rssi === 6) {
    return 'very bad';
  }

  if (rssi < -70 || (rssi >= 7 && rssi <= 11)) {
    return 'somewhat bad';
  }

  if (rssi < -60 || (rssi >= 12 && rssi <= 16)) {
    return 'alright';
  }

  if (rssi < 0 || rssi > 16) {
    return 'good';
  }

  return 'none';
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
 * @param {number} type 
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
function decodeType(type, bytes, offsetRef) {
  switch (type) {
    case TYPE.StateService:
      return decodeStateService(bytes, offsetRef);
    case TYPE.Acknowledgement:
      return null;
    case TYPE.StateHostFirmware:
      return decodeStateHostFirmware(bytes, offsetRef);
    case TYPE.LightState:
      return decodeLightState(bytes, offsetRef);
    case TYPE.StatePower:
      return decodeStatePower(bytes, offsetRef);
    case TYPE.StateVersion:
      return decodeStateVersion(bytes, offsetRef);
    case TYPE.StateLabel:
      return decodeStateLabel(bytes, offsetRef);
    case TYPE.StateGroup:
      return decodeStateGroup(bytes, offsetRef);
    case TYPE.StateUnhandled:
      return decodeStateUnhandled(bytes, offsetRef);
    case TYPE.StateWifiFirmware:
      // Decoding is same as StateHostFirmware
      return decodeStateHostFirmware(bytes, offsetRef);
    case TYPE.StateWifiInfo:
      return decodeStateWifiInfo(bytes, offsetRef);
    case TYPE.StateInfrared:
      return decodeStateInfrared(bytes, offsetRef);
    case TYPE.StateLightPower:
      return decodeStateLightPower(bytes, offsetRef);
    case TYPE.GetPower:
      return undefined;
    case TYPE._StateTime:
      return decodeStateTime(bytes, offsetRef);
    case TYPE._StateMeshInfo:
      return decodeStateMeshInfo(bytes, offsetRef);
    case TYPE._StateAccessPoint:
      return decodeStateAccessPoint(bytes, offsetRef);
    case TYPE._StateMCURailVoltage:
      return decodeStateMCURailVoltage(bytes, offsetRef);
    case TYPE._StateReboot:
      return undefined;
    default:
      return {
        todo: true,
        buffer: decodeBytes(bytes, offsetRef, bytes.byteLength - offsetRef.current),
      };
  }
}

/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 * @param {boolean} [warnIfMoreBufferRemaining=true]
 */
export function decode(bytes, offsetRef, warnIfMoreBufferRemaining = true) {
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

  const payload = decodeType(type, bytes, offsetRef);

  if (warnIfMoreBufferRemaining && offsetRef.current !== buffer.byteLength) {
    console.error('Packet has more data that was not decoded', offsetRef, buffer);
  }
  
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
    type: {
      code: type,
      name: TYPE_NAME[type] ?? 'Unknown',
    },
    payload,
  };
}

/**
 * @typedef {ReturnType<typeof decode>} RawPacket
 */

/**
 * @template T
 * @typedef {Omit<RawPacket, "payload"> & { payload: T; }} Packet
 */

/**
 * @param {RawPacket} packet
 * @returns {packet is Packet<ReturnType<typeof decodeStateService>>}
 */
export const isStateService = (packet) => packet.type.code === TYPE.StateService;

/**
 * @param {RawPacket} packet
 * @returns {packet is Packet<ReturnType<typeof decodeStateLabel>>}
 */
export const isStateLabel = (packet) => packet.type.code === TYPE.StateLabel;

/**
 * @param {RawPacket} packet
 * @returns {packet is Packet<ReturnType<typeof decodeStateGroup>>}
 */
export const isStateGroup = (packet) => packet.type.code === TYPE.StateGroup;

/**
 * @param {RawPacket} packet
 * @returns {packet is Packet<ReturnType<typeof decodeLightState>>}
 */
export const isLightState = (packet) => packet.type.code === TYPE.LightState;

/**
 * @param {RawPacket} packet
 * @returns {packet is Packet<ReturnType<typeof decodeStatePower>>}
 */
export const isStatePower = (packet) => packet.type.code === TYPE.StatePower;
