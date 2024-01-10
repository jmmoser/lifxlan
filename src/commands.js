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
    type: Type.GetLabel,
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

  view.setBigInt64(48, BigInt(updatedAt.getTime()) * 1000000n, true);

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

  view.setBigInt64(48, BigInt(updatedAt.getTime()) * 1000000n, true);
  return {
    type: Type.SetGroup,
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
  const payload = new Uint8Array(13);
  const view = new DataView(payload.buffer);
  view.setUint16(1, hue, true);
  view.setUint16(3, saturation, true);
  view.setUint16(5, brightness, true);
  view.setUint16(7, kelvin, true);
  view.setUint32(9, duration, true);
  return {
    type: Type.SetColor,
    payload,
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
 * @param {number} level
 * @param {number} duration
 */
export function SetLightPowerCommand(level, duration) {
  const payload = new Uint8Array(6);
  const view = new DataView(payload.buffer);
  view.setUint16(0, level, true);
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
