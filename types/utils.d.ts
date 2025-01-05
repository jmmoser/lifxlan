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
 * @param {number} h [0-65535]
 * @param {number} s [0-65535]
 * @param {number} b [0-65535]
 * @returns {[number, number, number]} RGB values [0-255]
 */
export function hsbToRgb(h: number, s: number, b: number): [number, number, number];
/**
 * https://github.com/Chalarangelo/30-seconds-of-code/blob/master/content/snippets/js/s/rgb-to-hsb.md
 *
 * @param {number} r [0-255]
 * @param {number} g [0-255]
 * @param {number} b [0-255]
 */
export function rgbToHsb(r: number, g: number, b: number): readonly [number, number, number];
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
