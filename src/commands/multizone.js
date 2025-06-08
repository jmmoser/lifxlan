import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';


/**
 * @param {number} startIndex
 * @param {number} endIndex
 */
export function GetColorZonesCommand(startIndex, endIndex) {
  return {
    type: Type.GetColorZones,
    payload: Encoding.encodeGetColorZones(startIndex, endIndex),
    decode: Encoding.decodeStateMultiZone,
  };
}

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
export function SetColorZonesCommand(startIndex, endIndex, hue, saturation, brightness, kelvin, duration, apply) {
  return {
    type: Type.SetColorZones,
    payload: Encoding.encodeSetColorZones(startIndex, endIndex, hue, saturation, brightness, kelvin, duration, apply),
    decode: Encoding.decodeStateMultiZone,
  };
}

export function GetMultiZoneEffectCommand() {
  return {
    type: Type.GetMultiZoneEffect,
    decode: Encoding.decodeStateMultiZoneEffect,
  };
}

/**
 * @param {number} instanceid
 * @param {import('../constants.js').MultiZoneEffectType} effectType
 * @param {number} speed
 * @param {bigint} duration
 * @param {Uint8Array} parameters
 */
export function SetMultiZoneEffectCommand(instanceid, effectType, speed, duration, parameters) {
  return {
    type: Type.SetMultiZoneEffect,
    payload: Encoding.encodeSetMultiZoneEffect(instanceid, effectType, speed, duration, parameters),
    decode: Encoding.decodeStateMultiZoneEffect,
  };
}

export function GetExtendedColorZonesCommand() {
  return {
    type: Type.GetExtendedColorZones,
    decode: Encoding.decodeStateExtendedColorZones,
  };
}

/**
 * @param {number} duration
 * @param {import('../constants.js').MultiZoneExtendedApplicationRequest} apply
 * @param {number} zoneIndex
 * @param {number} colorsCount
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} colors
 */
export function SetExtendedColorZonesCommand(duration, apply, zoneIndex, colorsCount, colors) {
  return {
    type: Type.SetExtendedColorZones,
    payload: Encoding.encodeSetExtendedColorZones(duration, apply, zoneIndex, colorsCount, colors),
    decode: Encoding.decodeStateExtendedColorZones,
  };
}