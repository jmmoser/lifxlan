import type { Decoder } from './index.js';

/**
 * What a multi-packet command supplies to {@link accumulate}: how to decode
 * one of its packets, and the bookkeeping that decides which packets count.
 */
export interface AccumulatorSpec<R> {
  /**
   * Decodes a packet of a type this command is answered with; returns
   * undefined for any other type, which is ignored.
   */
  decode(bytes: Uint8Array, offsetRef: { current: number }, responseType: number | undefined): R | undefined;
  /**
   * Marks the parts of the result this response supplies as received.
   * Returns false when it supplies nothing still outstanding — a UDP
   * duplicate, or a stray outside the requested range (e.g. a late reply on
   * a reused sequence number) — and the response is then dropped: it is
   * neither added to the result nor passed to `onResponse`.
   */
  record(response: R): boolean;
  /** Whether any part of the result is still outstanding. */
  outstanding(): boolean;
  /**
   * The caller's per-response callback. Returning false stops the exchange
   * early with what has accumulated.
   */
  onResponse?: ((response: R) => boolean | void) | undefined;
}

/**
 * Builds the decoder for a command whose result accumulates across several
 * response packets (GetColorZones, GetExtendedColorZones, Get64). The
 * accumulate/dedupe/stop-early loop lives here once, so every such command
 * drops duplicates and strays the same way; each command only describes its
 * packets and what it expects. Call it from the command's `createDecoder` so
 * each exchange gets fresh state.
 */
export function accumulate<R>(spec: AccumulatorSpec<R>): Decoder<R[]> {
  const responses: R[] = [];
  return (bytes, offsetRef, continuation, responseType) => {
    const response = spec.decode(bytes, offsetRef, responseType);
    let stopped = false;
    if (response !== undefined && spec.record(response)) {
      responses.push(response);
      if (spec.onResponse && spec.onResponse(response) === false) {
        stopped = true;
      }
    }
    if (continuation) {
      continuation.expectMore = !stopped && spec.outstanding();
    }
    return responses;
  };
}
