import { NO_TARGET, PORT } from './constants/index.js';
import { convertSerialNumberToTarget, convertTargetToSerialNumber, PromiseWithResolvers } from './utils/index.js';
import { AbortError, TimeoutError, ValidationError } from './errors.js';

export interface Device {
  address: string;
  port: number;
  target: Uint8Array;
  serialNumber: string;
}

export interface DeviceConfig {
  address: string;
  serialNumber?: string;
  port?: number;
  target?: Uint8Array;
}

export function Device(config: DeviceConfig): Device {
  if (!config.address) {
    throw new ValidationError('address', config.address, 'is required');
  }

  if (config.port !== undefined && (config.port < 1 || config.port > 65535)) {
    throw new ValidationError('port', config.port, 'must be between 1 and 65535');
  }

  // The wire target field is 8 bytes: a 6-byte serial plus 2 reserved padding
  // bytes, so both shapes are accepted. Anything else would silently encode a
  // corrupt frame address and derive a serial number that can never match an
  // inbound response, so fail fast here instead.
  if (config.target !== undefined && config.target.length !== 6 && config.target.length !== 8) {
    throw new ValidationError('target', config.target, 'must be 6 bytes (or 8 with two trailing reserved bytes)');
  }

  const target = config.target ?? (config.serialNumber ? convertSerialNumberToTarget(config.serialNumber) : NO_TARGET);
  const serialNumber = config.serialNumber
    ?? convertTargetToSerialNumber(target.length > 6 ? target.subarray(0, 6) : target);

  return {
    address: config.address,
    port: config.port ?? PORT,
    target,
    serialNumber,
  };
}

export interface DeviceEventHandlers {
  onAdded?: (device: Device) => void;
  onChanged?: (device: Device) => void;
  onRemoved?: (device: Device) => void;
}

export interface DevicesOptions extends DeviceEventHandlers {
  /**
   * How long get() waits for a device to be registered before rejecting with
   * TimeoutError. Applies whether or not a per-call signal is provided; set 0
   * to disable timeouts by default. Defaults to 3000ms.
   */
  defaultTimeoutMs?: number;
}

export interface GetDeviceOptions {
  /**
   * Cancels the lookup when aborted; the promise rejects with the signal's
   * reason. The signal is additive to the timeout — passing a signal does not
   * disable the timeout.
   */
  signal?: AbortSignal;
  /**
   * Per-call override of `defaultTimeoutMs`. Pass 0 to disable the timeout
   * for this call, in which case only registration (or the signal, if
   * provided) settles the promise.
   */
  timeoutMs?: number;
}

export interface DevicesInstance {
  readonly registered: ReadonlyMap<string, Device>;
  register(serialNumber: string, port: number, address: string, target?: Uint8Array): Device;
  remove(serialNumber: string): boolean;
  get(serialNumber: string, options?: GetDeviceOptions): Promise<Device>;
  /**
   * Adds an additional observer of registry events, independent of the
   * callbacks fixed at construction; returns a function that removes it.
   * For each event the constructor callback runs first, then subscribers in
   * subscription order. Subscriber errors are swallowed like constructor
   * callback errors, so one subscriber cannot starve another.
   */
  subscribe(handlers: DeviceEventHandlers): () => void;
  [Symbol.iterator](): Iterator<Device>;
}

export function Devices(options: DevicesOptions = {}): DevicesInstance {
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 3000;
  const onAdded = options.onAdded;
  const onChanged = options.onChanged;
  const onRemoved = options.onRemoved;

  const knownDevices = new Map<string, Device>();

  const deviceResolvers = new Map<string, Set<(device: Device) => void>>();

  const subscribers = new Set<DeviceEventHandlers>();

  function emitAdded(device: Device) {
    if (onAdded) {
      try { onAdded(device); } catch { /* user callback errors must not corrupt state */ }
    }
    for (const subscriber of subscribers) {
      if (subscriber.onAdded) {
        try { subscriber.onAdded(device); } catch { /* user callback errors must not corrupt state */ }
      }
    }
  }

  function emitChanged(device: Device) {
    if (onChanged) {
      try { onChanged(device); } catch { /* user callback errors must not corrupt state */ }
    }
    for (const subscriber of subscribers) {
      if (subscriber.onChanged) {
        try { subscriber.onChanged(device); } catch { /* user callback errors must not corrupt state */ }
      }
    }
  }

  function emitRemoved(device: Device) {
    if (onRemoved) {
      try { onRemoved(device); } catch { /* user callback errors must not corrupt state */ }
    }
    for (const subscriber of subscribers) {
      if (subscriber.onRemoved) {
        try { subscriber.onRemoved(device); } catch { /* user callback errors must not corrupt state */ }
      }
    }
  }

  function registerDevice(serialNumber: string, port: number, address: string, target?: Uint8Array): Device {
    const existingDevice = knownDevices.get(serialNumber);
    if (existingDevice) {
      if (port !== existingDevice.port || address !== existingDevice.address) {
        existingDevice.port = port;
        existingDevice.address = address;
        emitChanged(existingDevice);
      }
      return existingDevice;
    }
    const device = Device(target ? {
      serialNumber, port, address, target,
    } : {
      serialNumber, port, address,
    });
    knownDevices.set(serialNumber, device);
    emitAdded(device);
    return device;
  }

  return {
    get registered() {
      return knownDevices;
    },
    register(serialNumber: string, port: number, address: string, target?: Uint8Array): Device {
      const device = registerDevice(
        serialNumber,
        port,
        address,
        target,
      );

      const resolvers = deviceResolvers.get(serialNumber);
      if (resolvers) {
        deviceResolvers.delete(serialNumber);
        resolvers.forEach((resolver) => {
          try { resolver(device); } catch { /* one resolver throwing must not block others */ }
        });
      }

      return device;
    },
    remove(serialNumber: string): boolean {
      const device = knownDevices.get(serialNumber);
      const removed = knownDevices.delete(serialNumber);
      // Pending get() promises for this serial would otherwise hang
      // until their abort/timeout fires. Drop their resolvers; the abort
      // listeners and timeouts they own remain in place and will reject
      // the awaiting caller with an AbortError or TimeoutError, but the
      // resolver Set must be cleared so they aren't accidentally
      // resolved by a future re-registration.
      deviceResolvers.delete(serialNumber);
      if (device) {
        emitRemoved(device);
      }
      return removed;
    },
    subscribe(handlers: DeviceEventHandlers): () => void {
      // Copy the handlers so each call is its own subscription — passing the
      // same object twice must not collapse into one entry, and mutating the
      // caller's object after subscribing must not alter what was subscribed.
      const subscription: DeviceEventHandlers = {};
      if (handlers.onAdded) subscription.onAdded = handlers.onAdded;
      if (handlers.onChanged) subscription.onChanged = handlers.onChanged;
      if (handlers.onRemoved) subscription.onRemoved = handlers.onRemoved;
      subscribers.add(subscription);
      return () => {
        subscribers.delete(subscription);
      };
    },
    get(serialNumber: string, options?: GetDeviceOptions): Promise<Device> {
      const signal = options?.signal;

      if (signal?.aborted) {
        // The caller already cancelled. Reject even when the device is
        // already known — resolving a cancelled lookup is more surprising
        // than rejecting it, and it matches platform abort semantics. (An
        // already-aborted signal also never fires another 'abort' event, so
        // the listener below would never run.)
        return Promise.reject(signal.reason ?? new AbortError('device lookup'));
      }

      const knownDevice = knownDevices.get(serialNumber);
      if (knownDevice) {
        return Promise.resolve(knownDevice);
      }

      const timeoutMs = options?.timeoutMs ?? defaultTimeoutMs;

      const { resolve, reject, promise } = PromiseWithResolvers<Device>();

      let timeout: ReturnType<typeof setTimeout> | undefined;

      function cleanup() {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        if (timeout !== undefined) {
          clearTimeout(timeout);
        }
      }

      function settleReject(reason: unknown) {
        cleanup();
        const resolvers = deviceResolvers.get(serialNumber);
        if (resolvers) {
          if (resolvers.size > 1) {
            resolvers.delete(resolver);
          } else {
            deviceResolvers.delete(serialNumber);
          }
        }
        reject(reason);
      }

      function onAbort() {
        settleReject(signal?.reason ?? new AbortError('device lookup'));
      }

      const resolver = (device: Device) => {
        cleanup();
        resolve(device);
      };

      // The timeout and the signal are independent: a device that never
      // appears must not hang the caller just because they passed a
      // cancellation signal, so the timeout arms whether or not a signal is
      // present. A timeoutMs <= 0 disables it.
      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }
      if (timeoutMs > 0) {
        const timeoutError = new TimeoutError(timeoutMs, 'device discovery');
        timeout = setTimeout(settleReject.bind(undefined, timeoutError), timeoutMs);
      }

      const resolvers = deviceResolvers.get(serialNumber);
      if (!resolvers) {
        deviceResolvers.set(serialNumber, new Set([resolver]));
      } else {
        resolvers.add(resolver);
      }

      return promise;
    },
    [Symbol.iterator](): Iterator<Device> {
      return knownDevices.values();
    },
  };
}