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
  let deviceSource = 3; // 0 and 1 are reserved and we use 2 for discovering
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

  const knownDevices = /** @type {Device[]} */ ([]);

  /**
   * @type {Map<string, ((device: Device) => void)[]>}
   */
  const getDeviceResolvers = new Map();

  /**
   * @param {number} port
   * @param {string} address
   * @param {Uint8Array} target
   */
  function registerDevice(port, address, target) {
    const serialNumber = convertTargetToSerialNumber(target);
    for (let i = 0; i < knownDevices.length; i++) {
      const device = knownDevices[i];
      if (device.serialNumber === serialNumber) {
        device.port = port;
        device.address = address;
        return knownDevices[i];
      }
    }
    const device = createDevice(serialNumber, port, address, target, ++deviceSource);
    knownDevices.push(device);
    if (options.onDevice) {
      options.onDevice(device);
    }
    return device;
  }

  let discoverTimeout;
  function discoverDevices() {
    if (discoverTimeout) {
      clearTimeout(discoverTimeout);
    }
    options.onSend(encode(true, 2, NO_TARGET, true, false, 0, TYPE.GetService), PORT, BROADCAST_ADDRESS, true);
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
      const sequence = incrementSequence();
      const source = device ? device.source : 2;

      const bytes = encode(
        !device,
        source,
        device ? device.target : NO_TARGET,
        true,
        false,
        sequence,
        command.type,
        command.payload,
      );

      if (device) {
        options.onSend(bytes, device.port, device.address, false);
      } else {
        options.onSend(bytes, PORT, BROADCAST_ADDRESS, true);
      }

      return registerRequest(source, sequence, command.decoder);
    },
    /**
     * @param {string} serialNumber 
     */
    getDevice(serialNumber) {
      for (let i = 0; i < knownDevices.length; i++) {
        const device = knownDevices[i];
        if (device.serialNumber === serialNumber) {
          return knownDevices[i];
        }
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

      // TODO: every response could be handled, could use this.send() with commands to decode payload
      const possiblyDecodedResponsePayload = handleResponse(header.source, header.sequence, message, { current: offsetRef.current });

      const device = registerDevice(port, address, header.target);

      switch (header.type) {
        case TYPE.StateService: {
          const payload = decodeStateService(message, offsetRef);
          if (payload.service.code !== SERVICE_TYPE.UDP) {
            // ignore all other types as they are reserved
            return;
          }
          if (!device.label) {
            options.onSend(encode(false, device.source, device.target, true, false, 0, TYPE.GetLabel), port, address, false);
          }
          if (!device.group) {
            options.onSend(encode(false, device.source, device.target, true, false, 0, TYPE.GetGroup), port, address, false);
          }
          if (!device.color) {
            options.onSend(encode(false, device.source, device.target, true, false, 0, TYPE.GetColor), port, address, false);
          }
          if (!device.version) {
            options.onSend(encode(false, device.source, device.target, true, false, 0, TYPE.GetVersion), port, address, false);
          }
          if (!device.hostFirmware) {
            options.onSend(encode(false, device.source, device.target, true, false, 0, TYPE.GetHostFirmware), port, address, false);
          }
          break;
        }
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