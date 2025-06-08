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
