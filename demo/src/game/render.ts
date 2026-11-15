/**
 * Draws the house. The floor is painted once, as if evenly lit; every frame
 * a light map is built from what each simulated device is emitting right
 * now and multiplied over it, so the picture is dark wherever no device is
 * shining. Shades, sparks and the datagrams in flight go on top.
 */
import { decodeHeader } from '../../../src/encoding.js';
import type { Color } from '../../../src/index.js';
import { rgba, tint } from '../app/color.js';
import type { Rgb } from '../app/color.js';
import { typeName } from '../protocol/layouts.js';
import type { VirtualDevice } from '../sim/firmware.js';
import { BROADCAST } from '../sim/lan.js';
import type { Endpoint, LanEvent, VirtualLan } from '../sim/lan.js';
import type { Enemy, Game, GameEvent, Light } from './game.js';
import { HUES } from './waves.js';
import { DESK, FURNITURE, LAPTOP, OPENINGS, ROOMS, ROUTER, STRIP, TILE_SIZE, WALLS, WORLD, contains, tileCorner } from './world.js';
import type { Fixture, Furniture, Rect, Target, Vec } from './world.js';

const { w: W, h: H } = WORLD;
const TAU = Math.PI * 2;

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; ttl: number; size: number;
  rgb: Rgb; drag: number;
  /** Drawn as darkness over the scene instead of as light added to it. */
  smoke?: boolean;
}

interface Floater {
  x: number; y: number; text: string; color: string;
  life: number; ttl: number; size: number; rise: number;
}

interface Flight {
  from: Vec; to: Vec; start: number; duration: number;
  lost: boolean; outbound: boolean; bend: number;
}

interface Ring {
  at: Vec; start: number; duration: number; radius: number; rgb: Rgb;
}

interface Bolt {
  from: Vec; to: Vec; start: number;
}

export interface FineHit {
  readonly serial: string;
  /** The zone or tile pixel under the pointer, when the device has them. */
  readonly index: number | undefined;
}

const OFF_GLASS: Rgb = [46, 49, 62];
const AMBER: Rgb = [255, 180, 84];
const CYAN: Rgb = [98, 210, 226];
const RED: Rgb = [255, 96, 84];

/** The display colour of each of the six hues. */
export const HUE_RGB: readonly Rgb[] = HUES.map((hue) => tint({ hue: (hue.degrees / 360) * 65535, saturation: 65535, brightness: 65535, kelvin: 3500 }));

function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lit = (rgb: Rgb, level: number): Rgb => [rgb[0] * level, rgb[1] * level, rgb[2] * level];

/** A lit surface: dark glass when off, the tint as it brightens. */
function surface(c: Color, level: number): string {
  const v = Math.max(0, Math.min(1, level)) ** 0.55;
  const [r, g, b] = tint(c);
  return rgba([OFF_GLASS[0] + (r - OFF_GLASS[0]) * v, OFF_GLASS[1] + (g - OFF_GLASS[1]) * v, OFF_GLASS[2] + (b - OFF_GLASS[2]) * v], 1);
}

function layer(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2D is not available');
  return { canvas, ctx };
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  /** What the pointer is over, in house coordinates. */
  pointer: Vec | undefined;
  hover: Target | undefined;
  /** The device outlined in the sandbox. */
  selected: string | undefined;

  private readonly ctx: CanvasRenderingContext2D;
  private readonly game: Game;
  private readonly fleet: readonly VirtualDevice[];
  private readonly controller: Endpoint;
  private floor = layer(1, 1);
  private walls = layer(1, 1);
  private glow = layer(1, 1);
  private shade = layer(1, 1);
  private scale = 1;
  /** House units per CSS pixel: multiply to draw something a fixed size on screen. */
  private unit = 1;
  private readonly particles: Particle[] = [];
  private readonly floaters: Floater[] = [];
  private readonly flights: Flight[] = [];
  private readonly rings: Ring[] = [];
  private readonly bolts: Bolt[] = [];
  private readonly heard = new Map<string, number>();
  private readonly lastLabel = new Map<string, number>();
  private shake = 0;
  private glitchUntil = 0;
  private hurtUntil = 0;
  private routerBusy = 0;
  private last = 0;
  /** The light there is with every lamp off: night, a dead network, or morning. */
  private ambient: [number, number, number] = [33, 37, 62];
  private readonly reducedMotion: boolean;

  constructor(game: Game, fleet: readonly VirtualDevice[], lan: VirtualLan, controller: Endpoint) {
    this.game = game;
    this.fleet = fleet;
    this.controller = controller;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'arena-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'A floor plan of a house at night, lit only by the simulated lights, with shades moving toward the router.');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2D is not available');
    this.ctx = ctx;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    lan.observe((event) => this.onLan(event));
    game.listen((event) => this.onGame(event));
    new ResizeObserver(() => this.resize()).observe(this.canvas);
    this.resize();
  }

  /* ---------------------------------------------------------------- */
  /* Geometry                                                          */
  /* ---------------------------------------------------------------- */

  private resize(): void {
    const cssWidth = this.canvas.clientWidth || 800;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.min(1920, Math.round(cssWidth * ratio));
    const height = Math.round(width * (H / W));
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.scale = width / W;
    this.unit = W / cssWidth;

    this.floor = layer(width, height);
    this.floor.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.paintFloor(this.floor.ctx);
    this.walls = layer(width, height);
    this.walls.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.paintWalls(this.walls.ctx);
    this.glow = layer(width / 3, height / 3);
    this.shade = layer(width, height);
    this.paintVignette(this.shade.ctx, width, height);
  }

  /** Converts a pointer position on the page to house coordinates. */
  toWorld(clientX: number, clientY: number): Vec {
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((clientX - rect.left) / rect.width) * W, y: ((clientY - rect.top) / rect.height) * H };
  }

  /** The bulb, strip section or tile at a point. */
  targetAt(p: Vec): Target | undefined {
    for (const fixture of this.game.fixtures) {
      for (const target of fixture.targets) {
        if (contains(target.area, p)) return target;
      }
    }
    return undefined;
  }

  enemyAt(p: Vec): Enemy | undefined {
    let best: Enemy | undefined;
    let bestDistance = Infinity;
    for (const enemy of this.game.enemies) {
      const d = Math.hypot(enemy.at.x - p.x, enemy.at.y - p.y);
      if (d < enemy.type.size + 14 && d < bestDistance) {
        best = enemy;
        bestDistance = d;
      }
    }
    return best;
  }

  /** The exact zone or pixel at a point, for painting in the sandbox. */
  fineAt(p: Vec): FineHit | undefined {
    const target = this.targetAt(p);
    if (!target) return undefined;
    const device = this.fleet.find((candidate) => candidate.spec.serial === target.serial);
    if (!device) return undefined;
    if (target.kind === 'section') {
      const zone = Math.floor(((p.x - STRIP.x) / STRIP.length) * device.pixelCount);
      return { serial: target.serial, index: Math.max(0, Math.min(device.pixelCount - 1, zone)) };
    }
    if (target.kind === 'tile') {
      const corner = tileCorner(device, target.index);
      const px = Math.floor(((p.x - corner.x) / TILE_SIZE) * 8);
      const py = Math.floor(((p.y - corner.y) / TILE_SIZE) * 8);
      if (px < 0 || px > 7 || py < 0 || py > 7) return { serial: target.serial, index: undefined };
      return { serial: target.serial, index: target.index * 64 + py * 8 + px };
    }
    return { serial: target.serial, index: undefined };
  }

  private fixtureAt(address: string): Fixture | undefined {
    const device = this.fleet.find((candidate) => candidate.endpoint.address === address);
    return device && this.game.fixtureOf(device.spec.serial);
  }

  private point(endpoint: Endpoint): Vec | undefined {
    if (endpoint.address === this.controller.address) return LAPTOP;
    return this.fixtureAt(endpoint.address)?.at;
  }

  /* ---------------------------------------------------------------- */
  /* Effects                                                           */
  /* ---------------------------------------------------------------- */

  burst(at: Vec, rgb: Rgb, count: number, speed: number, size = 2.6): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const v = speed * (0.25 + Math.random() * 0.75);
      this.particles.push({
        x: at.x, y: at.y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
        life: 0, ttl: 0.35 + Math.random() * 0.6, size: size * (0.5 + Math.random()), rgb, drag: 2.4,
      });
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }

  say(at: Vec, text: string, color: string, size = 11, ttl = 1.1): void {
    // Labels that land on the same spot stack upward instead of piling up.
    let y = at.y;
    for (const other of this.floaters) {
      if (other.life < 0.6 && Math.abs(other.x - at.x) < 70 * this.unit && Math.abs(other.y - y) < 13 * this.unit) y = other.y - 14 * this.unit;
    }
    this.floaters.push({ x: at.x, y, text, color, life: 0, ttl, size, rise: 26 });
    if (this.floaters.length > 60) this.floaters.shift();
  }

  private onGame(event: GameEvent): void {
    const now = performance.now();
    switch (event.kind) {
      case 'kill': {
        const rgb = HUE_RGB[event.enemy.hue] ?? AMBER;
        this.burst(event.enemy.at, rgb, 26 + event.enemy.type.size, 240, 3);
        this.burst(event.enemy.at, [255, 255, 255], 8, 120, 2);
        this.rings.push({ at: event.enemy.at, start: now, duration: 420, radius: event.enemy.type.size * 3.2, rgb });
        this.say({ x: event.enemy.at.x, y: event.enemy.at.y - event.enemy.type.size }, event.combo > 1 ? `+${event.points}  ×${event.combo}` : `+${event.points}`, 'rgba(255,255,255,0.96)', event.combo > 2 ? 15 : 12);
        if (event.enemy.kind === 'outage') this.shake = 22;
        break;
      }
      case 'routerHit':
        this.shake = Math.max(this.shake, 14 + event.enemy.type.bite * 5);
        this.glitchUntil = now + 380;
        this.hurtUntil = now + 900;
        this.burst(ROUTER, RED, 40, 320, 3.4);
        this.rings.push({ at: ROUTER, start: now, duration: 600, radius: 260, rgb: RED });
        this.say({ x: ROUTER.x, y: ROUTER.y - 46 }, `−${event.enemy.type.bite} signal`, rgba(RED, 1), 15, 1.6);
        break;
      case 'spawn':
        this.rings.push({ at: event.enemy.at, start: now, duration: 700, radius: 70, rgb: HUE_RGB[event.enemy.hue] ?? AMBER });
        break;
      case 'retry':
        this.say({ x: event.at.x, y: event.at.y - 34 }, event.gaveUp ? 'TimeoutError · gave up' : `TimeoutError · retry ${event.attempt}/${event.of - 1}`, rgba(RED, 1), 11, 1.4);
        break;
      case 'denied':
        this.say({ x: event.at.x, y: event.at.y - 30 }, event.why, 'rgba(200,206,222,0.9)', 11, 0.9);
        break;
      case 'confirmed':
        this.say({ x: event.target.at.x + 22, y: event.target.at.y - 18 }, '✓ ack', rgba(CYAN, 0.95), 10, 0.7);
        break;
      case 'ability':
        this.rings.push({ at: event.fixture.at, start: now, duration: 500, radius: 150, rgb: [255, 255, 255] });
        break;
      case 'broadcast':
        this.rings.push({ at: LAPTOP, start: now, duration: 900, radius: 1500, rgb: [255, 255, 255] });
        this.shake = Math.max(this.shake, 8);
        break;
      case 'brownout': {
        const boss = this.game.boss;
        if (boss) this.bolts.push({ from: boss.at, to: event.fixture.at, start: now });
        this.burst(event.fixture.at, [150, 170, 255], 24, 200);
        this.say({ x: event.fixture.at.x, y: event.fixture.at.y - 40 }, 'power cut', 'rgba(170,185,255,1)', 12, 1.6);
        break;
      }
      case 'restored':
        this.say({ x: event.fixture.at.x, y: event.fixture.at.y - 40 }, 'booted', 'rgba(200,255,210,1)', 11, 1.2);
        break;
      case 'shuffle': {
        const boss = this.game.boss;
        if (boss) this.bolts.push({ from: boss.at, to: event.fixture.at, start: now });
        this.say({ x: event.fixture.at.x, y: event.fixture.at.y - 40 }, `now ${event.address}`, 'rgba(255,214,150,1)', 12, 2.4);
        break;
      }
      default:
        break;
    }
  }

  private onLan(event: LanEvent): void {
    const now = performance.now();
    const { datagram } = event;
    if (event.kind === 'deliver') {
      this.heard.set(event.to.address, now);
      this.routerBusy = now;
      const fixture = this.fixtureAt(event.to.address);
      if (!fixture) return;
      // Name the message where it lands — but not every packet of a stream.
      let name: string;
      try { name = typeName(decodeHeader(datagram.bytes).type); } catch { return; }
      const key = `${fixture.serial}:${name}`;
      if (now - (this.lastLabel.get(key) ?? -1e9) < 600) return;
      this.lastLabel.set(key, now);
      this.say({ x: fixture.at.x, y: fixture.at.y + 30 }, name, rgba(AMBER, 0.9), 9.5, 0.9);
      if (name.startsWith('Set')) this.rings.push({ at: fixture.at, start: now, duration: 380, radius: 90, rgb: [255, 255, 255] });
      return;
    }
    const from = this.point(datagram.from);
    if (!from) return;
    const outbound = datagram.from.address === this.controller.address;
    if (outbound && datagram.to.address === BROADCAST) {
      this.rings.push({ at: LAPTOP, start: now, duration: 800, radius: 900, rgb: AMBER });
    }
    for (const hop of event.hops) {
      const to = this.point(hop.to);
      if (!to) continue;
      this.flights.push({ from, to, start: now, duration: Math.max(hop.delayMs, 150), lost: hop.lost, outbound, bend: (Math.random() - 0.5) * 60 });
    }
    if (this.flights.length > 500) this.flights.splice(0, this.flights.length - 500);
  }

  /* ---------------------------------------------------------------- */
  /* Painted once                                                      */
  /* ---------------------------------------------------------------- */

  private paintFloor(ctx: CanvasRenderingContext2D): void {
    const random = mulberry(7);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, W, H);

    for (const room of ROOMS) {
      const { x, y, w, h } = room.area;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 8, y - 8, w + 16, h + 16);
      ctx.clip();
      if (room.floor === 'tile') {
        ctx.fillStyle = '#d2d6db';
        ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
        for (let ty = y - 8; ty < y + h + 8; ty += 46) {
          for (let tx = x - 8; tx < x + w + 8; tx += 46) {
            if ((Math.round(tx / 46) + Math.round(ty / 46)) % 2 === 0) {
              ctx.fillStyle = '#c0c6ce';
              ctx.fillRect(tx, ty, 46, 46);
            }
          }
        }
        ctx.strokeStyle = 'rgba(40,50,70,0.10)';
        ctx.lineWidth = 1.5;
        for (let tx = x - 8; tx < x + w + 8; tx += 46) { ctx.beginPath(); ctx.moveTo(tx, y - 8); ctx.lineTo(tx, y + h + 8); ctx.stroke(); }
        for (let ty = y - 8; ty < y + h + 8; ty += 46) { ctx.beginPath(); ctx.moveTo(x - 8, ty); ctx.lineTo(x + w + 8, ty); ctx.stroke(); }
      } else if (room.floor === 'wood') {
        for (let py = y - 8; py < y + h + 8; py += 23) {
          let px = x - 8 - random() * 140;
          while (px < x + w + 8) {
            const length = 96 + random() * 120;
            ctx.fillStyle = `hsl(${28 + random() * 6} ${30 + random() * 10}% ${60 + random() * 9}%)`;
            ctx.fillRect(px, py, length, 23);
            ctx.fillStyle = 'rgba(70,45,20,0.22)';
            ctx.fillRect(px + length - 1, py, 1.4, 23);
            px += length;
          }
          ctx.fillStyle = 'rgba(70,45,20,0.18)';
          ctx.fillRect(x - 8, py, w + 16, 1.2);
        }
      } else if (room.floor === 'carpet') {
        ctx.fillStyle = '#aeb6c8';
        ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
        for (let i = 0; i < 2600; i++) {
          ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(20,30,60,0.07)';
          ctx.fillRect(x + random() * w, y + random() * h, 2.2, 2.2);
        }
      } else {
        ctx.fillStyle = '#bcbec3';
        ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
        let row = 0;
        for (let sy = y - 8; sy < y + h + 8; sy += 72, row++) {
          for (let sx = x - 8 - (row % 2) * 52; sx < x + w + 8; sx += 104) {
            ctx.fillStyle = `hsl(225 4% ${72 + random() * 7}%)`;
            ctx.fillRect(sx + 1, sy + 1, 102, 70);
          }
        }
      }
      ctx.restore();
    }

    for (const item of FURNITURE) this.paintFurniture(ctx, item, random);
  }

  private paintFurniture(ctx: CanvasRenderingContext2D, item: Furniture, random: () => number): void {
    const { x, y, w, h } = item.area;
    const box = (fill: string, r = 6, inset = 0) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, r);
      ctx.fill();
    };
    ctx.save();
    if (item.look !== 'rug') {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = (item.tall ? 16 : 8) * this.scale;
      ctx.shadowOffsetY = (item.tall ? 5 : 2) * this.scale;
    }
    switch (item.look) {
      case 'rug': {
        const hall = w > 1000;
        box(hall ? '#cbbdaf' : w > 400 ? '#dccbb2' : '#c9cee2', 10);
        ctx.strokeStyle = hall ? '#a8927c' : w > 400 ? '#b59a78' : '#9aa3c4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 6);
        ctx.stroke();
        ctx.lineWidth = 1.2;
        if (hall) {
          for (let sx = x + 40; sx < x + w - 30; sx += 34) { ctx.beginPath(); ctx.moveTo(sx, y + 18); ctx.lineTo(sx + 14, y + h / 2); ctx.lineTo(sx, y + h - 18); ctx.stroke(); }
        } else {
          for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.roundRect(x + 22 + i * 12, y + 22 + i * 12, w - 44 - i * 24, h - 44 - i * 24, 4); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1; }
        }
        break;
      }
      case 'counter':
        box('#e6e2da', 4);
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#aaa59c';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        if (w > 200) {
          ctx.fillStyle = '#9fa6ad';
          ctx.beginPath(); ctx.roundRect(x + 40, y + 8, 70, h - 16, 6); ctx.fill();
          ctx.fillStyle = '#3b3f48';
          ctx.beginPath(); ctx.roundRect(x + 190, y + 6, 96, h - 12, 4); ctx.fill();
          ctx.strokeStyle = '#8b909a';
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + 214 + (i % 2) * 48, y + 15 + Math.floor(i / 2) * 17, 6, 0, TAU); ctx.stroke(); }
        }
        break;
      case 'fridge':
        box('#eef1f5', 5);
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#aab1bb';
        ctx.fillRect(x + w - 10, y + 12, 4, h - 24);
        break;
      case 'table':
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#8a6646';
        for (const [cx, cy] of [[x - 14, y + h / 2], [x + w + 14, y + h / 2], [x + w / 2, y - 14], [x + w / 2, y + h + 14]]) {
          ctx.beginPath(); ctx.roundRect(cx! - 15, cy! - 15, 30, 30, 8); ctx.fill();
        }
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.fillStyle = '#bd9163';
        ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w / 2, 0, TAU); ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(80,50,20,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w / 2 - 6, 0, TAU); ctx.stroke();
        break;
      case 'sofa':
        box('#8f9bb2', 10);
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#7b879f';
        ctx.beginPath(); ctx.roundRect(x, y, 18, h, 8); ctx.fill();
        ctx.fillStyle = '#a3aec3';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.roundRect(x + 22, y + 8 + i * ((h - 16) / 3), w - 28, (h - 16) / 3 - 5, 7); ctx.fill(); }
        break;
      case 'shelf':
        box('#a48260', 3);
        ctx.shadowColor = 'transparent';
        for (let bx = x + 6; bx < x + w - 10;) {
          const bw = 5 + random() * 7;
          ctx.fillStyle = `hsl(${Math.floor(random() * 360)} 35% ${45 + random() * 25}%)`;
          ctx.fillRect(bx, y + 5, bw, h - 10);
          bx += bw + 1.5;
        }
        break;
      case 'bed':
        box('#b99c7b', 8);
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#f2efe9';
        ctx.beginPath(); ctx.roundRect(x + 6, y + 6, w - 12, h - 12, 8); ctx.fill();
        ctx.fillStyle = '#9fb0cb';
        ctx.beginPath(); ctx.roundRect(x + 6, y + h * 0.48, w - 12, h * 0.48 - 6, 8); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.roundRect(x + 16, y + 14, w / 2 - 24, 40, 9); ctx.fill();
        ctx.beginPath(); ctx.roundRect(x + w / 2 + 8, y + 14, w / 2 - 24, 40, 9); ctx.fill();
        break;
      case 'wardrobe':
      case 'cabinet':
        box(item.look === 'wardrobe' ? '#a27f5c' : '#ad8a66', 4);
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(60,40,20,0.4)';
        ctx.lineWidth = 1.5;
        if (w > h) { ctx.beginPath(); ctx.moveTo(x + w / 2, y + 3); ctx.lineTo(x + w / 2, y + h - 3); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(x + 3, y + h / 2); ctx.lineTo(x + w - 3, y + h / 2); ctx.stroke(); }
        break;
      case 'plant':
        ctx.fillStyle = '#b8683f';
        ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w * 0.32, 0, TAU); ctx.fill();
        ctx.shadowColor = 'transparent';
        for (let i = 0; i < 9; i++) {
          const angle = (i / 9) * TAU + random();
          ctx.fillStyle = `hsl(${112 + random() * 30} ${38 + random() * 18}% ${38 + random() * 18}%)`;
          ctx.beginPath();
          ctx.ellipse(x + w / 2 + Math.cos(angle) * w * 0.3, y + h / 2 + Math.sin(angle) * h * 0.3, w * 0.3, w * 0.14, angle, 0, TAU);
          ctx.fill();
        }
        break;
      case 'desk':
        box('#b48d63', 6);
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(70,45,20,0.35)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
        break;
    }
    ctx.restore();
  }

  private paintWalls(ctx: CanvasRenderingContext2D): void {
    for (const wall of WALLS) {
      ctx.fillStyle = '#0d0f16';
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = '#2a2f40';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(wall.x + 1.5, wall.y + 1.5, wall.w - 3, wall.h - 3);
    }
    // Outside the house is night.
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, W, 32); ctx.fillRect(0, 868, W, 32); ctx.fillRect(0, 0, 32, H); ctx.fillRect(1568, 0, 32, H);
    for (const opening of OPENINGS) {
      const { x, y } = opening.at;
      const frame: Rect = opening.vertical ? { x: x - 9, y: y - 52, w: 18, h: 104 } : { x: x - 52, y: y - 9, w: 104, h: 18 };
      ctx.fillStyle = '#1a2233';
      ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
      ctx.strokeStyle = '#51618a';
      ctx.lineWidth = 2;
      ctx.strokeRect(frame.x + 2, frame.y + 2, frame.w - 4, frame.h - 4);
    }
  }

  private paintVignette(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const g = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  /* ---------------------------------------------------------------- */
  /* Every frame                                                       */
  /* ---------------------------------------------------------------- */

  draw(now: number): void {
    const dt = Math.min(0.05, this.last === 0 ? 0.016 : (now - this.last) / 1000);
    this.last = now;
    const { ctx, game, scale } = this;
    const frozen = game.paused;

    this.shake *= Math.exp(-dt * 9);
    const sky: Rgb = game.phase === 'won' ? [236, 214, 178] : game.phase === 'lost' ? [44, 12, 16] : [33, 37, 62];
    const ease = Math.min(1, dt * (game.phase === 'won' ? 0.5 : 2.5));
    for (let i = 0; i < 3; i++) this.ambient[i] = (this.ambient[i] ?? 0) + ((sky[i] ?? 0) - (this.ambient[i] ?? 0)) * ease;
    const sx = this.reducedMotion ? 0 : (Math.random() - 0.5) * this.shake * scale;
    const sy = this.reducedMotion ? 0 : (Math.random() - 0.5) * this.shake * scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.floor.canvas, sx, sy);

    this.drawLightMap();
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.glow.canvas, sx, sy, this.canvas.width, this.canvas.height);
    // A little of the light hangs in the air as haze.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.13;
    ctx.drawImage(this.glow.canvas, sx, sy, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.walls.canvas, sx, sy);

    ctx.setTransform(scale, 0, 0, scale, sx, sy);
    this.drawOpenings(now);
    this.drawDesk(now);
    for (const fixture of game.fixtures) this.drawFixture(fixture, now);
    this.drawRings(now);
    for (const enemy of game.enemies) this.drawEnemy(enemy, now, dt, frozen);
    this.drawParticles(frozen ? 0 : dt);
    this.drawBolts(now);
    this.drawFlights(now);
    this.drawFloaters(frozen ? 0 : dt);
    this.drawAim(now);

    // Post: vignette, and the router's pain.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.shade.canvas, 0, 0);
    const low = game.running && game.health <= 2;
    const hurt = Math.max(0, (this.hurtUntil - now) / 900);
    if (low || hurt > 0) {
      const pulse = low ? 0.1 + 0.07 * Math.sin(now / 240) : 0;
      const g = ctx.createRadialGradient(this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.3, this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.95);
      g.addColorStop(0, 'rgba(255,40,30,0)');
      g.addColorStop(1, `rgba(255,40,30,${(pulse + hurt * 0.45).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (now < this.glitchUntil && !this.reducedMotion) {
      // Tear a few horizontal bands sideways, like a stream losing sync.
      for (let i = 0; i < 7; i++) {
        const y = Math.random() * this.canvas.height;
        const h = 4 + Math.random() * 26 * scale;
        const dx = (Math.random() - 0.5) * 60 * scale;
        ctx.drawImage(this.canvas, 0, y, this.canvas.width, h, dx, y, this.canvas.width, h);
      }
    }
  }

  private drawLightMap(): void {
    const { ctx, canvas } = this.glow;
    const s = canvas.width / W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(this.ambient, 1);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.globalCompositeOperation = 'lighter';

    for (const light of this.game.lights) {
      if (light.level < 0.01) continue;
      const { emitter } = light;
      const rgb = lit(tint(light.color), 1);
      const power = light.level ** 0.8;
      ctx.save();
      ctx.beginPath();
      const reach = emitter.reach;
      for (let i = 0; i < reach.length; i++) {
        const p = reach[i]!;
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.clip();
      let g: CanvasGradient;
      if (emitter.kind === 'zone') {
        g = ctx.createLinearGradient(0, STRIP.y, 0, STRIP.y - emitter.radius);
        g.addColorStop(0, rgba(rgb, 0.5 * power));
        g.addColorStop(1, rgba(rgb, 0));
      } else {
        g = ctx.createRadialGradient(emitter.at.x, emitter.at.y, 0, emitter.at.x, emitter.at.y, emitter.radius);
        const peak = emitter.kind === 'bulb' ? 1 : 0.85;
        g.addColorStop(0, rgba(rgb, peak * power));
        g.addColorStop(0.4, rgba(rgb, peak * 0.62 * power));
        g.addColorStop(1, rgba(rgb, 0));
      }
      ctx.fillStyle = g;
      ctx.fillRect(emitter.at.x - emitter.radius - 30, emitter.at.y - emitter.radius - 30, emitter.radius * 2 + 60, emitter.radius * 2 + 60);
      ctx.restore();
    }
  }

  private drawOpenings(now: number): void {
    const { ctx, game } = this;
    if (!game.running) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const enemy of game.enemies) {
      if (enemy.age > 1.2) continue;
      const start = enemy.path[0];
      if (!start) continue;
      const rgb = HUE_RGB[enemy.hue] ?? AMBER;
      const g = ctx.createRadialGradient(start.x, start.y, 0, start.x, start.y, 90);
      g.addColorStop(0, rgba(rgb, 0.5 * (1 - enemy.age / 1.2)));
      g.addColorStop(1, rgba(rgb, 0));
      ctx.fillStyle = g;
      ctx.fillRect(start.x - 90, start.y - 90, 180, 180);
    }
    ctx.globalCompositeOperation = 'source-over';
    void now;
  }

  private drawDesk(now: number): void {
    const { ctx, game } = this;
    // Laptop: the machine the library runs on.
    ctx.fillStyle = '#20232f';
    ctx.beginPath(); ctx.roundRect(LAPTOP.x - 26, LAPTOP.y - 18, 52, 36, 4); ctx.fill();
    ctx.fillStyle = '#0d0f16';
    ctx.fillRect(LAPTOP.x - 22, LAPTOP.y - 14, 44, 24);
    ctx.fillStyle = rgba(AMBER, 0.95);
    ctx.font = `600 ${Math.max(7, 6.5 * this.unit)}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('lifxlan', LAPTOP.x, LAPTOP.y - 2);
    ctx.globalCompositeOperation = 'lighter';
    const screen = ctx.createRadialGradient(LAPTOP.x, LAPTOP.y, 0, LAPTOP.x, LAPTOP.y, 70);
    screen.addColorStop(0, rgba(AMBER, 0.2));
    screen.addColorStop(1, rgba(AMBER, 0));
    ctx.fillStyle = screen;
    ctx.fillRect(LAPTOP.x - 70, LAPTOP.y - 70, 140, 140);
    ctx.globalCompositeOperation = 'source-over';

    // Router: what the shades are after. Its rings are its signal.
    const alive = game.health / game.maxHealth;
    const ok: Rgb = alive > 0.6 ? [120, 230, 150] : alive > 0.3 ? AMBER : RED;
    ctx.fillStyle = '#e9ecf2';
    ctx.beginPath(); ctx.roundRect(ROUTER.x - 20, ROUTER.y - 13, 40, 26, 6); ctx.fill();
    ctx.strokeStyle = '#7d8598';
    ctx.lineWidth = 2;
    for (const dx of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(ROUTER.x + dx, ROUTER.y - 13); ctx.lineTo(ROUTER.x + dx * 1.5, ROUTER.y - 26); ctx.stroke(); }
    const blink = now - this.routerBusy < 90;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i === 0 ? rgba(ok, 1) : blink && i % 2 === Math.floor(now / 60) % 2 ? rgba(AMBER, 1) : '#aab1bf';
      ctx.fillRect(ROUTER.x - 14 + i * 8, ROUTER.y + 3, 4, 4);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < game.maxHealth; i++) {
      if (i >= game.health) break;
      const phase = ((now / 1400) + i / game.maxHealth) % 1;
      ctx.strokeStyle = rgba(ok, 0.34 * (1 - phase));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ROUTER.x, ROUTER.y, 24 + phase * 62, 0, TAU);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    void DESK;
  }

  private lightsOf(serial: string): Light[] {
    return this.game.lights.filter((light) => light.emitter.serial === serial);
  }

  private drawFixture(fixture: Fixture, now: number): void {
    const { ctx, game } = this;
    const device = this.fleet.find((candidate) => candidate.spec.serial === fixture.serial);
    if (!device) return;
    // Hardware that has not been plugged in yet is just dark; a light that lost power, or one nobody has discovered, says so.
    const status = !game.introduced(fixture.serial) || !game.running ? 'ready' : game.status(fixture.serial);
    const lights = this.lightsOf(fixture.serial);
    const heard = now - (this.heard.get(device.endpoint.address) ?? -1e9) < 140;

    if (fixture.kind === 'bulb') {
      const light = lights[0];
      const { at } = fixture;
      if (light && light.level > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, 74);
        g.addColorStop(0, rgba(tint(light.color), 0.75 * light.level));
        g.addColorStop(1, rgba(tint(light.color), 0));
        ctx.fillStyle = g;
        ctx.fillRect(at.x - 74, at.y - 74, 148, 148);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = '#171a24';
      ctx.beginPath(); ctx.arc(at.x, at.y, 18, 0, TAU); ctx.fill();
      ctx.fillStyle = light ? surface(light.color, light.level) : rgba(OFF_GLASS, 1);
      ctx.beginPath(); ctx.arc(at.x, at.y, 12.5, 0, TAU); ctx.fill();
      if (light && light.level > 0.3) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.arc(at.x, at.y, 5, 0, TAU); ctx.fill();
      }
      this.drawStatus(at, 26, status, heard, now);
      this.drawCooldown(fixture, at, 23, now);
    } else if (fixture.kind === 'strip') {
      const n = lights.length;
      const width = STRIP.length / Math.max(1, n);
      ctx.fillStyle = '#0b0d13';
      ctx.fillRect(STRIP.x - 4, STRIP.y - 3, STRIP.length + 8, 15);
      for (const light of lights) {
        const x = STRIP.x + light.emitter.index * width;
        ctx.fillStyle = surface(light.color, light.level);
        ctx.fillRect(x + 0.8, STRIP.y, width - 1.6, 9);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const light of lights) {
        if (light.level < 0.02 || light.emitter.index % 2) continue;
        const x = STRIP.x + (light.emitter.index + 1) * width;
        const g = ctx.createRadialGradient(x, STRIP.y + 4, 0, x, STRIP.y + 4, 46);
        g.addColorStop(0, rgba(tint(light.color), 0.4 * light.level));
        g.addColorStop(1, rgba(tint(light.color), 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - 46, STRIP.y - 42, 92, 92);
      }
      ctx.globalCompositeOperation = 'source-over';
      // Ticks between the sections a click colours.
      ctx.fillStyle = '#737b90';
      for (let s = 1; s < n / 8; s++) ctx.fillRect(STRIP.x + s * 8 * width - 1, STRIP.y - 6, 2, 18);
      this.drawStatus({ x: STRIP.x - 22, y: STRIP.y + 4 }, 12, status, heard, now);
      this.drawCooldown(fixture, { x: STRIP.x + STRIP.length + 22, y: STRIP.y + 4 }, 10, now);
    } else {
      const frame = device.frame(now);
      device.tileLayout.forEach((_, tile) => {
        const corner = tileCorner(device, tile);
        ctx.fillStyle = '#0b0d13';
        ctx.fillRect(corner.x - 3, corner.y - 3, TILE_SIZE + 6, TILE_SIZE + 6);
        const cell = TILE_SIZE / 8;
        for (let i = 0; i < 64; i++) {
          const c = frame.colors[tile * 64 + i];
          if (!c) continue;
          ctx.fillStyle = surface(c, (c.brightness / 65535) * frame.power);
          ctx.fillRect(corner.x + (i % 8) * cell + 0.6, corner.y + Math.floor(i / 8) * cell + 0.6, cell - 1.2, cell - 1.2);
        }
      });
      const top = tileCorner(device, 1);
      this.drawStatus({ x: top.x - 16, y: top.y + 8 }, 10, status, heard, now);
      this.drawCooldown(fixture, { x: top.x + TILE_SIZE + 16, y: top.y + 8 }, 10, now);
    }

    if (this.selected === fixture.serial && game.phase === 'sandbox') {
      const xs = fixture.targets.map((target) => target.area);
      const x0 = Math.min(...xs.map((r) => r.x)) - 6;
      const y0 = Math.min(...xs.map((r) => r.y)) - 6;
      const x1 = Math.max(...xs.map((r) => r.x + r.w)) + 6;
      const y1 = Math.max(...xs.map((r) => r.y + r.h)) + 6;
      ctx.strokeStyle = rgba(AMBER, 0.95);
      ctx.lineWidth = 2 * this.unit;
      const k = 14;
      ctx.beginPath();
      for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
        ctx.moveTo(cx! + dx! * k, cy!); ctx.lineTo(cx!, cy!); ctx.lineTo(cx!, cy! + dy! * k);
      }
      ctx.stroke();
    }
  }

  /** A device with no power, or one the library has not discovered, says so. */
  private drawStatus(at: Vec, radius: number, status: 'unplugged' | 'unknown' | 'ready', heard: boolean, now: number): void {
    const { ctx } = this;
    if (status === 'ready') {
      if (heard) {
        ctx.fillStyle = rgba(CYAN, 0.95);
        ctx.beginPath(); ctx.arc(at.x + radius * 0.8, at.y - radius * 0.8, 3 * this.unit, 0, TAU); ctx.fill();
      }
      return;
    }
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.lineWidth = 2 * this.unit;
    if (status === 'unknown') {
      ctx.rotate(now / 900);
      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = rgba(AMBER, 0.95);
      ctx.beginPath(); ctx.arc(0, 0, radius + 4, 0, TAU); ctx.stroke();
      ctx.rotate(-now / 900);
      ctx.setLineDash([]);
      ctx.fillStyle = rgba(AMBER, 1);
      ctx.font = `700 ${13 * this.unit}px "IBM Plex Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', radius + 14 * this.unit, -radius);
    } else {
      ctx.strokeStyle = 'rgba(150,160,190,0.7)';
      ctx.beginPath(); ctx.arc(0, 0, radius + 4, 0, TAU); ctx.moveTo(-radius, radius); ctx.lineTo(radius, -radius); ctx.stroke();
    }
    ctx.restore();
  }

  private drawCooldown(fixture: Fixture, at: Vec, radius: number, now: number): void {
    const { ctx, game } = this;
    if (!game.running || !game.abilitiesUnlocked || game.status(fixture.serial) !== 'ready') return;
    const cooling = game.cooldown(fixture.serial);
    ctx.lineWidth = 3 * this.unit;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.arc(at.x, at.y, radius, 0, TAU); ctx.stroke();
    if (cooling > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(at.x, at.y, radius, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - cooling)); ctx.stroke();
    } else {
      ctx.strokeStyle = `rgba(255,255,255,${(0.55 + 0.4 * Math.sin(now / 220)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(at.x, at.y, radius, 0, TAU); ctx.stroke();
    }
  }

  private drawEnemy(enemy: Enemy, now: number, dt: number, frozen: boolean): void {
    const { ctx } = this;
    const { type, at } = enemy;
    const rgb = HUE_RGB[enemy.hue] ?? AMBER;
    const t = now / 1000 + enemy.seed;
    const hp = Math.max(0, enemy.hp / type.hp);
    const grow = Math.min(1, enemy.age * 3);
    const r = type.size * (0.72 + 0.28 * hp) * grow;
    const shifting = type.shift > 0 && enemy.shiftIn < 0.9 && Math.floor(now / 90) % 2 === 0;

    // Afterimages for the quick and the slow.
    if (enemy.kind === 'runner' || enemy.kind === 'leech') {
      for (let k = 3; k >= 1; k--) {
        ctx.fillStyle = `rgba(3,4,10,${0.22 / k})`;
        ctx.beginPath();
        ctx.arc(at.x - enemy.heading.x * r * k * (enemy.kind === 'leech' ? 1.5 : 0.95), at.y - enemy.heading.y * r * k * (enemy.kind === 'leech' ? 1.5 : 0.95), r * (1 - k * 0.14), 0, TAU);
        ctx.fill();
      }
    }

    // The body: a knot of darkness.
    ctx.fillStyle = 'rgba(3,4,10,0.92)';
    const lobes = enemy.kind === 'outage' ? 11 : enemy.kind === 'brute' ? 8 : 6;
    ctx.beginPath();
    ctx.arc(at.x, at.y, r * 0.86, 0, TAU);
    ctx.fill();
    for (let k = 0; k < lobes; k++) {
      const angle = enemy.seed + k * (TAU / lobes) + Math.sin(t * 1.7 + k) * 0.5;
      const reach = r * (0.5 + 0.16 * Math.sin(t * 2.3 + k * 1.7));
      ctx.beginPath();
      ctx.arc(at.x + Math.cos(angle) * reach, at.y + Math.sin(angle) * reach, r * 0.52, 0, TAU);
      ctx.fill();
    }

    // A faint rim so it can be made out in the dark, and its colour burning in the core.
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(shifting ? [255, 255, 255] : rgb, 0.3 + 0.5 * enemy.burn);
    ctx.lineWidth = 1.6 * this.unit;
    ctx.beginPath(); ctx.arc(at.x, at.y, r * 1.04, 0, TAU); ctx.stroke();
    const core = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, r * (1.5 + enemy.burn));
    core.addColorStop(0, rgba(rgb, 0.5 + 0.4 * enemy.burn));
    core.addColorStop(0.5, rgba(rgb, 0.12 + 0.3 * enemy.burn));
    core.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = core;
    ctx.fillRect(at.x - r * 3, at.y - r * 3, r * 6, r * 6);

    // Eyes, looking where it is going.
    const hx = enemy.heading.x, hy = enemy.heading.y;
    const eyes = enemy.kind === 'brute' || enemy.kind === 'outage' ? [-0.42, 0, 0.42] : [-0.3, 0.3];
    for (const side of eyes) {
      const ex = at.x + hx * r * 0.34 - hy * r * side;
      const ey = at.y + hy * r * 0.34 + hx * r * side;
      ctx.fillStyle = rgba(shifting ? [255, 255, 255] : rgb, 1);
      ctx.beginPath(); ctx.arc(ex, ey, Math.max(1.6 * this.unit, r * 0.15), 0, TAU); ctx.fill();
    }

    if (enemy.kind === 'jammer') {
      // Static: broken arcs of noise.
      ctx.strokeStyle = 'rgba(230,236,255,0.6)';
      ctx.lineWidth = 1.3 * this.unit;
      for (let k = 0; k < 7; k++) {
        const a = Math.random() * TAU;
        const d = r * (1.3 + Math.random() * 0.9);
        ctx.beginPath();
        ctx.moveTo(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d);
        ctx.lineTo(at.x + Math.cos(a + 0.25) * (d + 5), at.y + Math.sin(a + 0.25) * (d + 5));
        ctx.stroke();
      }
    } else if (enemy.kind === 'leech') {
      ctx.strokeStyle = 'rgba(200,215,255,0.5)';
      ctx.lineWidth = 1.4 * this.unit;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.arc(at.x, at.y, r * (1.35 + k * 0.4), t * (k ? -0.9 : 0.6), t * (k ? -0.9 : 0.6) + 2.1);
        ctx.stroke();
      }
    } else if (enemy.kind === 'prism' || enemy.kind === 'outage') {
      // A crown of every colour it might become.
      const n = HUE_RGB.length;
      for (let k = 0; k < n; k++) {
        const a = t * 0.9 + (k / n) * TAU;
        ctx.fillStyle = rgba(HUE_RGB[k] ?? AMBER, k === enemy.hue ? 1 : 0.4);
        ctx.beginPath();
        ctx.arc(at.x + Math.cos(a) * r * 1.42, at.y + Math.sin(a) * r * 1.42, (k === enemy.hue ? 3.4 : 2.2) * this.unit, 0, TAU);
        ctx.fill();
      }
    }
    if (enemy.stun > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.5 * this.unit;
      ctx.setLineDash([3 * this.unit, 5 * this.unit]);
      ctx.beginPath(); ctx.arc(at.x, at.y, r * 1.3, t * 4, t * 4 + TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (hp < 0.995) {
      ctx.strokeStyle = rgba(rgb, 0.95);
      ctx.lineWidth = 2.4 * this.unit;
      ctx.beginPath(); ctx.arc(at.x, at.y, r * 1.2 + 3 * this.unit, -Math.PI / 2, -Math.PI / 2 + TAU * hp); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // The key that loads its colour.
    const key = this.game.palette.indexOf(enemy.hue) + 1;
    if (key > 0 && enemy.kind !== 'outage') {
      ctx.font = `700 ${10.5 * this.unit}px "IBM Plex Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const ly = at.y - r * 1.25 - 9 * this.unit;
      ctx.fillStyle = rgba(rgb, 1);
      ctx.beginPath(); ctx.arc(at.x, ly, 7.5 * this.unit, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(5,6,10,0.92)';
      ctx.fillText(String(key), at.x, ly + 0.5 * this.unit);
    }

    if (!frozen && enemy.stun <= 0 && Math.random() < dt * 14) {
      // Shreds of darkness left behind as it moves.
      this.particles.push({
        x: at.x - enemy.heading.x * r * 0.7 + (Math.random() - 0.5) * r, y: at.y - enemy.heading.y * r * 0.7 + (Math.random() - 0.5) * r,
        vx: -enemy.heading.x * 14, vy: -enemy.heading.y * 14,
        life: 0, ttl: 0.5 + Math.random() * 0.5, size: r * (0.3 + Math.random() * 0.3), rgb: [3, 4, 10], drag: 1, smoke: true,
      });
    }
    if (!frozen && enemy.burn > 0.04 && Math.random() < enemy.burn * dt * 70) {
      const angle = Math.random() * TAU;
      this.particles.push({
        x: at.x + Math.cos(angle) * r * 0.6, y: at.y + Math.sin(angle) * r * 0.6,
        vx: Math.cos(angle) * 46, vy: Math.sin(angle) * 46 - 20,
        life: 0, ttl: 0.3 + Math.random() * 0.45, size: 1.4 + Math.random() * 2, rgb, drag: 1.5,
      });
    }
  }

  private drawParticles(dt: number): void {
    const { ctx } = this;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt;
      if (p.life >= p.ttl) {
        this.particles.splice(i, 1);
        continue;
      }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag; p.vy *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const k = 1 - p.life / p.ttl;
      ctx.globalCompositeOperation = p.smoke ? 'source-over' : 'lighter';
      ctx.fillStyle = rgba(p.rgb, p.smoke ? k * 0.5 : k);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawRings(now: number): void {
    const { ctx } = this;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i]!;
      // Events are stamped with performance.now(), which can be a hair ahead of the frame's timestamp.
      const t = Math.max(0, (now - ring.start) / ring.duration);
      if (t >= 1) { this.rings.splice(i, 1); continue; }
      ctx.strokeStyle = rgba(ring.rgb, 0.7 * (1 - t));
      ctx.lineWidth = (1 + 3 * (1 - t)) * this.unit;
      ctx.beginPath(); ctx.arc(ring.at.x, ring.at.y, ring.radius * (1 - (1 - t) ** 2.2), 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawBolts(now: number): void {
    const { ctx } = this;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const bolt = this.bolts[i]!;
      const t = Math.max(0, (now - bolt.start) / 520);
      if (t >= 1) { this.bolts.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(190,205,255,${(1 - t).toFixed(3)})`;
      ctx.lineWidth = 2.4 * this.unit;
      ctx.beginPath();
      ctx.moveTo(bolt.from.x, bolt.from.y);
      for (let k = 1; k <= 9; k++) {
        const u = k / 9;
        const jitter = k === 9 ? 0 : (Math.random() - 0.5) * 46;
        ctx.lineTo(bolt.from.x + (bolt.to.x - bolt.from.x) * u + jitter, bolt.from.y + (bolt.to.y - bolt.from.y) * u + jitter);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawFlights(now: number): void {
    const { ctx } = this;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i]!;
      const t = Math.max(0, (now - f.start) / f.duration);
      if (t >= 1 || (this.reducedMotion && t > 0.05)) { this.flights.splice(i, 1); continue; }
      const length = Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y) || 1;
      const nx = -(f.to.y - f.from.y) / length;
      const ny = (f.to.x - f.from.x) / length;
      const end = f.lost ? 0.55 : 1;
      const at = (u: number): Vec => {
        const k = Math.max(0, Math.min(u, end));
        const arc = Math.sin(k * Math.PI) * f.bend;
        return { x: f.from.x + (f.to.x - f.from.x) * k + nx * arc, y: f.from.y + (f.to.y - f.from.y) * k + ny * arc };
      };
      const rgb = f.outbound ? AMBER : CYAN;
      if (f.lost && t > end) {
        const p = at(end);
        const fade = (t - end) / (1 - end);
        ctx.strokeStyle = rgba(RED, 1 - fade);
        ctx.lineWidth = 2 * this.unit;
        const k = (5 + fade * 6) * this.unit;
        ctx.beginPath();
        ctx.moveTo(p.x - k, p.y - k); ctx.lineTo(p.x + k, p.y + k);
        ctx.moveTo(p.x + k, p.y - k); ctx.lineTo(p.x - k, p.y + k);
        ctx.stroke();
        continue;
      }
      // A streak: bright head, fading tail.
      const head = at(t);
      const tail = at(t - 0.16);
      const g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      g.addColorStop(0, rgba(rgb, 0));
      g.addColorStop(1, rgba(rgb, 0.95));
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.6 * this.unit;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
      ctx.fillStyle = rgba([255, 255, 255], 0.9);
      ctx.beginPath(); ctx.arc(head.x, head.y, 2.2 * this.unit, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawFloaters(dt: number): void {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!;
      f.life += dt;
      if (f.life >= f.ttl) { this.floaters.splice(i, 1); continue; }
      const k = f.life / f.ttl;
      ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) * 4;
      ctx.font = `600 ${f.size * this.unit}px "IBM Plex Mono", ui-monospace, monospace`;
      const y = f.y - f.rise * (1 - (1 - k) ** 2) * this.unit * 0.6;
      ctx.lineWidth = 3 * this.unit;
      ctx.strokeStyle = 'rgba(4,5,10,0.85)';
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
  }

  /** What the pointer is aiming at, and the colour loaded. */
  private drawAim(now: number): void {
    const { ctx, game } = this;
    const loaded = HUE_RGB[game.loaded] ?? AMBER;
    const target = this.hover;
    const aiming = game.running && !game.paused;
    if (target && (aiming || game.phase === 'sandbox')) {
      const { x, y, w, h } = target.area;
      ctx.strokeStyle = rgba(aiming ? loaded : AMBER, 0.75 + 0.25 * Math.sin(now / 130));
      ctx.lineWidth = 2 * this.unit;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.stroke();
      const device = this.fleet.find((candidate) => candidate.spec.serial === target.serial);
      if (device) {
        ctx.font = `500 ${10.5 * this.unit}px "IBM Plex Mono", ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const label = `${target.kind === 'bulb' ? device.currentLabel : target.name.replace(device.spec.label, device.currentLabel)} · ${device.endpoint.address}`;
        ctx.lineWidth = 3 * this.unit;
        ctx.strokeStyle = 'rgba(4,5,10,0.85)';
        const ly = Math.max(60, y - 6 * this.unit);
        ctx.strokeText(label, target.at.x, ly);
        ctx.fillStyle = 'rgba(232,236,246,0.95)';
        ctx.fillText(label, target.at.x, ly);
      }
    }
    const p = this.pointer;
    if (!p || !aiming) return;
    const prey = target ? undefined : this.enemyAt(p);
    const rgb = prey ? HUE_RGB[prey.hue] ?? loaded : loaded;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(rgb, 0.95);
    ctx.lineWidth = 2.2 * this.unit;
    const r = (prey ? 17 : 12) * this.unit;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(rgb, 1);
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.4 * this.unit, 0, TAU); ctx.fill();
    ctx.beginPath();
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      ctx.moveTo(p.x + Math.cos(a) * (r + 3 * this.unit), p.y + Math.sin(a) * (r + 3 * this.unit));
      ctx.lineTo(p.x + Math.cos(a) * (r + 8 * this.unit), p.y + Math.sin(a) * (r + 8 * this.unit));
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
}
