import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import { NOOP } from '../utils/index.js';
import type { TileEffectType, TileEffectSkyType } from '../constants/index.js';

export function GetDeviceChainCommand() {
  return {
    type: Type.GetDeviceChain,
    decode: Encoding.decodeStateDeviceChain,
  };
}

export function Get64Command(tileIndex: number, length: number, x: number, y: number, width: number) {
  return {
    type: Type.Get64,
    payload: Encoding.encodeGet64(tileIndex, length, x, y, width),
    decode: Encoding.decodeState64,
  };
}

export function SetUserPositionCommand(tileIndex: number, userX: number, userY: number) {
  return {
    type: Type.SetUserPosition,
    payload: Encoding.encodeSetUserPosition(tileIndex, userX, userY),
    decode: NOOP,
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
  };
}

export function GetTileEffectCommand() {
  return {
    type: Type.GetTileEffect,
    payload: Encoding.encodeGetTileEffect(),
    decode: Encoding.decodeStateTileEffect,
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
  };
}