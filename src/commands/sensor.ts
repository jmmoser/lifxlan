import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';

export function SensorGetAmbientLightCommand() {
  return {
    type: Type.SensorGetAmbientLight,
    decode: Encoding.decodeSensorStateAmbientLight,
    defaultResponseMode: 'response' as const,
  };
}