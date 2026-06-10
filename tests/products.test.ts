import { describe, test } from 'bun:test';
import assert from 'node:assert';
import { Products } from '../src/products.js';
import type { VendorDefinition } from '../src/products.js';

// A trimmed-down slice of the real products.json shape.
const vendors: VendorDefinition[] = [
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
        pid: 32,
        name: 'LIFX Z',
        features: {
          color: true,
          multizone: true,
          temperature_range: [2500, 9000],
        },
        upgrades: [
          { major: 2, minor: 77, features: { extended_multizone: true } },
          { major: 2, minor: 80, features: { temperature_range: [1500, 9000] } },
        ],
      },
      {
        pid: 89,
        name: 'LIFX Switch',
        features: {
          relays: true,
          buttons: true,
        },
      },
    ],
  },
];

describe('products', () => {
  test('resolves base features against vendor defaults', () => {
    const products = Products(vendors);
    const z = products.get(1, 32);
    assert.ok(z);
    assert.equal(z.name, 'LIFX Z');
    assert.equal(z.vendorName, 'LIFX');
    assert.equal(z.features.color, true);
    assert.equal(z.features.multizone, true);
    // Vendor default applies where the product is silent.
    assert.equal(z.features.hev, false);
    // Upgrades are not applied without a firmware version.
    assert.equal(z.features.extended_multizone, false);
  });

  test('features() without firmware returns the conservative baseline', () => {
    const products = Products(vendors);
    const features = products.features(1, 32);
    assert.ok(features);
    assert.equal(features.extended_multizone, false);
    assert.deepEqual(features.temperature_range, [2500, 9000]);
  });

  test('features() applies every upgrade the firmware satisfies', () => {
    const products = Products(vendors);

    const old = products.features(1, 32, { major: 2, minor: 60 });
    assert.equal(old?.extended_multizone, false);

    const mid = products.features(1, 32, { major: 2, minor: 77 });
    assert.equal(mid?.extended_multizone, true);
    assert.deepEqual(mid?.temperature_range, [2500, 9000]);

    const latest = products.features(1, 32, { major: 3, minor: 0 });
    assert.equal(latest?.extended_multizone, true);
    assert.deepEqual(latest?.temperature_range, [1500, 9000]);
  });

  test('features() accepts the decodeStateHostFirmware shape directly', () => {
    const products = Products(vendors);
    const features = products.features(1, 32, { version_major: 2, version_minor: 80 });
    assert.equal(features?.extended_multizone, true);
    assert.deepEqual(features?.temperature_range, [1500, 9000]);
  });

  test('applying upgrades does not mutate the base features', () => {
    const products = Products(vendors);
    products.features(1, 32, { major: 3, minor: 0 });
    assert.equal(products.get(1, 32)?.features.extended_multizone, false);
  });

  test('unknown vendor or product ids return undefined', () => {
    const products = Products(vendors);
    assert.equal(products.get(2, 32), undefined);
    assert.equal(products.get(1, 9999), undefined);
    assert.equal(products.features(2, 32), undefined);
  });

  test('iterates all registered products', () => {
    const products = Products(vendors);
    const names = Array.from(products, (product) => product.name);
    assert.deepEqual(names.sort(), ['LIFX Switch', 'LIFX Z']);
  });

  test('switch capabilities resolve from product features', () => {
    const products = Products(vendors);
    const features = products.features(1, 89);
    assert.equal(features?.relays, true);
    assert.equal(features?.buttons, true);
    assert.equal(features?.color, false);
    assert.equal(features?.temperature_range, null);
  });
});
