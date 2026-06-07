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
  /**
   * Global tap invoked for every successfully decoded inbound message,
   * regardless of which (if any) client it routes to. Use it for
   * cross-cutting concerns such as device discovery, which needs to observe
   * messages from sources it did not send (e.g. broadcast StateService).
   */
  onMessage?: MessageHandler;
  /**
   * Called when an inbound message cannot be decoded (e.g. truncated or
   * malformed packet). If not provided, malformed packets are silently
   * discarded so a hostile sender cannot crash the host process.
   */
  onError?: (error: unknown, message: Uint8Array) => void;
  handlers?: Map<number, MessageHandler>;
}

export interface RouterInstance {
  /**
   * Allocates a free source id, registers `handler` against it, and returns
   * the source. Allocation and registration happen atomically in this single
   * call so two registrations can never be handed the same source.
   *
   * Pass an explicit `source` to reserve a caller-chosen id instead; it is
   * validated (2..4294967295) and must not already be registered. This is the
   * escape hatch for callers that manage their own source ids.
   */
  register(handler: MessageHandler, source?: number): number;
  deregister(source: number, handler: MessageHandler): void;
  send(message: Uint8Array, port: number, address: string, serialNumber?: string): void;
  /**
   * Decodes an inbound message and dispatches it through three channels:
   *
   * 1. the per-source `handler` registered for `header.source` (the client
   *    that sent the originating request), if any;
   * 2. the router-wide `onMessage` tap, if configured;
   * 3. the decoded `{ header, payload, serialNumber }` returned to the caller
   *    for synchronous inspection.
   *
   * Returns `undefined` if the message could not be decoded.
   */
  receive(message: Uint8Array): {
    header: Header;
    payload: Uint8Array;
    serialNumber: string;
  } | undefined;
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

  function allocateSource(): number {
    for (let i = 0; i < MAX_SOURCE_VALUES; i++) {
      const candidate = sourceCounter;
      sourceCounter = sourceCounter + 1 >= 0x100000000 ? 2 : sourceCounter + 1;
      if (!handlers.has(candidate)) {
        return candidate;
      }
    }
    throw new SourceExhaustionError();
  }

  return {
    register(handler: MessageHandler, source?: number): number {
      let resolved: number;
      if (source === undefined) {
        resolved = allocateSource();
      } else {
        if (source <= 1 || source > MAX_SOURCE) {
          throw new ValidationError('source', source, 'must be between 2 and 4294967295');
        }
        if (handlers.has(source)) {
          throw new ValidationError('source', source, 'already registered');
        }
        resolved = source;
      }
      handlers.set(resolved, handler);
      return resolved;
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
      let header: Header;
      let payload: Uint8Array;
      let serialNumber: string;
      try {
        header = decodeHeader(message);
        payload = getPayload(message, 0, header.size);
        serialNumber = convertTargetToSerialNumber(header.target);
      } catch (err) {
        if (options.onError) {
          try {
            options.onError(err, message);
          } catch {
            // A buggy onError callback must not crash receive().
          }
        }
        return undefined;
      }

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