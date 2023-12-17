import * as Protocol from './protocol.js';
import { PromiseWithResolvers } from './utils.js';

/**
 * @typedef {'light' | 'switch'} DeviceType
 */

/**
 * @typedef {{
 *   address: string;
 *   port: number;
 *   target: Uint8Array;
 *   label?: string;
 *   groupLabel?: string;
 *   groupId?: string;
 *   type?: DeviceType;
 *   source: number;
 * }} Device
 */

/**
 * @param {{
 *   onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void,
 *   onDevice?: (device: Device) => void,
 * }} options
 * @returns 
 */
export function Client(options) {
  let deviceSource = 3; // 0 and 1 are reserved and we use 2 for discovering
  let sequence = 0;

  function incrementSequence() {
    return ++sequence % 0x100;
  }

  /**
   * @type {Map<string, (payload: unknown) => void>}
   */
  const responseHandlerMap = new Map();

  /**
   * @param {number} source
   * @param {number} sequence
   */
  function buildMessageKey(source, sequence) {
    return `${source}_${sequence}`;
  }

  /**
   * @template T
   * @param {number} source 
   * @param {number} sequence 
   */
  function registerRequest(source, sequence) {
    const { resolve, reject, promise } = /** @type {typeof PromiseWithResolvers<T>} */ (PromiseWithResolvers)();

    const key = buildMessageKey(source, sequence);

    const timeout = setTimeout(() => {
      responseHandlerMap.delete(key);
      reject(new Error('Timeout'));
    }, 5000);

    responseHandlerMap.set(key, (res) => {
      clearTimeout(timeout);
      responseHandlerMap.delete(key);
      resolve(/** @type {T} */ (res));
    });

    return promise;
  }

  /**
   * @param {number} source 
   * @param {number} sequence 
   * @param {unknown} payload 
   */
  function handleResponse(source, sequence, payload) {
    const entry = responseHandlerMap.get(buildMessageKey(source, sequence));
    if (entry) {
      entry(payload);
    }
  }

  const knownDevices = /** @type {Device[]} */ ([]);

  /**
   * @type {Map<string, ((device: Device) => void)[]>}
   */
  const getDevicePromises = new Map();

  /**
   * @param {number} port 
   * @param {string} address 
   * @param {Uint8Array} target 
   */
  function registerDevice(port, address, target) {
    for (let i = 0; i < knownDevices.length; i++) {
      const device = knownDevices[i];
      if (device.address === address && device.port === port) {
        return knownDevices[i];
      }
    }
    const device = /** @type {Device} */ ({
      port,
      address,
      target,
      source: ++deviceSource,
    });
    knownDevices.push(device);
    return device;
  }

  let discoverTimeout;
  function discoverDevices() {
    if (discoverTimeout) {
      clearTimeout(discoverTimeout);
    }
    options.onSend(Protocol.encode(true, 2, Protocol.NO_TARGET, true, false, 0, Protocol.TYPE.GetService), Protocol.PORT, Protocol.BROADCAST_ADDRESS, true);
    discoverTimeout = setTimeout(discoverDevices, 2000);
  }

  return {
    discover() {
      discoverDevices();
    },
    close() {
      if (discoverTimeout) {
        clearTimeout(discoverTimeout);
      }
    },
    get devices() {
      return knownDevices;
    },
    /**
     * @template T
     * @param {import('./commands.js').Command<T>} command 
     * @param {Device} [device]
     * @returns {Promise<T>}}
     */
    send(command, device) {
      const seqence = incrementSequence();
      const source = device ? device.source : 2;

      const bytes = Protocol.encode(
        !device,
        source,
        device ? device.target : Protocol.NO_TARGET,
        true,
        false,
        seqence,
        command.type,
        command.payload,
      );

      if (device) {
        options.onSend(bytes, device.port, device.address, false);
      } else {
        options.onSend(bytes, Protocol.PORT, Protocol.BROADCAST_ADDRESS, true);
      }

      return registerRequest(source, sequence);
    },
    /**
     * @param {string} label 
     */
    getDevice(label) {
      for (let i = 0; i < knownDevices.length; i++) {
        const device = knownDevices[i];
        if (device.label === label) {
          return knownDevices[i];
        }
      }

      const { resolve, promise } = /** @type {typeof PromiseWithResolvers<Device>} */ (PromiseWithResolvers)();

      const existingPromises = getDevicePromises.get(label);
      if (!existingPromises) {
        getDevicePromises.set(label, [resolve]);
      } else {
        existingPromises.push(resolve);
      }

      return promise;
    },
    /**
     * @param {Uint8Array} message
     * @param {number} port 
     * @param {string} address 
     */
    onReceived(message, port, address) {
      const packet = Protocol.decode(message, { current: 0 });

      const device = registerDevice(port, address, packet.target.bytes);

      if (Protocol.isStateService(packet)) {
        if (packet.payload.service.code !== Protocol.SERVICE_TYPE.UDP) {
          // ignore all other types as they are reserved
          return;
        }
        if (options.onDevice && (!device.label || !device.groupId)) {
          options.onDevice(device);
        }
        if (!device.label) {
          options.onSend(Protocol.encode(false, device.source, device.target, true, false, 0, Protocol.TYPE.GetLabel), port, address, false);
        }
        if (!device.groupLabel) {
          options.onSend(Protocol.encode(false, device.source, device.target, true, false, 0, Protocol.TYPE.GetGroup), port, address, false);
        }
      } else if (Protocol.isStateGroup(packet)) {
        const { group, label } = packet.payload;

        if (device.groupId !== group || device.groupLabel !== label) {
          device.groupId = group;
          device.groupLabel = label;
          if (options.onDevice) {
            options.onDevice(device);
          }
        }
      } else if (Protocol.isStateLabel(packet)) {
        const label = packet.payload;

        if (device.label !== label) {
          device.label = label;
          if (options.onDevice) {
            options.onDevice(device);
          }
        }
      }

      handleResponse(packet.source, packet.sequence, packet.payload);

      if (device.label) {
        const resolvers = getDevicePromises.get(device.label);
        if (resolvers) {
          getDevicePromises.delete(device.label);
          resolvers.forEach((resolver) => {
            resolver(device);
          });
        }
      }

      return packet;
    }
  }
}