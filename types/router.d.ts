/**
 * @param {{
 *   onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
 * }} options
 */
export function Router(options: {
    onSend: (message: Uint8Array, port: number, address: string, broadcast: boolean) => void;
}): {
    send(message: any, port: any, address: any, broadcast: any): void;
    /**
     * @param {number} source
     * @param {MessageHandler} handler
     */
    register(source: number, handler: MessageHandler): void;
    deregister(source: any): void;
    /**
     * @param {Uint8Array} message
     */
    onReceived(message: Uint8Array): {
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
