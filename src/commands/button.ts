import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import type { Command } from './index.js';

export function GetButton() {
  return {
    type: Type.GetButton,
    decode: Encoding.decodeStateButton,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateButton, 'response'>;
}

export function SetButton(index: number, buttons: readonly Encoding.ButtonInput[]) {
  return {
    type: Type.SetButton,
    payload: Encoding.encodeSetButton(index, buttons),
    decode: Encoding.decodeStateButton,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateButton, 'ack-only'>;
}
