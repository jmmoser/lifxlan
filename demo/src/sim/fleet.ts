/**
 * The devices plugged into the virtual network, and the excerpt of the
 * official products.json that describes them.
 */
import type { VendorDefinition } from '../../../src/products.js';
import type { DeviceSpec } from './firmware.js';

const LOCATION = { id: '4b9d3c2e7f1a4c0e9a6d2b8f5e3c1a70', label: 'Home' };
const ROOMS = { id: '1f6e0c9a3b5d4e7f8a2c4d6e8f0a1b3c', label: 'Rooms' };
const HALL = { id: '9c8b7a6d5e4f40312a1b0c9d8e7f6a5b', label: 'Hallway' };
const LIVING = { id: '5a4b3c2d1e0f4a9b8c7d6e5f4a3b2c1d', label: 'Living room' };

const FIRMWARE_BUILD = new Date('2024-03-12T09:30:00Z');

/** Kelvin-only white: saturation 0, so `kelvin` sets the tint. */
const white = (kelvin: number, brightness: number) => ({ hue: 0, saturation: 0, brightness: Math.round(brightness * 65535), kelvin });

const bulb = (n: number, label: string, signal: number, group: { id: string; label: string }): DeviceSpec => ({
  kind: 'bulb',
  serial: `d073d5a1c00${n}`,
  address: `192.168.1.2${n}`,
  label,
  product: 27,
  firmware: { major: 2, minor: 80, build: FIRMWARE_BUILD },
  signal,
  group,
  location: LOCATION,
  color: white(2700, 0.8),
  power: true,
});

/** Every device in the house, in the order the game brings them online. */
export const FLEET: readonly DeviceSpec[] = [
  bulb(1, 'Entry Light', 2.5e-5, HALL),
  bulb(2, 'Kitchen Pendant', 4e-6, ROOMS),
  bulb(3, 'Bedroom Lamp', 9e-6, ROOMS),
  bulb(4, 'Landing Light', 1.6e-5, HALL),
  {
    kind: 'strip',
    serial: 'd073d5b2c005',
    address: '192.168.1.25',
    label: 'Hallway Strip',
    product: 32,
    firmware: { major: 2, minor: 80, build: FIRMWARE_BUILD },
    signal: 1.2e-5,
    group: HALL,
    location: LOCATION,
    zones: 32,
    color: white(3000, 0.7),
    power: true,
  },
  {
    kind: 'tiles',
    serial: 'd073d5c3c006',
    address: '192.168.1.26',
    label: 'Ceiling Tiles',
    product: 55,
    firmware: { major: 3, minor: 50, build: FIRMWARE_BUILD },
    signal: 3e-5,
    group: LIVING,
    location: LOCATION,
    // Five panels ringed around the router, in tile widths from its position.
    tiles: [{ x: -3, y: -0.5 }, { x: -0.5, y: -2.875 }, { x: 2, y: -0.5 }, { x: -1.875, y: 1.875 }, { x: 0.875, y: 1.875 }],
    color: white(3500, 0.55),
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
