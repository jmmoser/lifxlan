import * as Encoding from '../wire.js';
import { Type, TileEffectSkyType } from '../constants/index.js';
import { ValidationError } from '../errors.js';
import type { TileEffectType } from '../constants/index.js';
import type { Collector, Command } from './index.js';

/** The pixel-grid row width of every current LIFX tile device. */
const TILE_WIDTH = 8;

export function GetDeviceChain() {
  return {
    type: Type.GetDeviceChain,
    responseType: Type.StateDeviceChain,
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
   * Keep `tileIndex + tileCount` within the chain (the length of
   * GetDeviceChain's `devices`): State64 carries no chain length, so a tile
   * past the end never answers and the call waits for it until it times out.
   */
  tileCount?: number;
  /** Leftmost pixel column to fetch. Defaults to 0 (use 0 with width 8). */
  x?: number;
  /** Topmost pixel row to fetch. Defaults to 0 (use 0 with width 8). */
  y?: number;
  /** Pixel-grid row width. Defaults to 8, which every current LIFX tile device uses. */
  width?: number;
  /**
   * Called once per distinct requested tile as its State64 packet arrives
   * (duplicates and tiles outside the requested range are ignored). Return
   * false to stop waiting for further packets; the exchange then resolves
   * with the tiles received so far.
   */
  onResponse?: (response: Encoding.State64) => boolean | void;
}

/**
 * Reads one 64-pixel frame from each of `tileCount` tiles. Resolves with
 * one {@link Encoding.State64} per tile, ordered by `tileIndex` whatever
 * order the packets arrived in.
 */
export function Get64(options: Get64Options) {
  const tileCount = options.tileCount ?? 1;
  const firstTile = options.tileIndex;
  // Both are uint8 on the wire, but the collector below compares replies
  // against these raw numbers, so the exchange could only time out: a
  // wrapped tileIndex (256 encodes as 0) or tileCount (256 as 0) asks for
  // tiles the collector never accepts, and a fractional tileCount (1.5
  // sends 1) leaves it waiting for a fraction of a tile. A count of 0 requests no
  // tiles at all.
  if (!Number.isInteger(firstTile) || firstTile < 0 || firstTile > 255) {
    throw new ValidationError('tileIndex', firstTile, 'must be an integer between 0 and 255');
  }
  if (!Number.isInteger(tileCount) || tileCount < 1 || tileCount > 255) {
    throw new ValidationError('tileCount', tileCount, 'must be an integer between 1 and 255');
  }
  // Tile indices are uint8, so a range running past 255 names tiles that
  // cannot exist and the collector would wait for them until the timeout.
  if (firstTile + tileCount > 256) {
    throw new ValidationError('tileCount', tileCount, `tileIndex + tileCount must not exceed 256 (tileIndex is ${firstTile})`);
  }
  const onResponse = options.onResponse;

  // Accumulation state lives inside collect() so each send() gets a fresh
  // collector, making this command safe to reuse across concurrent sends
  // and devices.
  const collect = (): Collector<Encoding.State64[]> => {
    // Indexed by tileIndex - firstTile, which both orders the result and
    // tracks distinct tiles rather than counting packets: UDP can deliver a
    // State64 twice, and a duplicate must neither complete the exchange
    // before every tile has reported nor appear in the result. Devices
    // report absolute tile indices, so one outside the requested range is a
    // stray (e.g. a late reply on a reused sequence number) and must not
    // fill a slot either.
    const tiles: Encoding.State64[] = [];
    let seen = 0;

    return {
      add(payload, type) {
        if (type !== Type.State64) {
          return false;
        }
        const tile = Encoding.decodeState64(payload);
        const slot = tile.tileIndex - firstTile;
        if (slot < 0 || slot >= tileCount || tiles[slot] !== undefined) {
          return false; // stray or duplicate — keep waiting
        }
        tiles[slot] = tile;
        seen++;

        if (onResponse !== undefined && onResponse(tile) === false) {
          return true; // stopped early by the caller
        }

        return seen === tileCount;
      },
      result() {
        // Complete, the list has no gaps; stopped early it may, and the
        // missing tiles are simply left out (each entry names its tile).
        return seen === tileCount ? tiles : tiles.filter((tile) => tile !== undefined);
      },
    };
  };

  return {
    type: Type.Get64,
    responseType: Type.State64,
    payload: Encoding.encodeGet64(options.tileIndex, tileCount, options.x ?? 0, options.y ?? 0, options.width ?? TILE_WIDTH),
    collect,
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
  /** Pixel-grid row width. Defaults to 8, which every current LIFX tile device uses. */
  width?: number;
  /** Transition time in milliseconds. Defaults to 0 (immediate). */
  durationMs?: number;
  /** The frame: up to 64 colors in row-major order. Missing entries stay zero. */
  colors: readonly Encoding.Color[];
}

// The declared Command<void, ...> return type (rather than `satisfies`) is
// what lets send() reject responseMode 'response'/'both' at compile time:
// with no decoder to infer from, only the annotation carries `void` to the
// call site.
export function Set64(options: Set64Options): Command<void, 'ack-only'> & { payload: Uint8Array } {
  return {
    type: Type.Set64,
    payload: Encoding.encodeSet64(
      options.tileIndex,
      options.tileCount ?? 1,
      options.x ?? 0,
      options.y ?? 0,
      options.width ?? TILE_WIDTH,
      options.durationMs ?? 0,
      options.colors,
    ),
    defaultResponseMode: 'ack-only',
  };
}

export function GetTileEffect() {
  return {
    type: Type.GetTileEffect,
    responseType: Type.StateTileEffect,
    payload: Encoding.encodeGetTileEffect(),
    decode: Encoding.decodeStateTileEffect,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateTileEffect, 'response'>;
}

export interface SetTileEffectOptions {
  /** Caller-chosen identifier for this run of the effect. */
  instanceId: number;
  effectType: TileEffectType;
  /** Time one cycle of the effect takes, in milliseconds. */
  speedMs: number;
  /** How long the effect runs, in nanoseconds. 0 means until changed. */
  durationNs: bigint;
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
  palette: readonly Encoding.Color[];
}

export function SetTileEffect(options: SetTileEffectOptions) {
  return {
    type: Type.SetTileEffect,
    responseType: Type.StateTileEffect,
    payload: Encoding.encodeSetTileEffect(
      options.instanceId,
      options.effectType,
      options.speedMs,
      options.durationNs,
      options.skyType ?? TileEffectSkyType.SUNRISE,
      options.cloudSaturationMin ?? 0,
      options.cloudSaturationMax ?? 0,
      options.palette,
    ),
    decode: Encoding.decodeStateTileEffect,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateTileEffect, 'ack-only'>;
}
