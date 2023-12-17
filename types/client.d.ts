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
     * @param {string} label
     */
    getDevice(label: string): Device | Promise<Device>;
    /**
     * @param {Uint8Array} message
     * @param {number} port
     * @param {string} address
     */
    onReceived(message: Uint8Array, port: number, address: string): {
        buffer: ArrayBuffer;
        size: number;
        protocol: number;
        addressable: boolean;
        tagged: boolean;
        origin: number;
        source: number;
        target: {
            bytes: Uint8Array;
            address: any;
        };
        reserved_target_2: Uint8Array;
        revered_site_mac_address: {
            bytes: Uint8Array;
            address: any;
        };
        res_required: boolean;
        ack_required: boolean;
        sequence: number;
        reserved_timestamp: {
            buffer: Uint8Array;
            decoded: any;
        };
        reserved_protocol_header_2: Uint8Array;
        type: {
            code: number;
            name: any;
        };
        payload: any;
    };
};
export type DeviceType = 'light' | 'switch';
export type Device = {
    address: string;
    port: number;
    target: Uint8Array;
    label?: string;
    groupLabel?: string;
    groupId?: string;
    type?: DeviceType;
    source: number;
};
