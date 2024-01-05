/**
 * @param {{
 *   router: ReturnType<typeof import('./router.js').Router>;
 *   defaultTimeoutMs?: number;
 *   source?: number;
 * }} options
 */
export function Client(options: {
    router: ReturnType<typeof import('./router.js').Router>;
    defaultTimeoutMs?: number;
    source?: number;
}): {
    readonly router: {
        send(message: any, port: any, address: any, broadcast: any): void; /** Only allow up to 254. 255 is used for broadcast messages. */
        register(source: number, handler: import("./router.js").MessageHandler): void;
        deregister(source: any): void;
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
    readonly source: number;
    dispose(): void;
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
     * @param {ReturnType<typeof import('./encoding.js').decodeHeader>} header
     * @param {Uint8Array} payload
     * @param {string} serialNumber
     */
    onMessage(header: ReturnType<typeof import('./encoding.js').decodeHeader>, payload: Uint8Array, serialNumber: string): void;
};
