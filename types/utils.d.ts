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
 * https://github.com/Chalarangelo/30-seconds-of-code/blob/master/content/snippets/js/s/hsb-to-rgb.md
 *
 * @param {number} h [0-65535]
 * @param {number} s [0-65535]
 * @param {number} b [0-65535]
 */
export function hsbToRgb(h: number, s: number, b: number): readonly [number, number, number];
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
export function NOOP(value: any): void;
