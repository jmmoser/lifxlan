/**
 * The campaign: what attacks on each night, which devices are plugged in by
 * then, and the one thing about the protocol each night is built to teach.
 */
import type { PathName } from './world.js';

/** The six colours a shade can be, as hue in degrees. Index + 1 is its key. */
export const HUES: readonly { name: string; degrees: number }[] = [
  { name: 'Red', degrees: 0 },
  { name: 'Yellow', degrees: 60 },
  { name: 'Green', degrees: 120 },
  { name: 'Cyan', degrees: 180 },
  { name: 'Blue', degrees: 240 },
  { name: 'Magenta', degrees: 300 },
];

export type EnemyKind = 'shade' | 'runner' | 'brute' | 'jammer' | 'leech' | 'prism' | 'outage';

export interface EnemyType {
  readonly name: string;
  readonly hp: number;
  /** House units per second. */
  readonly speed: number;
  readonly size: number;
  /** Signal bars it takes from the router if it gets there. */
  readonly bite: number;
  readonly score: number;
  /** Packet loss it adds to the whole network while it lives (0..1). */
  readonly jam: number;
  /** One-way latency it adds while it lives, in milliseconds. */
  readonly lag: number;
  /** Seconds between changes of colour, or 0 for a fixed colour. */
  readonly shift: number;
  readonly about: string;
}

export const ENEMIES: Readonly<Record<EnemyKind, EnemyType>> = {
  shade: { name: 'Shade', hp: 100, speed: 54, size: 27, bite: 1, score: 10, jam: 0, lag: 0, shift: 0, about: 'Burns only in light of its own colour.' },
  runner: { name: 'Flicker', hp: 46, speed: 116, size: 19, bite: 1, score: 15, jam: 0, lag: 0, shift: 0, about: 'Fast and fragile. Have its colour waiting.' },
  brute: { name: 'Gloom', hp: 300, speed: 31, size: 40, bite: 2, score: 40, jam: 0, lag: 0, shift: 0, about: 'Slow, and takes a long burn. Costs two bars.' },
  jammer: { name: 'Static', hp: 170, speed: 40, size: 28, bite: 1, score: 35, jam: 0.2, lag: 0, shift: 0, about: 'Jams the air: while it lives, packets get lost.' },
  leech: { name: 'Lag', hp: 150, speed: 44, size: 28, bite: 1, score: 35, jam: 0, lag: 170, shift: 0, about: 'Slows the network: every packet takes longer to arrive.' },
  prism: { name: 'Prism', hp: 230, speed: 46, size: 29, bite: 1, score: 45, jam: 0, lag: 0, shift: 4.5, about: 'Changes colour every few seconds.' },
  outage: { name: 'The Outage', hp: 2300, speed: 23, size: 62, bite: 3, score: 1000, jam: 0.06, lag: 40, shift: 7, about: 'Cuts power to lights and knocks them onto new addresses.' },
};

export interface Spawn {
  /** Seconds after the night's attack begins. */
  readonly at: number;
  readonly path: PathName;
  readonly kind: EnemyKind;
  /** Hue index of each one, cycled. */
  readonly hues: readonly number[];
  readonly count: number;
  /** Seconds between each of the group. */
  readonly gap: number;
}

export interface Night {
  readonly title: string;
  /** Labels of the devices plugged in from this night on. */
  readonly plugIn: readonly string[];
  /** Whether the new devices must be found with a manual scan before the attack starts. */
  readonly scan: boolean;
  /** What is new tonight, in terms of what to do. */
  readonly brief: string;
  /** The part of the protocol behind it, for whoever wants to know. */
  readonly hood: string;
  /** A line of library code the night revolves around. */
  readonly code: string;
  /** New ways in or new enemies, named on the card. */
  readonly news: readonly string[];
  readonly spawns: readonly Spawn[];
  /** Musical intensity, 0..1. */
  readonly heat: number;
}

const group = (at: number, path: PathName, kind: EnemyKind, hues: readonly number[], count: number, gap = 2): Spawn => ({ at, path, kind, hues, count, gap });

const R = 0, Y = 1, G = 2, C = 3, B = 4, M = 5;

export const NIGHTS: readonly Night[] = [
  {
    title: 'First light',
    plugIn: ['Entry Light'],
    scan: false,
    brief: 'Shades are heading for the router. Click a shade and the light over it turns its colour. That burns it.',
    hood: 'Each click is one SetColor message: 49 bytes sent to the bulb, which answers with an Acknowledgement.',
    code: 'await client.send(SetColor({ hue: 21845, saturation: 65535, brightness: 65535, kelvin: 3500 }), entryLight)',
    news: ['Shade — burns only in its own colour'],
    heat: 0.25,
    spawns: [
      group(1, 'door', 'shade', [R], 1),
      group(8, 'door', 'shade', [G], 1),
      group(15, 'door', 'shade', [B, R], 2, 1.4),
      group(26, 'door', 'shade', [G, B, R], 3, 2.4),
      group(38, 'door', 'shade', [R, G, B, G], 4, 2.2),
    ],
  },
  {
    title: 'Discovery',
    plugIn: ['Kitchen Pendant'],
    scan: true,
    brief: 'Someone plugged in a kitchen light. Click it to find it: you cannot use a light the network has not met.',
    hood: 'Finding devices is one broadcast: GetService to every address. Each device answers StateService, and the library records who answered and from where.',
    code: 'client.broadcast(GetService())',
    news: ['The kitchen window is open'],
    heat: 0.35,
    spawns: [
      group(1, 'kitchen', 'shade', [R], 2, 3),
      group(8, 'door', 'shade', [G], 3, 2.4),
      group(17, 'kitchen', 'shade', [B, G], 3, 2.4),
      group(22, 'door', 'shade', [R, B], 3, 2.4),
      group(33, 'kitchen', 'shade', [G, R, B], 4, 2),
      group(35, 'door', 'shade', [B, G, R], 4, 2),
    ],
  },
  {
    title: 'One packet, many flashes',
    plugIn: ['Bedroom Lamp', 'Landing Light'],
    scan: true,
    brief: 'Bulbs can strobe. When the ring around a light is full, click the light itself. The flash burns every colour and staggers whatever it touches.',
    hood: 'SetWaveform hands the bulb a whole animation in one packet: colour, period, cycles, shape. The bulb runs it by itself.',
    code: 'await client.send(SetWaveform({ waveform: Waveform.PULSE, periodMs: 260, cycles: 9, … }), bedroomLamp)',
    news: ['Two more ways in', 'Cyan shades'],
    heat: 0.45,
    spawns: [
      group(1, 'bedroom', 'shade', [C], 2, 2.6),
      group(4, 'landing', 'shade', [R], 2, 2.6),
      group(13, 'door', 'shade', [G, B], 4, 2),
      group(15, 'kitchen', 'shade', [C, R], 3, 2.2),
      group(26, 'bedroom', 'shade', [R, G, B, C], 5, 1.5),
      group(36, 'landing', 'shade', [B, C], 4, 1.8),
      group(38, 'door', 'shade', [G, R, C], 4, 1.8),
      group(47, 'kitchen', 'shade', [B, G, R, C, B, G], 6, 1.2),
    ],
  },
  {
    title: 'Thirty-two zones',
    plugIn: ['Hallway Strip'],
    scan: true,
    brief: 'A light strip now lines the hallway. Click shades as before. Click the strip itself for a rainbow sweep.',
    hood: 'The strip is one device with 32 separately coloured zones. SetColorZones colours a range of them, and the MOVE effect scrolls them on the device for a set time.',
    code: 'await client.send(SetColorZones({ startIndex: 8, endIndex: 15, hue: 43690, … }), hallwayStrip)',
    news: ['Flicker — fast and fragile', 'All six colours'],
    heat: 0.55,
    spawns: [
      group(1, 'door', 'runner', [R, G], 4, 1.2),
      group(6, 'landing', 'shade', [Y, M], 4, 2),
      group(15, 'kitchenHall', 'shade', [C, B, Y], 4, 1.8),
      group(18, 'bedroom', 'runner', [M, G, R], 4, 1.1),
      group(28, 'door', 'shade', [B, Y, M, C], 6, 1.5),
      group(30, 'landing', 'runner', [G, R, Y], 5, 1),
      group(40, 'bedroomHall', 'shade', [R, M, G], 5, 1.5),
      group(42, 'kitchen', 'shade', [Y, C], 4, 1.6),
      group(52, 'door', 'runner', [M, B, G, Y, R, C], 8, 0.8),
    ],
  },
  {
    title: 'Lost in the air',
    plugIn: [],
    scan: false,
    brief: 'Statics jam the air. While one lives, some of your clicks get lost and have to be sent again. Burn Statics first.',
    hood: 'UDP promises nothing. A lost packet, or a lost reply, surfaces as TimeoutError, and the game sends it again, up to three times.',
    code: 'try { await client.send(SetColor(red), lamp) } catch (e) { if (e instanceof TimeoutError) /* send it again */ }',
    news: ['Static — packets get lost while it lives'],
    heat: 0.65,
    spawns: [
      group(1, 'door', 'jammer', [G], 1),
      group(3, 'door', 'shade', [R, B], 4, 1.8),
      group(12, 'kitchen', 'jammer', [M], 1),
      group(13, 'bedroom', 'shade', [Y, C, R], 5, 1.6),
      group(24, 'landing', 'jammer', [B], 1),
      group(25, 'landing', 'runner', [G, M, Y], 5, 1),
      group(27, 'kitchenHall', 'shade', [C, R], 4, 1.6),
      group(38, 'door', 'jammer', [Y], 1),
      group(38, 'bedroom', 'jammer', [R], 1),
      group(40, 'door', 'shade', [M, G, B, C], 6, 1.3),
      group(44, 'kitchen', 'runner', [B, Y, R], 5, 0.9),
      group(54, 'bedroomHall', 'shade', [G, C, M, Y], 6, 1.2),
    ],
  },
  {
    title: 'Sixty-four pixels',
    plugIn: ['Ceiling Tiles'],
    scan: true,
    brief: 'Five light tiles now ring the router: your last line. Click the tiles themselves to set them on fire.',
    hood: 'Each tile is 8 × 8 pixels, and one Set64 message carries all 64 colours of a tile: 558 bytes. FLAME is an effect the tiles run by themselves.',
    code: 'await client.send(Set64({ tileIndex: 2, colors, durationMs: 80 }), ceilingTiles)',
    news: ['Gloom — slow, tough, costs two bars', 'The balcony door is open'],
    heat: 0.75,
    spawns: [
      group(1, 'balcony', 'shade', [R, G], 3, 2.4),
      group(5, 'door', 'brute', [B], 1),
      group(8, 'kitchen', 'shade', [Y, M, C], 5, 1.5),
      group(18, 'bedroom', 'brute', [G], 1),
      group(20, 'landing', 'runner', [R, C, M], 6, 0.9),
      group(30, 'balcony', 'runner', [B, Y], 4, 1.2),
      group(32, 'door', 'jammer', [M], 1),
      group(34, 'kitchenHall', 'shade', [G, R, B], 5, 1.4),
      group(46, 'bedroom', 'shade', [C, Y, M, R], 5, 1.3),
      group(48, 'door', 'brute', [Y], 1),
      group(50, 'landing', 'brute', [R], 1),
      group(58, 'balcony', 'shade', [G, B, M, C], 5, 1.4),
    ],
  },
  {
    title: 'Everyone at once',
    plugIn: [],
    scan: false,
    brief: 'Clicks and kills charge the Broadcast. When it is full, press it: every light in the house strobes at once.',
    hood: 'A message addressed to all zeros with the tagged bit set is for every device. Sent to 255.255.255.255, one packet reaches the whole house.',
    code: 'client.broadcast(SetWaveform({ waveform: Waveform.PULSE, cycles: 12, … }))',
    news: ['Lag — slows every packet', 'Prism — changes colour'],
    heat: 0.88,
    spawns: [
      group(1, 'door', 'leech', [C], 1),
      group(2, 'kitchen', 'prism', [R], 1),
      group(4, 'bedroom', 'shade', [Y, G, M], 5, 1.4),
      group(14, 'landing', 'leech', [M], 1),
      group(15, 'landing', 'runner', [B, R, G, Y], 5, 0.9),
      group(18, 'balcony', 'prism', [G], 1),
      group(27, 'door', 'jammer', [R], 1),
      group(28, 'kitchenHall', 'shade', [C, B, M, Y], 5, 1.3),
      group(30, 'bedroom', 'brute', [G], 1),
      group(40, 'kitchen', 'leech', [Y], 1),
      group(41, 'door', 'prism', [B], 2, 4),
      group(43, 'bedroomHall', 'runner', [M, C, R, G], 6, 0.8),
      group(54, 'balcony', 'shade', [R, Y, B], 6, 1.1),
      group(56, 'landing', 'brute', [C], 1),
      group(62, 'kitchen', 'runner', [B, M, Y, R, G, C], 7, 0.7),
    ],
  },
  {
    title: 'The Outage',
    plugIn: [],
    scan: false,
    brief: 'The Outage cuts power to lights and knocks them onto new addresses. A light marked ? has moved: click it to find it again.',
    hood: 'Sends to a dead address time out. After a scan, the registry updates the same device object in place, so nothing else has to change.',
    code: 'Devices({ onChanged: (device) => console.log(device.serialNumber, "moved to", device.address) })',
    news: ['The Outage'],
    heat: 1,
    spawns: [
      group(2, 'tour', 'outage', [R], 1),
      group(10, 'landing', 'shade', [G, B], 4, 2),
      group(24, 'bedroom', 'runner', [Y, M, C], 5, 1),
      group(38, 'kitchen', 'shade', [R, C, G], 5, 1.4),
      group(52, 'balcony', 'runner', [B, Y], 4, 1.2),
      group(66, 'landing', 'jammer', [M], 1),
      group(68, 'door', 'shade', [G, R, B, Y], 6, 1.3),
      group(84, 'bedroomHall', 'runner', [C, M, G], 6, 0.9),
      group(98, 'kitchen', 'brute', [B], 1),
      group(100, 'balcony', 'shade', [Y, R, M], 5, 1.3),
      group(116, 'door', 'leech', [C], 1),
      group(118, 'landing', 'runner', [R, G, B, Y, M, C], 8, 0.8),
      group(136, 'bedroom', 'shade', [G, M, Y, C], 7, 1.1),
      group(150, 'kitchenHall', 'runner', [B, R, Y, G], 8, 0.8),
    ],
  },
];
