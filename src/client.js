import {
  GetColorCommand,
  GetGroupCommand,
  GetHostFirmwareCommand,
  GetLabelCommand,
  GetVersionCommand,
} from './commands.js';
import {
  TYPE,
  PORT,
  BROADCAST_ADDRESS,
  NO_TARGET,
} from './constants.js';
import {
  encode,
  decodeHeader,
  decodeStateGroup,
  decodeStateLabel,
  decodeLightState,
  decodeStateVersion,
  decodeStateHostFirmware,
  decodeStateUnhandled,
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
 *   defaultTimeoutMs?: number;
 * }} options
 */
export function Client(options) {
  let deviceSource = 3; // 0 and 1 are reserved and we use 2 for broadcasting
  let globalSequence = 0;

  // eslint-disable-next-line no-param-reassign
  options.defaultTimeoutMs = options.defaultTimeoutMs ?? 3000;

  function incrementSequence() {
    return ++globalSequence % 0x100;
  }

  /**
   * @type {Map<string, (type: number, bytes: Uint8Array, ref: { current: number; }) => unknown>}
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
   * @param {AbortSignal} [signal]
   */
  function registerRequest(source, sequence, decoder, signal) {
    /** @typedef {typeof PromiseWithResolvers<T>} Resolvers  */
    const { resolve, reject, promise } = /** @type {Resolvers} */ (PromiseWithResolvers)();

    const key = buildMessageKey(source, sequence);

    function onAbort(...args) {
      responseHandlerMap.delete(key);
      reject(...args);
    }

    let timeout;

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    } else {
      timeout = setTimeout(() => onAbort(new Error('Timeout')), options.defaultTimeoutMs);
    }

    responseHandlerMap.set(key, (type, bytes, offsetRef) => {
      if (type === TYPE.Acknowledgement) {
        // TODO
        return undefined;
      }
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      } else {
        clearTimeout(timeout);
      }
      responseHandlerMap.delete(key);
      if (type === TYPE.StateUnhandled) {
        const requestType = decodeStateUnhandled(bytes, offsetRef);
        reject(new Error(`Unhandled request type: ${requestType}`));
        return undefined;
      }
      const payload = decoder(bytes, offsetRef);
      resolve(/** @type {T} */(payload));
      return payload;
    });

    return promise;
  }

  /**
   * @param {number} source
   * @param {number} sequence
   * @param {number} type
   * @param {Uint8Array} payload
   * @param {{ current: number; }} offsetRef
   */
  function handleResponse(source, sequence, type, payload, offsetRef) {
    const entry = responseHandlerMap.get(buildMessageKey(source, sequence));
    if (entry) {
      return entry(type, payload, offsetRef);
    }
    return undefined;
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
     */
    sendWithoutResponse(command, device) {
      const sequence = incrementSequence();
      const { source } = device;

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

      options.onSend(bytes, device.port, device.address, false);
    },
    /**
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {Device} device
     * @param {AbortSignal} [signal]
     * @returns {Promise<T>}
     */
    send(command, device, signal) {
      const sequence = incrementSequence();
      const { source } = device;

      const bytes = encode(
        false,
        source,
        device.target,
        true,
        false,
        sequence,
        command.type,
        command.payload,
      );

      options.onSend(bytes, device.port, device.address, false);

      return registerRequest(source, sequence, command.decoder, signal);
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

      /** @typedef {typeof PromiseWithResolvers<Device>} Resolvers  */
      const { resolve, promise } = /** @type {Resolvers} */ (PromiseWithResolvers)();

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

      const payloadOffset = offsetRef.current;

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

      offsetRef.current = payloadOffset;

      const possiblyDecodedResponsePayload = handleResponse(
        header.source,
        header.sequence,
        header.type,
        message,
        offsetRef,
      );

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
    },
  };
}
