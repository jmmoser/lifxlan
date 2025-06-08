/**
 * @template OutputType
 * @typedef {(bytes: Uint8Array, offsetRef: { current: number; }) => OutputType} Decoder
 */

/**
 * @template OutputType
 * @typedef {{
 *   type: number;
 *   payload?: Uint8Array;
 *   decode: Decoder<OutputType>;
 * }} Command
 */

// Re-export all commands for backwards compatibility
export * from './device.js';
export * from './light.js';
export * from './multizone.js';
export * from './tile.js';
export * from './relay.js';
export * from './sensor.js';