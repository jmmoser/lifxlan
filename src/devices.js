import {
  PromiseWithResolvers,
} from './utils.js';

/**
 * @typedef {{
 *   address: string;
 *   port: number;
 *   target: Uint8Array;
 *   serialNumber: string;
 *   sequence: number;
 * }} Device
 */

/**
 * @param {string} serialNumber
 * @param {number} port
 * @param {string} address
 * @param {Uint8Array} target
 * @returns {Device}
 */
function createDevice(serialNumber, port, address, target) {
  return {
    serialNumber,
    port,
    address,
    target,
    sequence: 0,
  };
}

/**
 * @param {{
 *   onRegistered?: (device: Device) => void;
 *   defaultTimeoutMs?: number;
 * }} options
 */
export function Devices(options) {
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 3000;

  const knownDevices = /** @type {Map<string, Device>} */ (new Map());

  const deviceResolvers = /** @type {Map<string, Set<(device: Device) => void>>} */ (new Map());

  /**
   * @param {number} port
   * @param {string} address
   * @param {Uint8Array} target
   * @param {string} serialNumber
   */
  function registerDevice(port, address, target, serialNumber) {
    const existingDevice = knownDevices.get(serialNumber);
    if (existingDevice) {
      existingDevice.port = port;
      existingDevice.address = address;
      return existingDevice;
    }
    const device = createDevice(serialNumber, port, address, target);
    knownDevices.set(serialNumber, device);
    if (options.onRegistered) {
      options.onRegistered(device);
    }
    return device;
  }

  return {
    /**
     * @param {string} serialNumber
     * @param {number} port
     * @param {string} address
     * @param {Uint8Array} [target]
     */
    register(serialNumber, port, address, target) {
      if (serialNumber.length !== 12) {
        throw new Error('Invalid serial number');
      }
      if (!target) {
        target = new Uint8Array(6);
        for (let i = 0; i < 6; i++) {
          target[i] = parseInt(serialNumber.slice(2 * i, 2 * (i + 1)), 16);
        }
      }
      const device = registerDevice(port, address, target, serialNumber);

      const resolvers = deviceResolvers.get(serialNumber);
      if (resolvers) {
        deviceResolvers.delete(serialNumber);
        resolvers.forEach((resolver) => {
          resolver(device);
        });
      }
      return device;
    },
    /**
     * @param {string} serialNumber
     * @param {AbortSignal} [signal]
     */
    get(serialNumber, signal) {
      const knownDevice = knownDevices.get(serialNumber);
      if (knownDevice) {
        return knownDevice;
      }

      /** @typedef {typeof PromiseWithResolvers<Device>} Resolvers */
      const { resolve, reject, promise } = /** @type {Resolvers} */ (PromiseWithResolvers)();

      function onAbort(...args) {
        const resolvers = deviceResolvers.get(serialNumber);
        if (resolvers) {
          if (resolvers.size > 1) {
            resolvers.delete(resolve);
          } else {
            deviceResolvers.delete(serialNumber);
          }
        }
        reject(...args);
      }

      let timeout;

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      } else {
        timeout = setTimeout(() => onAbort(new Error('Timeout')), defaultTimeoutMs);
      }

      /**
       * @param {Device} device
       */
      const resolver = (device) => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        } else {
          clearTimeout(timeout);
        }
        resolve(device);
      };

      const resolvers = deviceResolvers.get(serialNumber);
      if (!resolvers) {
        deviceResolvers.set(serialNumber, new Set([resolver]));
      } else {
        resolvers.add(resolver);
      }

      return promise;
    },
  };
}
