import { PORT } from './constants/index.js';
import { convertSerialNumberToTarget, convertTargetToSerialNumber, PromiseWithResolvers } from './utils/index.js';
import { AbortError, DeviceRemovedError, TimeoutError, ValidationError } from './errors.js';

/**
 * The minimal decoded-message shape `register()` reads. `ReceivedMessage`
 * (what `router.receive()` returns) satisfies it, so the stock wiring passes
 * straight through; a custom decode pipeline only has to produce these two
 * fields.
 */
export interface RegistrationMessage {
  serialNumber: string;
  header: { target: Uint8Array };
}

/**
 * A device's network identity. The fields are read-only for callers: the
 * registry updates a device's `address`/`port` in place when the device
 * reappears at a new location, so every reference stays routable — writing
 * to the fields yourself would desync those references from the registry.
 */
export interface Device {
  readonly address: string;
  readonly port: number;
  readonly target: Uint8Array;
  readonly serialNumber: string;
}

/**
 * The registry's internal, writable view of {@link Device}. Structurally
 * identical, so it satisfies the public read-only type without casts; only
 * code in this module may mutate.
 */
interface MutableDevice {
  address: string;
  port: number;
  target: Uint8Array;
  serialNumber: string;
}

interface DeviceConfigBase {
  address: string;
  port?: number;
}

/**
 * A device needs an identity as well as an address: responses carry the
 * device's serial number in their target field, and that is how `send()`
 * correlates a reply with its request. Provide the serial number (the
 * 12-hex-digit MAC printed on the device, in either case), the 6-byte wire
 * target, or both; an address alone would send fine but could never match a
 * reply.
 */
export type DeviceConfig =
  | (DeviceConfigBase & { serialNumber: string; target?: Uint8Array })
  | (DeviceConfigBase & { target: Uint8Array; serialNumber?: string });

function isZeroTarget(target: Uint8Array): boolean {
  for (let i = 0; i < target.length; i++) {
    if (target[i] !== 0) return false;
  }
  return true;
}

export function Device(config: DeviceConfig): Device {
  return createDevice(config);
}

function createDevice(config: DeviceConfig): MutableDevice {
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

  let target: Uint8Array;
  if (config.target !== undefined) {
    target = config.target;
  } else if (config.serialNumber) {
    target = convertSerialNumberToTarget(config.serialNumber);
  } else {
    // Responses carry the device's real serial in their target field, so a
    // device without one could be sent to but never matched to a reply:
    // every send() would time out.
    throw new ValidationError('serialNumber', config.serialNumber, 'serialNumber or target is required');
  }
  // Inbound serials are derived from the wire target as lowercase hex, and
  // replies are correlated by string equality, so a serial copied in
  // uppercase from a label or the LIFX app must be normalized or every
  // send() to it times out.
  const serialNumber = config.serialNumber?.toLowerCase()
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
  /**
   * A live, read-only view of the registry's internal map — not a snapshot.
   * Entries appear, update, and disappear as devices are registered and
   * removed; iterate defensively (or copy) if you mutate the registry while
   * walking it.
   */
  readonly registered: ReadonlyMap<string, Device>;
  /**
   * Registers (or updates the address of) the device that sent a message just
   * decoded by `router.receive()`. Pass that result straight through:
   * `received` may be `undefined` (a malformed packet), in which case nothing
   * is registered and `undefined` is returned. A message whose target is all
   * zeros is also ignored (returning `undefined`): that is the broadcast
   * address, used by other controllers' GetService broadcasts, not a device
   * identity. Re-registering a known serial at a new port/address updates it
   * in place and emits `onChanged`.
   */
  register(port: number, address: string, received: RegistrationMessage | undefined): Device | undefined;
  /**
   * Forgets a device. Any `get()` still waiting on this serial number rejects
   * with {@link DeviceRemovedError} — a removed device is one the caller no
   * longer wants, so a lookup for it cannot be satisfied by a later
   * re-registration. Returns whether the device was known. The serial number
   * is matched case-insensitively.
   */
  remove(serialNumber: string): boolean;
  /**
   * Waits for the device with this serial number to be registered — a
   * discovery rendezvous, not a lookup. A known device resolves immediately;
   * otherwise the promise settles on a future `register()`, the timeout, the
   * signal, or a `remove()` of the same serial (rejecting with
   * {@link DeviceRemovedError}). The serial number is matched
   * case-insensitively. For a synchronous check, use
   * {@link DevicesInstance.registered}, which is keyed by lowercase serial.
   */
  get(serialNumber: string, options?: GetDeviceOptions): Promise<Device>;
  /**
   * Adds observers of registry events alongside the callbacks fixed at
   * construction; returns a function that removes exactly the handlers this
   * call added. For each event the constructor callback runs first, then
   * subscribers in subscription order. Handler errors are swallowed so one
   * cannot starve another. Each call is independent: subscribing the same
   * function twice invokes it twice per event. Subscribing from within a
   * handler takes effect on the next event; unsubscribing takes effect at
   * once — a handler removed mid-dispatch is skipped if it has not run yet.
   */
  subscribe(handlers: DeviceEventHandlers): () => void;
  [Symbol.iterator](): Iterator<Device>;
}

interface ListenerRecord {
  fn: (device: Device) => void;
}

export function Devices(options: DevicesOptions = {}): DevicesInstance {
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 3000;

  const knownDevices = new Map<string, MutableDevice>();

  interface Waiter {
    resolve(device: Device): void;
    reject(reason: Error): void;
  }

  const deviceResolvers = new Map<string, Set<Waiter>>();

  // One listener set per event, so dispatching an event never walks handlers
  // that don't observe it. Each handler is wrapped in a per-subscription
  // record: the constructor callbacks are simply the first records (Sets
  // iterate in insertion order, so they run ahead of later subscribers, with
  // no separate dispatch path), and every subscribe() stays independent —
  // subscribing the same function twice registers two records, and each
  // unsubscribe removes only its own.
  const addedListeners = new Set<ListenerRecord>();
  const changedListeners = new Set<ListenerRecord>();
  const removedListeners = new Set<ListenerRecord>();

  if (options.onAdded) addedListeners.add({ fn: options.onAdded });
  if (options.onChanged) changedListeners.add({ fn: options.onChanged });
  if (options.onRemoved) removedListeners.add({ fn: options.onRemoved });

  function emit(listeners: Set<ListenerRecord>, device: Device) {
    // Iterate at most the count captured before dispatch — zero allocation, no
    // per-dispatch copy. A handler subscribed from within a handler is past the
    // cap, so it isn't seen until the next event (this also stops a
    // subscribe-in-handler from looping forever); a handler unsubscribed before
    // it runs is simply skipped.
    let remaining = listeners.size;
    if (remaining === 0) return;
    for (const listener of listeners) {
      if (remaining-- <= 0) break;
      try { listener.fn(device); } catch { /* user callback errors must not corrupt state */ }
    }
  }

  function registerDevice(serialNumber: string, port: number, address: string, target?: Uint8Array): Device {
    const existingDevice = knownDevices.get(serialNumber);
    if (existingDevice) {
      if (port !== existingDevice.port || address !== existingDevice.address) {
        existingDevice.port = port;
        existingDevice.address = address;
        emit(changedListeners, existingDevice);
      }
      return existingDevice;
    }
    const device = createDevice(target ? {
      serialNumber, port, address, target,
    } : {
      serialNumber, port, address,
    });
    knownDevices.set(serialNumber, device);
    emit(addedListeners, device);
    return device;
  }

  function register(port: number, address: string, received: RegistrationMessage | undefined): Device | undefined {
    // received comes straight from router.receive(), so an undefined result
    // (a malformed packet) registers nothing.
    if (received === undefined) {
      return undefined;
    }
    // An all-zero target is the broadcast address, not a device: a socket
    // bound to 56700 sees every other controller's tagged GetService, and
    // registering those would plant a phantom serial 000000000000.
    if (isZeroTarget(received.header.target)) {
      return undefined;
    }
    const device = registerDevice(received.serialNumber, port, address, received.header.target);

    const waiters = deviceResolvers.get(received.serialNumber);
    if (waiters) {
      deviceResolvers.delete(received.serialNumber);
      waiters.forEach((waiter) => {
        try { waiter.resolve(device); } catch { /* one resolver throwing must not block others */ }
      });
    }

    return device;
  }

  return {
    get registered() {
      return knownDevices;
    },
    register,
    remove(serialNumberInput: string): boolean {
      const serialNumber = serialNumberInput.toLowerCase();
      const device = knownDevices.get(serialNumber);
      const removed = knownDevices.delete(serialNumber);
      // Pending get() promises for this serial must not be satisfied by a
      // future re-registration of a device the caller just discarded — and
      // a call with no timeout would otherwise hang forever — so settle them
      // now. Each waiter's reject() also detaches its own timeout and abort
      // listener.
      const waiters = deviceResolvers.get(serialNumber);
      if (waiters) {
        deviceResolvers.delete(serialNumber);
        const error = new DeviceRemovedError(serialNumber);
        waiters.forEach((waiter) => {
          try { waiter.reject(error); } catch { /* one waiter throwing must not block others */ }
        });
      }
      if (device) {
        emit(removedListeners, device);
      }
      return removed;
    },
    subscribe(handlers: DeviceEventHandlers): () => void {
      // Wrap each handler in its own record so the unsubscribe removes exactly
      // what this call added — independent of later mutation of the caller's
      // object and of any other subscriber that passes the same function.
      const added = handlers.onAdded ? { fn: handlers.onAdded } : undefined;
      const changed = handlers.onChanged ? { fn: handlers.onChanged } : undefined;
      const removed = handlers.onRemoved ? { fn: handlers.onRemoved } : undefined;
      if (added) addedListeners.add(added);
      if (changed) changedListeners.add(changed);
      if (removed) removedListeners.add(removed);
      return () => {
        if (added) addedListeners.delete(added);
        if (changed) changedListeners.delete(changed);
        if (removed) removedListeners.delete(removed);
      };
    },
    get(serialNumberInput: string, options?: GetDeviceOptions): Promise<Device> {
      const serialNumber = serialNumberInput.toLowerCase();
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
        // Remove only this call's waiter, and only if the set still holds
        // it: after a remove() settles and drops the set, a fresh get() for
        // the same serial owns a new set, and blindly deleting the map entry
        // here would silently drop that newer waiter.
        const waiters = deviceResolvers.get(serialNumber);
        if (waiters && waiters.delete(waiter) && waiters.size === 0) {
          deviceResolvers.delete(serialNumber);
        }
        reject(reason);
      }

      function onAbort() {
        settleReject(signal?.reason ?? new AbortError('device lookup'));
      }

      const waiter: Waiter = {
        resolve(device) {
          cleanup();
          resolve(device);
        },
        reject(reason) {
          // register()/remove() already dropped the set; only the timers
          // and the abort listener are left to release.
          cleanup();
          reject(reason);
        },
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

      const waiters = deviceResolvers.get(serialNumber);
      if (!waiters) {
        deviceResolvers.set(serialNumber, new Set([waiter]));
      } else {
        waiters.add(waiter);
      }

      return promise;
    },
    [Symbol.iterator](): Iterator<Device> {
      return knownDevices.values();
    },
  };
}