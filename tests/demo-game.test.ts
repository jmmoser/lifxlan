/**
 * The browser demo's game rules (demo/src/game), run headless: the real
 * library drives the simulated devices, and the game reads what the devices
 * are actually emitting. These hold the claim the page makes — a shade
 * burns only if a packet reached a light and the light acted on it.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Session } from '../demo/src/app/session.js';
import { Game, hueMatch } from '../demo/src/game/game.js';
import type { GameEvent } from '../demo/src/game/game.js';
import { ENEMIES, HUES, NIGHTS } from '../demo/src/game/waves.js';
import { PATHS, ROOMS, WALLS, along, contains, fixtureFor, inside, pathLength, reachOf } from '../demo/src/game/world.js';
import { VirtualDevice } from '../demo/src/sim/firmware.js';
import { FLEET } from '../demo/src/sim/fleet.js';
import { VirtualLan } from '../demo/src/sim/lan.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let lan: VirtualLan;
let fleet: VirtualDevice[];
let session: Session;
let game: Game;
let events: GameEvent[];

/**
 * Advances the game by `seconds` of game time in 20 ms steps, each taking
 * 4 ms of real time: shades move five times faster than the network and the
 * devices, which run on the real clock.
 */
async function run(seconds: number, until: () => boolean = () => false): Promise<void> {
  const steps = Math.ceil(seconds / 0.02);
  for (let i = 0; i < steps && !until(); i++) {
    await sleep(4);
    game.update(0.02, performance.now());
  }
}

beforeEach(() => {
  lan = new VirtualLan();
  lan.latencyMs = 2;
  lan.jitterMs = 0;
  fleet = FLEET.map((spec) => new VirtualDevice(spec, lan));
  session = new Session(lan);
  game = new Game(session, lan, fleet, fleet.map(fixtureFor), () => 0.5);
  events = [];
  game.listen((event) => events.push(event));
});

afterEach(() => {
  session.forgetAll();
  session.client.dispose();
});

describe('demo house', () => {
  test('every route starts at an opening in the outer wall and ends beside the router', () => {
    for (const [name, points] of Object.entries(PATHS)) {
      const first = points[0]!;
      const last = points[points.length - 1]!;
      expect({ name, edge: first.x <= 40 || first.x >= 1560 || first.y <= 40 }).toEqual({ name, edge: true });
      expect({ name, near: Math.hypot(last.x - 826, last.y - 300) < 110 }).toEqual({ name, near: true });
      // Shades walk through doorways, never through a wall.
      for (let d = 30; d < pathLength(points); d += 10) {
        const { at } = along(points, d);
        expect({ name, d, blocked: WALLS.some((wall) => contains(wall, at)) }).toEqual({ name, d, blocked: false });
      }
    }
  });

  test('a bulb lights its own room and spills through doorways, not through walls', () => {
    const kitchen = reachOf({ x: 262, y: 296 }, 320);
    expect(inside({ x: 150, y: 200 }, kitchen)).toBe(true);
    expect(inside({ x: 400, y: 450 }, kitchen)).toBe(true);
    // The living room is past a wall, except in line with the doorway.
    expect(inside({ x: 520, y: 150 }, kitchen)).toBe(false);
    expect(inside({ x: 540, y: 300 }, kitchen)).toBe(true);
    // The hallway below is past a wall too, except under its doorway.
    expect(inside({ x: 420, y: 600 }, kitchen)).toBe(false);
    expect(inside({ x: 255, y: 590 }, kitchen)).toBe(true);
  });

  test('every device is placed inside a room, with something to click', () => {
    for (const device of fleet) {
      const fixture = fixtureFor(device);
      expect(fixture.targets.length).toBeGreaterThan(0);
      expect(fixture.emitters.length).toBe(device.spec.kind === 'strip' ? 32 : device.spec.kind === 'tiles' ? 5 : 1);
      for (const target of fixture.targets) {
        expect({ label: fixture.label, placed: ROOMS.some((room) => contains(room.area, target.at)) }).toEqual({ label: fixture.label, placed: true });
      }
    }
  });

  test('the campaign only asks for devices, routes and colours that exist', () => {
    const labels = new Set(FLEET.map((spec) => spec.label));
    for (const night of NIGHTS) {
      for (const label of night.plugIn) expect(labels.has(label)).toBe(true);
      for (const spawn of night.spawns) {
        expect(PATHS[spawn.path].length).toBeGreaterThan(1);
        expect(ENEMIES[spawn.kind].hp).toBeGreaterThan(0);
        for (const hue of spawn.hues) expect(HUES[hue]).toBeDefined();
      }
    }
    expect(new Set(NIGHTS.flatMap((night) => night.plugIn)).size).toBe(FLEET.length);
  });

  test('a colour burns its own and leaves its neighbours alone', () => {
    expect(hueMatch(120, 120)).toBe(1);
    expect(hueMatch(120, 180)).toBe(0);
    expect(hueMatch(350, 0)).toBeGreaterThan(0.7);
    expect(hueMatch(0, 300)).toBe(0);
  });
});

describe('demo devices: power and addresses', () => {
  test('an unplugged device is dark and silent, and comes back with its settings', async () => {
    game.enterSandbox();
    await run(8, () => session.lamps.filter((lamp) => lamp.ready).length === FLEET.length);
    const lamp = session.lamps.find((candidate) => candidate.label === 'Entry Light')!;
    const device = fleet[0]!;
    await session.shoot(lamp, 0, { hue: 21845, saturation: 65535, brightness: 65535, kelvin: 3500 }, 0);

    device.unplug();
    expect(device.frame().power).toBe(0);
    await expect(session.shoot(lamp, 0, { hue: 0, saturation: 65535, brightness: 65535, kelvin: 3500 }, 0)).rejects.toThrow();

    device.plugIn();
    expect(device.frame().power).toBe(1);
    expect(device.frame().colors[0]).toMatchObject({ hue: 21845 });
  }, 10000);

  test('a device that moves to a new address is followed by the registry after a scan', async () => {
    game.enterSandbox();
    await run(8, () => session.lamps.filter((lamp) => lamp.ready).length === FLEET.length);
    const lamp = session.lamps.find((candidate) => candidate.label === 'Bedroom Lamp')!;
    const before = lamp.device;
    fleet[2]!.plugIn('192.168.1.99');

    expect(lamp.device.address).toBe('192.168.1.23');
    session.scan();
    await sleep(120);
    // Same object, new address: nothing holding the device had to change.
    expect(lamp.device).toBe(before);
    expect(lamp.device.address).toBe('192.168.1.99');
    await session.shoot(lamp, 0, { hue: 43690, saturation: 65535, brightness: 65535, kelvin: 3500 }, 0);
    expect(fleet[2]!.frame().colors[0]).toMatchObject({ hue: 43690 });
  });
});

describe('demo game rules', () => {
  async function firstNight(): Promise<void> {
    game.startCampaign();
    expect(game.phase).toBe('briefing');
    expect(fleet.every((device) => !device.online)).toBe(true);
    game.startNight();
    expect(fleet.map((device) => device.online)).toEqual([true, false, false, false, false, false]);
    await run(12, () => game.phase === 'wave');
    expect(game.phase).toBe('wave');
  }

  test('the first night plugs in one bulb, discovers it, and sends a red shade at the front door', async () => {
    await firstNight();
    expect(session.lamps.map((lamp) => lamp.label)).toEqual(['Entry Light']);
    await run(1.2, () => game.enemies.length > 0);
    expect(game.enemies[0]).toMatchObject({ kind: 'shade', hue: 0 });
  }, 10000);

  test('a shade burns in light of its own colour, and not in another', async () => {
    await firstNight();
    await run(1.2, () => game.enemies.length > 0);
    const shade = game.enemies[0]!;
    const target = game.fixtures[0]!.targets[0]!;

    // Before it reaches the light there is nothing to click it with.
    expect(game.aimAt(shade.at).aim).toBeUndefined();

    // As soon as the light can burn it, the game holds the moment and asks for a first click.
    await run(6, () => game.coach !== undefined);
    expect(game.coach).toMatchObject({ key: 'click', text: 'Click the shade.' });
    expect(Math.hypot((game.coach?.at?.x ?? 0) - shade.at.x, (game.coach?.at?.y ?? 0) - shade.at.y)).toBeLessThan(3);
    game.lessons = false;

    // Walk it further into the light. The bulb is still white: barely a scratch.
    await run(4, () => shade.at.x > 200);
    expect(shade.hp).toBeGreaterThan(80);
    expect(game.aimAt(shade.at).aim?.target).toBe(target);

    // Green light on a red shade: nothing.
    game.shoot(target, 2);
    await sleep(150);
    game.update(0.02, performance.now());
    const before = shade.hp;
    await run(0.4);
    expect(shade.hp).toBe(before);

    // Clicking the shade turns the light over it the shade's own colour, and it burns away.
    game.zap(shade);
    await sleep(150);
    expect(fleet[0]!.frame().colors[0]).toMatchObject({ hue: 0, saturation: 65535 });
    await run(6, () => !game.enemies.includes(shade));
    expect(game.enemies.includes(shade)).toBe(false);
    expect(events.some((event) => event.kind === 'kill')).toBe(true);
    expect(game.score).toBeGreaterThan(0);
  }, 20000);

  test('a shot lost on the network changes nothing: the light keeps its colour and the shade its health', async () => {
    await firstNight();
    await run(1.2, () => game.enemies.length > 0);
    const shade = game.enemies[0]!;
    game.lessons = false;
    await run(4, () => shade.at.x > 200);
    const hp = shade.hp;

    lan.loss = 1;
    game.zap(shade);
    // The game keeps its own network settings each frame; hold the loss in place by hand.
    for (let i = 0; i < 10; i++) {
      await sleep(20);
      lan.loss = 1;
    }
    expect(fleet[0]!.frame().colors[0]).toMatchObject({ saturation: 0 });
    expect(shade.hp).toBe(hp);
  }, 20000);

  test('a shade that reaches the router costs a bar of signal', async () => {
    await firstNight();
    await run(1.2, () => game.enemies.length > 0);
    const shade = game.enemies[0]!;
    shade.distance = pathLength(shade.path) - 5;
    await run(0.5, () => game.health < game.maxHealth);
    expect(game.health).toBe(game.maxHealth - 1);
    expect(events.some((event) => event.kind === 'routerHit')).toBe(true);
  }, 10000);

  test('a light the library has not met is found by clicking it, and only then can be used', async () => {
    await firstNight();
    game.night = 1;
    game.startNight();
    await run(0.2);
    const kitchen = game.fixtures[1]!;
    expect(game.status(kitchen.serial)).toBe('unknown');
    expect(game.coach).toMatchObject({ key: 'find', at: kitchen.at });
    expect(game.phase).toBe('setup');

    game.press(kitchen.targets[0]!);
    await run(12, () => game.phase === 'wave');
    expect(game.status(kitchen.serial)).toBe('ready');
    expect(events.some((event) => event.kind === 'scan')).toBe(true);
  }, 15000);

  test('a jammer raises packet loss for as long as it lives', async () => {
    await firstNight();
    game.night = 4;
    game.startNight();
    await run(12, () => game.enemies.some((enemy) => enemy.kind === 'jammer'));
    await run(0.1);
    expect(lan.loss).toBeCloseTo(ENEMIES.jammer.jam, 5);
    game.enemies.length = 0;
    await run(0.1);
    expect(lan.loss).toBe(0);
  }, 15000);
});
