/**
 * Product registry for resolving device capabilities from the official LIFX
 * products list (https://github.com/LIFX/products).
 *
 * This module is published as the `lifxlan/products` subpath export and is
 * intentionally not re-exported from the package root, so applications that
 * never look up capabilities pay nothing for it.
 *
 * In keeping with the bring-your-own-socket philosophy, this module does not
 * fetch anything: pass it the parsed products.json data, whether downloaded
 * at runtime from {@link PRODUCTS_URL} or vendored into your application.
 *
 * @example
 * ```javascript
 * import { PRODUCTS_URL, GetVersion, GetHostFirmware } from 'lifxlan';
 * import { Products } from 'lifxlan/products';
 *
 * const products = Products(await (await fetch(PRODUCTS_URL)).json());
 *
 * const version = await client.send(GetVersion(), device);
 * const firmware = await client.send(GetHostFirmware(), device);
 * const features = products.features(version.vendor, version.product, firmware);
 * if (features?.extended_multizone) {
 *   // safe to use SetExtendedColorZones
 * }
 * ```
 */

/**
 * The capability flags published for a product. Matches the `defaults` and
 * `features` objects in products.json.
 */
export interface ProductFeatures {
  /** Supports HEV (germicidal) cycles. */
  hev: boolean;
  /** Supports color (hue/saturation). */
  color: boolean;
  /** May be linked as a chain of devices (original LIFX Tile). */
  chain: boolean;
  /** Has a 2D matrix of zones (Tile, Candle, Path, Ceiling, ...). */
  matrix: boolean;
  /** Has relays for controlling physical power (LIFX Switch). */
  relays: boolean;
  /** Has physical buttons (LIFX Switch). */
  buttons: boolean;
  /** Supports infrared output. */
  infrared: boolean;
  /** Has a linear strip of zones (Z, Beam, Neon, String, ...). */
  multizone: boolean;
  /** Supports the extended multizone messages (Get/SetExtendedColorZones). */
  extended_multizone: boolean;
  /** Supported kelvin range, or null for fixed-temperature products. */
  temperature_range: [number, number] | null;
}

/**
 * A feature delta that applies once the device runs at least the given
 * host firmware version.
 */
export interface ProductUpgrade {
  major: number;
  minor: number;
  features: Partial<ProductFeatures>;
}

/** A single product entry in products.json. */
export interface ProductDefinition {
  pid: number;
  name: string;
  features: Partial<ProductFeatures>;
  upgrades?: ProductUpgrade[];
}

/** A vendor entry in products.json (the file is an array of these). */
export interface VendorDefinition {
  vid: number;
  name: string;
  defaults?: Partial<ProductFeatures>;
  products: ProductDefinition[];
}

/** A product with its base features fully resolved against vendor defaults. */
export interface Product {
  vid: number;
  vendorName: string;
  pid: number;
  name: string;
  /**
   * Features as built, without firmware upgrades applied. Use
   * {@link ProductsInstance.features} to resolve against a firmware version.
   */
  features: ProductFeatures;
  upgrades: readonly ProductUpgrade[];
}

/**
 * A host firmware version, either as `{ major, minor }` or in the shape
 * returned by `decodeStateHostFirmware` so the decoded response of a
 * `GetHostFirmware` can be passed directly.
 */
export type FirmwareVersion =
  | { major: number; minor: number }
  | { version_major: number; version_minor: number };

export interface ProductsInstance {
  /** Looks up a product by the vendor/product ids from a StateVersion response. */
  get(vendorId: number, productId: number): Product | undefined;
  /**
   * Resolves the features of a product, applying every firmware upgrade the
   * given version satisfies. Without a firmware version, upgrades are not
   * applied (the conservative baseline). Returns undefined for unknown
   * vendor/product ids.
   */
  features(vendorId: number, productId: number, firmware?: FirmwareVersion): ProductFeatures | undefined;
  [Symbol.iterator](): Iterator<Product>;
}

const BASE_FEATURES: ProductFeatures = {
  hev: false,
  color: false,
  chain: false,
  matrix: false,
  relays: false,
  buttons: false,
  infrared: false,
  multizone: false,
  extended_multizone: false,
  temperature_range: null,
};

const NO_UPGRADES: readonly ProductUpgrade[] = [];

export function Products(vendors: readonly VendorDefinition[]): ProductsInstance {
  const byVendor = new Map<number, Map<number, Product>>();

  for (const vendor of vendors) {
    let byProduct = byVendor.get(vendor.vid);
    if (!byProduct) {
      byProduct = new Map();
      byVendor.set(vendor.vid, byProduct);
    }
    for (const product of vendor.products) {
      byProduct.set(product.pid, {
        vid: vendor.vid,
        vendorName: vendor.name,
        pid: product.pid,
        name: product.name,
        features: { ...BASE_FEATURES, ...vendor.defaults, ...product.features },
        upgrades: product.upgrades ?? NO_UPGRADES,
      });
    }
  }

  return {
    get(vendorId: number, productId: number): Product | undefined {
      return byVendor.get(vendorId)?.get(productId);
    },
    features(vendorId: number, productId: number, firmware?: FirmwareVersion): ProductFeatures | undefined {
      const product = byVendor.get(vendorId)?.get(productId);
      if (!product) return undefined;
      if (!firmware || product.upgrades.length === 0) return product.features;

      const major = 'major' in firmware ? firmware.major : firmware.version_major;
      const minor = 'minor' in firmware ? firmware.minor : firmware.version_minor;

      let features = product.features;
      for (const upgrade of product.upgrades) {
        if (major > upgrade.major || (major === upgrade.major && minor >= upgrade.minor)) {
          features = { ...features, ...upgrade.features };
        }
      }
      return features;
    },
    *[Symbol.iterator](): Iterator<Product> {
      for (const byProduct of byVendor.values()) {
        yield* byProduct.values();
      }
    },
  };
}
