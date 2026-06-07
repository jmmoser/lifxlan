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
  MessageConflictError,
  AbortError,
  DisposedClientError,
} from './errors.js';

import type { RouterInstance, MessageHandler, Header, OutboundPacket } from './router.js';

import type { Device } from './devices.js';
import type { Decoder, Command } from './commands/index.js';

/**
 * Creates a unique response key for correlating requests with responses.
 *
 * @param serialNumber - The device serial number
 * @param sequence - The message sequence number
 * @returns A unique key for this request-response pair
 * @internal
 */
function getResponseKey(serialNumber: string, sequence: number): string {
  return `${serialNumber}:${sequence}`;
}

/**
 * Increments the sequence number for message ordering.
 * 
 * Sequence numbers are limited to 0-254 (255 is reserved for broadcast messages).
 * This ensures proper message ordering and prevents conflicts with broadcast operations.
 * 
 * @param sequence - Current sequence number, undefined for initial sequence
 * @returns Next sequence number (0-254)
 * @internal
 */
function incrementSequence(sequence?: number): number {
  /** Only allow up to 254. We use 255 for broadcast messages. */
  return sequence == null ? 0 : (sequence + 1) % 0xFF;
}

interface PendingHandler {
  handle(type: number, bytes: Uint8Array, offsetRef: { current: number }): void;
  cancel(reason: Error): void;
}

function registerHandler<T>(
  ackMode: 'ack-only' | 'response' | 'both',
  serialNumber: string,
  sequence: number,
  decode: Decoder<T> | undefined,
  defaultTimeoutMs: number,
  responseHandlerMap: Map<string, PendingHandler>,
  signal?: AbortSignal
): Promise<T | void> {
  const key = getResponseKey(serialNumber, sequence);

  if (responseHandlerMap.has(key)) {
    throw new MessageConflictError(key, sequence);
  }

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
    } else if (timeout) {
      clearTimeout(timeout);
    }
    responseHandlerMap.delete(key);
  }

  function onAbort(errOrEvent: Error | Event) {
    if (settled) return;
    settled = true;
    cleanup();
    reject(errOrEvent instanceof Error ? errOrEvent : new AbortError('device response'));
  }

  if (signal) {
    signal.addEventListener('abort', onAbort, { once: true });
  } else if (defaultTimeoutMs > 0) {
    const timeoutError = new TimeoutError(defaultTimeoutMs, 'device response');
    timeout = setTimeout(onAbort.bind(undefined, timeoutError), defaultTimeoutMs);
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

  responseHandlerMap.set(key, {
    handle(type, bytes, offsetRef) {
      if (settled) return;

      if (type === Type.Acknowledgement) {
        receivedAck = true;
        checkForCompletion();
        return;
      }

      if (type === Type.StateUnhandled) {
        settled = true;
        cleanup();
        const requestType = decodeStateUnhandled(bytes, offsetRef);
        reject(new UnhandledCommandError(requestType, serialNumber));
        return;
      }

      if (decode) {
        let result: T;
        try {
          continuation.expectMore = false;
          result = decode(bytes, offsetRef, continuation, type);
        } catch (err) {
          settled = true;
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
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
      if (settled) return;
      settled = true;
      cleanup();
      reject(reason);
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
 * Maps a resolved response mode to the value send() resolves with: an
 * 'ack-only' exchange resolves with no response data, every other mode resolves
 * the decoded payload. Keeping this aligned with the runtime prevents the static
 * type from promising a payload that ack-only calls never deliver.
 */
type ModeResult<T, Mode extends ResponseMode> = Mode extends 'ack-only' ? void : T;

type ModeReturn<T, Mode extends ResponseMode> = Promise<ModeResult<T, Mode>>;

type AckMode = 'ack-only' | 'response' | 'both';

/**
 * Resolves the concrete ack mode for a call at runtime: an explicit, non-'auto'
 * override wins; otherwise the command's own default mode is used (falling back
 * to 'response'). Mirrors the {@link ResolveMode} type-level resolution.
 */
function resolveAckMode(defaultResponseMode: ResponseMode | undefined, requestedMode: ResponseMode | undefined): AckMode {
  if (!requestedMode || requestedMode === 'auto') {
    return defaultResponseMode != null && defaultResponseMode !== 'auto'
      ? defaultResponseMode
      : 'response';
  }
  return requestedMode;
}

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
  signal?: AbortSignal;
}


export interface ClientOptions {
  router: RouterInstance;
  defaultTimeoutMs?: number;
  source?: number;
  onMessage?: MessageHandler;
}

export interface ClientInstance {
  readonly router: RouterInstance;
  readonly source: number;
  dispose(): void;
  broadcast<T>(command: Command<T>): void;

  /**
   * Send a command without expecting a response or acknowledgement.
   *
   * Pass a single device, or any iterable of devices (an array, the `Devices`
   * registry, a group's `devices`) to fan out. When given many devices the
   * whole batch of datagrams is flushed through {@link RouterInstance.sendMany},
   * so on runtimes wired up with a multi-packet send (e.g. Bun's
   * `socket.sendMany`) every packet leaves in a single syscall.
   */
  unicast<T>(command: Command<T>, device: Device): void;
  unicast<T>(command: Command<T>, devices: Iterable<Device>): void;

  /**
   * Send a command to a single device with configurable acknowledgment
   * behavior, resolving with the decoded response (or `void` for ack-only).
   */
  send<T, Default extends ResponseMode = 'response', Override extends ResponseMode = 'auto'>(
    command: Command<T> & { defaultResponseMode?: Default },
    device: Device,
    options?: SendOptions<Override>,
  ): ModeReturn<T, ResolveMode<Override, Default>>;

  /**
   * Send a command to many devices and await all of their responses. The
   * outbound datagrams are flushed together through
   * {@link RouterInstance.sendMany} (one syscall on runtimes that support it),
   * then every response is awaited independently.
   *
   * Resolves with a {@link PromiseSettledResult} per device, in the same order
   * the devices were iterated, so a single unreachable device never rejects the
   * whole batch. An optional `signal` aborts every outstanding request.
   */
  send<T, Default extends ResponseMode = 'response', Override extends ResponseMode = 'auto'>(
    command: Command<T> & { defaultResponseMode?: Default },
    devices: Iterable<Device>,
    options?: SendOptions<Override>,
  ): Promise<PromiseSettledResult<ModeResult<T, ResolveMode<Override, Default>>>[]>;

  onMessage(header: Header, payload: Uint8Array, serialNumber: string): void;
}

/**
 * Creates a high-level client for communicating with LIFX devices.
 *
 * The Client provides methods for sending commands to devices with automatic
 * timeout handling, retry logic, and response correlation. It uses the Router
 * for message routing and supports both acknowledged and unacknowledged messaging patterns.
 *
 * @param options Configuration options
 * @returns A new client instance
 * @example
 * ```javascript
 * const client = Client({ router });
 * const response = await client.send(GetColorCommand(), device);
 * ```
 * @performance Optimized for high-throughput scenarios with minimal allocations
 */
export function Client(options: ClientOptions): ClientInstance {
  const source = options.source ?? options.router.nextSource();

  const defaultTimeoutMs = options.defaultTimeoutMs ?? 3000;
  const { router } = options;

  const responseHandlerMap = new Map<string, PendingHandler>();

  // Reused across inbound messages to avoid allocating a fresh offset ref per
  // packet. Safe because handle() -> decode() runs fully synchronously and never
  // re-enters onMessage().
  const offsetRef = { current: 0 };

  let disposed = false;

  /**
   * Encodes a command targeted at a single device and advances that device's
   * sequence counter. Shared by the single- and multi-device send paths so the
   * framing and sequence bookkeeping stay identical.
   */
  function encodeForDevice<T>(
    command: Command<T>,
    device: Device,
    resRequired: boolean,
    ackRequired: boolean,
  ): { bytes: Uint8Array; sequence: number } {
    const sequence = device.sequence;
    device.sequence = incrementSequence(sequence);

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

    return { bytes, sequence };
  }

  /**
   * Distinguishes a single {@link Device} from an iterable of devices. A Device
   * is a plain record without an iterator, so the presence of `Symbol.iterator`
   * unambiguously identifies the fan-out forms of unicast()/send().
   */
  function isDeviceIterable(target: Device | Iterable<Device>): target is Iterable<Device> {
    return Symbol.iterator in target;
  }

  function unicast<T>(command: Command<T>, device: Device): void;
  function unicast<T>(command: Command<T>, devices: Iterable<Device>): void;
  function unicast<T>(command: Command<T>, target: Device | Iterable<Device>): void {
    if (disposed) throw new DisposedClientError(source);

    if (!isDeviceIterable(target)) {
      const { bytes } = encodeForDevice(command, target, false, false);
      router.send(bytes, target.port, target.address, target.serialNumber);
      return;
    }

    const packets: OutboundPacket[] = [];
    for (const device of target) {
      const { bytes } = encodeForDevice(command, device, false, false);
      packets.push({
        message: bytes,
        port: device.port,
        address: device.address,
        serialNumber: device.serialNumber,
      });
    }
    router.sendMany(packets);
  }

  function send<T, Default extends ResponseMode = 'response', Override extends ResponseMode = 'auto'>(
    command: Command<T> & { defaultResponseMode?: Default },
    device: Device,
    options?: SendOptions<Override>,
  ): ModeReturn<T, ResolveMode<Override, Default>>;
  function send<T, Default extends ResponseMode = 'response', Override extends ResponseMode = 'auto'>(
    command: Command<T> & { defaultResponseMode?: Default },
    devices: Iterable<Device>,
    options?: SendOptions<Override>,
  ): Promise<PromiseSettledResult<ModeResult<T, ResolveMode<Override, Default>>>[]>;
  function send<T, Default extends ResponseMode = 'response', Override extends ResponseMode = 'auto'>(
    command: Command<T> & { defaultResponseMode?: Default },
    target: Device | Iterable<Device>,
    options?: SendOptions<Override>,
  ): ModeReturn<T, ResolveMode<Override, Default>> | Promise<PromiseSettledResult<ModeResult<T, ResolveMode<Override, Default>>>[]> {
    if (disposed) throw new DisposedClientError(source);

    // Determine response mode: an explicit, non-'auto' override wins;
    // otherwise fall back to the command's default mode.
    const ackMode = resolveAckMode(command.defaultResponseMode, options?.responseMode);
    const resRequired = ackMode === 'response' || ackMode === 'both';
    const ackRequired = ackMode === 'ack-only' || ackMode === 'both';

    if (!isDeviceIterable(target)) {
      const { bytes, sequence } = encodeForDevice(command, target, resRequired, ackRequired);
      const promise = registerHandler(ackMode, target.serialNumber, sequence, command.decode, defaultTimeoutMs, responseHandlerMap, options?.signal);
      router.send(bytes, target.port, target.address, target.serialNumber);
      return promise as ModeReturn<T, ResolveMode<Override, Default>>;
    }

    // Register every handler and encode every packet before flushing so the
    // batch leaves together and no response can race ahead of its handler.
    const packets: OutboundPacket[] = [];
    const promises: Promise<T | void>[] = [];
    for (const device of target) {
      const { bytes, sequence } = encodeForDevice(command, device, resRequired, ackRequired);
      promises.push(
        registerHandler(ackMode, device.serialNumber, sequence, command.decode, defaultTimeoutMs, responseHandlerMap, options?.signal),
      );
      packets.push({
        message: bytes,
        port: device.port,
        address: device.address,
        serialNumber: device.serialNumber,
      });
    }
    router.sendMany(packets);
    return Promise.allSettled(promises) as Promise<PromiseSettledResult<ModeResult<T, ResolveMode<Override, Default>>>[]>;
  }

  const client: ClientInstance = {
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
    dispose() {
      if (disposed) return;
      disposed = true;

      // Deregister first so any in-flight messages routed to this client
      // are dropped before we tear down its pending handlers.
      router.deregister(source, client.onMessage);

      const error = new DisposedClientError(source);
      const entries = Array.from(responseHandlerMap.values());
      responseHandlerMap.clear();
      for (const entry of entries) {
        try {
          entry.cancel(error);
        } catch {
          // Ignore errors during disposal cleanup
        }
      }
    },
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
    unicast,
    send,
    onMessage(header: Header, payload: Uint8Array, serialNumber: string) {
      if (options.onMessage) {
        options.onMessage(header, payload, serialNumber);
      }

      const responseHandlerEntry = responseHandlerMap.get(
        getResponseKey(serialNumber, header.sequence),
      );

      if (responseHandlerEntry) {
        offsetRef.current = 0;
        responseHandlerEntry.handle(header.type, payload, offsetRef);
      }
    },
  };

  router.register(source, client.onMessage);

  return client;
}