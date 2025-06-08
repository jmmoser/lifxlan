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
 * @param {import('../constants.js').MultiZoneApplicationRequest} apply
 */
export function SetColorZonesCommand(startIndex: number, endIndex: number, hue: number, saturation: number, brightness: number, kelvin: number, duration: number, apply: import("../constants.js").MultiZoneApplicationRequest): {
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
 * @param {import('../constants.js').MultiZoneEffectType} effectType
 * @param {number} speed
 * @param {bigint} duration
 * @param {Uint8Array} parameters
 */
export function SetMultiZoneEffectCommand(instanceid: number, effectType: import("../constants.js").MultiZoneEffectType, speed: number, duration: bigint, parameters: Uint8Array): {
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
 * @param {import('../constants.js').MultiZoneExtendedApplicationRequest} apply
 * @param {number} zoneIndex
 * @param {number} colorsCount
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} colors
 */
export function SetExtendedColorZonesCommand(duration: number, apply: import("../constants.js").MultiZoneExtendedApplicationRequest, zoneIndex: number, colorsCount: number, colors: {
    hue: number;
    saturation: number;
    brightness: number;
    kelvin: number;
}[]): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateExtendedColorZones;
};
import * as Encoding from '../encoding.js';
