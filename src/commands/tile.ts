import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import { ValidationError } from '../errors.js';
import type { TileEffectType, TileEffectSkyType } from '../constants/index.js';
import type { Command, Decoder } from './index.js';

export function GetDeviceChain() {
  return {
    type: Type.GetDeviceChain,
    decode: Encoding.decodeStateDeviceChain,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateDeviceChain, 'response'>;
}

export interface Get64Options {
  /** Index of the first tile in the chain to fetch. */
  tileIndex: number;
  /**
   * How many tiles to fetch, starting at tileIndex — the protocol's `length`
   * field. Each tile answers with its own State64 packet. Defaults to 1.
   */
  tileCount?: number;
  /** Leftmost pixel column to fetch. Defaults to 0 (use 0 with width 8). */
  x?: number;
  /** Topmost pixel row to fetch. Defaults to 0 (use 0 with width 8). */
  y?: number;
  /** Pixel-grid row width; 8 for all current LIFX tile devices. */
  width: number;
  /**
   * Called once per State64 packet as it arrives. Return false to stop
   * waiting for further packets and resolve with what has accumulated.
   */
  onResponse?: (response: Encoding.State64) => boolean | void;
}

export function Get64(options: Get64Options) {
  const tileCount = options.tileCount ?? 1;
  const onResponse = options.onResponse;

  // Accumulation state lives inside createDecoder so each send() gets a
  // fresh decoder, making this command safe to reuse across concurrent
  // sends and devices.
  const createDecoder = (): Decoder<Encoding.State64[]> => {
    let tilesSeen = 0;

    const responses: Encoding.State64[] = [];

    return (bytes, offsetRef, continuation, responseType) => {
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

          continuation.expectMore = shouldContinue && tilesSeen < tileCount;
        } else {
          // Unknown response type - still expect more responses
          continuation.expectMore = tilesSeen < tileCount;
        }
      }

      return responses; // Always return the accumulated array
    };
  };

  return {
    type: Type.Get64,
    payload: Encoding.encodeGet64(options.tileIndex, tileCount, options.x ?? 0, options.y ?? 0, options.width),
    createDecoder,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.State64[], 'response'>;
}

// The declared Command<void, ...> return type (rather than `satisfies`) is
// what lets send() reject responseMode 'response'/'both' at compile time:
// with no decoder to infer from, only the annotation carries `void` to the
// call site.
export function SetUserPosition(tileIndex: number, userX: number, userY: number): Command<void, 'ack-only'> & { payload: Uint8Array } {
  return {
    type: Type.SetUserPosition,
    payload: Encoding.encodeSetUserPosition(tileIndex, userX, userY),
    defaultResponseMode: 'ack-only',
  };
}

export interface Set64Options {
  /** Index of the first tile in the chain the frame is applied to. */
  tileIndex: number;
  /**
   * How many tiles the frame is applied to, starting at tileIndex — the
   * protocol's `length` field. Defaults to 1. This is a tile count, not the
   * pixel count: `colors` is always one 64-pixel frame.
   */
  tileCount?: number;
  /** Leftmost pixel column the frame starts at. Defaults to 0 (use 0 with width 8). */
  x?: number;
  /** Topmost pixel row the frame starts at. Defaults to 0 (use 0 with width 8). */
  y?: number;
  /** Pixel-grid row width; 8 for all current LIFX tile devices. */
  width: number;
  /** Transition time in milliseconds. Defaults to 0 (immediate). */
  duration?: number;
  /** The frame: up to 64 colors in row-major order. Missing entries stay zero. */
  colors: Encoding.Color[];
}

// The declared Command<void, ...> return type (rather than `satisfies`) is
// what lets send() reject responseMode 'response'/'both' at compile time:
// with no decoder to infer from, only the annotation carries `void` to the
// call site.
export function Set64(options: Set64Options): Command<void, 'ack-only'> & { payload: Uint8Array } {
  if (options.colors.length > 64) {
    throw new ValidationError('colors', options.colors.length, 'must contain at most 64 colors');
  }
  return {
    type: Type.Set64,
    payload: Encoding.encodeSet64(
      options.tileIndex,
      options.tileCount ?? 1,
      options.x ?? 0,
      options.y ?? 0,
      options.width,
      options.duration ?? 0,
      options.colors,
    ),
    defaultResponseMode: 'ack-only',
  };
}

export function GetTileEffect() {
  return {
    type: Type.GetTileEffect,
    payload: Encoding.encodeGetTileEffect(),
    decode: Encoding.decodeStateTileEffect,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateTileEffect, 'response'>;
}

export interface SetTileEffectOptions {
  /** Caller-chosen identifier for this run of the effect. */
  instanceId: number;
  effectType: TileEffectType;
  /** Time in milliseconds one cycle of the effect takes. */
  speed: number;
  /** How long the effect runs, in nanoseconds. 0 means until changed. */
  duration: bigint;
  /** SKY effect only; ignored by other effects. Defaults to SUNRISE. */
  skyType?: TileEffectSkyType;
  /** SKY (CLOUDS) effect only; ignored by other effects. Defaults to 0. */
  cloudSaturationMin?: number;
  /** SKY (CLOUDS) effect only; ignored by other effects. Defaults to 0. */
  cloudSaturationMax?: number;
  /**
   * Up to 16 colors the effect draws from. The wire-level palette_count
   * field is derived from this array's length.
   */
  palette: Encoding.Color[];
}

export function SetTileEffect(options: SetTileEffectOptions) {
  if (options.palette.length > 16) {
    throw new ValidationError('palette', options.palette.length, 'must contain at most 16 colors');
  }
  return {
    type: Type.SetTileEffect,
    payload: Encoding.encodeSetTileEffect(
      options.instanceId,
      options.effectType,
      options.speed,
      options.duration,
      options.skyType ?? 0,
      options.cloudSaturationMin ?? 0,
      options.cloudSaturationMax ?? 0,
      options.palette.length,
      options.palette,
    ),
    decode: Encoding.decodeStateTileEffect,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateTileEffect, 'ack-only'>;
}
