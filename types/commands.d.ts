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
    payload: Uint8Array<ArrayBuffer>;
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
    payload: Uint8Array<ArrayBuffer>;
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
    payload: Uint8Array<ArrayBuffer>;
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
    payload: Uint8Array<ArrayBuffer>;
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
 * @param {import('./constants.js').Waveform} waveform
 */
export function SetWaveformCommand(transient: boolean, hue: number, saturation: number, brightness: number, kelvin: number, period: number, cycles: number, skewRatio: number, waveform: import("./constants.js").Waveform): {
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
 * @param {import('./constants.js').Waveform} waveform
 * @param {boolean} setHue
 * @param {boolean} setSaturation
 * @param {boolean} setBrightness
 * @param {boolean} setKelvin
 */
export function SetWaveformOptionalCommand(transient: boolean, hue: number, saturation: number, brightness: number, kelvin: number, period: number, cycles: number, skewRatio: number, waveform: import("./constants.js").Waveform, setHue: boolean, setSaturation: boolean, setBrightness: boolean, setKelvin: boolean): {
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
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateRPower;
};
export function GetDeviceChainCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateDeviceChain;
};
/**
 * @param {number} tileIndex
 * @param {number} length
 * @param {number} x
 * @param {number} y
 * @param {number} width
 */
export function Get64Command(tileIndex: number, length: number, x: number, y: number, width: number): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeState64;
};
/**
 * @param {number} startIndex
 * @param {number} endIndex
 */
export function GetColorZonesCommand(startIndex: number, endIndex: number): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateMultiZone;
};
/**
 * @param {number} startIndex
 * @param {number} endIndex
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} duration
 * @param {import('./constants.js').MultiZoneApplicationRequest} apply
 */
export function SetColorZonesCommand(startIndex: number, endIndex: number, hue: number, saturation: number, brightness: number, kelvin: number, duration: number, apply: import("./constants.js").MultiZoneApplicationRequest): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateMultiZone;
};
export function GetMultiZoneEffectCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateMultiZoneEffect;
};
/**
 * @param {number} instanceid
 * @param {import('./constants.js').MultiZoneEffectType} effectType
 * @param {number} speed
 * @param {bigint} duration
 * @param {Uint8Array} parameters
 */
export function SetMultiZoneEffectCommand(instanceid: number, effectType: import("./constants.js").MultiZoneEffectType, speed: number, duration: bigint, parameters: Uint8Array): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateMultiZoneEffect;
};
export function GetExtendedColorZonesCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateExtendedColorZones;
};
/**
 * @param {number} duration
 * @param {import('./constants.js').MultiZoneExtendedApplicationRequest} apply
 * @param {number} zoneIndex
 * @param {number} colorsCount
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} colors
 */
export function SetExtendedColorZonesCommand(duration: number, apply: import("./constants.js").MultiZoneExtendedApplicationRequest, zoneIndex: number, colorsCount: number, colors: {
    hue: number;
    saturation: number;
    brightness: number;
    kelvin: number;
}[]): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateExtendedColorZones;
};
/**
 * @param {number} tileIndex
 * @param {number} userX
 * @param {number} userY
 */
export function SetUserPositionCommand(tileIndex: number, userX: number, userY: number): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: (value: any) => void;
};
/**
 * @param {number} tileIndex
 * @param {number} length
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} duration
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} colors
 */
export function Set64Command(tileIndex: number, length: number, x: number, y: number, width: number, duration: number, colors: {
    hue: number;
    saturation: number;
    brightness: number;
    kelvin: number;
}[]): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: (value: any) => void;
};
export function GetTileEffectCommand(): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateTileEffect;
};
/**
 * @param {number} instanceid
 * @param {import('./constants.js').TileEffectType} effectType
 * @param {number} speed
 * @param {bigint} duration
 * @param {import('./constants.js').TileEffectSkyType} skyType
 * @param {number} cloudSaturationMin
 * @param {number} paletteCount
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} palette
 */
export function SetTileEffectCommand(instanceid: number, effectType: import("./constants.js").TileEffectType, speed: number, duration: bigint, skyType: import("./constants.js").TileEffectSkyType, cloudSaturationMin: number, paletteCount: number, palette: {
    hue: number;
    saturation: number;
    brightness: number;
    kelvin: number;
}[]): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateTileEffect;
};
export function SensorGetAmbientLightCommand(): {
    type: number;
    decode: typeof Encoding.decodeSensorStateAmbientLight;
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
