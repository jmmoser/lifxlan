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

/**
 * A single outbound UDP datagram destined for one device (or the broadcast
 * address). A batch of these is handed to {@link RouterInstance.sendMany} so a
 * runtime that supports sending multiple packets in one syscall (e.g. Bun's
 * `socket.sendMany`) can do so.
 */
export interface OutboundPacket {
  message: Uint8Array;
  port: number;
  address: string;
  serialNumber?: string;
}

export interface RouterOptions {
  onSend: (message: Uint8Array, port: number, address: string, serialNumber?: string) => void;
  /**
   * Optional batch send. When provided, {@link RouterInstance.sendMany} hands
   * the whole batch to this callback so runtimes with a multi-packet send API
   * (such as Bun's `socket.sendMany`) can flush every datagram in a single
   * syscall. When omitted, `sendMany` falls back to invoking {@link onSend}
   * once per packet, so callers can rely on batch sending regardless of
   * runtime support.
   */
  onSendMany?: (packets: readonly OutboundPacket[]) => void;
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
  nextSource(): number;
  register(source: number, handler: MessageHandler): void;
  deregister(source: number, handler: MessageHandler): void;
  send(message: Uint8Array, port: number, address: string, serialNumber?: string): void;
  /**
   * Send a batch of datagrams. Uses {@link RouterOptions.onSendMany} when one
   * was supplied, otherwise sends each packet individually via
   * {@link RouterOptions.onSend}. An empty batch is a no-op.
   */
  sendMany(packets: readonly OutboundPacket[]): void;
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
    sendMany(packets: readonly OutboundPacket[]) {
      if (packets.length === 0) {
        return;
      }
      if (options.onSendMany) {
        options.onSendMany(packets);
        return;
      }
      for (let i = 0; i < packets.length; i += 1) {
        const packet = packets[i]!;
        options.onSend(packet.message, packet.port, packet.address, packet.serialNumber);
      }
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