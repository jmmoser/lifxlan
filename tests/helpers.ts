import { Router, type ReceivedMessage } from '../src/router.js';
import { encode } from '../src/encoding.js';
import { Type } from '../src/constants/index.js';
import { convertSerialNumberToTarget } from '../src/utils/index.js';

/**
 * Builds the `ReceivedMessage` that `router.receive()` would produce for a
 * StateService response from `serialNumber`, by encoding a frame addressed to
 * it and decoding it back through a throwaway router, the same path a live
 * device takes. Feed it straight into `devices.register`:
 *
 *   devices.register(56700, '10.0.0.1', received('d073d5aa0001'));
 *
 * Seeding through the real decode path keeps the serial/target pair consistent
 * exactly as production does, rather than asserting a hand-built fixture. The
 * StateService payload is arbitrary (register() only reads serialNumber and
 * header.target), but a realistic one keeps the round trip honest.
 */
export function received(serialNumber: string): ReceivedMessage {
  const target = convertSerialNumberToTarget(serialNumber);
  const message = encode(false, 2, target, false, false, 0, Type.StateService, new Uint8Array([1, 0x7c, 0xdd, 0, 0]));
  const result = Router({ onSend() {} }).receive(message);
  if (result === undefined) {
    // Unreachable for a well-formed frame; narrows away `| undefined` without a
    // non-null assertion and turns any encode/decode regression into a loud failure.
    throw new Error(`failed to build ReceivedMessage for ${serialNumber}`);
  }
  return result;
}
