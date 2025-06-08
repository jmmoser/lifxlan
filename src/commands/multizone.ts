import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import type { MultiZoneApplicationRequest, MultiZoneEffectType, MultiZoneExtendedApplicationRequest } from '../constants/index.js';
import type { Decoder } from './index.js';

export type ColorZoneResponse = Encoding.StateZone | Encoding.StateMultiZone;

export function GetColorZonesCommand(
  startIndex: number, 
  endIndex: number, 
  onResponse?: (response: ColorZoneResponse) => boolean | void
) {
  const expectedZones = new Set<number>();
  for (let i = startIndex; i <= endIndex; i++) {
    expectedZones.add(i);
  }
  
  const responses: ColorZoneResponse[] = [];
  
  const decode: Decoder<ColorZoneResponse[]> = (bytes, offsetRef, continuation, responseType) => {
    let response: ColorZoneResponse | undefined;
    
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
  };
  
  return {
    type: Type.GetColorZones,
    payload: Encoding.encodeGetColorZones(startIndex, endIndex),
    decode,
  };
}

export function SetColorZonesCommand(
  startIndex: number, 
  endIndex: number, 
  hue: number, 
  saturation: number, 
  brightness: number, 
  kelvin: number, 
  duration: number, 
  apply: MultiZoneApplicationRequest
) {
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

export function SetMultiZoneEffectCommand(
  instanceid: number, 
  effectType: MultiZoneEffectType, 
  speed: number, 
  duration: bigint, 
  parameters: Uint8Array
) {
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

export function SetExtendedColorZonesCommand(
  duration: number, 
  apply: MultiZoneExtendedApplicationRequest, 
  zoneIndex: number, 
  colorsCount: number, 
  colors: Encoding.Color[]
) {
  return {
    type: Type.SetExtendedColorZones,
    payload: Encoding.encodeSetExtendedColorZones(duration, apply, zoneIndex, colorsCount, colors),
    decode: Encoding.decodeStateExtendedColorZones,
  };
}