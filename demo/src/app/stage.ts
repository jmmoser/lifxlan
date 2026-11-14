/**
 * The room: a canvas that draws what each simulated device is emitting,
 * and the datagrams in flight between them and the laptop running the
 * library. It reads device output only — nothing here knows what the
 * controls asked for, so a light changes on screen only if a packet reached
 * its device and the device acted on it.
 */
import type { Color } from '../../../src/index.js';
import type { VirtualDevice } from '../sim/firmware.js';
import type { Endpoint, LanEvent, VirtualLan } from '../sim/lan.js';
import { rgba, tint } from './color.js';
import type { Rgb } from './color.js';

/** The scene is laid out on a fixed grid and scaled to the canvas. */
const W = 1000;
const H = 540;

const LAPTOP = { x: 300, y: 372 };
const STRIP = { x: 78, y: 236, width: 384, height: 9 };
const TILE = { x: 548, y: 52, size: 74, pitch: 79 };

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Flight {
  from: { x: number; y: number };
  to: { x: number; y: number };
  start: number;
  duration: number;
  lost: boolean;
  outbound: boolean;
}

export interface StageHit {
  serial: string;
  /** The zone or tile pixel under the pointer, when there is one. */
  index: number | undefined;
}

export interface StageHandlers {
  select(serial: string): void;
  /** A drag across the selected strip or tile chain. */
  paint(serial: string, index: number): void;
}

const WALL: Rgb = [24, 26, 36];
const OFF_GLASS: Rgb = [58, 61, 74];

const level = (c: Color, power: number): number => Math.max(0, Math.min(1, (c.brightness / 65535) * power));

/** The color a lit surface shows: dark glass when off, the tint as it brightens. */
function surface(c: Color, power: number): string {
  const v = level(c, power) ** 0.55;
  const [r, g, b] = tint(c);
  return rgba([OFF_GLASS[0] + (r - OFF_GLASS[0]) * v, OFF_GLASS[1] + (g - OFF_GLASS[1]) * v, OFF_GLASS[2] + (b - OFF_GLASS[2]) * v], 1);
}

export class Stage {
  readonly canvas: HTMLCanvasElement;
  selected: string | undefined;

  private readonly ctx: CanvasRenderingContext2D;
  private readonly fleet: readonly VirtualDevice[];
  private readonly controller: Endpoint;
  private readonly handlers: StageHandlers;
  private readonly flights: Flight[] = [];
  private readonly activity = new Map<string, number>();
  private scale = 1;
  private painting = false;
  private lastPainted: number | undefined;
  private reducedMotion = false;

  constructor(fleet: readonly VirtualDevice[], lan: VirtualLan, controller: Endpoint, handlers: StageHandlers) {
    this.fleet = fleet;
    this.controller = controller;
    this.handlers = handlers;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stage-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'A room with two lamps, a light strip under a shelf, and five light tiles on the wall, showing the simulated devices\' current output.');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2D is not available');
    this.ctx = ctx;

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    lan.observe((event) => this.onLan(event));

    this.canvas.addEventListener('pointerdown', (event) => this.onPointer(event, true));
    this.canvas.addEventListener('pointermove', (event) => { if (this.painting) this.onPointer(event, false); });
    const stop = () => { this.painting = false; this.lastPainted = undefined; };
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);
    this.canvas.addEventListener('pointerleave', stop);

    new ResizeObserver(() => this.resize()).observe(this.canvas);
    this.resize();
    const loop = () => {
      this.draw(performance.now());
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private resize(): void {
    const width = this.canvas.clientWidth || 600;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(width * (H / W) * ratio);
    this.scale = this.canvas.width / W;
  }

  /* ---------------------------------------------------------------- */
  /* Geometry                                                          */
  /* ---------------------------------------------------------------- */

  private bulbCenter(device: VirtualDevice): { x: number; y: number } {
    const index = this.fleet.filter((d) => d.spec.kind === 'bulb').indexOf(device);
    return index === 0 ? { x: 150, y: 322 } : { x: 868, y: 262 };
  }

  private tileBox(device: VirtualDevice, tile: number): Box {
    const at = device.tileLayout[tile] ?? { x: tile, y: 0 };
    return { x: TILE.x + at.x * TILE.pitch, y: TILE.y + at.y * TILE.pitch, w: TILE.size, h: TILE.size };
  }

  private bounds(device: VirtualDevice): Box {
    if (device.spec.kind === 'strip') return { x: STRIP.x - 8, y: STRIP.y - 10, w: STRIP.width + 16, h: STRIP.height + 20 };
    if (device.spec.kind === 'tiles') {
      const boxes = device.tileLayout.map((_, i) => this.tileBox(device, i));
      const x = Math.min(...boxes.map((b) => b.x));
      const y = Math.min(...boxes.map((b) => b.y));
      return { x: x - 8, y: y - 8, w: Math.max(...boxes.map((b) => b.x + b.w)) - x + 16, h: Math.max(...boxes.map((b) => b.y + b.h)) - y + 16 };
    }
    const c = this.bulbCenter(device);
    return { x: c.x - 42, y: c.y - 46, w: 84, h: 92 };
  }

  private anchor(device: VirtualDevice): { x: number; y: number } {
    if (device.spec.kind === 'bulb') return this.bulbCenter(device);
    const b = this.bounds(device);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }

  private point(endpoint: Endpoint): { x: number; y: number } | undefined {
    if (endpoint.address === this.controller.address) return LAPTOP;
    const device = this.fleet.find((d) => d.spec.address === endpoint.address);
    return device ? this.anchor(device) : undefined;
  }

  /** What is under a point of the scene grid. */
  private hit(x: number, y: number): StageHit | undefined {
    for (const device of this.fleet) {
      const b = this.bounds(device);
      if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
      const serial = device.spec.serial;
      if (device.spec.kind === 'strip') {
        const zone = Math.floor(((x - STRIP.x) / STRIP.width) * device.pixelCount);
        return { serial, index: Math.max(0, Math.min(device.pixelCount - 1, zone)) };
      }
      if (device.spec.kind === 'tiles') {
        for (let tile = 0; tile < device.tileLayout.length; tile++) {
          const t = this.tileBox(device, tile);
          if (x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h) {
            const px = Math.min(7, Math.floor(((x - t.x) / t.w) * 8));
            const py = Math.min(7, Math.floor(((y - t.y) / t.h) * 8));
            return { serial, index: tile * 64 + py * 8 + px };
          }
        }
        return { serial, index: undefined };
      }
      return { serial, index: undefined };
    }
    return undefined;
  }

  private onPointer(event: PointerEvent, down: boolean): void {
    const rect = this.canvas.getBoundingClientRect();
    const hit = this.hit(((event.clientX - rect.left) / rect.width) * W, ((event.clientY - rect.top) / rect.height) * H);
    if (!hit) return;
    if (down) {
      if (hit.serial !== this.selected) {
        this.handlers.select(hit.serial);
        return;
      }
      this.painting = true;
      this.canvas.setPointerCapture(event.pointerId);
    }
    if (hit.serial === this.selected && hit.index !== undefined && hit.index !== this.lastPainted) {
      this.lastPainted = hit.index;
      this.handlers.paint(hit.serial, hit.index);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Packets in flight                                                 */
  /* ---------------------------------------------------------------- */

  private onLan(event: LanEvent): void {
    if (event.kind === 'deliver') {
      this.activity.set(event.to.address, performance.now());
      return;
    }
    const from = this.point(event.datagram.from);
    if (!from) return;
    for (const hop of event.hops) {
      const to = this.point(hop.to);
      if (!to) continue;
      // Short hops are stretched so the eye can follow them; long ones play at their real length.
      this.flights.push({
        from, to, start: performance.now(), duration: Math.max(hop.delayMs, 170), lost: hop.lost,
        outbound: event.datagram.from.address === this.controller.address,
      });
    }
    if (this.flights.length > 400) this.flights.splice(0, this.flights.length - 400);
  }

  /* ---------------------------------------------------------------- */
  /* Drawing                                                           */
  /* ---------------------------------------------------------------- */

  private glow(x: number, y: number, radius: number, rgb: Rgb, alpha: number): void {
    if (alpha <= 0.004) return;
    const g = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, rgba(rgb, alpha));
    g.addColorStop(0.45, rgba(rgb, alpha * 0.35));
    g.addColorStop(1, rgba(rgb, 0));
    this.ctx.fillStyle = g;
    this.ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  private draw(now: number): void {
    const { ctx } = this;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // Wall and floor.
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, rgba([WALL[0] - 6, WALL[1] - 6, WALL[2] - 6], 1));
    wall.addColorStop(1, rgba(WALL, 1));
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#12131b';
    ctx.fillRect(0, 448, W, H - 448);
    ctx.fillStyle = '#2b2e3d';
    ctx.fillRect(0, 446, W, 3);

    const frames = this.fleet.map((device) => ({ device, frame: device.frame(now) }));

    // Light thrown on the room, added up.
    ctx.globalCompositeOperation = 'lighter';
    for (const { device, frame } of frames) {
      if (device.spec.kind === 'bulb') {
        const c = frame.colors[0];
        if (!c) continue;
        const at = this.bulbCenter(device);
        const v = level(c, frame.power);
        this.glow(at.x, at.y, 330, tint(c), 0.5 * v);
        this.glow(at.x, at.y, 110, tint(c), 0.45 * v);
      } else if (device.spec.kind === 'strip') {
        const n = frame.colors.length;
        for (let i = 0; i < n; i += 2) {
          const c = frame.colors[i]!;
          this.glow(STRIP.x + ((i + 1) / n) * STRIP.width, STRIP.y + 26, 88, tint(c), 0.2 * level(c, frame.power));
        }
      } else {
        device.tileLayout.forEach((_, tile) => {
          const box = this.tileBox(device, tile);
          // The average of four pixels is close enough for a tile's wash on the wall.
          let r = 0, g = 0, b = 0, v = 0;
          for (const i of [9, 14, 49, 54, 27, 36]) {
            const c = frame.colors[tile * 64 + i];
            if (!c) continue;
            const t = tint(c);
            const l = level(c, frame.power);
            r += t[0] * l; g += t[1] * l; b += t[2] * l; v += l;
          }
          if (v > 0) this.glow(box.x + box.w / 2, box.y + box.h / 2, 120, [r / v, g / v, b / v], 0.3 * (v / 6));
        });
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    this.drawFurniture();

    for (const { device, frame } of frames) {
      if (device.spec.kind === 'bulb') this.drawBulb(device, frame.colors[0], frame.power);
      else if (device.spec.kind === 'strip') this.drawStrip(frame.colors, frame.power);
      else this.drawTiles(device, frame.colors, frame.power);
    }

    this.drawLabels(now);
    this.drawFlights(now);
  }

  private drawFurniture(): void {
    const { ctx } = this;
    const dark = '#0c0d13';
    const edge = '#34384a';

    // Shelf with a few things on it; the strip runs under its front edge.
    ctx.fillStyle = dark;
    for (const [x, w, h2] of [[104, 14, 56], [120, 18, 70], [140, 12, 48], [154, 16, 62], [300, 44, 30], [392, 22, 52], [416, 14, 40]]) {
      ctx.fillRect(x!, 222 - h2!, w!, h2!);
    }
    ctx.fillStyle = '#1b1d28';
    ctx.fillRect(62, 222, 416, 12);
    ctx.fillStyle = edge;
    ctx.fillRect(62, 222, 416, 1.5);

    // Desk.
    ctx.fillStyle = '#1b1d28';
    ctx.fillRect(48, 398, 392, 12);
    ctx.fillStyle = edge;
    ctx.fillRect(48, 398, 392, 1.5);
    ctx.fillStyle = dark;
    ctx.fillRect(66, 410, 10, 38);
    ctx.fillRect(412, 410, 10, 38);

    // Desk lamp: base, arm, shade.
    ctx.strokeStyle = '#3a3e52';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(196, 396);
    ctx.lineTo(214, 330);
    ctx.lineTo(172, 296);
    ctx.stroke();
    ctx.fillStyle = '#2a2d3c';
    ctx.fillRect(176, 390, 44, 8);

    // Floor lamp: base, pole.
    ctx.beginPath();
    ctx.moveTo(868, 446);
    ctx.lineTo(868, 300);
    ctx.stroke();
    ctx.fillRect(838, 440, 60, 7);

    // The laptop the library runs on.
    ctx.fillStyle = '#262938';
    ctx.beginPath();
    ctx.roundRect(264, 340, 72, 46, 4);
    ctx.fill();
    ctx.fillStyle = '#0f1118';
    ctx.fillRect(269, 345, 62, 36);
    ctx.fillStyle = '#3a3e52';
    ctx.beginPath();
    ctx.roundRect(252, 388, 96, 7, 3);
    ctx.fill();
    ctx.font = '600 9px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffb454';
    ctx.fillText('lifxlan', 300, 358);
    ctx.fillStyle = '#7d8498';
    ctx.font = '8px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillText('.1.10', 300, 371);
  }

  private drawBulb(device: VirtualDevice, c: Color | undefined, power: number): void {
    if (!c) return;
    const { ctx } = this;
    const at = this.bulbCenter(device);
    const v = level(c, power);
    const rgb = tint(c);

    // Shade above the bulb.
    ctx.fillStyle = '#2f3345';
    ctx.beginPath();
    ctx.moveTo(at.x - 16, at.y - 40);
    ctx.lineTo(at.x + 16, at.y - 40);
    ctx.lineTo(at.x + 36, at.y - 8);
    ctx.lineTo(at.x - 36, at.y - 8);
    ctx.closePath();
    ctx.fill();

    // Glass.
    const glass = ctx.createRadialGradient(at.x, at.y + 6, 2, at.x, at.y + 6, 22);
    const core: Rgb = [rgb[0] + (255 - rgb[0]) * 0.75, rgb[1] + (255 - rgb[1]) * 0.75, rgb[2] + (255 - rgb[2]) * 0.75];
    const lit = v ** 0.5;
    glass.addColorStop(0, rgba([OFF_GLASS[0] + (core[0] - OFF_GLASS[0]) * lit, OFF_GLASS[1] + (core[1] - OFF_GLASS[1]) * lit, OFF_GLASS[2] + (core[2] - OFF_GLASS[2]) * lit], 1));
    glass.addColorStop(1, surface(c, power));
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.arc(at.x, at.y + 8, 19, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawStrip(list: readonly Color[], power: number): void {
    const { ctx } = this;
    const n = list.length;
    const w = STRIP.width / n;
    ctx.fillStyle = '#0c0d13';
    ctx.fillRect(STRIP.x - 3, STRIP.y - 2, STRIP.width + 6, STRIP.height + 4);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = surface(list[i]!, power);
      ctx.fillRect(STRIP.x + i * w + 0.6, STRIP.y, w - 1.2, STRIP.height);
    }
  }

  private drawTiles(device: VirtualDevice, list: readonly Color[], power: number): void {
    const { ctx } = this;
    device.tileLayout.forEach((_, tile) => {
      const box = this.tileBox(device, tile);
      ctx.fillStyle = '#0c0d13';
      ctx.fillRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
      const cell = box.w / 8;
      for (let i = 0; i < 64; i++) {
        const c = list[tile * 64 + i];
        if (!c) continue;
        ctx.fillStyle = surface(c, power);
        ctx.fillRect(box.x + (i % 8) * cell + 0.5, box.y + Math.floor(i / 8) * cell + 0.5, cell - 1, cell - 1);
      }
    });
  }

  private drawLabels(now: number): void {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const device of this.fleet) {
      const b = this.bounds(device);
      const selected = device.spec.serial === this.selected;
      const heard = now - (this.activity.get(device.spec.address) ?? -1e9);

      if (selected) {
        // Corner brackets around the selected device.
        ctx.strokeStyle = '#ffb454';
        ctx.lineWidth = 2;
        const k = 10;
        ctx.beginPath();
        for (const [cx, cy, dx, dy] of [[b.x, b.y, 1, 1], [b.x + b.w, b.y, -1, 1], [b.x, b.y + b.h, 1, -1], [b.x + b.w, b.y + b.h, -1, -1]]) {
          ctx.moveTo(cx! + dx! * k, cy!);
          ctx.lineTo(cx!, cy!);
          ctx.lineTo(cx!, cy! + dy! * k);
        }
        ctx.stroke();
      }

      const labelY = device.spec.kind === 'strip' ? b.y + b.h + 30 : b.y + b.h + 6;
      const labelX = device.spec.kind === 'strip' ? b.x + b.w - 44 : b.x + b.w / 2;
      ctx.font = '600 12px "IBM Plex Sans", system-ui, sans-serif';
      ctx.fillStyle = selected ? '#ffd9a0' : '#c9cede';
      ctx.fillText(device.currentLabel, labelX, labelY);
      ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillStyle = '#7d8498';
      ctx.fillText(device.spec.address, labelX, labelY + 15);

      // A dot that blinks when a datagram arrives.
      if (heard < 260) {
        ctx.fillStyle = rgba([95, 208, 224], 1 - heard / 260);
        ctx.beginPath();
        ctx.arc(labelX + ctx.measureText(device.spec.address).width / 2 + 8, labelY + 20, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawFlights(now: number): void {
    const { ctx } = this;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i]!;
      const t = (now - f.start) / f.duration;
      if (t >= 1 || (this.reducedMotion && t > 0.05)) {
        this.flights.splice(i, 1);
        continue;
      }
      // A shallow arc between the two ends.
      const mx = (f.from.x + f.to.x) / 2;
      const my = Math.min(f.from.y, f.to.y) - 46;
      const end = f.lost ? 0.55 : 1;
      const at = (u: number) => {
        const k = Math.min(u, end);
        const a = (1 - k) * (1 - k), b2 = 2 * (1 - k) * k, c2 = k * k;
        return { x: a * f.from.x + b2 * mx + c2 * f.to.x, y: a * f.from.y + b2 * my + c2 * f.to.y };
      };
      const rgb: Rgb = f.outbound ? [255, 180, 84] : [95, 208, 224];
      if (f.lost && t > end) {
        // A lost datagram stops part-way and fades out as a red ring.
        const p = at(end);
        const fade = (t - end) / (1 - end);
        ctx.strokeStyle = rgba([255, 110, 96], 1 - fade);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 + fade * 9, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      for (let s = 0; s < 5; s++) {
        const p = at(Math.max(0, t - s * 0.035));
        ctx.fillStyle = rgba(rgb, 0.9 - s * 0.18);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2 - s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
