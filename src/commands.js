import * as Encoding from './encoding.js';
import { Type } from './constants.js';
import { NOOP } from './utils.js';

/**
 * @template OutputType
 * @typedef {(bytes: Uint8Array, offsetRef: { current: number; }) => OutputType} Decoder
 */

/**
 * @template OutputType
 * @typedef {{
 *   type: number;
 *   payload?: Uint8Array;
 *   decode: Decoder<OutputType>;
 * }} Command
 */

export function GetServiceCommand() {
  return {
    type: Type.GetService,
    decode: Encoding.decodeStateService,
  };
}

export function GetHostFirmwareCommand() {
  return {
    type: Type.GetHostFirmware,
    decode: Encoding.decodeStateHostFirmware,
  };
}

export function GetWifiInfoCommand() {
  return {
    type: Type.GetWifiInfo,
    decode: Encoding.decodeStateWifiInfo,
  };
}

export function GetWifiFirmwareCommand() {
  return {
    type: Type.GetWifiFirmware,
    decode: Encoding.decodeStateWifiFirmware,
  };
}

export function GetPowerCommand() {
  return {
    type: Type.GetPower,
    decode: Encoding.decodeStatePower,
  };
}

/**
 * @param {number | boolean} power
 */
export function SetPowerCommand(power) {
  const payload = new Uint8Array(2);
  const view = new DataView(payload.buffer);
  view.setUint16(
    0,
    typeof power === 'number'
      ? power
      : power ? 65535 : 0,
    true,
  );
  return {
    type: Type.SetPower,
    payload,
    decode: Encoding.decodeStatePower,
  };
}

export function GetLabelCommand() {
  return {
    type: Type.GetLabel,
    decode: Encoding.decodeStateLabel,
  };
}

/**
 * @param {string} label
 */
export function SetLabelCommand(label) {
  return {
    type: Type.SetLabel,
    payload: Encoding.encodeString(label, 32),
    decode: Encoding.decodeStateLabel,
  };
}

export function GetVersionCommand() {
  return {
    type: Type.GetVersion,
    decode: Encoding.decodeStateVersion,
  };
}

export function GetInfoCommand() {
  return {
    type: Type.GetInfo,
    decode: Encoding.decodeStateInfo,
  };
}

/**
 * @returns {Command<void>}
 */
export function SetRebootCommand() {
  return {
    type: Type.SetReboot,
    decode: NOOP,
  };
}

/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateLocation>>}
 */
export function GetLocationCommand() {
  return {
    type: Type.GetLocation,
    decode: Encoding.decodeStateLocation,
  };
}

/**
 * @param {Uint8Array | string} location
 * @param {string} label
 * @param {Date} updatedAt
 */
export function SetLocationCommand(location, label, updatedAt) {
  const payload = new Uint8Array(56);
  const view = new DataView(payload.buffer);

  if (typeof location === 'string') {
    Encoding.encodeUuidTo(payload, 0, location);
  } else {
    payload.set(location, 0);
  }

  Encoding.encodeStringTo(payload, 16, label, 32);
  Encoding.encodeTimestampTo(view, 48, updatedAt);

  return {
    type: Type.SetLocation,
    payload,
    decode: Encoding.decodeStateLocation,
  };
}

export function GetGroupCommand() {
  return {
    type: Type.GetGroup,
    decode: Encoding.decodeStateGroup,
  };
}

/**
 * @param {Uint8Array | string} group
 * @param {string} label
 * @param {Date} updatedAt
 */
export function SetGroupCommand(group, label, updatedAt) {
  const payload = new Uint8Array(56);
  const view = new DataView(payload.buffer);

  if (typeof group === 'string') {
    Encoding.encodeUuidTo(payload, 0, group);
  } else {
    payload.set(group, 0);
  }

  Encoding.encodeStringTo(payload, 16, label, 32);
  Encoding.encodeTimestampTo(view, 48, updatedAt);

  return {
    type: Type.SetGroup,
    payload,
    decode: Encoding.decodeStateGroup,
  };
}

/**
 * @param {Uint8Array} echoing
 * @returns {Command<ReturnType<typeof Encoding.decodeEchoResponse>>}
 */
export function EchoRequestCommand(echoing) {
  const payload = new Uint8Array(64);
  payload.set(echoing);
  return {
    type: Type.EchoRequest,
    payload,
    decode: Encoding.decodeEchoResponse,
  };
}

export function GetColorCommand() {
  return {
    type: Type.GetColor,
    decode: Encoding.decodeLightState,
  };
}

/**
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} duration
 */
export function SetColorCommand(hue, saturation, brightness, kelvin, duration) {
  return {
    type: Type.SetColor,
    payload: Encoding.encodeSetColor(hue, saturation, brightness, kelvin, duration),
    decode: Encoding.decodeLightState,
  };
}

/**
 * @param {boolean} transient
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} period
 * @param {number} cycles
 * @param {number} skewRatio
 * @param {import('./constants.js').Waveform} waveform
 */
export function SetWaveformCommand(
  transient,
  hue,
  saturation,
  brightness,
  kelvin,
  period,
  cycles,
  skewRatio,
  waveform,
) {
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
  return {
    type: Type.SetWaveform,
    payload,
    decode: Encoding.decodeLightState,
  };
}

export function GetLightPowerCommand() {
  return {
    type: Type.GetLightPower,
    decode: Encoding.decodeStateLightPower,
  };
}

/**
 * @param {number | boolean} level
 * @param {number} duration
 */
export function SetLightPowerCommand(level, duration) {
  const payload = new Uint8Array(6);
  const view = new DataView(payload.buffer);
  const value = typeof level === 'number'
    ? level
    : level ? 65535 : 0;
  view.setUint16(0, value, true);
  view.setUint32(2, duration, true);
  return {
    type: Type.SetLightPower,
    payload,
    decode: Encoding.decodeStateLightPower,
  };
}

/**
 * @param {boolean} transient
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} period
 * @param {number} cycles
 * @param {number} skewRatio
 * @param {import('./constants.js').Waveform} waveform
 * @param {boolean} setHue
 * @param {boolean} setSaturation
 * @param {boolean} setBrightness
 * @param {boolean} setKelvin
 */
export function SetWaveformOptionalCommand(
  transient,
  hue,
  saturation,
  brightness,
  kelvin,
  period,
  cycles,
  skewRatio,
  waveform,
  setHue,
  setSaturation,
  setBrightness,
  setKelvin,
) {
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
  return {
    type: Type.SetWaveformOptional,
    payload,
    decode: Encoding.decodeStateLightPower,
  };
}

export function GetInfraredCommand() {
  return {
    type: Type.GetInfrared,
    decode: Encoding.decodeStateInfrared,
  };
}

/**
 * @param {number} brightness
 * @returns {Command<ReturnType<typeof Encoding.decodeStateInfrared>>}
 */
export function SetInfraredCommand(brightness) {
  const payload = new Uint8Array(2);
  const view = new DataView(payload.buffer);
  view.setUint16(0, brightness, true);
  return {
    type: Type.SetInfrared,
    payload,
    decode: Encoding.decodeStateInfrared,
  };
}

export function GetHevCycleCommand() {
  return {
    type: Type.GetHevCycle,
    decode: Encoding.decodeStateHevCycle,
  };
}

/**
 * @param {boolean} enable
 * @param {number} durationSeconds
 */
export function SetHevCycleCommand(enable, durationSeconds) {
  const payload = new Uint8Array(5);
  const view = new DataView(payload.buffer);
  view.setUint8(0, enable ? 1 : 0);
  view.setUint32(1, durationSeconds, true);
  return {
    type: Type.SetHevCycle,
    payload,
    decode: Encoding.decodeStateHevCycle,
  };
}

export function GetHevCycleConfigurationCommand() {
  return {
    type: Type.GetHevCycleConfiguration,
    decode: Encoding.decodeStateHevCycleConfiguration,
  };
}

/**
 * @param {boolean} indication
 * @param {number} durationSeconds
 */
export function SetHevCycleConfigurationCommand(indication, durationSeconds) {
  const payload = new Uint8Array(5);
  const view = new DataView(payload.buffer);
  view.setUint8(0, indication ? 1 : 0);
  view.setUint32(1, durationSeconds, true);
  return {
    type: Type.SetHevCycleConfiguration,
    payload,
    decode: Encoding.decodeStateHevCycleConfiguration,
  };
}

export function GetLastHevCycleResultCommand() {
  return {
    type: Type.GetLastHevCycleResult,
    decode: Encoding.decodeStateLastHevCycleResult,
  };
}

/**
 * @param {number} relayIndex
 * @returns {Command<ReturnType<typeof Encoding.decodeStateRPower>>}
 */
export function GetRPowerCommand(relayIndex) {
  const payload = new Uint8Array(1);
  const view = new DataView(payload.buffer);
  view.setUint8(0, relayIndex);
  return {
    type: Type.GetRPower,
    payload,
    decode: Encoding.decodeStateRPower,
  };
}

/**
 * @param {number} relayIndex
 * @param {number} level
 */
export function SetRPowerCommand(relayIndex, level) {
  const payload = new Uint8Array(3);
  const view = new DataView(payload.buffer);
  view.setUint8(0, relayIndex);
  view.setUint16(1, level, true);
  return {
    type: Type.SetRPower,
    payload,
    decode: Encoding.decodeStateRPower,
  };
}

export function GetDeviceChainCommand() {
  return {
    type: Type.GetDeviceChain,
    decode: Encoding.decodeStateDeviceChain,
  };
}

/**
 * @param {number} tileIndex
 * @param {number} length
 * @param {number} x
 * @param {number} y
 * @param {number} width
 */
export function Get64Command(tileIndex, length, x, y, width) {
  const payload = new Uint8Array(6);
  const view = new DataView(payload.buffer);
  view.setUint8(0, tileIndex);
  view.setUint8(1, length);
  view.setUint8(2, 0); // reserved
  view.setUint8(3, x);
  view.setUint8(4, y);
  view.setUint8(5, width);
  return {
    type: Type.Get64,
    payload,
    decode: Encoding.decodeState64,
  };
}

/**
 * @param {number} startIndex
 * @param {number} endIndex
 */
export function GetColorZonesCommand(startIndex, endIndex) {
  const payload = new Uint8Array(2);
  const view = new DataView(payload.buffer);
  view.setUint8(0, startIndex);
  view.setUint8(1, endIndex);
  return {
    type: Type.GetColorZones,
    payload,
    decode: Encoding.decodeStateMultiZone,
  };
}

/**
 * @param {number} startIndex
 * @param {number} endIndex
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} duration
 * @param {import('./constants.js').MultiZoneApplicationRequest} apply
 */
export function SetColorZonesCommand(startIndex, endIndex, hue, saturation, brightness, kelvin, duration, apply) {
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
  return {
    type: Type.SetColorZones,
    payload,
    decode: Encoding.decodeStateMultiZone,
  };
}

export function GetMultiZoneEffectCommand() {
  return {
    type: Type.GetMultiZoneEffect,
    decode: Encoding.decodeStateMultiZoneEffect,
  };
}

/**
 * @param {number} instanceid
 * @param {import('./constants.js').MultiZoneEffectType} effectType
 * @param {number} speed
 * @param {bigint} duration
 * @param {Uint8Array} parameters
 */
export function SetMultiZoneEffectCommand(instanceid, effectType, speed, duration, parameters) {
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
  return {
    type: Type.SetMultiZoneEffect,
    payload,
    decode: Encoding.decodeStateMultiZoneEffect,
  };
}

export function GetExtendedColorZonesCommand() {
  return {
    type: Type.GetExtendedColorZones,
    decode: Encoding.decodeStateExtendedColorZones,
  };
}

/**
 * @param {number} duration
 * @param {import('./constants.js').MultiZoneExtendedApplicationRequest} apply
 * @param {number} zoneIndex
 * @param {number} colorsCount
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} colors
 */
export function SetExtendedColorZonesCommand(duration, apply, zoneIndex, colorsCount, colors) {
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
  
  return {
    type: Type.SetExtendedColorZones,
    payload,
    decode: Encoding.decodeStateExtendedColorZones,
  };
}

/**
 * @param {number} tileIndex
 * @param {number} userX
 * @param {number} userY
 */
export function SetUserPositionCommand(tileIndex, userX, userY) {
  const payload = new Uint8Array(11);
  const view = new DataView(payload.buffer);
  view.setUint8(0, tileIndex);
  view.setUint8(1, 0); // reserved
  view.setUint8(2, 0); // reserved
  view.setFloat32(3, userX, true);
  view.setFloat32(7, userY, true);
  return {
    type: Type.SetUserPosition,
    payload,
    decode: NOOP,
  };
}

/**
 * @param {number} tileIndex
 * @param {number} length
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} duration
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} colors
 */
export function Set64Command(tileIndex, length, x, y, width, duration, colors) {
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
  
  return {
    type: Type.Set64,
    payload,
    decode: NOOP,
  };
}

export function GetTileEffectCommand() {
  const payload = new Uint8Array(2);
  payload[0] = 0; // reserved6
  payload[1] = 0; // reserved7
  return {
    type: Type.GetTileEffect,
    payload,
    decode: Encoding.decodeStateTileEffect,
  };
}

/**
 * @param {number} instanceid
 * @param {import('./constants.js').TileEffectType} effectType
 * @param {number} speed
 * @param {bigint} duration
 * @param {import('./constants.js').TileEffectSkyType} skyType
 * @param {number} cloudSaturationMin
 * @param {number} paletteCount
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} palette
 */
export function SetTileEffectCommand(instanceid, effectType, speed, duration, skyType, cloudSaturationMin, paletteCount, palette) {
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
  
  return {
    type: Type.SetTileEffect,
    payload,
    decode: Encoding.decodeStateTileEffect,
  };
}

export function SensorGetAmbientLightCommand() {
  return {
    type: Type.SensorGetAmbientLight,
    decode: Encoding.decodeSensorStateAmbientLight,
  };
}
