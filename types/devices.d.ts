/**
 * @param {{
 *   serialNumber: string;
 *   address: string;
 *   port?: number;
 *   target?: Uint8Array;
 *   sequence?: number;
 * }} config
 * @returns {Device}
 */
export function Device(config: {
    serialNumber: string;
    address: string;
    port?: number;
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
 *   onAdded?: (device: Device) => void;
 *   onChanged?: (device: Device) => void;
 *   defaultTimeoutMs?: number;
 * }} [options]
 */
export function Devices(options?: {
    onAdded?: (device: Device) => void;
    onChanged?: (device: Device) => void;
    defaultTimeoutMs?: number;
}): {
    readonly registered: Map<string, Device>;
    /**
     * @param {string} serialNumber
     * @param {number} port
     * @param {string} address
     * @param {Uint8Array} [target]
     */
    register(serialNumber: string, port: number, address: string, target?: Uint8Array): any;
    /**
     * @param {string} serialNumber
     */
    remove(serialNumber: string): void;
    /**
     * @param {string} serialNumber
     * @param {AbortSignal} [signal]
     */
    get(serialNumber: string, signal?: AbortSignal): any;
};
