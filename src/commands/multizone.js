import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';


/**
 * @typedef {ReturnType<typeof import('../encoding.js').decodeStateZone> | ReturnType<typeof import('../encoding.js').decodeStateMultiZone>} ColorZoneResponse
 */

/**
 * @param {number} startIndex
 * @param {number} endIndex
 * @param {(response: ColorZoneResponse) => boolean | void} [onResponse] - Optional callback called for each response. Return false to stop early.
 */
export function GetColorZonesCommand(startIndex, endIndex, onResponse) {
  const expectedZones = new Set();
  for (let i = startIndex; i <= endIndex; i++) {
    expectedZones.add(i);
  }
  
  /** @type {ColorZoneResponse[]} */
  const responses = [];
  
  return {
    type: Type.GetColorZones,
    payload: Encoding.encodeGetColorZones(startIndex, endIndex),
    
    /**
     * @param {Uint8Array} bytes
     * @param {{current: number}} offsetRef  
     * @param {{expectMore: boolean}} [continuation] - Set expectMore to false to stop waiting for more responses
     * @param {number} [responseType] - Message type (for multi-response commands)
     */
    decode(bytes, offsetRef, continuation, responseType) {
      
      let response;
      
      if (responseType === Type.StateZone) {
        response = Encoding.decodeStateZone(bytes, offsetRef);
        expectedZones.delete(response.zone_index);
      } else if (responseType === Type.StateMultiZone) {
        response = Encoding.decodeStateMultiZone(bytes, offsetRef);
        // Remove all zones covered by this response
        for (let i = 0; i < response.colors.length; i++) {
          expectedZones.delete(response.zone_index + i);
        }
      }
      
      // Update continuation to indicate if more responses are expected
      if (continuation) {
        if (response) {
          responses.push(response);
          
          // Call user callback if provided
          let shouldContinue = true;
          if (onResponse) {
            const result = onResponse(response);
            shouldContinue = result !== false; // false = stop early
          }
          
          continuation.expectMore = shouldContinue && expectedZones.size > 0;
        } else {
          // Unknown response type - still expect more responses
          continuation.expectMore = expectedZones.size > 0;
        }
      }
      
      return responses; // Always return the accumulated array
    }
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