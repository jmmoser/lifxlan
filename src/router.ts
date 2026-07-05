import { decodeHeader, getPayload, Header } from './encoding.js';
import { convertTargetToSerialNumber } from './utils/index.js';
import { SourceExhaustionError, ValidationError } from './errors.js';

export type { Header };

/**
 * The decoded message `receive()` returns: the parsed `header`, a zero-copy
 * `payload` view, and the `serialNumber` derived from `header.target`. It
 * satisfies the registry's `RegistrationMessage`, so it passes straight to
 * `devices.register(port, address, received)` to register the device that
 * sent it.
 */
export interface ReceivedMessage {
  header: Header;
  payload: Uint8Array;
  serialNumber: string;
}

export type MessageHandler = (
  header: Header,
  payload: Uint8Array,
  serialNumber: string,
) => void;

const MAX_SOURCE = 0xFFFFFFFF;

/** 0 and 1 are reserved */
const MAX_SOURCE_VALUES = MAX_SOURCE - 2;

export interface RouterOptions {
  /**
   * The outbound transport: called with the encoded packet for every
   * `send()`. `serialNumber` is a routing hint — senders that know which
   * device a packet is for pass its serial number (Client does for unicast
   * exchanges, and omits it for broadcasts) so a transport that keeps
   * per-device paths (a socket per device, a mock keyed by serial) can pick
   * one without decoding the packet. A plain UDP transport can ignore it.
   */
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
}

/**
 * The sending half of the router: source registration plus the outbound
 * transport seam. This is all a {@link Client} (or any other message
 * sender) requires, so a custom router only has to implement these three
 * methods to drive one — {@link RouterInstance.receive}, which owns the
 * decode pipeline, is only needed by the code that wires the socket.
 *
 * The contract that ties the methods together: the source id returned by
 * `register()` must be written into the header of every request passed to
 * `send()` (the `source` argument of `encode()` from `lifxlan/encoding`).
 * Devices echo it in their responses, and it is how the receiving side finds
 * the registered handler to deliver the response to.
 */
export interface ClientRouter {
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
  /**
   * Hands an encoded packet to the transport (the `onSend` callback the
   * router was constructed with). The router adds nothing on this path — it
   * exists so every component that sends traffic needs only a router
   * reference, giving the application a single seam to swap or instrument
   * the outbound transport. `serialNumber` is the per-device routing hint
   * forwarded verbatim to `onSend`; see {@link RouterOptions.onSend}.
   */
  send(message: Uint8Array, port: number, address: string, serialNumber?: string): void;
}

export interface RouterInstance extends ClientRouter {
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
   *
   * Ownership: the buffer passed to `receive()` is consumed, not copied.
   * Decoded values — `header.target`, `payload`, and the results that
   * decoders deliver to awaiting `send()` calls — are zero-copy views into
   * it. A socket layer that reuses its receive buffer must hand `receive()`
   * a copy; otherwise the next datagram silently corrupts previously decoded
   * results. (Node's dgram and Deno's listenDatagram allocate a fresh buffer
   * per message, so no copy is needed there.)
   */
  receive(message: Uint8Array): ReceivedMessage | undefined;
}

/**
 * Multiplexes one network transport across many concurrent senders. Each
 * sender calls `register()` to obtain a source id and encodes it into the
 * headers of the requests it passes to `send()` (via `encode()` from
 * `lifxlan/encoding` — the router itself never encodes); devices echo the
 * source in their responses, and `receive()` uses it to route each response
 * back to the handler registered by the sender of the originating request.
 *
 * `receive()` also decodes the header once — including converting the
 * target to a serial number string, which is relatively expensive — so the
 * per-source handler, the `onMessage` tap, and the caller all share one
 * decode per packet.
 */
export function Router(options: RouterOptions): RouterInstance {
  const handlers = new Map<number, MessageHandler>();

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