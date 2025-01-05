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
 * @param {number} h [0-65535]
 * @param {number} s [0-65535]
 * @param {number} b [0-65535]
 * @returns {[number, number, number]} RGB values [0-255]
 */
export function hsbToRgb(h, s, b) {
  h = (h * 6) / 65535;
  s = s / 65535;
  b = b * 255 / 65535;

  const i = Math.floor(h);
  const f = h - i;
  const p = b * (1 - s);
  const q = b * (1 - s * f);
  const t = b * (1 - s * (1 - f));

  let r, g, bl;

  switch (i) {
    case 0: r = b; g = t; bl = p; break;
    case 1: r = q; g = b; bl = p; break;
    case 2: r = p; g = b; bl = t; break;
    case 3: r = p; g = q; bl = b; break;
    case 4: r = t; g = p; bl = b; break;
    default: r = b; g = p; bl = q;
  }

  return /** @type {const} */ ([Math.round(r), Math.round(g), Math.round(bl)]);
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
      str += '0' + chunk;
    } else {
      str += chunk;
    }
  }
  return str;
}

/**
 * @param {string} serialNumber
 */
export function convertSerialNumberToTarget(serialNumber) {
  if (serialNumber.length !== 12) {
    throw new Error('Invalid serial number');
  }
  const target = new Uint8Array(6);
  for (let i = 0; i < 6; i++) {
    const offset = 2 * i;
    target[i] = parseInt(serialNumber.slice(offset, offset + 2), 16);
  }
  return target;
}