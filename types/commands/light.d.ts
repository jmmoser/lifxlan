export function GetColorCommand(): {
    type: number;
    decode: typeof Encoding.decodeLightState;
};
/**
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} duration
 */
export function SetColorCommand(hue: number, saturation: number, brightness: number, kelvin: number, duration: number): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeLightState;
};
/**
 * @param {boolean} transient
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} period
 * @param {number} cycles
 * @param {number} skewRatio
 * @param {import('../constants.js').Waveform} waveform
 */
export function SetWaveformCommand(transient: boolean, hue: number, saturation: number, brightness: number, kelvin: number, period: number, cycles: number, skewRatio: number, waveform: import("../constants.js").Waveform): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeLightState;
};
export function GetLightPowerCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateLightPower;
};
/**
 * @param {number | boolean} level
 * @param {number} duration
 */
export function SetLightPowerCommand(level: number | boolean, duration: number): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateLightPower;
};
/**
 * @param {boolean} transient
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} period
 * @param {number} cycles
 * @param {number} skewRatio
 * @param {import('../constants.js').Waveform} waveform
 * @param {boolean} setHue
 * @param {boolean} setSaturation
 * @param {boolean} setBrightness
 * @param {boolean} setKelvin
 */
export function SetWaveformOptionalCommand(transient: boolean, hue: number, saturation: number, brightness: number, kelvin: number, period: number, cycles: number, skewRatio: number, waveform: import("../constants.js").Waveform, setHue: boolean, setSaturation: boolean, setBrightness: boolean, setKelvin: boolean): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateLightPower;
};
export function GetInfraredCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateInfrared;
};
/**
 * @param {number} brightness
 */
export function SetInfraredCommand(brightness: number): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateInfrared;
};
export function GetHevCycleCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateHevCycle;
};
/**
 * @param {boolean} enable
 * @param {number} durationSeconds
 */
export function SetHevCycleCommand(enable: boolean, durationSeconds: number): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateHevCycle;
};
export function GetHevCycleConfigurationCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateHevCycleConfiguration;
};
/**
 * @param {boolean} indication
 * @param {number} durationSeconds
 */
export function SetHevCycleConfigurationCommand(indication: boolean, durationSeconds: number): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateHevCycleConfiguration;
};
export function GetLastHevCycleResultCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateLastHevCycleResult;
};
import * as Encoding from '../encoding.js';
