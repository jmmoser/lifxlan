import { decodeHeader, getPayload } from './wire.js';
import type { Header } from './wire.js';
import { convertTargetToSerialNumber } from './utils/index.js';
import { SourceExhaustionError, ValidationError } from './errors.js';

export type { Header };

/**
 * A decoded inbound message: the parsed `header`, a zero-copy `payload`
 * view, and the `serialNumber` derived from `header.target`. It is what
 * `receive()` returns and what every {@link MessageHandler} is called with
 * — one object, shared by all of them, so treat it as read-only. It
 * satisfies the registry's `RegistrationMessage`, so it passes straight to
 * `devices.register(port, address, received)` to register the device that
 * sent it.
 */
export interface ReceivedMessage {
  readonly header: Header;
  readonly payload: Uint8Array;
  readonly serialNumber: string;
}

export type MessageHandler = (message: ReceivedMessage) => void;

const MAX_SOURCE = 0xFFFFFFFF;

/** 0 and 1 are reserved */
const MAX_SOURCE_VALUES = MAX_SOURCE - 2;

export interface RouterOptions {
  /**
   * The outbound transport: called with the encoded packet for every
   * `send()`. `serialNumber` is a routing hint — present when the sender
   * knows the destination device (unicast, not broadcast) — letting a
   * transport with per-device paths pick one without decoding the packet.
   * A plain UDP transport can ignore it.
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
   * malformed packet), or when a registered handler or the `onMessage` tap
   * throws while processing one. If not provided, these errors are silently
   * discarded so neither a hostile sender nor a buggy callback can crash the
   * host process or stop reception.
   */
  onError?: (error: unknown, message: Uint8Array) => void;
}

/**
 * The sending half of the router — all a {@link Client} requires, so a
 * custom router only has to implement these three methods to drive one;
 * {@link Router.receive} is only needed by the socket wiring.
 *
 * The contract tying the methods together: the source id returned by
 * `register()` must be written into the header of every request passed to
 * `send()` (the `source` argument of `encode()` from `lifxlan/encoding`).
 * Devices echo it in responses, which is how `receive()` finds the handler
 * to deliver each response to.
 */
export interface ClientRouter {
  /**
   * Allocates a free source id, registers `handler` against it, and returns
   * the source. Allocation and registration happen atomically in this single
   * call so two registrations can never be handed the same source.
   *
   * Pass an explicit `source` to reserve a caller-chosen id instead; it is
   * validated (an integer in 2..4294967295) and must not already be registered. This is the
   * escape hatch for callers that manage their own source ids.
   */
  register(handler: MessageHandler, source?: number): number;
  deregister(source: number, handler: MessageHandler): void;
  /**
   * Hands an encoded packet to the transport. A pass-through by design: it
   * gives every sender a single seam to swap or instrument the outbound
   * transport. `serialNumber` is the per-device routing hint forwarded to
   * the transport; see {@link RouterOptions.onSend}.
   */
  send(message: Uint8Array, port: number, address: string, serialNumber?: string): void;
}

export interface Router extends ClientRouter {
  /**
   * Decodes an inbound message and dispatches it through three channels:
   *
   * 1. the per-source `handler` registered for `header.source` (the client
   *    that sent the originating request), if any;
   * 2. the router-wide `onMessage` tap, if configured;
   * 3. the same decoded {@link ReceivedMessage} returned to the caller for
   *    synchronous inspection.
   *
   * Returns `undefined` if the message could not be decoded. Never throws:
   * decode failures (a `DecodeError`) and errors thrown by the handler or
   * the tap are reported to {@link RouterOptions.onError}.
   *
   * Ownership: the buffer passed to `receive()` is consumed, not copied.
   * `header.target`, `payload`, and the byte-array fields of decoded
   * results (an echo payload, an effect's `parameters`, a button action's
   * `target`) are zero-copy views into it; every other decoded value is
   * copied out. A socket layer that reuses its receive buffer must hand
   * `receive()` a copy; otherwise the next datagram silently corrupts those
   * views. (Node's dgram and Deno's listenDatagram allocate a fresh buffer
   * per message, so no copy is needed there.)
   */
  receive(message: Uint8Array): ReceivedMessage | undefined;
}

/**
 * Multiplexes one network transport across many concurrent senders. Each
 * sender registers a handler under a source id and encodes that id into its
 * requests (see {@link ClientRouter}); `receive()` routes each response to
 * the handler whose source it echoes, decoding the header — including the
 * relatively expensive serial number conversion — once per packet.
 */
export function Router(options: RouterOptions): Router {
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

  function reportError(error: unknown, message: Uint8Array) {
    if (options.onError) {
      try {
        options.onError(error, message);
      } catch {
        // A buggy onError callback must not crash receive().
      }
    }
  }

  return {
    register(handler: MessageHandler, source?: number): number {
      let resolved: number;
      if (source === undefined) {
        resolved = allocateSource();
      } else {
        // Integer check included: encode() writes the source with bitwise
        // math, so a fractional id would silently alias another client's.
        if (!Number.isInteger(source) || source <= 1 || source > MAX_SOURCE) {
          throw new ValidationError('source', source, 'must be an integer between 2 and 4294967295');
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
      let received: ReceivedMessage;
      try {
        const header = decodeHeader(message);
        received = {
          header,
          payload: getPayload(message, 0, header.size),
          serialNumber: convertTargetToSerialNumber(header.target),
        };
      } catch (err) {
        reportError(err, message);
        return undefined;
      }

      // receive() runs inside the socket's receive path, so a throwing
      // handler or tap must not escape it: on Node that is an uncaught
      // exception from the 'message' event, on Deno it ends the read loop and
      // with it all reception. Each callback is isolated so one failing
      // cannot starve the other; the error goes to onError.
      const handler = handlers.get(received.header.source);

      if (handler) {
        try {
          handler(received);
        } catch (err) {
          reportError(err, message);
        }
      }

      if (options.onMessage) {
        try {
          options.onMessage(received);
        } catch (err) {
          reportError(err, message);
        }
      }

      return received;
    },
  };
}
