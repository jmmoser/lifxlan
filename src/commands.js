import * as Encoding from './encoding.js';
import { TYPE } from './constants.js';

/**
 * @template OutputType
 * @typedef {(bytes: Uint8Array, offsetRef: { current: number; }) => OutputType} Decoder
 */

/**
 * @template OutputType
 * @typedef {{
 *   type: number;
 *   payload: Uint8Array | undefined;
 *   decoder: Decoder<OutputType>;
 * }} Command
 */

/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateVersion>>}
 */
export function GetVersionCommand() {
  return {
    type: TYPE.GetVersion,
    payload: undefined,
    decoder: Encoding.decodeStateVersion,
  };
}

/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateHostFirmware>>}
 */
export function GetHostFirmwareCommand() {
  return {
    type: TYPE.GetHostFirmware,
    payload: undefined,
    decoder: Encoding.decodeStateHostFirmware,
  };
}

/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateLabel>>}
 */
export function GetLabelCommand() {
  return {
    type: TYPE.GetLabel,
    payload: undefined,
    decoder: Encoding.decodeStateLabel,
  };
}

/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateGroup>>}
 */
export function GetGroupCommand() {
  return {
    type: TYPE.GetGroup,
    payload: undefined,
    decoder: Encoding.decodeStateGroup,
  };
}

/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateService>>}
 */
export function GetServiceCommand() {
  return {
    type: TYPE.SetColor,
    payload: undefined,
    decoder: Encoding.decodeStateService,
  };
}

/**
 * @returns {Command<ReturnType<typeof Encoding.decodeLightState>>}
 */
export function GetColorCommand() {
  return {
    type: TYPE.GetColor,
    payload: undefined,
    decoder: Encoding.decodeLightState,
  };
}

/**
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} duration
 * @returns {Command<ReturnType<typeof Encoding.decodeLightState>>}
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
    decoder: Encoding.decodeLightState,
  };
}

/**
 * @param {boolean} on
 * @returns {Command<ReturnType<typeof Encoding.decodeStatePower>>}
 */
export function SetPowerCommand(on) {
  const payload = new Uint8Array(2);
  const view = new DataView(payload.buffer);
  view.setUint16(0, on ? 0xFFFF : 0, true);
  return {
    type: TYPE.SetPower,
    payload,
    decoder: Encoding.decodeStatePower,
  };
}

/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStatePower>>}
 */
export function GetPowerCommand() {
  return {
    type: TYPE.GetPower,
    payload: undefined,
    decoder: Encoding.decodeStatePower,
  };
}
