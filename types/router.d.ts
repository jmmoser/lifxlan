/**
 * @param {{
 *   onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
 * }} options
 */
export function Router(options: {
    onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
}): {
    nextSource(): number;
    /**
     * @param {number} source
     * @param {MessageHandler} handler
     */
    register(handler: MessageHandler, source: number): void;
    /**
     * @param {number} source
     * @param {MessageHandler} handler
     */
    deregister(source: number, handler: MessageHandler): void;
    /**
     * @param {Uint8Array} message
     * @param {number} port
     * @param {string} address
     * @param {boolean} broadcast
     */
    send(message: Uint8Array, port: number, address: string, broadcast: boolean): void;
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
            resRequired: boolean;
            ackRequired: boolean;
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
