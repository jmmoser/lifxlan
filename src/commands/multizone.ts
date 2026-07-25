import * as Encoding from '../encoding.js';
import { Type, MultiZoneApplicationRequest, MultiZoneExtendedApplicationRequest } from '../constants/index.js';
import type { MultiZoneEffectType } from '../constants/index.js';
import { ValidationError } from '../errors.js';
import type { Command, Decoder } from './index.js';

export type ColorZoneResponse = Encoding.StateZone | Encoding.StateMultiZone;

export interface GetColorZonesOptions {
  /** First zone to fetch (inclusive). */
  startIndex: number;
  /** Last zone to fetch (inclusive). */
  endIndex: number;
  /**
   * Called once per StateZone/StateMultiZone packet as it arrives. Return
   * false to stop waiting for further packets and resolve with what has
   * accumulated.
   */
  onResponse?: (response: ColorZoneResponse) => boolean | void;
}

export function GetColorZones(options: GetColorZonesOptions) {
  const { startIndex, endIndex, onResponse } = options;
  // Accumulation state lives inside createDecoder so each send() gets a
  // fresh decoder, making this command safe to reuse across concurrent
  // sends and devices.
  const createDecoder = (): Decoder<ColorZoneResponse[]> => {
    const expectedZones = new Set<number>();
    for (let i = startIndex; i <= endIndex; i++) {
      expectedZones.add(i);
    }

    const responses: ColorZoneResponse[] = [];

    return (bytes, offsetRef, continuation, responseType) => {
      let response: ColorZoneResponse | undefined;

      if (responseType === Type.StateZone) {
        response = Encoding.decodeStateZone(bytes, offsetRef);
        expectedZones.delete(response.zoneIndex);
      } else if (responseType === Type.StateMultiZone) {
        response = Encoding.decodeStateMultiZone(bytes, offsetRef);
        // Remove all zones covered by this response
        for (let i = 0; i < response.colors.length; i++) {
          expectedZones.delete(response.zoneIndex + i);
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
  };

  return {
    type: Type.GetColorZones,
    payload: Encoding.encodeGetColorZones(startIndex, endIndex),
    createDecoder,
    defaultResponseMode: 'response',
  } satisfies Command<ColorZoneResponse[], 'response'>;
}

export interface SetColorZonesOptions {
  /** First zone the color applies to (inclusive). */
  startIndex: number;
  /** Last zone the color applies to (inclusive). */
  endIndex: number;
  /** Hue as an unsigned 16-bit value (0-65535 maps to 0-360 degrees). */
  hue: number;
  /** Saturation as an unsigned 16-bit value (0-65535 maps to 0-100%). */
  saturation: number;
  /** Brightness as an unsigned 16-bit value (0-65535 maps to 0-100%). */
  brightness: number;
  /** Color temperature in Kelvin (relevant when saturation is low). */
  kelvin: number;
  /** Transition time in milliseconds. Defaults to 0 (immediate). */
  duration?: number;
  /**
   * Whether the device applies the change immediately (APPLY, the default),
   * buffers it for a later APPLY (NO_APPLY), or applies the buffered changes
   * without this one (APPLY_ONLY).
   */
  apply?: MultiZoneApplicationRequest;
}

export function SetColorZones(options: SetColorZonesOptions) {
  return {
    type: Type.SetColorZones,
    payload: Encoding.encodeSetColorZones(
      options.startIndex,
      options.endIndex,
      options.hue,
      options.saturation,
      options.brightness,
      options.kelvin,
      options.duration ?? 0,
      options.apply ?? MultiZoneApplicationRequest.APPLY,
    ),
    decode: Encoding.decodeStateMultiZone,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateMultiZone, 'ack-only'>;
}

export function GetMultiZoneEffect() {
  return {
    type: Type.GetMultiZoneEffect,
    decode: Encoding.decodeStateMultiZoneEffect,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateMultiZoneEffect, 'response'>;
}

export interface SetMultiZoneEffectOptions {
  /** Caller-chosen identifier for this run of the effect. */
  instanceId: number;
  effectType: MultiZoneEffectType;
  /** Time in milliseconds one cycle of the effect takes. */
  speed: number;
  /** How long the effect runs, in nanoseconds. 0 means until changed. */
  duration: bigint;
  /**
   * The 32-byte effect parameter block; only the MOVE effect reads it (the
   * direction field). Defaults to all zeros. Longer inputs are truncated to
   * 32 bytes.
   */
  parameters?: Uint8Array;
}

export function SetMultiZoneEffect(options: SetMultiZoneEffectOptions) {
  return {
    type: Type.SetMultiZoneEffect,
    payload: Encoding.encodeSetMultiZoneEffect(
      options.instanceId,
      options.effectType,
      options.speed,
      options.duration,
      options.parameters ?? new Uint8Array(0),
    ),
    decode: Encoding.decodeStateMultiZoneEffect,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateMultiZoneEffect, 'ack-only'>;
}

export interface GetExtendedColorZonesOptions {
  /**
   * Called once per StateExtendedColorZones packet as it arrives. Return
   * false to stop waiting for further packets and resolve with what has
   * accumulated.
   */
  onResponse?: (response: Encoding.StateExtendedColorZones) => boolean | void;
}

export function GetExtendedColorZones(options: GetExtendedColorZonesOptions = {}) {
  const { onResponse } = options;
  // Accumulation state lives inside createDecoder so each send() gets a
  // fresh decoder, making this command safe to reuse across concurrent
  // sends and devices.
  const createDecoder = (): Decoder<Encoding.StateExtendedColorZones[]> => {
    const expectedZoneIndexes = new Set<number>();
    let firstResponse = true;

    const responses: Encoding.StateExtendedColorZones[] = [];

    return (bytes, offsetRef, continuation, responseType) => {
      let response: Encoding.StateExtendedColorZones | undefined;

      if (responseType === Type.StateExtendedColorZones) {
        response = Encoding.decodeStateExtendedColorZones(bytes, offsetRef);

        // On first response, calculate expected zone indexes based on total zones
        if (firstResponse && response.zonesCount > 82) {
          firstResponse = false;
          // Each response can contain up to 82 zones
          for (let i = 0; i < response.zonesCount; i += 82) {
            expectedZoneIndexes.add(i);
          }
        }

        expectedZoneIndexes.delete(response.zoneIndex);
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

          continuation.expectMore = shouldContinue && expectedZoneIndexes.size > 0;
        } else {
          // Unknown response type - still expect more responses
          continuation.expectMore = expectedZoneIndexes.size > 0;
        }
      }

      return responses; // Always return the accumulated array
    };
  };

  return {
    type: Type.GetExtendedColorZones,
    createDecoder,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateExtendedColorZones[], 'response'>;
}

export interface SetExtendedColorZonesOptions {
  /** Index of the first zone the colors apply to. */
  zoneIndex: number;
  /**
   * Up to 82 colors, applied to consecutive zones starting at zoneIndex.
   * The wire-level colors_count field is derived from this array's length.
   * To address more than 82 zones, send multiple commands with NO_APPLY and
   * finish with APPLY — which may be an empty array here, since APPLY_ONLY
   * flushes previously buffered zones without carrying colors of its own.
   */
  colors: Encoding.Color[];
  /** Transition time in milliseconds. Defaults to 0 (immediate). */
  duration?: number;
  /**
   * Whether the device applies the change immediately (APPLY, the default),
   * buffers it for a later APPLY (NO_APPLY), or applies the buffered changes
   * without this one (APPLY_ONLY).
   */
  apply?: MultiZoneExtendedApplicationRequest;
}

export function SetExtendedColorZones(options: SetExtendedColorZonesOptions) {
  if (options.colors.length > 82) {
    throw new ValidationError('colors', options.colors.length, 'must contain at most 82 colors');
  }
  return {
    type: Type.SetExtendedColorZones,
    payload: Encoding.encodeSetExtendedColorZones(
      options.duration ?? 0,
      options.apply ?? MultiZoneExtendedApplicationRequest.APPLY,
      options.zoneIndex,
      options.colors.length,
      options.colors,
    ),
    decode: Encoding.decodeStateExtendedColorZones,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateExtendedColorZones, 'ack-only'>;
}
