/**
 * @param {number} relayIndex
 */
export function GetRPowerCommand(relayIndex: number): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateRPower;
};
/**
 * @param {number} relayIndex
 * @param {number} level
 */
export function SetRPowerCommand(relayIndex: number, level: number): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateRPower;
};
import * as Encoding from '../encoding.js';
