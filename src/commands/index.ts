export type Decoder<OutputType> = (
  bytes: Uint8Array,
  offsetRef: { current: number },
  continuation?: { expectMore: boolean },
  responseType?: number
) => OutputType;

export interface Command<OutputType> {
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
  defaultResponseMode?: 'ack-only' | 'response' | 'both';
}

// Re-export all commands for backwards compatibility
export * from './button.js';
export * from './device.js';
export * from './light.js';
export * from './multizone.js';
export * from './tile.js';
export * from './relay.js';
export * from './sensor.js';