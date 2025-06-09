export const NOOP = (_value: unknown) => {};

export function PromiseWithResolvers<T>(): {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  promise: Promise<T>;
} {
  let resolve = NOOP as (value: T) => void;
  let reject = NOOP as (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}

export type RssiStatus = 'none' | 'very bad' | 'somewhat bad' | 'alright' | 'good';

export function getRssiStatus(rssi: number): RssiStatus {
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

export function convertSignalToRssi(signal: number): number {
  return Math.floor(10 * Math.log10(signal) + 0.5);
}

export function convertTargetToSerialNumber(slice: Uint8Array): string {
  let str = '';
  const { length } = slice;
  for (let i = 0; i < length; i++) {
    const chunk = slice[i]!.toString(16);
    if (chunk.length < 2) {
      str += '0' + chunk;
    } else {
      str += chunk;
    }
  }
  return str;
}

export function convertSerialNumberToTarget(serialNumber: string): Uint8Array {
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