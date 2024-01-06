import { PORT } from './constants.js';
import { PromiseWithResolvers } from './utils.js';

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
 */
function convertSerialNumberToTarget(serialNumber) {
  if (serialNumber.length !== 12) {
    throw new Error('Invalid serial number');
  }
  const target = new Uint8Array(6);
  for (let i = 0; i < 6; i++) {
    target[i] = parseInt(serialNumber.slice(2 * i, 2 * (i + 1)), 16);
  }
  return target;
}

/**
 * @param {{
 *   serialNumber: string;
 *   address: string;
 *   port?: number;
 *   target?: Uint8Array;
 *   sequence?: number;
 * }} config
 * @returns {Device}
 */
export function Device(config) {
  config.port ??= PORT;
  config.target ??= convertSerialNumberToTarget(config.serialNumber);
  config.sequence = 0;
  return /** @type {Device} */ (config);
}

/**
 * @param {{
 *   onAdded?: (device: Device) => void;
 *   defaultTimeoutMs?: number;
 * }} [options]
 */
export function Devices(options) {
  const defaultTimeoutMs = options?.defaultTimeoutMs ?? 3000;
  const onAdded = options?.onAdded;

  const knownDevices = /** @type {Map<string, Device>} */ (new Map());

  const deviceResolvers = /** @type {Map<string, Set<(device: Device) => void>>} */ (new Map());

  /**
   * @param {string} serialNumber
   * @param {number} port
   * @param {string} address
   * @param {Uint8Array} [target]
   */
  function registerDevice(serialNumber, port, address, target) {
    const existingDevice = knownDevices.get(serialNumber);
    if (existingDevice) {
      existingDevice.port = port;
      existingDevice.address = address;
      return existingDevice;
    }
    const device = Device({
      serialNumber, port, address, target,
    });
    knownDevices.set(serialNumber, device);
    if (onAdded) {
      onAdded(device);
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
      const device = registerDevice(
        serialNumber,
        port,
        address,
        target,
      );

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
     */
    remove(serialNumber) {
      knownDevices.delete(serialNumber);
      deviceResolvers.delete(serialNumber);
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
