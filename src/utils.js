// eslint-disable-next-line no-unused-vars
export const NOOP = (/** @type {any} */ value) => {};

/**
 * @template T
 * @returns {{
 *   resolve: (value: T) => void;
 *   reject: (reason?: any) => void;
 *   promise: Promise<T>;
 * }}
 */
export function PromiseWithResolvers() {
  let resolve = NOOP;
  let reject = NOOP;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}

/**
 * https://github.com/Chalarangelo/30-seconds-of-code/blob/master/content/snippets/js/s/hsb-to-rgb.md
 *
 * @param {number} h [0-65535]
 * @param {number} s [0-65535]
 * @param {number} b [0-65535]
 */
export function hsbToRgb(h, s, b) {
  h *= 360 / 65535;
  s /= 65535;
  b /= 65535;
  const k = (/** @type {number} */ n) => (n + h / 60) % 6;
  const f = (/** @type {number} */ n) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  return /** @type {const} */ ([
    Math.round(255 * f(5)),
    Math.round(255 * f(3)),
    Math.round(255 * f(1)),
  ]);
}

/**
 * https://github.com/Chalarangelo/30-seconds-of-code/blob/master/content/snippets/js/s/rgb-to-hsb.md
 *
 * @param {number} r [0-255]
 * @param {number} g [0-255]
 * @param {number} b [0-255]
 */
export function rgbToHsb(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const v = Math.max(r, g, b);
  const n = v - Math.min(r, g, b);
  // eslint-disable-next-line no-nested-ternary
  const h = n === 0 ? 0 : n && v === r ? (g - b) / n : v === g ? 2 + (b - r) / n : 4 + (r - g) / n;
  return /** @type {const} */ ([
    Math.round((60 * (h < 0 ? h + 6 : h)) * (65535 / 360)),
    Math.round(v && (n / v) * 65535),
    Math.round(v * 65535),
  ]);
}

/**
 * @param {number} rssi
 */
export function getRssiStatus(rssi) {
  if (rssi === 200) return 'none';

  if (rssi < -80 || rssi === 4 || rssi === 5 || rssi === 6) {
    return 'very bad';
  }

  if (rssi < -70 || (rssi >= 7 && rssi <= 11)) {
    return 'somewhat bad';
  }

  if (rssi < -60 || (rssi >= 12 && rssi <= 16)) {
    return 'alright';
  }

  if (rssi < 0 || rssi > 16) {
    return 'good';
  }

  return 'none';
}

/**
 * @param {number} signal
 */
export function convertSignalToRssi(signal) {
  return Math.floor(10 * Math.log10(signal) + 0.5);
}

/**
 * @param {Uint8Array} slice
 */
export function convertTargetToSerialNumber(slice) {
  let str = '';
  const { length } = slice;
  for (let i = 0; i < length; i++) {
    const chunk = slice[i].toString(16);
    if (chunk.length < 2) {
      // eslint-disable-next-line prefer-template
      str += '0' + chunk;
    } else {
      str += chunk;
    }
  }
  return str;
}
