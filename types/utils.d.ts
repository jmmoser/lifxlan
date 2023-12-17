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
 * https://gist.github.com/mjackson/5311256
 *
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param {number} r The red color value
 * @param {number} g The green color value
 * @param {number} b The blue color value
 */
export function rgbToHsl(r: number, g: number, b: number): readonly [number, number, number];
