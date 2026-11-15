/**
 * The rules of the game. Shades walk toward the router; light of their own
 * colour burns them.
 *
 * What a light is doing is read from the simulated device's own output
 * (`VirtualDevice.frame()`), never from what the player asked for. A shade
 * only burns if a packet reached the device and the device acted on it — a
 * shot lost on the network changes nothing here.
 */
import { Type } from '../../../src/index.js';
import type { Color } from '../../../src/index.js';
import { hsbk } from '../app/color.js';
import type { Lamp, Session } from '../app/session.js';
import type { VirtualDevice } from '../sim/firmware.js';
import type { VirtualLan } from '../sim/lan.js';
import { ENEMIES, HUES, NIGHTS } from './waves.js';
import type { EnemyKind, EnemyType, Night } from './waves.js';
import { PATHS, ROUTER, along, inside } from './world.js';
import type { Emitter, Fixture, Target, Vec } from './world.js';

export type Phase = 'title' | 'briefing' | 'setup' | 'wave' | 'clear' | 'won' | 'lost' | 'sandbox';

/** One emitter and what it is putting out this frame. */
export interface Light {
  readonly emitter: Emitter;
  readonly color: Color;
  /** Brightness × power, 0..1. */
  readonly level: number;
  /** Hue in degrees and saturation 0..1 of the light as emitted. */
  readonly hue: number;
  readonly saturation: number;
  /** The device is running a strobe (SetWaveform): burns every colour and staggers. */
  readonly strobe: boolean;
  /** The device is running FLAME: burns every colour. */
  readonly fire: boolean;
}

export interface Enemy {
  readonly id: number;
  readonly kind: EnemyKind;
  readonly type: EnemyType;
  hue: number;
  hp: number;
  readonly path: readonly Vec[];
  distance: number;
  readonly lateral: number;
  at: Vec;
  heading: Vec;
  /** Seconds of stagger left. */
  stun: number;
  /** 0..1, how hard it is burning right now. */
  burn: number;
  /** Seconds until a prism's next change of colour. */
  shiftIn: number;
  readonly seed: number;
  age: number;
}

export interface NightStats {
  shots: number;
  confirmed: number;
  retries: number;
  failed: number;
  kills: number;
  leaks: number;
}

export type GameEvent =
  | { readonly kind: 'phase'; readonly phase: Phase }
  | { readonly kind: 'hint'; readonly text: string }
  | { readonly kind: 'spawn'; readonly enemy: Enemy }
  | { readonly kind: 'kill'; readonly enemy: Enemy; readonly points: number; readonly combo: number }
  | { readonly kind: 'routerHit'; readonly enemy: Enemy }
  | { readonly kind: 'shot'; readonly target: Target; readonly hue: number }
  | { readonly kind: 'confirmed'; readonly target: Target }
  | { readonly kind: 'failed'; readonly target: Target }
  | { readonly kind: 'retry'; readonly at: Vec; readonly attempt: number; readonly of: number; readonly gaveUp: boolean }
  | { readonly kind: 'ability'; readonly fixture: Fixture }
  | { readonly kind: 'broadcast' }
  | { readonly kind: 'scan' }
  | { readonly kind: 'load'; readonly hue: number }
  | { readonly kind: 'brownout'; readonly fixture: Fixture }
  | { readonly kind: 'restored'; readonly fixture: Fixture }
  | { readonly kind: 'shuffle'; readonly fixture: Fixture; readonly address: string }
  | { readonly kind: 'denied'; readonly at: Vec; readonly why: string };

const COOLDOWNS = { bulb: 14, strip: 22, tiles: 26 } as const;
const BASE_DPS = { bulb: 50, zone: 27, tile: 64 } as const;
/** How much a white light hurts, as a share of a matching colour. */
const WHITE_SHARE = 0.05;
const ROUTER_BARS = 5;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** How well light of `lightHue` burns a shade of `enemyHue` (degrees): 1 on the nose, 0 a colour away. */
export function hueMatch(lightHue: number, enemyHue: number): number {
  const delta = Math.abs(((lightHue - enemyHue + 540) % 360) - 180);
  return clamp01(1 - delta / 48);
}

export class Game {
  phase: Phase = 'title';
  paused = false;
  /** Index into NIGHTS. */
  night = 0;
  /** Seconds since the night's attack began. */
  time = 0;
  enemies: Enemy[] = [];
  lights: Light[] = [];
  health = ROUTER_BARS;
  readonly maxHealth = ROUTER_BARS;
  score = 0;
  combo = 0;
  /** 0..1 */
  charge = 0;
  /** Index into HUES of the colour the next click sends. */
  loaded = 0;
  stats: NightStats = { shots: 0, confirmed: 0, retries: 0, failed: 0, kills: 0, leaks: 0 };

  readonly fixtures: readonly Fixture[];
  private readonly session: Session;
  private readonly lan: VirtualLan;
  private readonly fleet: readonly VirtualDevice[];
  private readonly listeners = new Set<(event: GameEvent) => void>();
  private readonly cooldowns = new Map<string, number>();
  private readonly lastShot = new Map<string, number>();
  private readonly restores: { at: number; device: VirtualDevice; fixture: Fixture }[] = [];
  private readonly said = new Set<string>();
  private queue: { at: number; path: readonly Vec[]; kind: EnemyKind; hue: number }[] = [];
  private nextId = 1;
  /** Game seconds: advances only while a night is running. */
  private clock = 0;
  private comboUntil = 0;
  private clearAt = 0;
  private bossCutAt = 0;
  private bossShuffles = 0;
  private idleAt = 0;
  private scoreAtNightStart = 0;
  private random: () => number;

  constructor(session: Session, lan: VirtualLan, fleet: readonly VirtualDevice[], fixtures: readonly Fixture[], random: () => number = Math.random) {
    this.session = session;
    this.lan = lan;
    this.fleet = fleet;
    this.fixtures = fixtures;
    this.random = random;
    session.listen({
      // Every Acknowledgement that makes it back charges the Broadcast.
      message: (message) => {
        if (message.header.type === Type.Acknowledgement && this.phase === 'wave' && this.broadcastUnlocked) {
          this.charge = clamp01(this.charge + 0.012);
        }
      },
      retry: (lamp, attempt, of, gaveUp) => {
        const fixture = this.fixtureOf(lamp.device.serialNumber);
        if (!fixture || !this.running) return;
        this.stats.retries++;
        this.emit({ kind: 'retry', at: fixture.at, attempt, of, gaveUp });
        this.sayOnce('retry', 'TimeoutError: the packet or its reply was lost. The game sends it again, up to three times.');
      },
    });
  }

  listen(listener: (event: GameEvent) => void): void {
    this.listeners.add(listener);
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private say(text: string): void {
    this.emit({ kind: 'hint', text });
  }

  private sayOnce(key: string, text: string): void {
    if (this.said.has(key)) return;
    this.said.add(key);
    this.say(text);
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.emit({ kind: 'phase', phase });
  }

  /* ---------------------------------------------------------------- */
  /* Lookups                                                           */
  /* ---------------------------------------------------------------- */

  get current(): Night {
    return NIGHTS[Math.min(this.night, NIGHTS.length - 1)]!;
  }

  /** Whether a night is in progress (enemies may be about). */
  get running(): boolean {
    return this.phase === 'setup' || this.phase === 'wave' || this.phase === 'clear';
  }

  get broadcastUnlocked(): boolean {
    return this.night >= 6;
  }

  get abilitiesUnlocked(): boolean {
    return this.night >= 2;
  }

  /** How many colours are in play tonight. */
  get palette(): readonly number[] {
    return this.night >= 3 ? [0, 1, 2, 3, 4, 5] : this.night === 2 ? [0, 2, 3, 4] : [0, 2, 4];
  }

  get boss(): Enemy | undefined {
    return this.enemies.find((enemy) => enemy.kind === 'outage');
  }

  /** Share of tonight's attackers already dealt with, 0..1. */
  get progress(): number {
    const total = this.stats.kills + this.stats.leaks + this.enemies.length + this.queue.length;
    return total === 0 ? 0 : (this.stats.kills + this.stats.leaks) / total;
  }

  fixtureOf(serial: string): Fixture | undefined {
    return this.fixtures.find((fixture) => fixture.serial === serial);
  }

  private deviceOf(serial: string): VirtualDevice | undefined {
    return this.fleet.find((device) => device.spec.serial === serial);
  }

  lampOf(serial: string): Lamp | undefined {
    const lamp = this.session.lamps.find((candidate) => candidate.device.serialNumber === serial);
    return lamp?.ready ? lamp : undefined;
  }

  /** Whether the device has been plugged in by this point of the campaign (always, outside it). */
  introduced(serial: string): boolean {
    if (!this.running && this.phase !== 'briefing' && this.phase !== 'lost') return true;
    const label = this.deviceOf(serial)?.spec.label;
    return NIGHTS.slice(0, this.night + 1).some((night) => night.plugIn.some((name) => name === label));
  }

  /** Whether the device has power, and whether the library has discovered it. */
  status(serial: string): 'unplugged' | 'unknown' | 'ready' {
    if (!this.deviceOf(serial)?.online) return 'unplugged';
    return this.lampOf(serial) ? 'ready' : 'unknown';
  }

  /** 0 when the device's ability is ready, up to 1 just after use. */
  cooldown(serial: string): number {
    const fixture = this.fixtureOf(serial);
    const readyAt = this.cooldowns.get(serial);
    if (!fixture || readyAt === undefined) return 0;
    return clamp01((readyAt - this.clock) / COOLDOWNS[fixture.kind]);
  }

  /* ---------------------------------------------------------------- */
  /* Flow                                                              */
  /* ---------------------------------------------------------------- */

  private restoreNetwork(): void {
    this.lan.latencyMs = 25;
    this.lan.jitterMs = 10;
    this.lan.loss = 0;
  }

  private clearField(): void {
    this.enemies = [];
    this.queue = [];
    this.restores.length = 0;
    this.cooldowns.clear();
    this.paused = false;
    this.restoreNetwork();
  }

  /** Every device powered and discovered, nothing attacking: the title screen and the sandbox. */
  private openHouse(): void {
    this.clearField();
    for (const device of this.fleet) {
      if (!device.online || device.endpoint.address !== device.spec.address) device.plugIn(device.spec.address);
    }
    this.session.rescan();
  }

  showTitle(): void {
    this.openHouse();
    this.setPhase('title');
  }

  enterSandbox(): void {
    this.openHouse();
    this.setPhase('sandbox');
  }

  startCampaign(): void {
    this.clearField();
    this.session.forgetAll();
    for (const device of this.fleet) {
      device.reset();
      device.unplug();
    }
    this.night = 0;
    this.health = ROUTER_BARS;
    this.score = 0;
    this.combo = 0;
    this.charge = 0;
    this.loaded = 0;
    this.said.clear();
    this.setPhase('briefing');
  }

  /** Leaves the briefing: plugs in tonight's devices and waits for them to be discovered. */
  startNight(): void {
    const night = this.current;
    this.clearField();
    this.stats = { shots: 0, confirmed: 0, retries: 0, failed: 0, kills: 0, leaks: 0 };
    this.time = 0;
    // The router is patched up between nights; each night is its own fight.
    this.health = ROUTER_BARS;
    this.scoreAtNightStart = this.score;
    this.bossCutAt = 14;
    this.bossShuffles = 0;
    if (!this.palette.includes(this.loaded)) this.loaded = this.palette[0] ?? 0;

    const due = new Set(NIGHTS.slice(0, this.night + 1).flatMap((n) => n.plugIn));
    for (const device of this.fleet) {
      if (due.has(device.spec.label)) {
        if (!device.online || device.endpoint.address !== device.spec.address) device.plugIn(device.spec.address);
      } else {
        device.unplug();
      }
    }

    this.queue = night.spawns.flatMap((spawn) => Array.from({ length: spawn.count }, (_, i) => ({
      at: spawn.at + i * spawn.gap,
      path: PATHS[spawn.path],
      kind: spawn.kind,
      hue: spawn.hues[i % spawn.hues.length] ?? 0,
    }))).sort((a, b) => a.at - b.at);

    this.setPhase('setup');
    if (night.scan) {
      this.say(`${night.plugIn.join(' and ')} ${night.plugIn.length > 1 ? 'are' : 'is'} plugged in but undiscovered. Press R to scan.`);
    } else if (this.undiscovered().length > 0) {
      this.session.startDiscovery();
    }
  }

  private undiscovered(): VirtualDevice[] {
    return this.fleet.filter((device) => device.online && !this.lampOf(device.spec.serial));
  }

  private finishNight(): void {
    for (const pending of this.restores.splice(0)) pending.device.plugIn();
    this.restoreNetwork();
    if (this.night >= NIGHTS.length - 1) {
      this.setPhase('won');
    } else {
      this.night++;
      this.setPhase('briefing');
    }
  }

  /** After losing: the same night again, with the router repaired and the night's points handed back. */
  retryNight(): void {
    this.score = this.scoreAtNightStart;
    this.combo = 0;
    this.startNight();
  }

  togglePause(force?: boolean): void {
    if (!this.running) return;
    this.paused = force ?? !this.paused;
    this.emit({ kind: 'phase', phase: this.phase });
  }

  /* ---------------------------------------------------------------- */
  /* Player actions — each one a library call                          */
  /* ---------------------------------------------------------------- */

  load(hue: number): void {
    if (!this.palette.includes(hue) || hue === this.loaded) return;
    this.loaded = hue;
    this.emit({ kind: 'load', hue });
  }

  /** Steps the loaded colour through tonight's palette. */
  cycle(step: number): void {
    const palette = this.palette;
    const at = palette.indexOf(this.loaded);
    this.load(palette[(at + step + palette.length) % palette.length] ?? this.loaded);
  }

  /** Sends the loaded colour to whatever was aimed at. */
  fire(target: Target): void {
    if (!this.running || this.paused) return;
    const lamp = this.lampOf(target.serial);
    if (!lamp) {
      const unplugged = this.status(target.serial) === 'unplugged';
      this.emit({ kind: 'denied', at: target.at, why: unplugged ? 'no power' : 'not discovered — scan' });
      return;
    }
    const now = performance.now();
    if (now - (this.lastShot.get(target.id) ?? -1e9) < 110) return;
    this.lastShot.set(target.id, now);

    const hue = this.loaded;
    this.stats.shots++;
    this.emit({ kind: 'shot', target, hue });
    this.session.shoot(lamp, target.index, hsbk(HUES[hue]?.degrees ?? 0, 1, 1), 70).then(() => {
      this.stats.confirmed++;
      this.emit({ kind: 'confirmed', target });
    }, () => {
      this.stats.failed++;
      this.emit({ kind: 'failed', target });
    });
  }

  /** Triggers the device's own animation: a strobe, a rainbow chase, or fire. */
  ability(target: Target): void {
    if (!this.running || this.paused || !this.abilitiesUnlocked) return;
    const fixture = this.fixtureOf(target.serial);
    const lamp = this.lampOf(target.serial);
    if (!fixture) return;
    if (!lamp) {
      this.emit({ kind: 'denied', at: target.at, why: this.status(target.serial) === 'unplugged' ? 'no power' : 'not discovered — scan' });
      return;
    }
    if (this.cooldown(fixture.serial) > 0) {
      this.emit({ kind: 'denied', at: target.at, why: 'recharging' });
      return;
    }
    this.cooldowns.set(fixture.serial, this.clock + COOLDOWNS[fixture.kind]);
    this.emit({ kind: 'ability', fixture });
    const sent = fixture.kind === 'bulb' ? this.session.flash(lamp)
      : fixture.kind === 'strip' ? this.session.chase(lamp, 7)
        : this.session.firewall(lamp, 6);
    // An ability that never reached its device is handed back.
    sent.catch(() => { this.cooldowns.delete(fixture.serial); });
  }

  scan(): void {
    if (this.phase === 'title') return;
    this.session.scan();
    this.emit({ kind: 'scan' });
  }

  broadcast(): void {
    if (!this.running || this.paused || !this.broadcastUnlocked || this.charge < 1) return;
    this.charge = 0;
    this.session.broadcastFlash();
    this.emit({ kind: 'broadcast' });
  }

  /* ---------------------------------------------------------------- */
  /* Simulation                                                        */
  /* ---------------------------------------------------------------- */

  /** Reads every light's real output for this frame. */
  private readLights(now: number): void {
    const lights: Light[] = [];
    for (const fixture of this.fixtures) {
      const device = this.deviceOf(fixture.serial);
      if (!device) continue;
      const frame = device.frame(now);
      const running = device.running(now);
      for (const emitter of fixture.emitters) {
        let color: Color | undefined;
        if (emitter.kind === 'tile') {
          // A tile throws the average of its 64 pixels.
          let x = 0, y = 0, brightness = 0, kelvin = 0;
          for (let i = 0; i < 64; i++) {
            const c = frame.colors[emitter.index * 64 + i];
            if (!c) continue;
            const angle = (c.hue / 65536) * Math.PI * 2;
            x += Math.cos(angle) * c.saturation;
            y += Math.sin(angle) * c.saturation;
            brightness += c.brightness;
            kelvin += c.kelvin;
          }
          color = {
            hue: ((Math.atan2(y, x) / (Math.PI * 2)) * 65536 + 65536) % 65536,
            saturation: Math.min(65535, Math.hypot(x, y) / 64),
            brightness: brightness / 64,
            kelvin: kelvin / 64,
          };
        } else {
          color = frame.colors[emitter.index];
        }
        if (!color) continue;
        lights.push({
          emitter,
          color,
          level: clamp01((color.brightness / 65535) * frame.power),
          hue: (color.hue / 65536) * 360,
          saturation: clamp01(color.saturation / 65535),
          strobe: running.waveform,
          fire: emitter.kind === 'tile' && running.tileEffect !== 0,
        });
      }
    }
    this.lights = lights;
  }

  /** Damage per second the lights are doing to something at `at` of colour `hue` (degrees), and whether it is staggered. */
  private exposure(at: Vec, hue: number): { dps: number; stagger: boolean } {
    let dps = 0;
    let stagger = false;
    for (const light of this.lights) {
      if (light.level < 0.02) continue;
      const { emitter } = light;
      const dx = at.x - emitter.at.x;
      const dy = at.y - emitter.at.y;
      if (dx * dx + dy * dy > emitter.radius * emitter.radius * 1.3) continue;
      if (!inside(at, emitter.reach)) continue;
      const falloff = emitter.kind === 'zone'
        ? 1 - 0.55 * clamp01(Math.abs(dy) / emitter.radius)
        : clamp01(1 - Math.hypot(dx, dy) / emitter.radius) ** (emitter.kind === 'bulb' ? 0.9 : 0.6);
      const all = light.strobe || light.fire;
      const match = all ? 1 : light.saturation * hueMatch(light.hue, hue) + (1 - light.saturation) * WHITE_SHARE;
      dps += BASE_DPS[emitter.kind] * light.level * falloff * match * (light.strobe ? 1.7 : 1);
      if (light.strobe && falloff > 0.05) stagger = true;
    }
    return { dps, stagger };
  }

  private spawn(entry: { path: readonly Vec[]; kind: EnemyKind; hue: number }): void {
    const type = ENEMIES[entry.kind];
    const start = entry.path[0] ?? { x: 0, y: 0 };
    const enemy: Enemy = {
      id: this.nextId++, kind: entry.kind, type, hue: entry.hue, hp: type.hp, path: entry.path, distance: 0,
      lateral: entry.kind === 'outage' ? 0 : (this.random() - 0.5) * 34,
      at: start, heading: { x: 1, y: 0 }, stun: 0, burn: 0, shiftIn: type.shift, seed: this.random() * 1000, age: 0,
    };
    this.enemies.push(enemy);
    this.emit({ kind: 'spawn', enemy });
    if (!this.said.has(`meet:${entry.kind}`) && entry.kind !== 'shade') {
      this.said.add(`meet:${entry.kind}`);
      this.say(`${type.name}: ${type.about}`);
    }
  }

  private kill(enemy: Enemy): void {
    this.combo = this.clock < this.comboUntil ? Math.min(9, this.combo + 1) : 1;
    this.comboUntil = this.clock + 2.6;
    const points = enemy.type.score * this.combo;
    this.score += points;
    this.stats.kills++;
    if (this.broadcastUnlocked) this.charge = clamp01(this.charge + 0.035);
    this.emit({ kind: 'kill', enemy, points, combo: this.combo });
    if (this.night === 0) this.sayOnce('firstKill', 'That was one SetColor packet. Pause (P) and click any row of the wire log to take it apart.');
  }

  /** The Outage's tricks: cut the nearest light's power, or knock a bulb onto a new address. */
  private bossActs(boss: Enemy): void {
    if (this.time >= this.bossCutAt) {
      this.bossCutAt = this.time + 15;
      const victim = this.fixtures
        .filter((fixture) => this.deviceOf(fixture.serial)?.online)
        .sort((a, b) => Math.hypot(a.at.x - boss.at.x, a.at.y - boss.at.y) - Math.hypot(b.at.x - boss.at.x, b.at.y - boss.at.y))[0];
      const device = victim && this.deviceOf(victim.serial);
      if (victim && device) {
        device.unplug();
        this.restores.push({ at: this.clock + 5, device, fixture: victim });
        this.emit({ kind: 'brownout', fixture: victim });
        this.sayOnce('brownout', `Brownout: ${victim.label} has no power. Sends to it will time out until it boots again.`);
      }
    }
    const lost = 1 - boss.hp / boss.type.hp;
    if (lost > (this.bossShuffles + 1) / 3.5 && this.bossShuffles < 3) {
      this.bossShuffles++;
      const bulbs = this.fixtures.filter((fixture) => fixture.kind === 'bulb' && this.deviceOf(fixture.serial)?.online);
      const victim = bulbs[Math.floor(this.random() * bulbs.length)];
      const device = victim && this.deviceOf(victim.serial);
      if (victim && device) {
        const address = `192.168.1.${80 + this.bossShuffles * 7 + Math.floor(this.random() * 6)}`;
        device.plugIn(address);
        this.emit({ kind: 'shuffle', fixture: victim, address });
        this.say(`${victim.label} rebooted at ${address}. Its old address is dead: press R to scan and the registry will follow it.`);
      }
    }
  }

  /** Advances the game by `dt` seconds. `now` is the wall clock the devices run on. */
  update(dt: number, now: number): void {
    this.readLights(now);
    if (this.phase === 'title') this.idle(now);
    if (!this.running || this.paused) return;

    this.clock += dt;
    for (let i = this.restores.length - 1; i >= 0; i--) {
      const pending = this.restores[i]!;
      if (this.clock >= pending.at) {
        this.restores.splice(i, 1);
        pending.device.plugIn();
        this.emit({ kind: 'restored', fixture: pending.fixture });
      }
    }

    if (this.phase === 'setup') {
      if (this.undiscovered().length === 0) {
        this.setPhase('wave');
        const first = ['Press 1, 2 or 3 (or scroll) to load a colour, then click the Entry Light.',
          '', 'Right-click a bulb, or hover and press Space, to strobe it.',
          'Click a section of the strip to colour eight zones. Right-click it for the rainbow chase.',
          '', 'Click a tile to colour it. Right-click the tiles for fire.', '', ''][this.night];
        if (first) this.say(first);
      }
      return;
    }

    if (this.phase === 'clear') {
      if (this.clock >= this.clearAt) this.finishNight();
      return;
    }

    this.time += dt;
    while (this.queue.length > 0 && this.queue[0]!.at <= this.time) {
      const entry = this.queue.shift();
      if (entry) this.spawn(entry);
    }

    let jam = 0;
    let lag = 0;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]!;
      const { type } = enemy;
      enemy.age += dt;
      jam += type.jam;
      lag += type.lag;

      if (type.shift > 0) {
        enemy.shiftIn -= dt;
        if (enemy.shiftIn <= 0) {
          enemy.shiftIn = type.shift;
          const palette = this.palette;
          enemy.hue = palette[(palette.indexOf(enemy.hue) + 1 + Math.floor(this.random() * (palette.length - 1))) % palette.length] ?? enemy.hue;
        }
      }

      const { dps, stagger } = this.exposure(enemy.at, HUES[enemy.hue]?.degrees ?? 0);
      if (stagger) enemy.stun = Math.max(enemy.stun, 0.5);
      enemy.hp -= dps * dt;
      enemy.burn += (clamp01(dps / 55) - enemy.burn) * Math.min(1, dt * 10);
      if (enemy.hp <= 0) {
        this.enemies.splice(i, 1);
        this.kill(enemy);
        continue;
      }

      enemy.stun = Math.max(0, enemy.stun - dt);
      enemy.distance += type.speed * (enemy.stun > 0 ? 0.22 : 1) * dt;
      const step = along(enemy.path, enemy.distance);
      enemy.heading = step.heading;
      enemy.at = { x: step.at.x - step.heading.y * enemy.lateral, y: step.at.y + step.heading.x * enemy.lateral };

      if (enemy.kind === 'outage') this.bossActs(enemy);

      if (step.done) {
        this.health -= type.bite;
        this.stats.leaks++;
        this.combo = 0;
        this.emit({ kind: 'routerHit', enemy });
        if (enemy.kind === 'outage' && this.health > 0) {
          enemy.distance = 0; // it circles the house again
        } else {
          this.enemies.splice(i, 1);
        }
      }
    }

    this.lan.loss = Math.min(0.62, jam);
    this.lan.latencyMs = Math.min(650, 25 + lag);
    this.lan.jitterMs = Math.min(40, this.lan.latencyMs * 0.4);

    if (this.broadcastUnlocked && this.charge >= 1) this.sayOnce('charged', 'Broadcast charged. Press B: one tagged packet, every light strobes.');

    if (this.health <= 0) {
      this.health = 0;
      this.restoreNetwork();
      this.setPhase('lost');
      return;
    }
    if (this.queue.length === 0 && this.enemies.length === 0) {
      this.clearAt = this.clock + 2.2;
      this.restoreNetwork();
      this.setPhase('clear');
    }
  }

  /** On the title screen the house idles through colours — real sends, so the wire log is alive. */
  private idle(now: number): void {
    if (now < this.idleAt) return;
    this.idleAt = now + 1700;
    const ready = this.fixtures.filter((fixture) => this.lampOf(fixture.serial));
    const fixture = ready[Math.floor(this.random() * ready.length)];
    const lamp = fixture && this.lampOf(fixture.serial);
    const target = fixture?.targets[Math.floor(this.random() * fixture.targets.length)];
    if (!lamp || !target) return;
    const hue = HUES[Math.floor(this.random() * HUES.length)]?.degrees ?? 0;
    this.session.shoot(lamp, target.index, hsbk(hue, 1, 0.9), 1400).catch(() => { /* logged */ });
  }

  /** Where the router is, for anything that needs to point at it. */
  get routerAt(): Vec {
    return ROUTER;
  }
}
