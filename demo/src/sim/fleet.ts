/**
 * The devices plugged into the virtual network, and the excerpt of the
 * official products.json that describes them.
 */
import type { VendorDefinition } from '../../../src/products.js';
import type { DeviceSpec } from './firmware.js';

const LOCATION = { id: '4b9d3c2e7f1a4c0e9a6d2b8f5e3c1a70', label: 'Studio' };
const LAMPS = { id: '1f6e0c9a3b5d4e7f8a2c4d6e8f0a1b3c', label: 'Lamps' };
const ACCENTS = { id: '9c8b7a6d5e4f40312a1b0c9d8e7f6a5b', label: 'Accent lighting' };

const FIRMWARE_BUILD = new Date('2024-03-12T09:30:00Z');

/** Kelvin-only white: saturation 0, so `kelvin` sets the tint. */
const white = (kelvin: number, brightness: number) => ({ hue: 0, saturation: 0, brightness: Math.round(brightness * 65535), kelvin });

export const FLEET: readonly DeviceSpec[] = [
  {
    kind: 'bulb',
    serial: 'd073d5a1c001',
    address: '192.168.1.21',
    label: 'Desk Lamp',
    product: 27,
    firmware: { major: 2, minor: 80, build: FIRMWARE_BUILD },
    signal: 2.5e-5,
    group: LAMPS,
    location: LOCATION,
    color: white(2700, 0.85),
    power: true,
  },
  {
    kind: 'bulb',
    serial: 'd073d5a1c002',
    address: '192.168.1.22',
    label: 'Floor Lamp',
    product: 27,
    firmware: { major: 2, minor: 80, build: FIRMWARE_BUILD },
    signal: 4e-6,
    group: LAMPS,
    location: LOCATION,
    color: white(3200, 0.7),
    power: true,
  },
  {
    kind: 'strip',
    serial: 'd073d5b2c003',
    address: '192.168.1.23',
    label: 'Shelf Strip',
    product: 32,
    firmware: { major: 2, minor: 80, build: FIRMWARE_BUILD },
    signal: 1.2e-5,
    group: ACCENTS,
    location: LOCATION,
    zones: 32,
    color: white(3000, 0.6),
    power: true,
  },
  {
    kind: 'tiles',
    serial: 'd073d5c3c004',
    address: '192.168.1.24',
    label: 'Wall Tiles',
    product: 55,
    firmware: { major: 3, minor: 50, build: FIRMWARE_BUILD },
    signal: 8e-6,
    group: ACCENTS,
    location: LOCATION,
    tiles: [{ x: 0, y: 0.5 }, { x: 1, y: 0 }, { x: 2, y: 0.5 }, { x: 3, y: 0 }, { x: 4, y: 0.5 }],
    color: white(3500, 0.25),
    power: true,
  },
];

/**
 * The entries of https://github.com/LIFX/products (products.json) for the
 * three products above, in that file's own shape — what `Products()` from
 * `lifxlan/products` takes. A real application would vendor or fetch the
 * whole file.
 */
export const PRODUCTS_EXCERPT: VendorDefinition[] = [
  {
    vid: 1,
    name: 'LIFX',
    defaults: {
      hev: false,
      color: false,
      chain: false,
      matrix: false,
      relays: false,
      buttons: false,
      infrared: false,
      multizone: false,
      temperature_range: null,
      extended_multizone: false,
    },
    products: [
      {
        pid: 27,
        name: 'LIFX A19',
        features: { color: true, temperature_range: [2500, 9000] },
        upgrades: [{ major: 2, minor: 80, features: { temperature_range: [1500, 9000] } }],
      },
      {
        pid: 32,
        name: 'LIFX Z',
        features: { color: true, multizone: true, temperature_range: [2500, 9000] },
        upgrades: [
          { major: 2, minor: 77, features: { extended_multizone: true } },
          { major: 2, minor: 80, features: { temperature_range: [1500, 9000] } },
        ],
      },
      {
        pid: 55,
        name: 'LIFX Tile',
        features: { color: true, chain: true, matrix: true, temperature_range: [2500, 9000] },
      },
    ],
  },
];
