import {
  TYPE,
  PORT,
  BROADCAST_ADDRESS,
  NO_TARGET,
} from './constants.js';
import {
  encode,
  decodeHeader,
  decodeStateUnhandled,
} from './encoding.js';
import {
  PromiseWithResolvers,
  convertTargetToSerialNumber,
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
 * @param {string} serialNumber
 * @param {number} sequence
 */
function getResponseKey(serialNumber, sequence) {
  return `${serialNumber}:${sequence}`;
}

/**
 * @param {{
 *   onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
 *   onDevice?: (device: Device) => void;
 *   defaultTimeoutMs?: number;
 *   source?: number;
 * }} options
 */
export function Client(options) {
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 3000;
  const source = options.source ?? Math.floor(Math.random() * 65534) + 2;

  /**
   * @param {number} [sequence]
   */
  function incrementSequence(sequence) {
    return sequence == null ? 0 : (sequence + 1) % 0x100;
  }

  /**
   * @type {Map<string, (type: number, bytes: Uint8Array, ref: { current: number; }) => void>}
   */
  const responseHandlerMap = new Map();

  /**
   * @param {string} serialNumber
   * @param {number} sequence
   * @param {AbortSignal} [signal]
   */
  function registerAckRequest(serialNumber, sequence, signal) {
    /** @typedef {typeof PromiseWithResolvers<void>} Resolvers */
    const { resolve, reject, promise } = /** @type {Resolvers} */ (PromiseWithResolvers)();

    const key = getResponseKey(serialNumber, sequence);

    function onAbort(...args) {
      responseHandlerMap.delete(key);
      reject(...args);
    }

    let timeout;

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    } else {
      timeout = setTimeout(() => onAbort(new Error('Timeout')), defaultTimeoutMs);
    }

    responseHandlerMap.set(key, (type, bytes, offsetRef) => {
      if (type === TYPE.Acknowledgement || type === TYPE.StateUnhandled) {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        } else {
          clearTimeout(timeout);
        }
        responseHandlerMap.delete(key);
        if (type === TYPE.StateUnhandled) {
          const requestType = decodeStateUnhandled(bytes, offsetRef);
          reject(new Error(`Unhandled request type: ${requestType}`));
          return;
        }
        resolve();
      }
    });

    return promise;
  }

  /**
   * @template T
   * @param {string} serialNumber
   * @param {number} sequence
   * @param {import('./commands.js').Decoder<T>} decode
   * @param {AbortSignal} [signal]
   */
  function registerRequest(serialNumber, sequence, decode, signal) {
    /** @typedef {typeof PromiseWithResolvers<T>} Resolvers */
    const { resolve, reject, promise } = /** @type {Resolvers} */ (PromiseWithResolvers)();

    const key = getResponseKey(serialNumber, sequence);

    function onAbort(...args) {
      responseHandlerMap.delete(key);
      reject(...args);
    }

    let timeout;

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    } else {
      timeout = setTimeout(() => onAbort(new Error('Timeout')), defaultTimeoutMs);
    }

    responseHandlerMap.set(key, (type, bytes, offsetRef) => {
      if (type === TYPE.Acknowledgement) {
        return;
      }
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      } else {
        clearTimeout(timeout);
      }
      responseHandlerMap.delete(key);
      if (type === TYPE.StateUnhandled) {
        const requestType = decodeStateUnhandled(bytes, offsetRef);
        reject(new Error(`Unhandled request type: ${requestType}`));
        return;
      }
      resolve(decode(bytes, offsetRef));
    });

    return promise;
  }

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
    if (options.onDevice) {
      options.onDevice(device);
    }
    return device;
  }

  return {
    /**
     * @param {string} serialNumber
     * @param {number} port
     * @param {string} address
     */
    registerDevice(serialNumber, port, address) {
      if (serialNumber.length !== 12) {
        throw new Error('Invalid serial number');
      }
      const target = new Uint8Array(6);
      for (let i = 0; i < 6; i++) {
        target[i] = parseInt(serialNumber.slice(2 * i, 2 * (i + 1)), 16);
      }
      return registerDevice(port, address, target, serialNumber);
    },
    get devices() {
      return knownDevices;
    },
    /**
     * Broadcast a command to all devices.
     * @template T
     * @param {import('./commands.js').Command<T>} command
     */
    broadcast(command) {
      const bytes = encode(
        true,
        source,
        NO_TARGET,
        false,
        false,
        0,
        command.type,
        command.payload,
      );

      options.onSend(bytes, PORT, BROADCAST_ADDRESS, true);
    },
    /**
     * Send a command to a device without expecting a response or acknowledgement.
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {Device} device
     */
    unicast(command, device) {
      const bytes = encode(
        false,
        source,
        device.target,
        false,
        false,
        device.sequence,
        command.type,
        command.payload,
      );

      options.onSend(bytes, device.port, device.address, false);

      device.sequence = incrementSequence(device.sequence);
    },
    /**
     * Send a command to a device and only require an acknowledgement.
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {Device} device
     * @param {AbortSignal} [signal]
     * @returns {Promise<void>}
     */
    sendOnlyAcknowledgement(command, device, signal) {
      const bytes = encode(
        false,
        source,
        device.target,
        false,
        true,
        device.sequence,
        command.type,
        command.payload,
      );

      const promise = registerAckRequest(device.serialNumber, device.sequence, signal);

      device.sequence = incrementSequence(device.sequence);

      options.onSend(bytes, device.port, device.address, false);

      return promise;
    },
    /**
     * Send a command to a device and require a response.
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {Device} device
     * @param {AbortSignal} [signal]
     * @returns {Promise<T>}
     */
    send(command, device, signal) {
      const bytes = encode(
        false,
        source,
        device.target,
        true,
        false,
        device.sequence,
        command.type,
        command.payload,
      );

      const promise = registerRequest(device.serialNumber, device.sequence, command.decode, signal);

      device.sequence = incrementSequence(device.sequence);

      options.onSend(bytes, device.port, device.address, false);

      return promise;
    },
    /**
     * @param {string} serialNumber
     * @param {AbortSignal} [signal]
     */
    getDevice(serialNumber, signal) {
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
    /**
     * @param {Uint8Array} message
     * @param {number} port
     * @param {string} address
     */
    onReceived(message, port, address) {
      const offsetRef = { current: 0 };
      const header = decodeHeader(message, offsetRef);

      const device = registerDevice(
        port,
        address,
        header.target,
        convertTargetToSerialNumber(header.target),
      );

      const payload = message.subarray(offsetRef.current);

      const responseHandlerEntry = responseHandlerMap.get(
        getResponseKey(device.serialNumber, header.sequence),
      );

      if (responseHandlerEntry) {
        responseHandlerEntry(header.type, message, offsetRef);
      }

      const resolvers = deviceResolvers.get(device.serialNumber);
      if (resolvers) {
        deviceResolvers.delete(device.serialNumber);
        resolvers.forEach((resolver) => {
          resolver(device);
        });
      }

      return {
        header,
        payload,
      };
    },
  };
}
