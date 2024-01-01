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
  };
}

/**
 * @param {{
 *   onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
 *   onDevice?: (device: Device) => void;
 *   defaultTimeoutMs?: number;
 * }} options
 */
export function Client(options) {
  let globalSource = 2; // 0 and 1 are reserved

  options.defaultTimeoutMs = options.defaultTimeoutMs ?? 3000;

  /**
   * @param {number} [source]
   */
  function incrementSource(source) {
    if (source == null) {
      source = globalSource;
      globalSource = (globalSource + 1) % 0x10000;
      globalSource = globalSource <= 1 ? 2 : globalSource;
    }
    return source;
  }

  /**
   * @param {number} [sequence]
   */
  function incrementSequence(sequence) {
    return sequence == null ? 0 : (sequence + 1) % 0x100;
  }

  /**
   * @type {Map<number, (type: number, bytes: Uint8Array, ref: { current: number; }) => void>}
   */
  const responseHandlerMap = new Map();

  /**
   * @param {number} source
   * @param {AbortSignal} [signal]
   */
  function registerAckRequest(source, signal) {
    /** @typedef {typeof PromiseWithResolvers<void>} Resolvers */
    const { resolve, reject, promise } = /** @type {Resolvers} */ (PromiseWithResolvers)();

    function onAbort(...args) {
      responseHandlerMap.delete(source);
      reject(...args);
    }

    let timeout;

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    } else {
      timeout = setTimeout(() => onAbort(new Error('Timeout')), options.defaultTimeoutMs);
    }

    responseHandlerMap.set(source, (type, bytes, offsetRef) => {
      if (type === TYPE.Acknowledgement || type === TYPE.StateUnhandled) {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        } else {
          clearTimeout(timeout);
        }
        responseHandlerMap.delete(source);
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
   * @param {number} source
   * @param {import('./commands.js').Decoder<T>} decoder
   * @param {AbortSignal} [signal]
   */
  function registerRequest(source, decoder, signal) {
    /** @typedef {typeof PromiseWithResolvers<T>} Resolvers */
    const { resolve, reject, promise } = /** @type {Resolvers} */ (PromiseWithResolvers)();

    function onAbort(...args) {
      responseHandlerMap.delete(source);
      reject(...args);
    }

    let timeout;

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    } else {
      timeout = setTimeout(() => onAbort(new Error('Timeout')), options.defaultTimeoutMs);
    }

    responseHandlerMap.set(source, (type, bytes, offsetRef) => {
      if (type === TYPE.Acknowledgement) {
        return;
      }
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      } else {
        clearTimeout(timeout);
      }
      responseHandlerMap.delete(source);
      if (type === TYPE.StateUnhandled) {
        const requestType = decodeStateUnhandled(bytes, offsetRef);
        reject(new Error(`Unhandled request type: ${requestType}`));
        return;
      }
      resolve(decoder(bytes, offsetRef));
    });

    return promise;
  }

  const knownDevices = /** @type {Map<string, Device>} */ (new Map());

  const getDeviceResolvers = /** @type {Map<string, ((device: Device) => void)[]>} */ (new Map());

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
     * @template T
     * @param {import('./commands.js').Command<T>} command
     */
    broadcast(command) {
      command.source = incrementSource(command.source);
      command.sequence = incrementSequence(command.sequence);

      const bytes = encode(
        true,
        command.source,
        NO_TARGET,
        true,
        false,
        command.sequence,
        command.type,
        command.payload,
      );

      options.onSend(bytes, PORT, BROADCAST_ADDRESS, true);
    },
    /**
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {Device} device
     */
    unicast(command, device) {
      command.source = incrementSource(command.source);
      command.sequence = incrementSequence(command.sequence);

      const bytes = encode(
        false,
        command.source,
        device.target,
        false,
        false,
        command.sequence,
        command.type,
        command.payload,
      );

      options.onSend(bytes, device.port, device.address, false);
    },
    /**
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {Device} device
     * @param {AbortSignal} [signal]
     * @returns {Promise<void>}
     */
    sendOnlyAcknowledgement(command, device, signal) {
      command.source = incrementSource(command.source);
      command.sequence = incrementSequence(command.sequence);

      const bytes = encode(
        false,
        command.source,
        device.target,
        false,
        true,
        command.sequence,
        command.type,
        command.payload,
      );

      const promise = registerAckRequest(command.source, signal);

      options.onSend(bytes, device.port, device.address, false);

      return promise;
    },
    /**
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {Device} device
     * @param {AbortSignal} [signal]
     * @returns {Promise<T>}
     */
    send(command, device, signal) {
      command.source = incrementSource(command.source);
      command.sequence = incrementSequence(command.sequence);

      const bytes = encode(
        false,
        command.source,
        device.target,
        true,
        false,
        command.sequence,
        command.type,
        command.payload,
      );

      const promise = registerRequest(command.source, command.decoder, signal);

      options.onSend(bytes, device.port, device.address, false);

      return promise;
    },
    /**
     * @param {string} serialNumber
     */
    getDevice(serialNumber) {
      const device = knownDevices.get(serialNumber);
      if (device) {
        return device;
      }

      /** @typedef {typeof PromiseWithResolvers<Device>} Resolvers */
      const { resolve, promise } = /** @type {Resolvers} */ (PromiseWithResolvers)();

      const deviceResolvers = getDeviceResolvers.get(serialNumber);
      if (!deviceResolvers) {
        getDeviceResolvers.set(serialNumber, [resolve]);
      } else {
        deviceResolvers.push(resolve);
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

      const responseHandlerEntry = responseHandlerMap.get(header.source);
      if (responseHandlerEntry) {
        responseHandlerEntry(header.type, message, offsetRef);
      }

      const resolvers = getDeviceResolvers.get(device.serialNumber);
      if (resolvers) {
        getDeviceResolvers.delete(device.serialNumber);
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
