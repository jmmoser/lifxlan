import { decodeHeader, getPayload, Header } from './encoding.js';
import { convertTargetToSerialNumber } from './utils/index.js';
import { SourceExhaustionError, ValidationError } from './errors.js';

export type { Header };

export type MessageHandler = (
  header: Header,
  payload: Uint8Array,
  serialNumber: string,
) => void;

const MAX_SOURCE = 0xFFFFFFFF;

/** 0 and 1 are reserved */
const MAX_SOURCE_VALUES = MAX_SOURCE - 2;

export interface RouterOptions {
  onSend: (message: Uint8Array, port: number, address: string, serialNumber?: string) => void;
  onMessage?: MessageHandler;
  handlers?: Map<number, MessageHandler>;
}

export interface RouterInstance {
  nextSource(): number;
  register(source: number, handler: MessageHandler): void;
  deregister(source: number, handler: MessageHandler): void;
  send(message: Uint8Array, port: number, address: string, serialNumber?: string): void;
  receive(message: Uint8Array): {
    header: Header;
    payload: Uint8Array;
    serialNumber: string;
  };
}

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
 */
export function Router(options: RouterOptions): RouterInstance {
  const handlers: Map<number, MessageHandler> = options.handlers ?? new Map();

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
        throw new SourceExhaustionError();
      }
      return source;
    },
    register(source: number, handler: MessageHandler) {
      if (source <= 1 || source > MAX_SOURCE) {
        throw new ValidationError('source', source, 'must be between 2 and 4294967295');
      }
      if (handlers.has(source)) {
        throw new ValidationError('source', source, 'already registered');
      }
      handlers.set(source, handler);
    },
    deregister(source: number, handler: MessageHandler) {
      if (handlers.get(source) !== handler) {
        throw new ValidationError('messageHandler', handler, 'does not match registered handler');
      }
      handlers.delete(source);
    },
    send(message: Uint8Array, port: number, address: string, serialNumber?: string) {
      options.onSend(message, port, address, serialNumber);
    },
    receive(message: Uint8Array) {
      const header = decodeHeader(message);
      const payload = getPayload(message);

      const serialNumber = convertTargetToSerialNumber(header.target);

      const handler = handlers.get(header.source);

      if (handler) {
        handler(header, payload, serialNumber);
      }

      if (options.onMessage) {
        options.onMessage(header, payload, serialNumber);
      }

      return {
        header,
        payload,
        serialNumber,
      };
    },
  };
}