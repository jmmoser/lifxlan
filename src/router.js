import { decodeHeader, getPayload } from './encoding.js';
import { convertTargetToSerialNumber } from './utils.js';

/**
 * @typedef {{
 *   onMessage: (
 *     header: ReturnType<typeof decodeHeader>,
 *     payload: Uint8Array,
 *     serialNumber: string,
 *   ) => void;
 * }} MessageHandler
 */

const MAX_SOURCE = 0xFFFFFFFF;

/** 0 and 1 are reserved */
const MAX_SOURCE_VALUES = MAX_SOURCE - 2;

/**
 * Since a client is a source of messages and there may be multiple
 * clients sending messages at the same time, the router receives
 * response messages and routes them to the client (a MessageHandler)
 * that sent the request message.
 *
 * It has the added benefit of allowing callers to send messages
 * messages. With the previous benefit, the router helps associate
 * received messages with previously sent messages.
 *
 * It also decodes the header and converts the target to a serial
 * number string. This helps avoid calling the relatively expensive
 * convertTargetToSerialNumber utility function multiple times for
 * each response message.
 *
 * @param {{
 *   onSend: (message: Uint8Array, port: number, address: string, serialNumber?: string) => void;
 *   handlers?: Map<number, MessageHandler>;
 * }} options
 */
export function Router(options) {
  /**
   * @type {Map<number, MessageHandler>}
   */
  const handlers = options.handlers ?? new Map();

  let sourceCounter = 2;

  return {
    nextSource() {
      let source = -1;
      for (let i = 0; i < MAX_SOURCE_VALUES; i++) {
        if (!handlers.has(sourceCounter)) {
          source = sourceCounter;
          break;
        }
        sourceCounter = (sourceCounter + 1) % 0x100000000;
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
    register(source, handler) {
      if (source <= 1 || source > MAX_SOURCE) {
        throw new Error('Invalid source');
      }
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
     * @param {string} [serialNumber]
     */
    send(message, port, address, serialNumber) {
      options.onSend(message, port, address, serialNumber);
    },
    /**
     * @param {Uint8Array} message
     */
    receive(message) {
      const header = decodeHeader(message);
      const payload = getPayload(message);

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
