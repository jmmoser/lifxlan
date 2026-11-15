/**
 * The house: its walls, furniture, the lights fixed to it, the routes the
 * shades take through it, and what each light can reach. Pure geometry —
 * no drawing and no game rules — so it is checked by tests in bun.
 */
import type { DeviceKind, VirtualDevice } from '../sim/firmware.js';

export const WORLD = { w: 1600, h: 900 } as const;

export interface Vec {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/** The desk in the living room: the router the shades want, and the laptop the library runs on. */
export const ROUTER: Vec = { x: 826, y: 300 };
export const LAPTOP: Vec = { x: 776, y: 302 };
export const DESK = rect(736, 268, 128, 64);

const T = 16;

/** Walls block light. Doorways are the gaps between them. */
export const WALLS: readonly Rect[] = [
  rect(32, 32, 1536, T), rect(32, 852, 1536, T), rect(32, 32, T, 836), rect(1552, 32, T, 836),
  // Kitchen | living room, with a doorway.
  rect(472, 48, T, 202), rect(472, 350, T, 202),
  // Living room | bedroom, with a doorway.
  rect(1112, 48, T, 202), rect(1112, 350, T, 202),
  // Rooms above | hallway below, with three doorways.
  rect(48, 552, 152, T), rect(300, 552, 440, T), rect(860, 552, 440, T), rect(1400, 552, 152, T),
];

export type Floor = 'tile' | 'wood' | 'carpet' | 'stone';

export const ROOMS: readonly { name: string; area: Rect; floor: Floor }[] = [
  { name: 'Kitchen', area: rect(48, 48, 424, 504), floor: 'tile' },
  { name: 'Living room', area: rect(488, 48, 624, 504), floor: 'wood' },
  { name: 'Bedroom', area: rect(1128, 48, 424, 504), floor: 'carpet' },
  { name: 'Hallway', area: rect(48, 568, 1504, 284), floor: 'stone' },
];

export interface Furniture {
  readonly area: Rect;
  readonly look: 'counter' | 'fridge' | 'table' | 'sofa' | 'shelf' | 'bed' | 'wardrobe' | 'plant' | 'cabinet' | 'rug' | 'desk';
  /** Tall enough to throw a shadow. */
  readonly tall: boolean;
}

export const FURNITURE: readonly Furniture[] = [
  { area: rect(560, 190, 480, 250), look: 'rug', tall: false },
  { area: rect(120, 600, 1360, 150), look: 'rug', tall: false },
  { area: rect(1180, 150, 300, 300), look: 'rug', tall: false },
  { area: rect(132, 52, 330, 46), look: 'counter', tall: false },
  { area: rect(52, 52, 76, 86), look: 'fridge', tall: true },
  { area: rect(52, 420, 46, 126), look: 'counter', tall: false },
  { area: rect(330, 410, 96, 96), look: 'table', tall: true },
  { area: rect(500, 392, 62, 150), look: 'sofa', tall: true },
  { area: rect(520, 52, 190, 34), look: 'shelf', tall: false },
  { area: rect(1046, 60, 50, 50), look: 'plant', tall: true },
  { area: rect(1040, 470, 56, 66), look: 'cabinet', tall: true },
  { area: DESK, look: 'desk', tall: false },
  { area: rect(1372, 56, 172, 150), look: 'bed', tall: false },
  { area: rect(1136, 420, 54, 124), look: 'wardrobe', tall: true },
  { area: rect(1490, 480, 50, 50), look: 'plant', tall: true },
  { area: rect(590, 574, 130, 30), look: 'cabinet', tall: true },
  { area: rect(960, 574, 110, 30), look: 'cabinet', tall: true },
  { area: rect(1486, 590, 48, 48), look: 'plant', tall: true },
  { area: rect(70, 590, 44, 44), look: 'plant', tall: true },
];

/** Where the shades get in. */
export const OPENINGS: readonly { at: Vec; vertical: boolean; name: string }[] = [
  { at: { x: 40, y: 710 }, vertical: true, name: 'Front door' },
  { at: { x: 1560, y: 710 }, vertical: true, name: 'Landing window' },
  { at: { x: 260, y: 40 }, vertical: false, name: 'Kitchen window' },
  { at: { x: 1560, y: 300 }, vertical: true, name: 'Bedroom window' },
  { at: { x: 1000, y: 40 }, vertical: false, name: 'Balcony door' },
];

const path = (...points: [number, number][]): Vec[] => points.map(([x, y]) => ({ x, y }));

/** The routes from each opening to the router. */
export const PATHS = {
  door: path([40, 710], [500, 716], [790, 704], [800, 560], [800, 340]),
  landing: path([1560, 710], [1100, 716], [810, 704], [800, 560], [800, 340]),
  kitchen: path([260, 40], [270, 290], [480, 300], [640, 300], [730, 300]),
  kitchenHall: path([260, 40], [250, 300], [250, 560], [310, 700], [790, 706], [800, 560], [800, 340]),
  bedroom: path([1560, 300], [1340, 296], [1120, 300], [960, 300], [870, 300]),
  bedroomHall: path([1560, 300], [1350, 300], [1350, 560], [1290, 700], [810, 706], [800, 560], [800, 340]),
  balcony: path([1000, 40], [1000, 112], [800, 122], [800, 236]),
  // The long way round, for something that wants to visit every room first.
  tour: path([40, 710], [250, 700], [250, 560], [260, 300], [480, 300], [640, 300], [700, 470], [800, 560], [800, 706],
    [1300, 706], [1350, 560], [1340, 300], [1120, 300], [960, 300], [870, 300]),
} satisfies Record<string, Vec[]>;

export type PathName = keyof typeof PATHS;

/* ------------------------------------------------------------------ */
/* Lights                                                              */
/* ------------------------------------------------------------------ */

const BULB_AT: Readonly<Record<string, Vec>> = {
  'Entry Light': { x: 260, y: 712 },
  'Kitchen Pendant': { x: 262, y: 296 },
  'Bedroom Lamp': { x: 1338, y: 296 },
  'Landing Light': { x: 1340, y: 712 },
};

/** The strip runs along the foot of the hallway's far wall. */
export const STRIP = { x: 480, y: 838, length: 640, reach: 250 } as const;
/** Zones per section a single click colours. */
export const SECTION_ZONES = 8;
export const TILE_SIZE = 64;

/** One source of light, for drawing and for working out what it burns. */
export interface Emitter {
  readonly serial: string;
  readonly kind: 'bulb' | 'zone' | 'tile';
  /** The zone or tile number (0 for a bulb). */
  readonly index: number;
  readonly at: Vec;
  readonly radius: number;
  /** The region the light reaches, as a polygon around `at`. */
  readonly reach: readonly Vec[];
}

/** Something the player aims at: a bulb, a section of the strip, one tile. */
export interface Target {
  readonly id: string;
  readonly serial: string;
  readonly kind: 'bulb' | 'section' | 'tile';
  readonly index: number;
  readonly at: Vec;
  readonly area: Rect;
  readonly name: string;
}

export interface Fixture {
  readonly serial: string;
  readonly kind: DeviceKind;
  readonly label: string;
  /** Where packets to and from the device are drawn arriving. */
  readonly at: Vec;
  readonly emitters: readonly Emitter[];
  readonly targets: readonly Target[];
}

/* ------------------------------------------------------------------ */
/* What a light can reach                                              */
/* ------------------------------------------------------------------ */

interface Segment {
  readonly a: Vec;
  readonly b: Vec;
  /** How far light carries past this edge (the depth of a piece of furniture, so its top is lit). */
  readonly soak: number;
}

function edges(r: Rect, soak: number): Segment[] {
  const a = { x: r.x, y: r.y }, b = { x: r.x + r.w, y: r.y }, c = { x: r.x + r.w, y: r.y + r.h }, d = { x: r.x, y: r.y + r.h };
  return [{ a, b, soak }, { a: b, b: c, soak }, { a: c, b: d, soak }, { a: d, b: a, soak }];
}

const OCCLUDERS: readonly Segment[] = [
  ...WALLS.flatMap((wall) => edges(wall, 3)),
  ...FURNITURE.filter((item) => item.tall).flatMap((item) => edges(item.area, Math.min(item.area.w, item.area.h) * 0.9)),
];

/** Distance along the ray from `o` in direction `d` to the first thing in the way, capped at `limit`. */
function cast(o: Vec, dx: number, dy: number, limit: number): number {
  let nearest = limit;
  for (const s of OCCLUDERS) {
    const ex = s.b.x - s.a.x;
    const ey = s.b.y - s.a.y;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-9) continue;
    const t = ((s.a.x - o.x) * ey - (s.a.y - o.y) * ex) / denom;
    const u = ((s.a.x - o.x) * dy - (s.a.y - o.y) * dx) / denom;
    if (t > 0.5 && u >= 0 && u <= 1 && t + s.soak < nearest) nearest = t + s.soak;
  }
  return nearest;
}

/** The area a light at `origin` reaches: rays to every corner in range, stopped by walls and tall furniture. */
export function reachOf(origin: Vec, radius: number): Vec[] {
  const angles: number[] = [];
  for (let i = 0; i < 72; i++) angles.push((i / 72) * Math.PI * 2 - Math.PI);
  for (const s of OCCLUDERS) {
    for (const p of [s.a, s.b]) {
      if (Math.hypot(p.x - origin.x, p.y - origin.y) > radius * 1.2) continue;
      const angle = Math.atan2(p.y - origin.y, p.x - origin.x);
      angles.push(angle - 0.002, angle, angle + 0.002);
    }
  }
  angles.sort((x, y) => x - y);
  return angles.map((angle) => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const t = cast(origin, dx, dy, radius);
    return { x: origin.x + dx * t, y: origin.y + dy * t };
  });
}

/** Whether `p` lies inside a polygon. */
export function inside(p: Vec, polygon: readonly Vec[]): boolean {
  let within = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) within = !within;
  }
  return within;
}

export const contains = (r: Rect, p: Vec): boolean => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** Where tile `index` of a chain sits in the house: its top-left corner. */
export function tileCorner(device: VirtualDevice, index: number): Vec {
  const at = device.tileLayout[index] ?? { x: 0, y: 0 };
  return { x: ROUTER.x - 26 + at.x * TILE_SIZE, y: ROUTER.y + at.y * TILE_SIZE };
}

/** Lays a device out in the house: where it is, what it lights, and what can be clicked. */
export function fixtureFor(device: VirtualDevice): Fixture {
  const { serial, kind, label } = device.spec;

  if (kind === 'strip') {
    const zones = device.pixelCount;
    const width = STRIP.length / zones;
    const emitters: Emitter[] = [];
    for (let i = 0; i < zones; i++) {
      const x = STRIP.x + i * width;
      // Each zone lights the stretch of hallway in front of it, fanning out a little.
      const reach = [
        { x, y: STRIP.y + 12 }, { x: x + width, y: STRIP.y + 12 },
        { x: x + width + 26, y: STRIP.y - STRIP.reach }, { x: x - 26, y: STRIP.y - STRIP.reach },
      ];
      emitters.push({ serial, kind: 'zone', index: i, at: { x: x + width / 2, y: STRIP.y }, radius: STRIP.reach, reach });
    }
    const targets: Target[] = [];
    for (let s = 0; s < zones / SECTION_ZONES; s++) {
      const x = STRIP.x + s * SECTION_ZONES * width;
      const w = SECTION_ZONES * width;
      targets.push({
        id: `${serial}:${s}`, serial, kind: 'section', index: s, at: { x: x + w / 2, y: STRIP.y - 4 },
        area: rect(x, STRIP.y - 46, w, 62), name: `${label} zones ${s * SECTION_ZONES}–${s * SECTION_ZONES + SECTION_ZONES - 1}`,
      });
    }
    return { serial, kind, label, at: { x: STRIP.x + STRIP.length / 2, y: STRIP.y - 6 }, emitters, targets };
  }

  if (kind === 'tiles') {
    const emitters: Emitter[] = [];
    const targets: Target[] = [];
    device.tileLayout.forEach((_, i) => {
      const corner = tileCorner(device, i);
      const at = { x: corner.x + TILE_SIZE / 2, y: corner.y + TILE_SIZE / 2 };
      emitters.push({ serial, kind: 'tile', index: i, at, radius: 150, reach: reachOf(at, 150) });
      targets.push({ id: `${serial}:${i}`, serial, kind: 'tile', index: i, at, area: rect(corner.x - 6, corner.y - 6, TILE_SIZE + 12, TILE_SIZE + 12), name: `${label} tile ${i}` });
    });
    return { serial, kind, label, at: { x: ROUTER.x - 26 + TILE_SIZE / 2, y: ROUTER.y - 2.875 * TILE_SIZE + TILE_SIZE / 2 }, emitters, targets };
  }

  const at = BULB_AT[label] ?? { x: 800, y: 450 };
  const radius = 320;
  return {
    serial, kind, label, at,
    emitters: [{ serial, kind: 'bulb', index: 0, at, radius, reach: reachOf(at, radius) }],
    targets: [{ id: serial, serial, kind: 'bulb', index: 0, at, area: rect(at.x - 34, at.y - 34, 68, 68), name: label }],
  };
}

/* ------------------------------------------------------------------ */
/* Walking a route                                                     */
/* ------------------------------------------------------------------ */

export function pathLength(points: readonly Vec[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  return total;
}

/** The point `distance` along a route, and the direction of travel there. */
export function along(points: readonly Vec[], distance: number): { at: Vec; heading: Vec; done: boolean } {
  let left = Math.max(0, distance);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const heading = { x: (b.x - a.x) / (length || 1), y: (b.y - a.y) / (length || 1) };
    if (left <= length) return { at: { x: a.x + heading.x * left, y: a.y + heading.y * left }, heading, done: false };
    left -= length;
    if (i === points.length - 1) return { at: b, heading, done: true };
  }
  return { at: points[0] ?? { x: 0, y: 0 }, heading: { x: 1, y: 0 }, done: true };
}
