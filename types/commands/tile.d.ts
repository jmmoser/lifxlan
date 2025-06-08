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
 * @param {import('../constants.js').TileEffectType} effectType
 * @param {number} speed
 * @param {bigint} duration
 * @param {import('../constants.js').TileEffectSkyType} skyType
 * @param {number} cloudSaturationMin
 * @param {number} paletteCount
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} palette
 */
export function SetTileEffectCommand(instanceid: number, effectType: import("../constants.js").TileEffectType, speed: number, duration: bigint, skyType: import("../constants.js").TileEffectSkyType, cloudSaturationMin: number, paletteCount: number, palette: {
    hue: number;
    saturation: number;
    brightness: number;
    kelvin: number;
}[]): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateTileEffect;
};
import * as Encoding from '../encoding.js';
