/**
 * @template OutputType
 * @typedef {{
 *   type: number;
 *   payload: Uint8Array | undefined;
 *   decoder: (bytes: Uint8Array, offsetRef: { current: number; }) => OutputType;
 * }} Command
 */
/**
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} duration
 * @returns {Command<ReturnType<typeof import('./protocol.js').decodeLightState>>}
 */
export function SetColorCommand(hue: number, saturation: number, brightness: number, kelvin: number, duration: number): Command<ReturnType<typeof import('./protocol.js').decodeLightState>>;
/**
 * @param {boolean} on
 * @returns {Command<ReturnType<typeof import('./protocol.js').decodeStatePower>>}
 */
export function SetPowerCommand(on: boolean): Command<ReturnType<typeof import('./protocol.js').decodeStatePower>>;
/**
 * @returns {Command<ReturnType<typeof import('./protocol.js').decodeStatePower>>}
 */
export function GetPowerCommand(): Command<ReturnType<typeof import('./protocol.js').decodeStatePower>>;
export type Command<OutputType> = {
    type: number;
    payload: Uint8Array | undefined;
    decoder: (bytes: Uint8Array, offsetRef: {
        current: number;
    }) => OutputType;
};
