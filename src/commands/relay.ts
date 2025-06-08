import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import type { Command } from './index.js';

export function GetRPowerCommand(relayIndex: number): Command<Encoding.StateRPower> {
  return {
    type: Type.GetRPower,
    payload: Encoding.encodeGetRPower(relayIndex),
    decode: Encoding.decodeStateRPower,
  };
}

export function SetRPowerCommand(relayIndex: number, level: number): Command<Encoding.StateRPower> {
  return {
    type: Type.SetRPower,
    payload: Encoding.encodeSetRPower(relayIndex, level),
    decode: Encoding.decodeStateRPower,
  };
}