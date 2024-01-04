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
 * @param {string} serialNumber
 * @param {number} sequence
 */
function getResponseKey(serialNumber, sequence) {
  return `${serialNumber}:${sequence}`;
}

/**
 * @param {{
 *   onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
 *   devices?: ReturnType<typeof import('./devices.js').Devices>;
 *   defaultTimeoutMs?: number;
 *   source?: number;
 * }} options
 */
export function Client(options) {
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 3000;
  const source = options.source ?? Math.floor(Math.random() * 65534) + 2;

  const { onSend, devices } = options;

  /**
   * @param {number} [sequence]
   */
  function incrementSequence(sequence) {
    /** Only allow up to 254. 255 is used for broadcast messages. */
    return sequence == null ? 0 : (sequence + 1) % 0xFF;
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

  return {
    /**
     * Broadcast a command to the local network.
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
        0xFF,
        command.type,
        command.payload,
      );

      onSend(bytes, PORT, BROADCAST_ADDRESS, true);
    },
    /**
     * Send a command to a device without expecting a response or acknowledgement.
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {import('./devices.js').Device} device
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

      onSend(bytes, device.port, device.address, false);

      device.sequence = incrementSequence(device.sequence);
    },
    /**
     * Send a command to a device and only require an acknowledgement.
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {import('./devices.js').Device} device
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

      onSend(bytes, device.port, device.address, false);

      return promise;
    },
    /**
     * Send a command to a device and require a response.
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {import('./devices.js').Device} device
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

      onSend(bytes, device.port, device.address, false);

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

      const payload = message.subarray(offsetRef.current);

      if (devices) {
        const device = devices.register(
          convertTargetToSerialNumber(header.target),
          port,
          address,
          header.target,
        );

        const responseHandlerEntry = responseHandlerMap.get(
          getResponseKey(device.serialNumber, header.sequence),
        );

        if (responseHandlerEntry) {
          responseHandlerEntry(header.type, message, offsetRef);
        }
      }

      return {
        header,
        payload,
      };
    },
  };
}
