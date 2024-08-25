/**
 * @param {{
 *   router: ReturnType<typeof import('./router.js').Router>;
 *   defaultTimeoutMs?: number;
 *   source?: number;
 * }} options
 */
export function Client(options: {
    router: ReturnType<typeof import("./router.js").Router>;
    defaultTimeoutMs?: number;
    source?: number;
}): {
    readonly router: {
        nextSource(): number;
        register(source: number, handler: MessageHandler): void;
        deregister(source: number, handler: MessageHandler): void;
        send(message: Uint8Array, port: number, address: string, serialNumber?: string): void;
        receive(message: Uint8Array): {
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
                res_required: boolean;
                ack_required: boolean;
                reserved3: number;
                reserved4: Uint8Array;
                sequence: number;
                reserved5: Uint8Array;
                type: number;
            };
            payload: Uint8Array;
            serialNumber: string;
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
    unicast<T>(command: import("./commands.js").Command<T>, device: import("./devices.js").Device): void;
    /**
     * Send a command to a device and only require an acknowledgement.
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {import('./devices.js').Device} device
     * @param {AbortSignal} [signal]
     * @returns {Promise<void>}
     */
    sendOnlyAcknowledgement<T>(command: import("./commands.js").Command<T>, device: import("./devices.js").Device, signal?: AbortSignal): Promise<void>;
    /**
     * Send a command to a device and require a response.
     * @template T
     * @param {import('./commands.js').Command<T>} command
     * @param {import('./devices.js').Device} device
     * @param {AbortSignal} [signal]
     * @returns {Promise<T>}
     */
    send<T>(command: import("./commands.js").Command<T>, device: import("./devices.js").Device, signal?: AbortSignal): Promise<T>;
    /**
     * @param {ReturnType<typeof import('./encoding.js').decodeHeader>} header
     * @param {Uint8Array} payload
     * @param {string} serialNumber
     */
    onMessage(header: ReturnType<typeof import("./encoding.js").decodeHeader>, payload: Uint8Array, serialNumber: string): void;
};
