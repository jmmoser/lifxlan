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