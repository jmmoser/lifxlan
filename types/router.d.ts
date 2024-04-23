/**
 * Since a client is a source of messages and there may be multiple
 * clients sending messages at the same time, the router receives
 * response messages and routes them to the client (a MessageHandler)
 * that sent the request message.
 *
 * It has the added benefit of allowing callers to send messages
 * messages. With the previous benefit, the router helps associate
 * received messages with previously sent messages.
 *
 * It also decodes the header and converts the target to a serial
 * number string. This helps avoid calling the relatively expensive
 * convertTargetToSerialNumber utility function multiple times for
 * each response message.
 *
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
