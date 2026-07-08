import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';

export function GetRPower(relayIndex: number) {
  return {
    type: Type.GetRPower,
    payload: Encoding.encodeGetRPower(relayIndex),
    decode: Encoding.decodeStateRPower,
    defaultResponseMode: 'response' as const,
  };
}

export function SetRPower(relayIndex: number, level: number) {
  return {
    type: Type.SetRPower,
    payload: Encoding.encodeSetRPower(relayIndex, level),
    decode: Encoding.decodeStateRPower,
    defaultResponseMode: 'ack-only' as const,
  };
}