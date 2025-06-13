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

import type { RouterInstance, MessageHandler, Header, BatchSendMessage } from './router.js';

import type { Device } from './devices.js';
import type { Decoder, Command } from './commands/index.js';

/**
 * Creates a unique response key for correlating requests with responses.
 * 
 * @param serialNumber - The device serial number
 * @param sequence - The message sequence number
 * @returns A unique key for this request-response pair
 * @internal
 * @performance Critical path - string concatenation optimized for V8
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
 * @performance Bitwise operations for maximum speed
 */
function incrementSequence(sequence?: number): number {
  /** Only allow up to 254. We use 255 for broadcast messages. */
  return sequence == null ? 0 : (sequence + 1) % 0xFF;
}

function registerHandler<T, ACK extends boolean>(
  isAckOnly: ACK,
  serialNumber: string,
  sequence: number,
  decode: Decoder<T> | undefined,
  defaultTimeoutMs: number,
  responseHandlerMap: Map<string, (type: number, bytes: Uint8Array, ref: { current: number }) => void>,
  signal?: AbortSignal
): Promise<ACK extends true ? void : T> {
  const key = getResponseKey(serialNumber, sequence);

  if (responseHandlerMap.has(key)) {
    throw new MessageConflictError(key, sequence);
  }

  const { resolve, reject, promise } = PromiseWithResolvers<ACK extends true ? void : T>();

  function onAbort(errOrEvent: Error | Event) {
    responseHandlerMap.delete(key);
    if (errOrEvent instanceof Error) {
      reject(errOrEvent);
    } else {
      reject(new AbortError('device response'));
    }
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;

  if (signal) {
    signal.addEventListener('abort', onAbort, { once: true });
  } else if (defaultTimeoutMs > 0) {
    timeout = setTimeout(() => onAbort(new TimeoutError(defaultTimeoutMs, 'device response')), defaultTimeoutMs);
  }

  function cleanupOnResponse() {
    if (signal) {
      signal.removeEventListener('abort', onAbort);
    } else if (timeout) {
      clearTimeout(timeout);
    }
    responseHandlerMap.delete(key);
  }

  responseHandlerMap.set(key, (type, bytes, offsetRef) => {
    if (type === Type.Acknowledgement) {
      if (isAckOnly) {
        cleanupOnResponse();
        resolve(undefined as ACK extends true ? void : T);
      }
      return;
    }
    
    if (type === Type.StateUnhandled) {
      cleanupOnResponse();
      const requestType = decodeStateUnhandled(bytes, offsetRef);
      reject(new UnhandledCommandError(requestType, serialNumber));
      return;
    }
    
    if (!isAckOnly && decode) {
      // Support both single-response and multi-response commands
      const continuation = { expectMore: false };
      
      // Check if this is a multi-response command that accepts responseType parameter
      const result = decode.length >= 4 
        ? decode(bytes, offsetRef, continuation, type)
        : decode(bytes, offsetRef, continuation);
      
      if (continuation.expectMore) {
        // Don't cleanup or resolve yet - wait for more responses
        return;
      } else {
        // This is the final response or a single-response command
        cleanupOnResponse();
        resolve(result as ACK extends true ? void : T);
      }
    }
  });

  return promise;
}

export interface ClientOptions {
  router: RouterInstance;
  defaultTimeoutMs?: number;
  source?: number;
  onMessage?: MessageHandler;
}

export interface BatchCommand<T> {
  command: Command<T>;
  device: Device;
}

export interface ClientInstance {
  readonly router: RouterInstance;
  readonly source: number;
  dispose(): void;
  broadcast<T>(command: Command<T>): void;
  unicast<T>(command: Command<T>, device: Device): void;
  sendOnlyAcknowledgement<T>(command: Command<T>, device: Device, signal?: AbortSignal): Promise<void>;
  send<T>(command: Command<T>, device: Device, signal?: AbortSignal): Promise<T>;
  batchUnicast<T>(commands: BatchCommand<T>[]): void;
  batchSendOnlyAcknowledgement<T>(commands: BatchCommand<T>[], signal?: AbortSignal): Promise<void[]>;
  batchSend<T>(commands: BatchCommand<T>[], signal?: AbortSignal): Promise<T[]>;
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

  const responseHandlerMap = new Map<string, (type: number, bytes: Uint8Array, ref: { current: number }) => void>();

  let disposed = false;

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
      
      // Clear all pending response handlers
      for (const handler of responseHandlerMap.values()) {
        try {
          handler(0, new Uint8Array(), { current: 0 });
        } catch {
          // Ignore errors during disposal cleanup
        }
      }
      responseHandlerMap.clear();
      
      router.deregister(source, client.onMessage);
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
    /**
     * Send a command to a device without expecting a response or acknowledgement.
     */
    unicast<T>(command: Command<T>, device: Device) {
      if (disposed) throw new DisposedClientError(source);
      
      const bytes = encode(
        false,
        source,
        device.target,
        false,
        false,
        device.sequence,
        command.type,
        command.payload,
      );

      router.send(bytes, device.port, device.address, device.serialNumber);

      device.sequence = incrementSequence(device.sequence);
    },
    /**
     * Send a command to a device and only require an acknowledgement.
     */
    sendOnlyAcknowledgement<T>(command: Command<T>, device: Device, signal?: AbortSignal): Promise<void> {
      if (disposed) throw new DisposedClientError(source);
      
      const bytes = encode(
        false,
        source,
        device.target,
        false,
        true,
        device.sequence,
        command.type,
        command.payload,
      );

      const promise = registerHandler(true, device.serialNumber, device.sequence, undefined, defaultTimeoutMs, responseHandlerMap, signal);

      device.sequence = incrementSequence(device.sequence);

      router.send(bytes, device.port, device.address, device.serialNumber);

      return promise;
    },
    /**
     * Send a command to a device and require a response.
     */
    send<T>(command: Command<T>, device: Device, signal?: AbortSignal): Promise<T> {
      if (disposed) throw new DisposedClientError(source);
      
      const bytes = encode(
        false,
        source,
        device.target,
        true,
        false,
        device.sequence,
        command.type,
        command.payload,
      );

      const promise = registerHandler(false, device.serialNumber, device.sequence, command.decode, defaultTimeoutMs, responseHandlerMap, signal);

      device.sequence = incrementSequence(device.sequence);

      router.send(bytes, device.port, device.address, device.serialNumber);

      return promise;
    },
    /**
     * Send multiple commands to multiple devices without expecting responses or acknowledgements.
     */
    batchUnicast<T>(commands: BatchCommand<T>[]) {
      if (disposed) throw new DisposedClientError(source);
      
      const messages: BatchSendMessage[] = [];
      
      for (const { command, device } of commands) {
        const bytes = encode(
          false,
          source,
          device.target,
          false,
          false,
          device.sequence,
          command.type,
          command.payload,
        );
        
        messages.push({
          message: bytes,
          port: device.port,
          address: device.address,
          serialNumber: device.serialNumber,
        });
        
        device.sequence = incrementSequence(device.sequence);
      }
      
      router.batchSend(messages);
    },
    /**
     * Send multiple commands to multiple devices and only require acknowledgements.
     */
    batchSendOnlyAcknowledgement<T>(commands: BatchCommand<T>[], signal?: AbortSignal): Promise<void[]> {
      if (disposed) throw new DisposedClientError(source);
      
      const messages: BatchSendMessage[] = [];
      const promises: Promise<void>[] = [];
      
      for (const { command, device } of commands) {
        const bytes = encode(
          false,
          source,
          device.target,
          false,
          true,
          device.sequence,
          command.type,
          command.payload,
        );
        
        const promise = registerHandler(true, device.serialNumber, device.sequence, undefined, defaultTimeoutMs, responseHandlerMap, signal);
        promises.push(promise);
        
        messages.push({
          message: bytes,
          port: device.port,
          address: device.address,
          serialNumber: device.serialNumber,
        });
        
        device.sequence = incrementSequence(device.sequence);
      }
      
      router.batchSend(messages);
      
      return Promise.all(promises);
    },
    /**
     * Send multiple commands to multiple devices and require responses.
     */
    batchSend<T>(commands: BatchCommand<T>[], signal?: AbortSignal): Promise<T[]> {
      if (disposed) throw new DisposedClientError(source);
      
      const messages: BatchSendMessage[] = [];
      const promises: Promise<T>[] = [];
      
      for (const { command, device } of commands) {
        const bytes = encode(
          false,
          source,
          device.target,
          true,
          false,
          device.sequence,
          command.type,
          command.payload,
        );
        
        const promise = registerHandler(false, device.serialNumber, device.sequence, command.decode, defaultTimeoutMs, responseHandlerMap, signal);
        promises.push(promise);
        
        messages.push({
          message: bytes,
          port: device.port,
          address: device.address,
          serialNumber: device.serialNumber,
        });
        
        device.sequence = incrementSequence(device.sequence);
      }
      
      router.batchSend(messages);
      
      return Promise.all(promises);
    },
    onMessage(header: Header, payload: Uint8Array, serialNumber: string) {
      if (options.onMessage) {
        options.onMessage(header, payload, serialNumber);
      }

      const responseHandlerEntry = responseHandlerMap.get(
        getResponseKey(serialNumber, header.sequence),
      );

      if (responseHandlerEntry) {
        responseHandlerEntry(header.type, payload, { current: 0 });
      }
    },
  };

  router.register(source, client.onMessage);

  return client;
}