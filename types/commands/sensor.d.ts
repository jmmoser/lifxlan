export function SensorGetAmbientLightCommand(): {
    type: number;
    decode: typeof Encoding.decodeSensorStateAmbientLight;
};
import * as Encoding from '../encoding.js';
