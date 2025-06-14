import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import { NOOP } from '../utils/index.js';
import type { TileEffectType, TileEffectSkyType } from '../constants/index.js';
import type { Decoder } from './index.js';

export function GetDeviceChainCommand() {
  return {
    type: Type.GetDeviceChain,
    decode: Encoding.decodeStateDeviceChain,
    defaultResponseMode: 'response' as const,
  };
}

export function Get64Command(
  tileIndex: number, 
  length: number, 
  x: number, 
  y: number, 
  width: number,
  onResponse?: (response: Encoding.State64) => boolean | void
) {
  let tilesSeen = 0;
  
  const responses: Encoding.State64[] = [];
  
  const decode: Decoder<Encoding.State64[]> = (bytes, offsetRef, continuation, responseType) => {
    let response: Encoding.State64 | undefined;
    
    if (responseType === Type.State64) {
      response = Encoding.decodeState64(bytes, offsetRef);
      tilesSeen++;
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
        
        continuation.expectMore = shouldContinue && tilesSeen < length;
      } else {
        // Unknown response type - still expect more responses
        continuation.expectMore = tilesSeen < length;
      }
    }
    
    return responses; // Always return the accumulated array
  };
  
  return {
    type: Type.Get64,
    payload: Encoding.encodeGet64(tileIndex, length, x, y, width),
    decode,
    defaultResponseMode: 'response' as const,
  };
}

export function SetUserPositionCommand(tileIndex: number, userX: number, userY: number) {
  return {
    type: Type.SetUserPosition,
    payload: Encoding.encodeSetUserPosition(tileIndex, userX, userY),
    decode: NOOP,
    defaultResponseMode: 'none' as const,
  };
}

export function Set64Command(
  tileIndex: number, 
  length: number, 
  x: number, 
  y: number, 
  width: number, 
  duration: number, 
  colors: Encoding.Color[]
) {
  return {
    type: Type.Set64,
    payload: Encoding.encodeSet64(tileIndex, length, x, y, width, duration, colors),
    decode: NOOP,
    defaultResponseMode: 'none' as const,
  };
}

export function GetTileEffectCommand() {
  return {
    type: Type.GetTileEffect,
    payload: Encoding.encodeGetTileEffect(),
    decode: Encoding.decodeStateTileEffect,
    defaultResponseMode: 'response' as const,
  };
}

export function SetTileEffectCommand(
  instanceid: number, 
  effectType: TileEffectType, 
  speed: number, 
  duration: bigint, 
  skyType: TileEffectSkyType, 
  cloudSaturationMin: number, 
  paletteCount: number, 
  palette: Encoding.Color[]
) {
  return {
    type: Type.SetTileEffect,
    payload: Encoding.encodeSetTileEffect(instanceid, effectType, speed, duration, skyType, cloudSaturationMin, paletteCount, palette),
    decode: Encoding.decodeStateTileEffect,
    defaultResponseMode: 'ack-only' as const,
  };
}