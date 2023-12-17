import * as Protocol from './protocol.js';

/**
 * @template OutputType
 * @typedef {{
 *   type: number;
 *   payload: Uint8Array | undefined;
 *   decoder: (bytes: Uint8Array, offsetRef: { current: number; }) => OutputType;
 * }} Command
 */

/**
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} duration
 * @returns {Command<ReturnType<typeof import('./protocol.js').decodeLightState>>}
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
    type: Protocol.TYPE.SetColor,
    payload,
    decoder: Protocol.decodeLightState,
  };
}

/**
 * @param {boolean} on
 * @returns {Command<ReturnType<typeof import('./protocol.js').decodeStatePower>>}
 */
export function SetPowerCommand(on) {
  const payload = new Uint8Array(2);
  const view = new DataView(payload.buffer);
  view.setUint16(0, on ? 0xFFFF : 0, true);
  return {
    type: Protocol.TYPE.SetPower,
    payload,
    decoder: Protocol.decodeStatePower,
  };
}

/**
 * @returns {Command<ReturnType<typeof import('./protocol.js').decodeStatePower>>}
 */
export function GetPowerCommand() {
  return {
    type: Protocol.TYPE.GetPower,
    payload: undefined,
    decoder: Protocol.decodeStatePower,
  };
}
