import {
  Type,
  PORT,
  BROADCAST_ADDRESS,
  NO_TARGET,
} from './constants/index.js';

import {
  encode,
  decodeStateUnhandled,
} from './encoding.js';

import {
  PromiseWithResolvers,
} from './utils/index.js';

import {
  TimeoutError,
  UnhandledCommandError,
  SequenceExhaustionError,
  AbortError,
  DisposedClientError,
  ValidationError,
} from './errors.js';

import type { ClientRouter, MessageHandler, Header } from './router.js';

import type { Device } from './devices.js';
import type { Decoder, Command } from './commands/index.js';

/** Sequence numbers are limited to 0-254. We use 255 for broadcast messages. */
const SEQUENCE_SPACE = 0xFF;

interface PendingHandler {
  handle(type: number, bytes: Uint8Array, offsetRef: { current: number }): void;
  cancel(reason: Error): void;
}

function registerHandler<T>(
  ackMode: 'ack-only' | 'response' | 'both',
  serialNumber: string,
  sequence: number,
  decode: Decoder<T> | undefined,
  timeoutMs: number,
  responseHandlerMap: Map<string, Map<number, PendingHandler>>,
  pendingBySequence: Map<number, PendingHandler>,
  signal?: AbortSignal
): Promise<T | void> {
  const { resolve, reject, promise } = PromiseWithResolvers<T | void>();
  const continuation = { expectMore: false };

  let receivedAck = false;
  let receivedResponse = false;
  let responseResult: T | undefined;
  let settled = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  function cleanup() {
    if (signal) {
      signal.removeEventListener('abort', onAbort);
    }
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    pendingBySequence.delete(sequence);
    // Drop the per-device map once it has no pending exchanges so devices
    // that disappear from the network do not leak empty maps.
    if (pendingBySequence.size === 0) {
      responseHandlerMap.delete(serialNumber);
    }
  }

  function settleReject(reason: unknown) {
    if (settled) return;
    settled = true;
    cleanup();
    reject(reason);
  }

  function onAbort() {
    settleReject(signal?.reason ?? new AbortError('device response'));
  }

  // send() rejects pre-aborted signals before calling this function (so no
  // packet is transmitted and no sequence number is consumed), which means
  // the signal here can only abort *after* the listener below is attached.
  if (signal) {
    signal.addEventListener('abort', onAbort, { once: true });
  }
  // The timeout and the signal are independent: a lost UDP packet must not
  // hang the caller just because they passed a cancellation signal, so the
  // timeout arms whether or not a signal is present. A timeoutMs <= 0
  // disables it, leaving the signal (or a response) as the only way to settle.
  if (timeoutMs > 0) {
    const timeoutError = new TimeoutError(timeoutMs, 'device response');
    timeout = setTimeout(settleReject.bind(undefined, timeoutError), timeoutMs);
  }

  function checkForCompletion() {
    if (settled) return true;
    if (
      (ackMode === 'ack-only' && receivedAck) ||
      (ackMode === 'response' && receivedResponse) ||
      (ackMode === 'both' && receivedAck && receivedResponse)
    ) {
      settled = true;
      cleanup();
      resolve(ackMode === 'ack-only' ? undefined : responseResult);
      return true;
    }
    return false;
  }

  pendingBySequence.set(sequence, {
    handle(type, bytes, offsetRef) {
      if (settled) return;

      if (type === Type.Acknowledgement) {
        receivedAck = true;
        checkForCompletion();
        return;
      }

      if (type === Type.StateUnhandled) {
        const requestType = decodeStateUnhandled(bytes, offsetRef);
        settleReject(new UnhandledCommandError(requestType, serialNumber));
        return;
      }

      if (decode) {
        let result: T;
        try {
          continuation.expectMore = false;
          result = decode(bytes, offsetRef, continuation, type);
        } catch (err) {
          settleReject(err instanceof Error ? err : new Error(String(err)));
          return;
        }

        if (continuation.expectMore) {
          return;
        }

        receivedResponse = true;
        responseResult = result;
        checkForCompletion();
      }
    },
    cancel(reason) {
      settleReject(reason);
    },
  });

  return promise;
}

// Define response modes as const to get literal types
const RESPONSE_MODES = ['auto', 'ack-only', 'response', 'both'] as const;
export type ResponseMode = typeof RESPONSE_MODES[number];

/**
 * Resolves the effective response mode for a call: an explicit, non-'auto'
 * override wins; otherwise the command's own default mode is used. This mirrors
 * the runtime resolution in send() (`options.responseMode` else command default).
 */
type ResolveMode<Override extends ResponseMode, Default extends ResponseMode> =
  Override extends 'auto' ? Default : Override;

/**
 * Maps a resolved response mode to the awaited result of send(): an 'ack-only'
 * exchange resolves with no response data, every other mode resolves the
 * decoded payload. Keeping this aligned with the runtime prevents the static
 * type from promising a payload that ack-only calls never deliver.
 */
type ModeReturn<T, Mode extends ResponseMode> = Mode extends 'ack-only' ? Promise<void> : Promise<T>;

export interface SendOptions<A extends ResponseMode = ResponseMode> {
  /**
   * Controls response behavior for the command.
   * 
   * Available options:
   * - 'auto': Use the command's default behavior (recommended)
   * - 'ack-only': Wait for acknowledgment packet (confirms receipt)
   * - 'response': Wait for response data packet (Get commands)
   * - 'both': Wait for both ack and response (maximum reliability)
   */
  responseMode?: A;
  /**
   * Cancels the exchange when aborted; the promise rejects with the signal's
   * reason. The signal is additive to the timeout — passing a signal does not
   * disable the timeout.
   */
  signal?: AbortSignal;
  /**
   * Per-call override of the client's `defaultTimeoutMs`. Pass 0 to disable
   * the timeout for this call, in which case only a response (or the signal,
   * if provided) settles the promise.
   */
  timeoutMs?: number;
}


export interface ClientOptions<R extends ClientRouter = ClientRouter> {
  /**
   * Only the sending half of the router is required — see
   * {@link ClientRouter}. A full `Router` satisfies it, and so does a
   * custom implementation of just those three methods; the client never
   * calls `receive()`. The concrete type is preserved on
   * {@link ClientInstance.router}, so passing a full `RouterInstance` keeps
   * `receive()` reachable through the client.
   */
  router: R;
  /**
   * How long send() waits for the device before rejecting with TimeoutError.
   * Applies whether or not a per-call signal is provided; set 0 to disable
   * timeouts by default. Defaults to 3000ms.
   */
  defaultTimeoutMs?: number;
  source?: number;
  /**
   * Tap invoked for every inbound message addressed to this client's source
   * — i.e. responses to requests this client sent — before response
   * correlation runs. For a tap that observes *all* traffic regardless of
   * source (e.g. discovery responses), use the router-level
   * `RouterOptions.onMessage` instead.
   */
  onMessage?: MessageHandler;
}

export interface ClientInstance<R extends ClientRouter = ClientRouter> extends Disposable {
  readonly router: R;
  readonly source: number;
  /**
   * Disposes of the client and releases its source identifier back to the
   * router. Call this when creating many short-lived clients to prevent
   * source exhaustion. Idempotent. Once disposed, the client cannot be used
   * for further operations. A `using` declaration does the same through
   * `Symbol.dispose` at end of scope.
   */
  dispose(): void;
  /**
   * Fire-and-forget to the whole network: encodes `command` addressed to all
   * devices and hands it to the transport. Nothing is awaited and no
   * response is correlated — responses only reach a router-level `onMessage`
   * tap. Throws synchronously if the transport does.
   */
  broadcast<T>(command: Command<T>): void;
  /**
   * Fire-and-forget to one device. Despite the addressing-flavored name,
   * what distinguishes this from `send()` is reliability, not addressing:
   * the packet requests no acknowledgement or response, nothing is awaited,
   * and delivery is not confirmed — UDP loss goes unnoticed. Use it for
   * high-rate updates (e.g. streaming color changes) where the next packet
   * supersedes the last; use `send()` when the outcome matters.
   */
  unicast<T>(command: Command<T>, device: Device): void;

  send<T, Default extends ResponseMode = 'response', Override extends ResponseMode = 'auto'>(
    command: Command<T> & { defaultResponseMode?: Default },
    device: Device,
    options?: SendOptions<Override>,
  ): ModeReturn<T, ResolveMode<Override, Default>>;
}

/**
 * Creates a high-level client for communicating with LIFX devices.
 *
 * The Client provides methods for sending commands to devices with automatic
 * timeout handling and response correlation. It uses the Router for message
 * routing and supports both acknowledged and unacknowledged messaging patterns.
 *
 * @param options Configuration options
 * @returns A new client instance
 * @example
 * ```javascript
 * const client = Client({ router });
 * const response = await client.send(GetColorCommand(), device);
 * ```
 */
export function Client<R extends ClientRouter>(options: ClientOptions<R>): ClientInstance<R> {
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 3000;
  const { router } = options;

  // Pending request handlers, keyed by device serial number, then by
  // sequence number. The two-level structure avoids allocating a composite
  // string key per packet and makes free-sequence scanning cheap.
  const responseHandlerMap = new Map<string, Map<number, PendingHandler>>();

  // Per-(client, device) sequence counters, keyed by device serial number.
  // Sequence is a property of the conversation between this client and a
  // device, not of the device itself, so it lives here rather than on the
  // shared Device object. Two clients talking to the same device therefore
  // keep independent sequence spaces.
  const sequences = new Map<string, number>();

  function nextSequence(serialNumber: string): number {
    const sequence = sequences.get(serialNumber) ?? 0;
    sequences.set(serialNumber, (sequence + 1) % SEQUENCE_SPACE);
    return sequence;
  }

  /**
   * Allocates the next sequence number that has no pending exchange. A
   * sequence is only unavailable while a send() to the same device is still
   * in flight, so a slow response (or a timeoutMs: 0 call) never collides
   * with new sends — the counter simply skips over it. Returns undefined
   * when all 255 sequence numbers are in flight.
   */
  function nextFreeSequence(serialNumber: string, pendingBySequence: Map<number, PendingHandler>): number | undefined {
    let candidate = sequences.get(serialNumber) ?? 0;
    for (let i = 0; i < SEQUENCE_SPACE; i++) {
      if (!pendingBySequence.has(candidate)) {
        sequences.set(serialNumber, (candidate + 1) % SEQUENCE_SPACE);
        return candidate;
      }
      candidate = (candidate + 1) % SEQUENCE_SPACE;
    }
    return undefined;
  }

  // Reused across inbound messages to avoid allocating a fresh offset ref per
  // packet. Safe because handle() -> decode() runs fully synchronously and never
  // re-enters onMessage().
  const offsetRef = { current: 0 };

  let disposed = false;

  // Routes inbound messages addressed to this client's source. Kept as a
  // private closure (not exposed on ClientInstance) so callers can't bypass
  // routing by invoking it directly.
  function onMessage(header: Header, payload: Uint8Array, serialNumber: string) {
    if (options.onMessage) {
      options.onMessage(header, payload, serialNumber);
    }

    const responseHandlerEntry = responseHandlerMap.get(serialNumber)?.get(header.sequence);

    if (responseHandlerEntry) {
      offsetRef.current = 0;
      responseHandlerEntry.handle(header.type, payload, offsetRef);
    }
  }

  const source = router.register(onMessage, options.source);

  function dispose() {
    if (disposed) return;
    disposed = true;

    // Deregister first so any in-flight messages routed to this client
    // are dropped before we tear down its pending handlers.
    router.deregister(source, onMessage);

    const error = new DisposedClientError(source);
    const deviceMaps = Array.from(responseHandlerMap.values());
    responseHandlerMap.clear();
    for (const pendingBySequence of deviceMaps) {
      for (const entry of Array.from(pendingBySequence.values())) {
        try {
          entry.cancel(error);
        } catch {
          // Ignore errors during disposal cleanup
        }
      }
    }
  }

  const client: ClientInstance<R> = {
    /**
     * @readonly
     * @returns The router instance
     */
    get router() {
      return router;
    },
    /**
     * @readonly  
     * @returns The client's unique source identifier
     */
    get source() {
      return source;
    },
    /**
     * Disposes of the client and releases its source identifier.
     *
     * Call this when creating many short-lived clients to prevent source exhaustion.
     * Once disposed, the client cannot be used for further operations.
     *
     * @example
     * ```javascript
     * const client = Client({ router });
     * // ... use client
     * client.dispose(); // Free up resources
     * ```
     */
    dispose,
    // Enables `using client = Client(...)`: end of scope disposes the client.
    // Requiring Node >= 22 (where Symbol.dispose exists natively) is what
    // makes defining this safe — on older runtimes the symbol was undefined
    // and the computed key silently became the string "undefined".
    [Symbol.dispose]: dispose,
    /**
     * Broadcast a command to the local network.
     */
    broadcast<T>(command: Command<T>) {
      if (disposed) throw new DisposedClientError(source);
      
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
     */
    unicast<T>(command: Command<T>, device: Device) {
      if (disposed) throw new DisposedClientError(source);

      const sequence = nextSequence(device.serialNumber);

      const bytes = encode(
        false,
        source,
        device.target,
        false,
        false,
        sequence,
        command.type,
        command.payload,
      );

      router.send(bytes, device.port, device.address, device.serialNumber);
    },
    /**
     * Send a command to a device with configurable acknowledgment behavior.
     *
     * Never throws synchronously: every failure — disposed client, aborted
     * signal, exhausted sequence numbers, a missing decoder, or a throwing
     * transport — surfaces as a rejected promise, so fan-outs like
     * `Promise.all(devices.map(...))` observe all failures uniformly.
     */
    send<T, Default extends ResponseMode = 'response', Override extends ResponseMode = 'auto'>(
      command: Command<T> & { defaultResponseMode?: Default },
      device: Device,
      options?: SendOptions<Override>,
    ): ModeReturn<T, ResolveMode<Override, Default>> {
      // The cast mirrors the return cast at the bottom of send().
      const rejected = (reason: unknown): ModeReturn<T, ResolveMode<Override, Default>> => {
        const rejection: Promise<never> = Promise.reject(reason);
        return rejection as ModeReturn<T, ResolveMode<Override, Default>>;
      };

      if (disposed) return rejected(new DisposedClientError(source));

      const signal = options?.signal;
      if (signal?.aborted) {
        // The caller already cancelled: reject before a sequence number is
        // consumed or a packet is transmitted on their behalf. This check
        // must live here (not in registerHandler) precisely so nothing below
        // runs.
        return rejected(signal.reason ?? new AbortError('device response'));
      }

      // Everything below runs inside one guard so that no synchronous throw
      // — a user-supplied createDecoder/payload getter, encode() on a
      // malformed device, or anything unforeseen — can escape send() as an
      // exception instead of a rejection.
      let pendingBySequence: Map<number, PendingHandler> | undefined;
      try {
        // Determine response mode: an explicit, non-'auto' override wins;
        // otherwise fall back to the command's default mode.
        const requestedMode = options?.responseMode;
        const ackMode: 'ack-only' | 'response' | 'both' =
          !requestedMode || requestedMode === 'auto'
            ? command.defaultResponseMode ?? 'response'
            : requestedMode;

        // A createDecoder command gets a fresh decoder per exchange so commands
        // that accumulate multi-packet state stay safe to reuse across
        // concurrent sends and devices.
        const decode = command.createDecoder ? command.createDecoder() : command.decode;

        // A mode that waits on response data can never settle without a
        // decoder; fail loudly now instead of letting the call ride to a
        // confusing timeout.
        if (ackMode !== 'ack-only' && decode === undefined) {
          throw new ValidationError('command', command.type, `response mode '${ackMode}' requires the command to provide decode or createDecoder`);
        }

        // Determine protocol flags based on response mode
        let resRequired = false;
        let ackRequired = false;

        switch (ackMode) {
          case 'ack-only':
            ackRequired = true;
            break;
          case 'response':
            resRequired = true;
            break;
          case 'both':
            resRequired = true;
            ackRequired = true;
            break;
        }

        pendingBySequence = responseHandlerMap.get(device.serialNumber);
        if (!pendingBySequence) {
          pendingBySequence = new Map();
          responseHandlerMap.set(device.serialNumber, pendingBySequence);
        }

        const sequence = nextFreeSequence(device.serialNumber, pendingBySequence);
        if (sequence === undefined) {
          throw new SequenceExhaustionError(device.serialNumber);
        }

        const bytes = encode(
          false,
          source,
          device.target,
          resRequired,
          ackRequired,
          sequence,
          command.type,
          command.payload,
        );

        const timeoutMs = options?.timeoutMs ?? defaultTimeoutMs;

        const promise = registerHandler(ackMode, device.serialNumber, sequence, decode, timeoutMs, responseHandlerMap, pendingBySequence, signal);

        try {
          router.send(bytes, device.port, device.address, device.serialNumber);
        } catch (err) {
          // The transport refused the packet synchronously. Cancel the pending
          // handler (which also clears its timeout and abort listener) so the
          // failure is delivered through the returned promise.
          const entry = pendingBySequence.get(sequence);
          if (entry) {
            entry.cancel(err instanceof Error ? err : new Error(String(err)));
          }
        }

        return promise as ModeReturn<T, ResolveMode<Override, Default>>;
      } catch (err) {
        // A per-device map created for an exchange that never registered a
        // handler must not linger.
        if (pendingBySequence && pendingBySequence.size === 0) {
          responseHandlerMap.delete(device.serialNumber);
        }
        return rejected(err);
      }
    },
  };

  return client;
}