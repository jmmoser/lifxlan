/**
 * @typedef {ReturnType<typeof import('../encoding.js').decodeStateZone> | ReturnType<typeof import('../encoding.js').decodeStateMultiZone>} ColorZoneResponse
 */
/**
 * @param {number} startIndex
 * @param {number} endIndex
 * @param {(response: ColorZoneResponse) => boolean | void} [onResponse] - Optional callback called for each response. Return false to stop early.
 */
export function GetColorZonesCommand(startIndex: number, endIndex: number, onResponse?: (response: ColorZoneResponse) => boolean | void): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    /**
     * @param {Uint8Array} bytes
     * @param {{current: number}} offsetRef
     * @param {{expectMore: boolean}} [continuation] - Set expectMore to false to stop waiting for more responses
     * @param {number} [responseType] - Message type (for multi-response commands)
     */
    decode(bytes: Uint8Array, offsetRef: {
        current: number;
    }, continuation?: {
        expectMore: boolean;
    }, responseType?: number): ColorZoneResponse[];
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
export type ColorZoneResponse = ReturnType<typeof import("../encoding.js").decodeStateZone> | ReturnType<typeof import("../encoding.js").decodeStateMultiZone>;
import * as Encoding from '../encoding.js';
