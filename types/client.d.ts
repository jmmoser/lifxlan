/**
 * @param {{
 *   onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
 *   onDevice?: (device: Device) => void;
 *   defaultTimeoutMs?: number;
 * }} options
 */
export function Client(options: {
    onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
    onDevice?: (device: Device) => void;
    defaultTimeoutMs?: number;
}): {
    /**
     * @param {string} serialNumber
     * @param {number} port
     * @param {string} address
     */
    registerDevice(serialNumber: string, port: number, address: string): any;
    readonly devices: Map<string, Device>;
    /**
     * @template T
     * @param {import('./commands.js').Command<T>} command
     */
    broadcast<T>(command: import("./commands.js").Command<T>): void;
    /**
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {Device} device
     */
    unicast<T_1>(command: import("./commands.js").Command<T_1>, device: Device): void;
    /**
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {Device} device
     * @param {AbortSignal} [signal]
     * @returns {Promise<void>}
     */
    sendOnlyAcknowledgement<T_2>(command: import("./commands.js").Command<T_2>, device: Device, signal?: AbortSignal): Promise<void>;
    /**
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {Device} device
     * @param {AbortSignal} [signal]
     * @returns {Promise<T>}
     */
    send<T_3>(command: import("./commands.js").Command<T_3>, device: Device, signal?: AbortSignal): Promise<T_3>;
    /**
     * @param {Device} device
     */
    refreshDeviceInfo(device: Device): Promise<void>;
    /**
     * @param {string} serialNumber
     */
    getDevice(serialNumber: string): any;
    /**
     * @param {Uint8Array} message
     * @param {number} port
     * @param {string} address
     */
    onReceived(message: Uint8Array, port: number, address: string): {
        header: {
            bytes: Uint8Array;
            size: number;
            protocol: number;
            addressable: boolean;
            tagged: boolean;
            origin: number;
            source: number;
            target: Uint8Array;
            reserved1: Uint8Array;
            reserved2: Uint8Array;
            resRequired: boolean;
            ackRequired: boolean;
            reserved3: number;
            reserved4: Uint8Array;
            sequence: number;
            reserved5: Uint8Array;
            type: number;
        };
        payload: any;
    };
};
export type DeviceType = 'light' | 'switch';
export type Device = {
    address: string;
    port: number;
    target: Uint8Array;
    serialNumber: string;
    label?: string;
    group?: ReturnType<typeof decodeStateGroup>;
    type?: DeviceType;
    color?: ReturnType<typeof decodeLightState>;
    version?: ReturnType<typeof decodeStateVersion>;
    hostFirmware?: ReturnType<typeof decodeStateHostFirmware>;
};
import { decodeStateGroup } from './encoding.js';
import { decodeLightState } from './encoding.js';
import { decodeStateVersion } from './encoding.js';
import { decodeStateHostFirmware } from './encoding.js';
