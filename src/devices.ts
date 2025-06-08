import { NO_TARGET, PORT } from './constants/index.js';
import { convertSerialNumberToTarget, PromiseWithResolvers } from './utils/index.js';

export interface Device {
  address: string;
  port: number;
  target: Uint8Array;
  serialNumber: string;
  sequence: number;
}

export interface DeviceConfig {
  address: string;
  serialNumber?: string;
  port?: number;
  target?: Uint8Array;
  sequence?: number;
}

export function Device(config: DeviceConfig): Device {
  const device = config as Device;
  device.port ??= PORT;
  device.target ??= config.serialNumber ? convertSerialNumberToTarget(config.serialNumber) : NO_TARGET;
  device.sequence = config.sequence ?? 0;
  return device;
}

export interface DevicesOptions {
  onAdded?: (device: Device) => void;
  onChanged?: (device: Device) => void;
  onRemoved?: (device: Device) => void;
  defaultTimeoutMs?: number;
}

export interface DevicesInstance {
  readonly registered: Map<string, Device>;
  register(serialNumber: string, port: number, address: string, target?: Uint8Array): Device;
  remove(serialNumber: string): boolean;
  get(serialNumber: string, signal?: AbortSignal): Promise<Device>;
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
          onChanged(existingDevice);
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
      onAdded(device);
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
          resolver(device);
        });
      }

      return device;
    },
    remove(serialNumber: string): boolean {
      const device = knownDevices.get(serialNumber);
      const removed = knownDevices.delete(serialNumber);
      if (device && onRemoved) {
        onRemoved(device);
      }
      return removed;
    },
    get(serialNumber: string, signal?: AbortSignal): Promise<Device> {
      const knownDevice = knownDevices.get(serialNumber);
      if (knownDevice) {
        return Promise.resolve(knownDevice);
      }

      const { resolve, reject, promise } = PromiseWithResolvers<Device>();

      function onAbort(errOrEvent: Error | Event) {
        const resolvers = deviceResolvers.get(serialNumber);
        if (resolvers) {
          if (resolvers.size > 1) {
            resolvers.delete(resolve);
          } else {
            deviceResolvers.delete(serialNumber);
          }
        }
        reject(errOrEvent instanceof Error ? errOrEvent : new Error('Abort'));
      }

      let timeout: ReturnType<typeof setTimeout> | undefined;

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      } else {
        timeout = setTimeout(() => onAbort(new Error('Timeout')), defaultTimeoutMs);
      }

      const resolver = (device: Device) => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        } else if (timeout) {
          clearTimeout(timeout);
        }
        resolve(device);
      };

      const resolvers = deviceResolvers.get(serialNumber);
      if (!resolvers) {
        deviceResolvers.set(serialNumber, new Set([resolver]));
      } else {
        resolvers.add(resolver);
      }

      return promise;
    },
  };
}