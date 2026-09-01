import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import type { Command } from './index.js';

export function SensorGetAmbientLight() {
  return {
    type: Type.SensorGetAmbientLight,
    responseType: Type.SensorStateAmbientLight,
    decode: Encoding.decodeSensorStateAmbientLight,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.SensorStateAmbientLight, 'response'>;
}
