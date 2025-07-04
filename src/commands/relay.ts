import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';

export function GetRPowerCommand(relayIndex: number) {
  return {
    type: Type.GetRPower,
    payload: Encoding.encodeGetRPower(relayIndex),
    decode: Encoding.decodeStateRPower,
    defaultResponseMode: 'response' as const,
  };
}

export function SetRPowerCommand(relayIndex: number, level: number) {
  return {
    type: Type.SetRPower,
    payload: Encoding.encodeSetRPower(relayIndex, level),
    decode: Encoding.decodeStateRPower,
    defaultResponseMode: 'ack-only' as const,
  };
}