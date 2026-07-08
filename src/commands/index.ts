export type Decoder<OutputType> = (
  bytes: Uint8Array,
  offsetRef: { current: number },
  continuation?: { expectMore: boolean },
  responseType?: number
) => OutputType;

/**
 * The three exchange shapes a command can request from a device:
 *
 * - `'ack-only'`: set the `ack_required` protocol flag and wait for the
 *   Acknowledgement packet (confirms the device received the message)
 * - `'response'`: set the `res_required` protocol flag and wait for the
 *   response data packet
 * - `'both'`: set both flags and wait for both packets
 *
 * Omitting the per-call `responseMode` option in send() uses the command's
 * {@link Command.defaultResponseMode}.
 */
export type ResponseMode = 'ack-only' | 'response' | 'both';

export interface Command<OutputType, Mode extends ResponseMode = 'response'> {
  type: number;
  payload?: Uint8Array;
  /**
   * Decodes a single response packet. Must be stateless: the same command
   * object may be sent multiple times, concurrently, to multiple devices.
   */
  decode?: Decoder<OutputType>;
  /**
   * For commands whose result accumulates across multiple response packets
   * (e.g. GetColorZones, Get64). Called once per send() so every exchange
   * gets fresh accumulation state, keeping the command object safe to reuse
   * across concurrent sends and devices. Takes precedence over `decode`.
   */
  createDecoder?: () => Decoder<OutputType>;
  /**
   * The exchange send() performs when the caller does not pass a
   * `responseMode` override: Get commands declare `'response'`, Set commands
   * declare `'ack-only'`. Carrying the literal in the `Mode` type parameter
   * (e.g. `Command<number, 'ack-only'>`) is what lets send() narrow its
   * return type to `Promise<void>` for ack-only exchanges. Absent means
   * `'response'`.
   */
  defaultResponseMode?: Mode;
}

// Re-export all commands for backwards compatibility
export * from './button.js';
export * from './device.js';
export * from './light.js';
export * from './multizone.js';
export * from './tile.js';
export * from './relay.js';
export * from './sensor.js';