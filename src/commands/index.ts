/**
 * Decodes one response packet into a command's result. `payload` is the
 * packet's payload (a zero-copy view into the received datagram) and `type`
 * its message type. Every `decode*` function of 'lifxlan/encoding' fits.
 */
export type Decoder<OutputType> = (payload: Uint8Array, type: number) => OutputType;

/**
 * Assembles a result that spans several response packets. A command's
 * {@link Command.collect} creates one per `send()`, so each exchange owns
 * its accumulation state.
 */
export interface Collector<OutputType> {
  /**
   * Takes one response packet. Returns `true` once the result is complete —
   * `send()` then resolves with {@link Collector.result} — or `false` to
   * keep the exchange open for more packets. A packet that is not part of
   * the result (an unexpected type, a duplicate) is simply answered with
   * `false`. Throwing rejects the `send()`.
   */
  add(payload: Uint8Array, type: number): boolean;
  /** The assembled result. Called once, after `add()` returned `true`. */
  result(): OutputType;
}

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
   * Decodes the single response packet a command is answered with. Must be
   * stateless: the same command object may be sent multiple times,
   * concurrently, to multiple devices.
   */
  decode?: Decoder<OutputType>;
  /**
   * For commands whose result spans multiple response packets (e.g.
   * GetColorZones, Get64). Called once per send() so every exchange gets
   * its own {@link Collector}, keeping the command object safe to reuse
   * across concurrent sends and devices. Takes precedence over `decode`.
   */
  collect?: () => Collector<OutputType>;
  /**
   * The message type of the State packet this command's response arrives in
   * (e.g. `Type.LightState` for GetColor). When set, send() ignores any
   * response packet of a different type instead of handing it to `decode`
   * (or the collector),
   * so a stray or late reply — a wrapped sequence number colliding with an
   * earlier exchange, a mis-addressed packet — cannot resolve the exchange
   * with the wrong data. Leave it unset for commands whose responses may
   * arrive as more than one type (GetColorZones answers with StateZone or
   * StateMultiZone); their collector then does its own filtering.
   */
  responseType?: number;
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

export * from './button.js';
export * from './device.js';
export * from './light.js';
export * from './multizone.js';
export * from './tile.js';
export * from './relay.js';
export * from './sensor.js';
