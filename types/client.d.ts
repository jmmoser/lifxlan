/**
 * @param {{
 *   onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
 *   devices?: ReturnType<typeof import('./devices.js').Devices>;
 *   defaultTimeoutMs?: number;
 *   source?: number;
 * }} options
 */
export function Client(options: {
    onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
    devices?: ReturnType<typeof import('./devices.js').Devices>;
    defaultTimeoutMs?: number;
    source?: number;
}): {
    /**
     * Broadcast a command to the local network.
     * @template T
     * @param {import('./commands.js').Command<T>} command
     */
    broadcast<T>(command: import("./commands.js").Command<T>): void;
    /**
     * Send a command to a device without expecting a response or acknowledgement.
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {import('./devices.js').Device} device
     */
    unicast<T_1>(command: import("./commands.js").Command<T_1>, device: import('./devices.js').Device): void;
    /**
     * Send a command to a device and only require an acknowledgement.
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {import('./devices.js').Device} device
     * @param {AbortSignal} [signal]
     * @returns {Promise<void>}
     */
    sendOnlyAcknowledgement<T_2>(command: import("./commands.js").Command<T_2>, device: import('./devices.js').Device, signal?: AbortSignal): Promise<void>;
    /**
     * Send a command to a device and require a response.
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {import('./devices.js').Device} device
     * @param {AbortSignal} [signal]
     * @returns {Promise<T>}
     */
    send<T_3>(command: import("./commands.js").Command<T_3>, device: import('./devices.js').Device, signal?: AbortSignal): Promise<T_3>;
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
        payload: Uint8Array;
    };
};
