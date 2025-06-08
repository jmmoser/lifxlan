/**
 * @template T
 * @returns {{
 *   resolve: (value: T) => void;
 *   reject: (reason?: any) => void;
 *   promise: Promise<T>;
 * }}
 */
export function PromiseWithResolvers<T>(): {
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
    promise: Promise<T>;
};
/**
 * @param {number} rssi
 */
export function getRssiStatus(rssi: number): "none" | "very bad" | "somewhat bad" | "alright" | "good";
/**
 * @param {number} signal
 */
export function convertSignalToRssi(signal: number): number;
/**
 * @param {Uint8Array} slice
 */
export function convertTargetToSerialNumber(slice: Uint8Array): string;
/**
 * @param {string} serialNumber
 */
export function convertSerialNumberToTarget(serialNumber: string): Uint8Array<ArrayBuffer>;
export function NOOP(value: any): void;
