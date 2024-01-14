import { decodeHeader } from './encoding.js';

/**
 * @typedef {{
 *   onMessage: (
 *     header: ReturnType<typeof decodeHeader>,
 *     payload: Uint8Array,
 *     serialNumber: string,
 *   ) => void;
 * }} MessageHandler
 */

/**
 * @param {Uint8Array} slice
 */
function convertTargetToSerialNumber(slice) {
  let str = '';
  const { length } = slice;
  for (let i = 0; i < length; i++) {
    str += slice[i].toString(16).padStart(2, '0');
  }
  return str;
}

/**
 * @param {{
 *   onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
 * }} options
 */
export function Router(options) {
  /**
   * @type {Map<number, MessageHandler>}
   */
  const handlers = new Map();

  let sourceCounter = 2;

  return {
    nextSource() {
      let source = -1;
      for (let i = 0; i < 65533; i++) {
        if (!handlers.has(sourceCounter)) {
          source = sourceCounter;
          break;
        }
        sourceCounter = (sourceCounter + 1) % 65535;
        if (sourceCounter <= 1) {
          sourceCounter = 2;
        }
      }
      if (source === -1) {
        throw new Error('No available source');
      }
      return source;
    },
    /**
     * @param {number} source
     * @param {MessageHandler} handler
     */
    register(handler, source) {
      if (handlers.has(source)) {
        throw new Error('Source already registered');
      }
      handlers.set(source, handler);
    },
    /**
     * @param {number} source
     * @param {MessageHandler} handler
     */
    deregister(source, handler) {
      if (handlers.get(source) !== handler) {
        throw new Error('Handler mismatch');
      }
      handlers.delete(source);
    },
    /**
     * @param {Uint8Array} message
     * @param {number} port
     * @param {string} address
     * @param {boolean} broadcast
     */
    send(message, port, address, broadcast) {
      options.onSend(message, port, address, broadcast);
    },
    /**
     * @param {Uint8Array} message
     */
    receive(message) {
      const offsetRef = { current: 0 };
      const header = decodeHeader(message, offsetRef);

      const payload = message.subarray(offsetRef.current);

      const serialNumber = convertTargetToSerialNumber(header.target);

      const handler = handlers.get(header.source);

      if (handler) {
        handler.onMessage(header, payload, serialNumber);
      }

      return {
        header,
        payload,
        serialNumber,
      };
    },
  };
}
