import { GetColorCommand, GetGroupCommand, GetHostFirmwareCommand, GetLabelCommand, GetVersionCommand } from './commands.js';
import {
  TYPE,
  SERVICE_TYPE,
  PORT,
  BROADCAST_ADDRESS,
  NO_TARGET,
} from './constants.js';
import {
  encode,
  decodeHeader,
  decodeStateService,
  decodeStateGroup,
  decodeStateLabel,
  decodeLightState,
  decodeStateVersion,
  decodeStateHostFirmware,
} from './encoding.js';
import {
  PromiseWithResolvers,
  convertTargetToSerialNumber,
} from './utils.js';

/**
 * @typedef {'light' | 'switch'} DeviceType
 */

/**
 * @typedef {{
 *   address: string;
 *   port: number;
 *   target: Uint8Array;
 *   serialNumber: string;
 *   label?: string;
 *   group?: ReturnType<typeof decodeStateGroup>;
 *   type?: DeviceType;
 *   source: number;
 *   color?: ReturnType<typeof decodeLightState>;
 *   version?: ReturnType<typeof decodeStateVersion>;
 *   hostFirmware?: ReturnType<typeof decodeStateHostFirmware>;
 * }} Device
 */

/**
 * @param {string} serialNumber
 * @param {number} port
 * @param {string} address
 * @param {Uint8Array} target
 * @param {number} source
 * @returns {Device}
 */
function createDevice(serialNumber, port, address, target, source) {
  return {
    serialNumber,
    port,
    address,
    target,
    source,
  };
}

/**
 * @param {{
 *   onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
 *   onDevice?: (device: Device) => void;
 * }} options
 */
export function Client(options) {
  let deviceSource = 3; // 0 and 1 are reserved and we use 2 for broadcasting
  let _sequence = 0;

  function incrementSequence() {
    return ++_sequence % 0x100;
  }

  /**
  * @type {Map<string, (bytes: Uint8Array, offsetRef: { current: number; }) => unknown>}
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
   * @param {import('./commands.js').Decoder<T>} decoder
   */
  function registerRequest(source, sequence, decoder) {
    const { resolve, reject, promise } = /** @type {typeof PromiseWithResolvers<T>} */ (PromiseWithResolvers)();

    const key = buildMessageKey(source, sequence);

    const timeout = setTimeout(() => {
      responseHandlerMap.delete(key);
      reject(new Error('Timeout'));
    }, 5000);

    responseHandlerMap.set(key, (bytes, offsetRef) => {
      clearTimeout(timeout);
      responseHandlerMap.delete(key);
      const payload = decoder(bytes, offsetRef);
      resolve(/** @type {T} */(payload));
      return payload;
    });

    return promise;
  }

  /**
   * @param {number} source 
   * @param {number} sequence 
   * @param {Uint8Array} payload
   * @param {{ current: number; }} offsetRef
   */
  function handleResponse(source, sequence, payload, offsetRef) {
    const entry = responseHandlerMap.get(buildMessageKey(source, sequence));
    if (entry) {
      return entry(payload, offsetRef);
    }
  }

  const knownDevices = /** @type {Map<string, Device>} */ (new Map());

  const getDeviceResolvers = /** @type {Map<string, ((device: Device) => void)[]>} */ (new Map());

  /**
   * @param {number} port
   * @param {string} address
   * @param {Uint8Array} target
   */
  function registerDevice(port, address, target) {
    const serialNumber = convertTargetToSerialNumber(target);
    const existingDevice = knownDevices.get(serialNumber);
    if (existingDevice) {
      existingDevice.port = port;
      existingDevice.address = address;
      return existingDevice;
    }
    const device = createDevice(serialNumber, port, address, target, ++deviceSource);
    knownDevices.set(serialNumber, device);
    if (options.onDevice) {
      options.onDevice(device);
    }
    return device;
  }

  return {
    get devices() {
      return knownDevices;
    },
    /**
     * @template T
     * @param {import('./commands.js').Command<T>} command
     */
    broadcast(command) {
      const bytes = encode(true, 2, NO_TARGET, true, false, 0, command.type, command.payload);
      options.onSend(bytes, PORT, BROADCAST_ADDRESS, true);
    },
    /**
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {Device} device
     * @returns {Promise<T>}
     */
    send(command, device) {
      const sequence = incrementSequence();
      const source = device.source;

      const bytes = encode(
        !device,
        source,
        device.target,
        true,
        false,
        sequence,
        command.type,
        command.payload,
      );

      options.onSend(bytes, device.port, device.address, false);

      return registerRequest(source, sequence, command.decoder);
    },
    /**
     * @param {Device} device
     */
    async refreshDeviceInfo(device) {
      await Promise.allSettled([
        this.send(GetLabelCommand(), device),
        this.send(GetGroupCommand(), device),
        this.send(GetColorCommand(), device),
        this.send(GetVersionCommand(), device),
        this.send(GetHostFirmwareCommand(), device),
      ]);
    },
    /**
     * @param {string} serialNumber 
     */
    getDevice(serialNumber) {
      const device = knownDevices.get(serialNumber);
      if (device) {
        return device;
      }

      const { resolve, promise } = /** @type {typeof PromiseWithResolvers<Device>} */ (PromiseWithResolvers)();

      const deviceResolvers = getDeviceResolvers.get(serialNumber);
      if (!deviceResolvers) {
        getDeviceResolvers.set(serialNumber, [resolve]);
      } else {
        deviceResolvers.push(resolve);
      }

      return promise;
    },
    /**
     * @param {Uint8Array} message
     * @param {number} port
     * @param {string} address
     */
    onReceived(message, port, address) {
      const offsetRef = { current: 0 };
      const header = decodeHeader(message, offsetRef);

      const device = registerDevice(port, address, header.target);

      const currentOffset = offsetRef.current;

      switch (header.type) {
        case TYPE.StateGroup:
          device.group = decodeStateGroup(message, offsetRef);
          break;
        case TYPE.StateLabel:
          device.label = decodeStateLabel(message, offsetRef);
          break;
        case TYPE.LightState:
          device.color = decodeLightState(message, offsetRef);
          device.type = 'light';
          break;
        case TYPE.StateVersion:
          device.version = decodeStateVersion(message, offsetRef);
          break;
        case TYPE.StateHostFirmware:
          device.hostFirmware = decodeStateHostFirmware(message, offsetRef);
          break;
        default:
          break;
      }

      offsetRef.current = currentOffset;

      // TODO: every response could be handled, could use this.send() with commands to decode payload
      const possiblyDecodedResponsePayload = handleResponse(header.source, header.sequence, message, offsetRef);

      const resolvers = getDeviceResolvers.get(device.serialNumber);
      if (resolvers) {
        getDeviceResolvers.delete(device.serialNumber);
        resolvers.forEach((resolver) => {
          resolver(device);
        });
      }

      return {
        header,
        payload: possiblyDecodedResponsePayload,
      };
    }
  }
}