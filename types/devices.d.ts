/**
 * @param {{
 *   serialNumber: string;
 *   port: number;
 *   address: string;
 *   target?: Uint8Array;
 *   sequence?: number;
 * }} config
 * @returns {Device}
 */
export function Device(config: {
    serialNumber: string;
    port: number;
    address: string;
    target?: Uint8Array;
    sequence?: number;
}): Device;
export type Device = {
    address: string;
    port: number;
    target: Uint8Array;
    serialNumber: string;
    sequence: number;
};
/**
 * @param {{
 *   onRegistered?: (device: Device) => void;
 *   defaultTimeoutMs?: number;
 * }} options
 */
export function Devices(options: {
    onRegistered?: (device: Device) => void;
    defaultTimeoutMs?: number;
}): {
    /**
     * @param {string} serialNumber
     * @param {number} port
     * @param {string} address
     * @param {Uint8Array} [target]
     */
    register(serialNumber: string, port: number, address: string, target?: Uint8Array): any;
    /**
     * @param {string} serialNumber
     * @param {AbortSignal} [signal]
     */
    get(serialNumber: string, signal?: AbortSignal): any;
};
