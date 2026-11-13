import * as Encoding from '../wire.js';
import { Type } from '../constants/index.js';
import type { Command } from './index.js';

export function GetRPower(relayIndex: number) {
  return {
    type: Type.GetRPower,
    responseType: Type.StateRPower,
    payload: Encoding.encodeGetRPower(relayIndex),
    decode: Encoding.decodeStateRPower,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateRPower, 'response'>;
}

/**
 * @param level A boolean (on/off) or an unsigned 16-bit power level (0 is
 * off, any other value is on).
 */
export function SetRPower(relayIndex: number, level: number | boolean) {
  return {
    type: Type.SetRPower,
    responseType: Type.StateRPower,
    payload: Encoding.encodeSetRPower(relayIndex, level),
    decode: Encoding.decodeStateRPower,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateRPower, 'ack-only'>;
}
