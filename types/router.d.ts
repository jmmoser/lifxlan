/**
 * @param {{
 *   onSend: (message: Uint8Array, port: number, address: string, serialNumber?: string) => void;
 *   handlers?: Map<number, MessageHandler>;
 * }} options
 */
export function Router(options: {
    onSend: (message: Uint8Array, port: number, address: string, serialNumber?: string) => void;
    handlers?: Map<number, MessageHandler>;
}): {
    nextSource(): number;
    /**
     * @param {number} source
     * @param {MessageHandler} handler
     */
    register(source: number, handler: MessageHandler): void;
    /**
     * @param {number} source
     * @param {MessageHandler} handler
     */
    deregister(source: number, handler: MessageHandler): void;
    /**
     * @param {Uint8Array} message
     * @param {number} port
     * @param {string} address
     * @param {string} [serialNumber]
     */
    send(message: Uint8Array, port: number, address: string, serialNumber?: string): void;
    /**
     * @param {Uint8Array} message
     */
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
export type MessageHandler = {
    onMessage: (header: ReturnType<typeof decodeHeader>, payload: Uint8Array, serialNumber: string) => void;
};
import { decodeHeader } from './encoding.js';
