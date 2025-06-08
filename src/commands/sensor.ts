import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import type { Command } from './index.js';

export function SensorGetAmbientLightCommand(): Command<Encoding.SensorStateAmbientLight> {
  return {
    type: Type.SensorGetAmbientLight,
    decode: Encoding.decodeSensorStateAmbientLight,
  };
}