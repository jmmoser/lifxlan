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

  const target = config.target ?? (config.serialNumber ? convertSerialNumberToTarget(config.serialNumber) : NO_TARGET);
  const serialNumber = config.serialNumber ?? convertTargetToSerialNumber(target);

  return {
    address: config.address,
    port: config.port ?? PORT,
    target,
    serialNumber,
  };
}

export interface DevicesOptions {
  onAdded?: (device: Device) => void;
  onChanged?: (device: Device) => void;
  onRemoved?: (device: Device) => void;
  defaultTimeoutMs?: number;
}

export interface DevicesInstance {
  readonly registered: ReadonlyMap<string, Device>;
  register(serialNumber: string, port: number, address: string, target?: Uint8Array): Device;
  remove(serialNumber: string): boolean;
  get(serialNumber: string, signal?: AbortSignal): Promise<Device>;
  [Symbol.iterator](): Iterator<Device>;
}

export function Devices(options: DevicesOptions = {}): DevicesInstance {
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 3000;
  const onAdded = options.onAdded;
  const onChanged = options.onChanged;
  const onRemoved = options.onRemoved;

  const knownDevices = new Map<string, Device>();

  const deviceResolvers = new Map<string, Set<(device: Device) => void>>();

  function registerDevice(serialNumber: string, port: number, address: string, target?: Uint8Array): Device {
    const existingDevice = knownDevices.get(serialNumber);
    if (existingDevice) {
      if (port !== existingDevice.port || address !== existingDevice.address) {
        existingDevice.port = port;
        existingDevice.address = address;
        if (onChanged) {
          try { onChanged(existingDevice); } catch { /* user callback errors must not corrupt state */ }
        }
      }
      return existingDevice;
    }
    const device = Device(target ? {
      serialNumber, port, address, target,
    } : {
      serialNumber, port, address,
    });
    knownDevices.set(serialNumber, device);
    if (onAdded) {
      try { onAdded(device); } catch { /* user callback errors must not corrupt state */ }
    }
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
      if (device && onRemoved) {
        try { onRemoved(device); } catch { /* user callback errors must not corrupt state */ }
      }
      return removed;
    },
    get(serialNumber: string, signal?: AbortSignal): Promise<Device> {
      const knownDevice = knownDevices.get(serialNumber);
      if (knownDevice) {
        return Promise.resolve(knownDevice);
      }

      const { resolve, reject, promise } = PromiseWithResolvers<Device>();

      let timeout: ReturnType<typeof setTimeout> | undefined;

      function cleanup() {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        } else if (timeout) {
          clearTimeout(timeout);
        }
      }

      function onAbort(errOrEvent: Error | Event) {
        cleanup();
        const resolvers = deviceResolvers.get(serialNumber);
        if (resolvers) {
          if (resolvers.size > 1) {
            resolvers.delete(resolver);
          } else {
            deviceResolvers.delete(serialNumber);
          }
        }
        reject(errOrEvent instanceof Error ? errOrEvent : new AbortError('device lookup'));
      }

      const resolver = (device: Device) => {
        cleanup();
        resolve(device);
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      } else {
        const timeoutError = new TimeoutError(defaultTimeoutMs, 'device discovery');
        timeout = setTimeout(onAbort.bind(undefined, timeoutError), defaultTimeoutMs);
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