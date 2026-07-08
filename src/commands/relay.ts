import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import type { Command } from './index.js';

export function GetRPower(relayIndex: number) {
  return {
    type: Type.GetRPower,
    payload: Encoding.encodeGetRPower(relayIndex),
    decode: Encoding.decodeStateRPower,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateRPower, 'response'>;
}

export function SetRPower(relayIndex: number, level: number) {
  return {
    type: Type.SetRPower,
    payload: Encoding.encodeSetRPower(relayIndex, level),
    decode: Encoding.decodeStateRPower,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateRPower, 'ack-only'>;
}
