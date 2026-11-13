import * as Encoding from '../wire.js';
import { Type, MultiZoneApplicationRequest, MultiZoneExtendedApplicationRequest } from '../constants/index.js';
import type { MultiZoneEffectType } from '../constants/index.js';
import { ValidationError } from '../errors.js';
import type { Collector, Command } from './index.js';

/** A single packet of a GetColorZones reply, as `onResponse` observes it. */
export type ColorZoneResponse = Encoding.StateZone | Encoding.StateMultiZone;

/**
 * The colors of a run of consecutive zones, assembled from however many
 * packets the device answered with — what GetColorZones and
 * GetExtendedColorZones resolve with.
 */
export interface ColorZones {
  /** Total number of zones on the device. */
  zonesCount: number;
  /** The zone `colors[0]` belongs to. */
  zoneIndex: number;
  /** One color per zone, in zone order, starting at `zoneIndex`. */
  colors: Encoding.Color[];
}

/**
 * Cuts an assembled color list at its first gap. A completed exchange has
 * none; one stopped early by `onResponse` may, and a list with holes would
 * break the "colors[i] is zone zoneIndex + i" contract.
 */
function untilFirstGap(colors: Encoding.Color[]): Encoding.Color[] {
  let length = 0;
  while (length < colors.length && colors[length] !== undefined) {
    length++;
  }
  colors.length = length;
  return colors;
}

export interface GetColorZonesOptions {
  /** First zone to fetch (inclusive). */
  startIndex: number;
  /**
   * Last zone to fetch (inclusive). May exceed the device's zone count — the
   * LIFX-documented way to fetch every zone is 0..255 — since the exchange
   * completes once every zone the device actually has in the range has been
   * reported.
   */
  endIndex: number;
  /**
   * Called once per StateZone/StateMultiZone packet as it arrives. Return
   * false to stop waiting for further packets; the exchange then resolves
   * with the zones received so far, up to the first one still missing.
   */
  onResponse?: (response: ColorZoneResponse) => boolean | void;
}

function assertZoneIndex(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new ValidationError(name, value, 'must be an integer between 0 and 255');
  }
}

/**
 * Reads the colors of zones `startIndex..endIndex`. Resolves with the
 * assembled {@link ColorZones} — every requested zone the device has, in
 * zone order — however many packets the device split its answer across.
 */
export function GetColorZones(options: GetColorZonesOptions) {
  const { startIndex, endIndex, onResponse } = options;

  // The wire fields are uint8: an out-of-range index would wrap on encode
  // (256 becomes 0), asking the device for zones other than the ones the
  // collector below waits on — so the exchange timed out, or resolved with
  // another zone's data.
  assertZoneIndex('startIndex', startIndex);
  assertZoneIndex('endIndex', endIndex);

  const requested = endIndex - startIndex + 1;

  // Accumulation state lives inside collect() so each send() gets a fresh
  // collector, making this command safe to reuse across concurrent sends
  // and devices.
  const collect = (): Collector<ColorZones> => {
    // Indexed by zone - startIndex. Track distinct zones rather than
    // counting packets: UDP can deliver a packet twice, and a duplicate
    // must not complete the exchange before every zone has reported.
    const colors: Encoding.Color[] = [];
    let received = 0;
    let zonesCount = 0;

    return {
      add(payload, type) {
        let packet: ColorZoneResponse;

        if (type === Type.StateMultiZone) {
          const multi = Encoding.decodeStateMultiZone(payload);
          const packetColors = multi.colors;
          let slot = multi.zoneIndex - startIndex;
          // Devices answer in 8-zone packets aligned to their own grid, so a
          // packet may carry zones outside the requested range.
          for (let i = 0; i < packetColors.length; i++, slot++) {
            if (slot >= 0 && slot < requested && colors[slot] === undefined) {
              colors[slot] = packetColors[i]!;
              received++;
            }
          }
          packet = multi;
        } else if (type === Type.StateZone) {
          const zone = Encoding.decodeStateZone(payload);
          const slot = zone.zoneIndex - startIndex;
          if (slot >= 0 && slot < requested && zone.zoneIndex < zone.zonesCount && colors[slot] === undefined) {
            colors[slot] = {
              hue: zone.hue,
              saturation: zone.saturation,
              brightness: zone.brightness,
              kelvin: zone.kelvin,
            };
            received++;
          }
          packet = zone;
        } else {
          // Not part of this reply — keep waiting.
          return false;
        }

        zonesCount = packet.zonesCount;

        if (onResponse !== undefined && onResponse(packet) === false) {
          return true; // stopped early by the caller
        }

        // A device only reports zones it has, so anything requested at or
        // past its zonesCount will never arrive and must not hold the
        // exchange open.
        return received >= Math.min(requested, zonesCount - startIndex);
      },
      result() {
        return { zonesCount, zoneIndex: startIndex, colors: untilFirstGap(colors) };
      },
    };
  };

  return {
    type: Type.GetColorZones,
    payload: Encoding.encodeGetColorZones(startIndex, endIndex),
    collect,
    defaultResponseMode: 'response',
  } satisfies Command<ColorZones, 'response'>;
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
  durationMs?: number;
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
    responseType: Type.StateMultiZone,
    payload: Encoding.encodeSetColorZones(
      options.startIndex,
      options.endIndex,
      options.hue,
      options.saturation,
      options.brightness,
      options.kelvin,
      options.durationMs ?? 0,
      options.apply ?? MultiZoneApplicationRequest.APPLY,
    ),
    decode: Encoding.decodeStateMultiZone,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateMultiZone, 'ack-only'>;
}

export function GetMultiZoneEffect() {
  return {
    type: Type.GetMultiZoneEffect,
    responseType: Type.StateMultiZoneEffect,
    decode: Encoding.decodeStateMultiZoneEffect,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateMultiZoneEffect, 'response'>;
}

export interface SetMultiZoneEffectOptions {
  /** Caller-chosen identifier for this run of the effect. */
  instanceId: number;
  effectType: MultiZoneEffectType;
  /** Time one cycle of the effect takes, in milliseconds. */
  speedMs: number;
  /** How long the effect runs, in nanoseconds. 0 means until changed. */
  durationNs: bigint;
  /**
   * The effect parameter block, at most 32 bytes (shorter input is
   * zero-padded); only the MOVE effect reads it (the direction field).
   * Defaults to all zeros.
   */
  parameters?: Uint8Array;
}

const NO_PARAMETERS = new Uint8Array(0);

export function SetMultiZoneEffect(options: SetMultiZoneEffectOptions) {
  return {
    type: Type.SetMultiZoneEffect,
    responseType: Type.StateMultiZoneEffect,
    payload: Encoding.encodeSetMultiZoneEffect(
      options.instanceId,
      options.effectType,
      options.speedMs,
      options.durationNs,
      options.parameters ?? NO_PARAMETERS,
    ),
    decode: Encoding.decodeStateMultiZoneEffect,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateMultiZoneEffect, 'ack-only'>;
}

/** How many zones one StateExtendedColorZones packet carries. */
const ZONES_PER_PACKET = 82;

export interface GetExtendedColorZonesOptions {
  /**
   * Called once per StateExtendedColorZones packet as it arrives. Return
   * false to stop waiting for further packets; the exchange then resolves
   * with the zones received so far, up to the first one still missing.
   */
  onResponse?: (response: Encoding.StateExtendedColorZones) => boolean | void;
}

/**
 * Reads the colors of every zone. Resolves with the assembled
 * {@link ColorZones} — all of the device's zones, in zone order — however
 * many packets the device split its answer across (one per 82 zones).
 */
export function GetExtendedColorZones(options: GetExtendedColorZonesOptions = {}) {
  const onResponse = options.onResponse;

  // Accumulation state lives inside collect() so each send() gets a fresh
  // collector, making this command safe to reuse across concurrent sends
  // and devices.
  const collect = (): Collector<ColorZones> => {
    // Indexed by zone. Distinct zones are counted (not packets) so a
    // duplicated packet cannot complete the exchange early.
    let colors: Encoding.Color[] = [];
    let received = 0;
    let zonesCount = 0;

    return {
      add(payload, type) {
        if (type !== Type.StateExtendedColorZones) {
          return false;
        }
        const packet = Encoding.decodeStateExtendedColorZones(payload);
        const packetColors = packet.colors;
        zonesCount = packet.zonesCount;

        // A device with at most 82 zones answers with exactly one packet, so
        // that packet is the complete reply whatever colors_count it carries
        // — firmware that under-reports it must not leave the exchange
        // waiting for a second packet that will never come.
        const singlePacket = zonesCount <= ZONES_PER_PACKET;

        if (singlePacket && received === 0 && packet.zoneIndex === 0 && onResponse === undefined) {
          // The common case adopts the decoded colors as the result without
          // copying.
          colors = packetColors;
          received = packetColors.length;
          return true;
        }

        let slot = packet.zoneIndex;
        for (let i = 0; i < packetColors.length; i++, slot++) {
          if (slot < zonesCount && colors[slot] === undefined) {
            colors[slot] = packetColors[i]!;
            received++;
          }
        }

        if (onResponse !== undefined && onResponse(packet) === false) {
          return true; // stopped early by the caller
        }

        return singlePacket || received >= zonesCount;
      },
      result() {
        return { zonesCount, zoneIndex: 0, colors: untilFirstGap(colors) };
      },
    };
  };

  return {
    type: Type.GetExtendedColorZones,
    responseType: Type.StateExtendedColorZones,
    collect,
    defaultResponseMode: 'response',
  } satisfies Command<ColorZones, 'response'>;
}

export interface SetExtendedColorZonesOptions {
  /** Index of the first zone the colors apply to. */
  zoneIndex: number;
  /**
   * Between 1 and 82 colors, applied to consecutive zones starting at
   * zoneIndex. The wire-level colors_count field is derived from this
   * array's length. To address more than 82 zones, send multiple commands
   * with NO_APPLY and finish with APPLY.
   */
  colors: readonly Encoding.Color[];
  /** Transition time in milliseconds. Defaults to 0 (immediate). */
  durationMs?: number;
  /**
   * Whether the device applies the change immediately (APPLY, the default),
   * buffers it for a later APPLY (NO_APPLY), or applies the buffered changes
   * without this one (APPLY_ONLY).
   */
  apply?: MultiZoneExtendedApplicationRequest;
}

export function SetExtendedColorZones(options: SetExtendedColorZonesOptions) {
  return {
    type: Type.SetExtendedColorZones,
    responseType: Type.StateExtendedColorZones,
    payload: Encoding.encodeSetExtendedColorZones(
      options.durationMs ?? 0,
      options.apply ?? MultiZoneExtendedApplicationRequest.APPLY,
      options.zoneIndex,
      options.colors,
    ),
    decode: Encoding.decodeStateExtendedColorZones,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateExtendedColorZones, 'ack-only'>;
}
