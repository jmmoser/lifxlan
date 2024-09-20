/**
 * @template OutputType
 * @typedef {(bytes: Uint8Array, offsetRef: { current: number; }) => OutputType} Decoder
 */
/**
 * @template OutputType
 * @typedef {{
 *   type: number;
 *   payload?: Uint8Array;
 *   decode: Decoder<OutputType>;
 * }} Command
 */
export function GetServiceCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateService;
};
export function GetHostFirmwareCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateHostFirmware;
};
export function GetWifiInfoCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateWifiInfo;
};
export function GetWifiFirmwareCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateWifiFirmware;
};
export function GetPowerCommand(): {
    type: number;
    decode: typeof Encoding.decodeStatePower;
};
/**
 * @param {number | boolean} power
 */
export function SetPowerCommand(power: number | boolean): {
    type: number;
    payload: Uint8Array;
    decode: typeof Encoding.decodeStatePower;
};
export function GetLabelCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateLabel;
};
/**
 * @param {string} label
 */
export function SetLabelCommand(label: string): {
    type: number;
    payload: Uint8Array;
    decode: typeof Encoding.decodeStateLabel;
};
export function GetVersionCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateVersion;
};
export function GetInfoCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateInfo;
};
/**
 * @returns {Command<void>}
 */
export function SetRebootCommand(): Command<void>;
/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateLocation>>}
 */
export function GetLocationCommand(): Command<ReturnType<typeof Encoding.decodeStateLocation>>;
/**
 * @param {Uint8Array | string} location
 * @param {string} label
 * @param {Date} updatedAt
 */
export function SetLocationCommand(location: Uint8Array | string, label: string, updatedAt: Date): {
    type: number;
    payload: Uint8Array;
    decode: typeof Encoding.decodeStateLocation;
};
export function GetGroupCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateGroup;
};
/**
 * @param {Uint8Array | string} group
 * @param {string} label
 * @param {Date} updatedAt
 */
export function SetGroupCommand(group: Uint8Array | string, label: string, updatedAt: Date): {
    type: number;
    payload: Uint8Array;
    decode: typeof Encoding.decodeStateGroup;
};
/**
 * @param {Uint8Array} echoing
 * @returns {Command<ReturnType<typeof Encoding.decodeEchoResponse>>}
 */
export function EchoRequestCommand(echoing: Uint8Array): Command<ReturnType<typeof Encoding.decodeEchoResponse>>;
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
    payload: Uint8Array;
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
 * @param {import('./constants.js').Waveform} waveform
 */
export function SetWaveformCommand(transient: boolean, hue: number, saturation: number, brightness: number, kelvin: number, period: number, cycles: number, skewRatio: number, waveform: import("./constants.js").Waveform): {
    type: number;
    payload: Uint8Array;
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
    payload: Uint8Array;
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
 * @param {import('./constants.js').Waveform} waveform
 * @param {boolean} setHue
 * @param {boolean} setSaturation
 * @param {boolean} setBrightness
 * @param {boolean} setKelvin
 */
export function SetWaveformOptionalCommand(transient: boolean, hue: number, saturation: number, brightness: number, kelvin: number, period: number, cycles: number, skewRatio: number, waveform: import("./constants.js").Waveform, setHue: boolean, setSaturation: boolean, setBrightness: boolean, setKelvin: boolean): {
    type: number;
    payload: Uint8Array;
    decode: typeof Encoding.decodeStateLightPower;
};
export function GetInfraredCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateInfrared;
};
/**
 * @param {number} brightness
 * @returns {Command<ReturnType<typeof Encoding.decodeStateInfrared>>}
 */
export function SetInfraredCommand(brightness: number): Command<ReturnType<typeof Encoding.decodeStateInfrared>>;
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
    payload: Uint8Array;
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
    payload: Uint8Array;
    decode: typeof Encoding.decodeStateHevCycleConfiguration;
};
export function GetLastHevCycleResultCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateLastHevCycleResult;
};
/**
 * @param {number} relayIndex
 * @returns {Command<ReturnType<typeof Encoding.decodeStateRPower>>}
 */
export function GetRPowerCommand(relayIndex: number): Command<ReturnType<typeof Encoding.decodeStateRPower>>;
/**
 * @param {number} relayIndex
 * @param {number} level
 */
export function SetRPowerCommand(relayIndex: number, level: number): {
    type: number;
    payload: Uint8Array;
    decode: typeof Encoding.decodeStateRPower;
};
export function GetDeviceChainCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateDeviceChain;
};
export function Get64Command(): {
    type: number;
    decode: typeof Encoding.decodeState64;
};
export type Decoder<OutputType> = (bytes: Uint8Array, offsetRef: {
    current: number;
}) => OutputType;
export type Command<OutputType> = {
    type: number;
    payload?: Uint8Array;
    decode: Decoder<OutputType>;
};
import * as Encoding from './encoding.js';
