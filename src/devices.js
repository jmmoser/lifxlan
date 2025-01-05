import { NO_TARGET, PORT } from './constants.js';
import { convertSerialNumberToTarget, PromiseWithResolvers } from './utils.js';

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
 * @param {{
 *   address: string;
 *   serialNumber?: string;
 *   port?: number;
 *   target?: Uint8Array;
 *   sequence?: number;
 * }} config
 */
export function Device(config) {
  config.port ??= PORT;
  config.target ??= config.serialNumber ? convertSerialNumberToTarget(config.serialNumber) : NO_TARGET;
  config.sequence = 0;
  return /** @type {Device} */ (config);
}

/**
 * @param {{
 *   onAdded?: (device: Device) => void;
 *   onChanged?: (device: Device) => void;
 *   onRemoved?: (device: Device) => void;
 *   defaultTimeoutMs?: number;
 * }} [options]
 */
export function Devices(options) {
  const defaultTimeoutMs = options?.defaultTimeoutMs ?? 3000;
  const onAdded = options?.onAdded;
  const onChanged = options?.onChanged;
  const onRemoved = options?.onRemoved;

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
      if (port !== existingDevice.port || address !== existingDevice.address) {
        existingDevice.port = port;
        existingDevice.address = address;
        if (onChanged) {
          onChanged(existingDevice);
        }
      }
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
    get registered() {
      return knownDevices;
    },
    /**
     * @param {string} serialNumber
     * @param {number} port
     * @param {string} address
     * @param {Uint8Array} [target]
     * @returns {Device}
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
     * @returns {boolean}
     */
    remove(serialNumber) {
      const device = knownDevices.get(serialNumber);
      const removed = knownDevices.delete(serialNumber);
      if (device && onRemoved) {
        onRemoved(device);
      }
      return removed;
    },
    /**
     * @param {string} serialNumber
     * @param {AbortSignal} [signal]
     * @returns {Promise<Device>}
     */
    get(serialNumber, signal) {
      const knownDevice = knownDevices.get(serialNumber);
      if (knownDevice) {
        return Promise.resolve(knownDevice);
      }

      /** @typedef {typeof PromiseWithResolvers<Device>} Resolvers */
      const { resolve, reject, promise } = /** @type {Resolvers} */ (PromiseWithResolvers)();

      /**
       * @param {any} errOrEvent
       */
      function onAbort(errOrEvent) {
        const resolvers = deviceResolvers.get(serialNumber);
        if (resolvers) {
          if (resolvers.size > 1) {
            resolvers.delete(resolve);
          } else {
            deviceResolvers.delete(serialNumber);
          }
        }
        reject(errOrEvent instanceof Error ? errOrEvent : new Error('Abort'));
      }

      /** @type {any} */
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
