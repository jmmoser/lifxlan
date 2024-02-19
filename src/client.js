import {
  Type,
  PORT,
  BROADCAST_ADDRESS,
  NO_TARGET,
} from './constants.js';
import {
  encode,
  decodeStateUnhandled,
} from './encoding.js';
import { PromiseWithResolvers } from './utils.js';

/**
 * @param {string} serialNumber
 * @param {number} sequence
 */
function getResponseKey(serialNumber, sequence) {
  return `${serialNumber}:${sequence}`;
}

/**
 * @param {number} [sequence]
 */
function incrementSequence(sequence) {
  /** Only allow up to 254. 255 is used for broadcast messages. */
  return sequence == null ? 0 : (sequence + 1) % 0xFF;
}

/**
 * @param {{
 *   router: ReturnType<typeof import('./router.js').Router>;
 *   defaultTimeoutMs?: number;
 *   source?: number;
 * }} options
 */
export function Client(options) {
  const source = options.source ?? options.router.nextSource();

  const defaultTimeoutMs = options.defaultTimeoutMs ?? 3000;
  const { router } = options;

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
    const key = getResponseKey(serialNumber, sequence);

    if (responseHandlerMap.has(key)) {
      throw new Error('Conflict');
    }

    /** @typedef {typeof PromiseWithResolvers<void>} Resolvers */
    const { resolve, reject, promise } = /** @type {Resolvers} */ (PromiseWithResolvers)();

    function onAbort(/** @type {any} */ ...args) {
      responseHandlerMap.delete(key);
      reject(...args);
    }

    /** @type {number} */
    let timeout;

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    } else {
      timeout = setTimeout(() => onAbort(new Error('Timeout')), defaultTimeoutMs);
    }

    responseHandlerMap.set(key, (type, bytes, offsetRef) => {
      if (type === Type.Acknowledgement || type === Type.StateUnhandled) {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        } else {
          clearTimeout(timeout);
        }
        responseHandlerMap.delete(key);
        if (type === Type.StateUnhandled) {
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
    const key = getResponseKey(serialNumber, sequence);

    if (responseHandlerMap.has(key)) {
      throw new Error('Conflict');
    }

    /** @typedef {typeof PromiseWithResolvers<T>} Resolvers */
    const { resolve, reject, promise } = /** @type {Resolvers} */ (PromiseWithResolvers)();

    function onAbort(/** @type {any} */ ...args) {
      responseHandlerMap.delete(key);
      reject(...args);
    }

    /** @type {number} */
    let timeout;

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    } else {
      timeout = setTimeout(() => onAbort(new Error('Timeout')), defaultTimeoutMs);
    }

    responseHandlerMap.set(key, (type, bytes, offsetRef) => {
      if (type === Type.Acknowledgement) {
        return;
      }
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      } else {
        clearTimeout(timeout);
      }
      responseHandlerMap.delete(key);
      if (type === Type.StateUnhandled) {
        const requestType = decodeStateUnhandled(bytes, offsetRef);
        reject(new Error(`Unhandled request type: ${requestType}`));
        return;
      }
      resolve(decode(bytes, offsetRef));
    });

    return promise;
  }

  let disposed = false;

  const client = {
    get router() {
      return router;
    },
    get source() {
      return source;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      router.deregister(source, client);
    },
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

      router.send(bytes, PORT, BROADCAST_ADDRESS);
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

      router.send(bytes, device.port, device.address, device.serialNumber);

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

      router.send(bytes, device.port, device.address, device.serialNumber);

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

      router.send(bytes, device.port, device.address, device.serialNumber);

      return promise;
    },
    /**
     * @param {ReturnType<typeof import('./encoding.js').decodeHeader>} header
     * @param {Uint8Array} payload
     * @param {string} serialNumber
     */
    onMessage(header, payload, serialNumber) {
      const responseHandlerEntry = responseHandlerMap.get(
        getResponseKey(serialNumber, header.sequence),
      );

      if (responseHandlerEntry) {
        responseHandlerEntry(header.type, payload, { current: 0 });
      }
    },
  };

  router.register(client, source);

  return client;
}
