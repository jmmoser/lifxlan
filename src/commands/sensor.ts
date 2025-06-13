import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';

export function SensorGetAmbientLightCommand() {
  return {
    type: Type.SensorGetAmbientLight,
    decode: Encoding.decodeSensorStateAmbientLight,
    defaultAcknowledgment: 'response' as const,
  };
}