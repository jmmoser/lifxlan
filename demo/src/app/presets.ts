/** The colors, gradients and pixel patterns the controls offer. */
import type { Color } from '../../../src/index.js';
import { gradient, hsbk } from './color.js';

export const OFF: Color = hsbk(0, 0, 0);

export const SWATCHES: readonly { name: string; color: Color }[] = [
  { name: 'Candle', color: hsbk(0, 0, 0.6, 2000) },
  { name: 'Warm white', color: hsbk(0, 0, 0.9, 2700) },
  { name: 'Daylight', color: hsbk(0, 0, 1, 5500) },
  { name: 'Red', color: hsbk(0, 1, 1) },
  { name: 'Amber', color: hsbk(35, 1, 1) },
  { name: 'Green', color: hsbk(120, 1, 0.9) },
  { name: 'Cyan', color: hsbk(185, 1, 1) },
  { name: 'Blue', color: hsbk(230, 1, 1) },
  { name: 'Violet', color: hsbk(275, 1, 1) },
  { name: 'Pink', color: hsbk(325, 0.85, 1) },
];

export const GRADIENTS: readonly { name: string; stops: readonly Color[] }[] = [
  { name: 'Sunset', stops: [hsbk(45, 1, 1), hsbk(20, 1, 0.95), hsbk(340, 0.95, 0.85), hsbk(275, 0.9, 0.6)] },
  { name: 'Ocean', stops: [hsbk(165, 0.9, 0.8), hsbk(195, 1, 1), hsbk(225, 1, 0.9), hsbk(250, 0.9, 0.5)] },
  { name: 'Aurora', stops: [hsbk(140, 1, 0.9), hsbk(170, 1, 0.8), hsbk(265, 0.9, 0.9), hsbk(310, 0.8, 0.7)] },
  { name: 'Ember', stops: [hsbk(0, 1, 0.5), hsbk(18, 1, 1), hsbk(40, 0.9, 1), hsbk(10, 1, 0.6)] },
  { name: 'Rainbow', stops: [hsbk(0, 1, 1), hsbk(90, 1, 1), hsbk(180, 1, 1), hsbk(270, 1, 1), hsbk(359, 1, 1)] },
  { name: 'Reading', stops: [hsbk(0, 0, 0.8, 4000), hsbk(0, 0, 0.8, 4000)] },
];

export const zoneGradient = (name: string, count: number): Color[] => {
  const preset = GRADIENTS.find((candidate) => candidate.name === name) ?? GRADIENTS[0]!;
  return gradient(preset.stops, count);
};

export const PALETTES = {
  aurora: [hsbk(140, 1, 0.9), hsbk(175, 1, 0.7), hsbk(215, 1, 0.5), hsbk(270, 0.9, 0.85), hsbk(310, 0.8, 0.6)],
  lagoon: [hsbk(160, 1, 0.9), hsbk(190, 1, 1), hsbk(220, 1, 0.7), hsbk(200, 0.6, 0.3)],
  dusk: [hsbk(30, 1, 1), hsbk(350, 0.9, 0.9), hsbk(285, 0.9, 0.7), hsbk(240, 1, 0.4)],
} satisfies Record<string, Color[]>;

/** Where one tile sits, in tile widths (from GetDeviceChain's user_x / user_y). */
export interface TileAt {
  readonly x: number;
  readonly y: number;
}

const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  H: ['........', '.#....#.', '.#....#.', '.######.', '.#....#.', '.#....#.', '.#....#.', '........'],
  E: ['........', '.######.', '.#......', '.#####..', '.#......', '.#......', '.######.', '........'],
  L: ['........', '.#......', '.#......', '.#......', '.#......', '.#......', '.######.', '........'],
  O: ['........', '..####..', '.#....#.', '.#....#.', '.#....#.', '.#....#.', '..####..', '........'],
  heart: ['........', '.##..##.', '########', '########', '.######.', '..####..', '...##...', '........'],
};

function glyphFrame(glyph: readonly string[], ink: Color, paper: Color): Color[] {
  const frame: Color[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) frame.push(glyph[y]?.[x] === '#' ? ink : paper);
  }
  return frame;
}

function field(tiles: readonly TileAt[], paint: (gx: number, gy: number, tile: number) => Color): Color[][] {
  return tiles.map((at, tile) => {
    const frame: Color[] = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) frame.push(paint(at.x * 8 + x, at.y * 8 + y, tile));
    }
    return frame;
  });
}

/** Pixel patterns: each returns one 64-color frame per tile. */
export const PATTERNS: readonly { name: string; frames: (tiles: readonly TileAt[]) => Color[][] }[] = [
  {
    name: 'Hello',
    frames: (tiles) => tiles.map((_, i) => {
      const letter = GLYPHS['HELLO'[i % 5] ?? 'O'] ?? GLYPHS['O']!;
      return glyphFrame(letter, hsbk(40 + i * 62, 0.9, 1), hsbk(230, 0.8, 0.07));
    }),
  },
  {
    name: 'Hearts',
    frames: (tiles) => tiles.map((_, i) => glyphFrame(GLYPHS['heart']!, hsbk(350 - i * 12, 0.95, 1), hsbk(330, 0.7, 0.06))),
  },
  { name: 'Rainbow', frames: (tiles) => field(tiles, (gx, gy) => hsbk(gx * 9 + gy * 6, 1, 0.9)) },
  {
    name: 'Checker',
    frames: (tiles) => field(tiles, (gx, gy, tile) => ((Math.floor(gx / 2) + Math.floor(gy / 2)) % 2 === 0 ? hsbk(190 + tile * 20, 1, 0.9) : hsbk(280, 0.9, 0.18))),
  },
  { name: 'Blank', frames: (tiles) => tiles.map(() => Array.from({ length: 64 }, () => hsbk(0, 0, 0.03, 3500))) },
];

/** One frame of the client-driven plasma animation, `t` in seconds. */
export function plasma(tiles: readonly TileAt[], t: number): Color[][] {
  return field(tiles, (gx, gy) => {
    const v = Math.sin(gx * 0.35 + t * 1.9) + Math.sin(gy * 0.45 - t * 1.4) + Math.sin((gx + gy) * 0.25 + t) + Math.sin(Math.hypot(gx - 20, gy - 6) * 0.5 - t * 2.3);
    return hsbk(v * 45 + t * 40, 1, 0.55 + 0.45 * Math.sin(v * 1.6 + t));
  });
}

/**
 * Datagrams written out by hand for the raw packet lab — typed as hex, never
 * passed through the library's encoder. Each is sent to the broadcast
 * address, so every device on the network receives it.
 */
export const RAW_PACKETS: readonly { name: string; about: string; hex: string }[] = [
  {
    name: 'All lights green',
    about: 'The worked example from the LIFX protocol documentation: a tagged SetColor (type 0x66 = 102) with hue 0x5555 (120°), full saturation and brightness, 3500 K, over 1024 ms.',
    hex: '31 00 00 34 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 66 00 00 00 00 55 55 ff ff ff ff ac 0d 00 04 00 00',
  },
  {
    name: 'Who is out there?',
    about: 'A GetService (type 2) with no payload: 36 bytes of header. The source is 42, a number no client here uses, so the StateService replies show up in the log with nobody waiting for them.',
    hex: '24 00 00 34 2a 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 07 00 00 00 00 00 00 00 00 02 00 00 00',
  },
  {
    name: 'Everything off',
    about: 'A SetPower (type 0x15 = 21) with level 0x0000. Change the last two bytes to ff ff and send it again to turn everything back on.',
    hex: '26 00 00 34 2a 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 15 00 00 00 00 00',
  },
  {
    name: 'A broken frame',
    about: 'The size field claims 49 bytes but only 40 follow. The library refuses to decode it and the devices ignore it.',
    hex: '31 00 00 34 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 66 00 00 00 00 55 55 ff',
  },
];
