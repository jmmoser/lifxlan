/**
 * @template OutputType
 * @typedef {(bytes: Uint8Array, offsetRef: { current: number; }) => OutputType} Decoder
 */
/**
 * @template OutputType
 * @typedef {{
 *   type: number;
 *   payload: Uint8Array | undefined;
 *   decoder: Decoder<OutputType>;
 * }} Command
 */
/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateVersion>>}
 */
export function GetVersionCommand(): Command<ReturnType<typeof Encoding.decodeStateVersion>>;
/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateHostFirmware>>}
 */
export function GetHostFirmwareCommand(): Command<ReturnType<typeof Encoding.decodeStateHostFirmware>>;
/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateLabel>>}
 */
export function GetLabelCommand(): Command<ReturnType<typeof Encoding.decodeStateLabel>>;
/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateGroup>>}
 */
export function GetGroupCommand(): Command<ReturnType<typeof Encoding.decodeStateGroup>>;
/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateService>>}
 */
export function GetServiceCommand(): Command<ReturnType<typeof Encoding.decodeStateService>>;
/**
 * @returns {Command<ReturnType<typeof Encoding.decodeLightState>>}
 */
export function GetColorCommand(): Command<ReturnType<typeof Encoding.decodeLightState>>;
/**
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} duration
 * @returns {Command<ReturnType<typeof Encoding.decodeLightState>>}
 */
export function SetColorCommand(hue: number, saturation: number, brightness: number, kelvin: number, duration: number): Command<ReturnType<typeof Encoding.decodeLightState>>;
/**
 * @param {boolean} on
 * @returns {Command<ReturnType<typeof Encoding.decodeStatePower>>}
 */
export function SetPowerCommand(on: boolean): Command<ReturnType<typeof Encoding.decodeStatePower>>;
/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStatePower>>}
 */
export function GetPowerCommand(): Command<ReturnType<typeof Encoding.decodeStatePower>>;
export type Decoder<OutputType> = (bytes: Uint8Array, offsetRef: {
    current: number;
}) => OutputType;
export type Command<OutputType> = {
    type: number;
    payload: Uint8Array | undefined;
    decoder: Decoder<OutputType>;
};
import * as Encoding from './encoding.js';
