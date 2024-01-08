import * as Encoding from './encoding.js';
import { TYPE } from './constants.js';
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
    type: TYPE.GetService,
    decode: Encoding.decodeStateService,
  };
}

export function GetHostFirmwareCommand() {
  return {
    type: TYPE.GetHostFirmware,
    decode: Encoding.decodeStateHostFirmware,
  };
}

export function GetWifiInfoCommand() {
  return {
    type: TYPE.GetWifiInfo,
    decode: Encoding.decodeStateWifiInfo,
  };
}

export function GetWifiFirmwareCommand() {
  return {
    type: TYPE.GetWifiFirmware,
    decode: Encoding.decodeStateWifiFirmware,
  };
}

export function GetVersionCommand() {
  return {
    type: TYPE.GetVersion,
    decode: Encoding.decodeStateVersion,
  };
}

export function GetLabelCommand() {
  return {
    type: TYPE.GetLabel,
    decode: Encoding.decodeStateLabel,
  };
}

/**
 * @param {string} label
 */
export function SetLabelCommand(label) {
  return {
    type: TYPE.GetLabel,
    payload: Encoding.encodeString(label, 32),
    decode: Encoding.decodeStateLabel,
  };
}

export function GetInfoCommand() {
  return {
    type: TYPE.GetInfo,
    decode: Encoding.decodeStateInfo,
  };
}

/**
 * @returns {Command<void>}
 */
export function SetRebootCommand() {
  return {
    type: TYPE.SetReboot,
    decode: NOOP,
  };
}

/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateLocation>>}
 */
export function GetLocationCommand() {
  return {
    type: TYPE.GetLocation,
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
    type: TYPE.SetLocation,
    payload,
    decode: Encoding.decodeStateLocation,
  };
}

export function GetGroupCommand() {
  return {
    type: TYPE.GetGroup,
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
    type: TYPE.SetGroup,
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
    type: TYPE.EchoRequest,
    payload,
    decode: Encoding.decodeEchoResponse,
  };
}

export function GetColorCommand() {
  return {
    type: TYPE.GetColor,
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
    type: TYPE.SetColor,
    payload,
    decode: Encoding.decodeLightState,
  };
}

export function GetPowerCommand() {
  return {
    type: TYPE.GetPower,
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
    type: TYPE.SetPower,
    payload,
    decode: Encoding.decodeStatePower,
  };
}

export function GetInfraredCommand() {
  return {
    type: TYPE.GetInfrared,
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
    type: TYPE.SetInfrared,
    payload,
    decode: Encoding.decodeStateInfrared,
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
    type: TYPE.GetRPower,
    payload,
    decode: Encoding.decodeStateRPower,
  };
}
