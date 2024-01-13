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

  return {
    send(message, port, address, broadcast) {
      options.onSend(message, port, address, broadcast);
    },
    /**
     * @param {number} source
     * @param {MessageHandler} handler
     */
    register(source, handler) {
      if (handlers.has(source)) {
        throw new Error('Source already registered');
      }
      handlers.set(source, handler);
    },
    deregister(source) {
      handlers.delete(source);
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
