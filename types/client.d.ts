/**
 * @param {{
 *   onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
 *   onDevice?: (device: Device) => void;
 * }} options
 */
export function Client(options: {
    onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
    onDevice?: (device: Device) => void;
}): {
    discover(): void;
    close(): void;
    readonly devices: Device[];
    /**
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {Device} [device]
     * @returns {Promise<T>}}
     */
    send<T>(command: import("./commands.js").Command<T>, device?: Device): Promise<T>;
    /**
     * @param {string} serialNumber
     */
    getDevice(serialNumber: string): Device | Promise<Device>;
    /**
     * @param {Uint8Array} message
     * @param {number} port
     * @param {string} address
     */
    onReceived(message: Uint8Array, port: number, address: string): {
        header: {
            buffer: ArrayBuffer;
            size: number;
            protocol: number;
            addressable: boolean;
            tagged: boolean;
            origin: number;
            source: number;
            target: Uint8Array;
            reserved_target_2: Uint8Array;
            revered_site_mac_address: Uint8Array;
            res_required: boolean;
            ack_required: boolean;
            sequence: number;
            reserved_timestamp: {
                buffer: Uint8Array;
                decoded: any;
            };
            reserved_protocol_header_2: Uint8Array;
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
    source: number;
    color?: ReturnType<typeof decodeLightState>;
    version?: ReturnType<typeof decodeStateVersion>;
    hostFirmware?: ReturnType<typeof decodeStateHostFirmware>;
};
import { decodeStateGroup } from './encoding.js';
import { decodeLightState } from './encoding.js';
import { decodeStateVersion } from './encoding.js';
import { decodeStateHostFirmware } from './encoding.js';
