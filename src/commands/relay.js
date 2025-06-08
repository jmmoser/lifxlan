import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';


/**
 * @param {number} relayIndex
 */
export function GetRPowerCommand(relayIndex) {
  return {
    type: Type.GetRPower,
    payload: Encoding.encodeGetRPower(relayIndex),
    decode: Encoding.decodeStateRPower,
  };
}

/**
 * @param {number} relayIndex
 * @param {number} level
 */
export function SetRPowerCommand(relayIndex, level) {
  return {
    type: Type.SetRPower,
    payload: Encoding.encodeSetRPower(relayIndex, level),
    decode: Encoding.decodeStateRPower,
  };
}