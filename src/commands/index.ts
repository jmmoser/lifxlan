export type Decoder<OutputType> = (
  bytes: Uint8Array,
  offsetRef: { current: number },
  continuation?: { expectMore: boolean },
  responseType?: number
) => OutputType;

export interface Command<OutputType> {
  type: number;
  payload?: Uint8Array;
  decode?: Decoder<OutputType>;
  defaultAcknowledgment?: 'none' | 'ack-only' | 'response' | 'both';
}

// Re-export all commands for backwards compatibility
export * from './device.js';
export * from './light.js';
export * from './multizone.js';
export * from './tile.js';
export * from './relay.js';
export * from './sensor.js';