import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import { NOOP } from '../utils/index.js';


export function GetDeviceChainCommand() {
  return {
    type: Type.GetDeviceChain,
    decode: Encoding.decodeStateDeviceChain,
  };
}

/**
 * @param {number} tileIndex
 * @param {number} length
 * @param {number} x
 * @param {number} y
 * @param {number} width
 */
export function Get64Command(tileIndex, length, x, y, width) {
  return {
    type: Type.Get64,
    payload: Encoding.encodeGet64(tileIndex, length, x, y, width),
    decode: Encoding.decodeState64,
  };
}

/**
 * @param {number} tileIndex
 * @param {number} userX
 * @param {number} userY
 */
export function SetUserPositionCommand(tileIndex, userX, userY) {
  return {
    type: Type.SetUserPosition,
    payload: Encoding.encodeSetUserPosition(tileIndex, userX, userY),
    decode: NOOP,
  };
}

/**
 * @param {number} tileIndex
 * @param {number} length
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} duration
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} colors
 */
export function Set64Command(tileIndex, length, x, y, width, duration, colors) {
  return {
    type: Type.Set64,
    payload: Encoding.encodeSet64(tileIndex, length, x, y, width, duration, colors),
    decode: NOOP,
  };
}

export function GetTileEffectCommand() {
  return {
    type: Type.GetTileEffect,
    payload: Encoding.encodeGetTileEffect(),
    decode: Encoding.decodeStateTileEffect,
  };
}

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
export function SetTileEffectCommand(instanceid, effectType, speed, duration, skyType, cloudSaturationMin, paletteCount, palette) {
  return {
    type: Type.SetTileEffect,
    payload: Encoding.encodeSetTileEffect(instanceid, effectType, speed, duration, skyType, cloudSaturationMin, paletteCount, palette),
    decode: Encoding.decodeStateTileEffect,
  };
}