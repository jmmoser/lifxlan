import { describe, test } from 'node:test';
import assert from 'node:assert';
import { encode, decodeHeader } from '../src/encoding.js';

describe('encoding', () => {
  test('decode', () => {
    const bytes = new Uint8Array([
      0x24, 0x00, 0x00, 0x34, 0x99, 0x9c, 0x8c, 0xc9,
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x05,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x00, 0x00,
    ]);
    const packet = decodeHeader(bytes, { current: 0 });

    assert.deepEqual(packet, {
      bytes,
      size: bytes.length,
      type: 2,
      protocol: 1024,
      addressable: true,
      tagged: true,
      origin: 0,
      source: 3381435545,
      target: new Uint8Array([1, 2, 3, 4, 5, 6]),
      reserved1: new Uint8Array(2),
      reserved2: new Uint8Array(6),
      resRequired: true,
      ackRequired: false,
      reserved3: 0,
      reserved4: new Uint8Array(8),
      sequence: 5,
      reserved5: new Uint8Array(2),
    });

    const encodedBytes = encode(
      packet.tagged,
      packet.source,
      packet.target,
      packet.resRequired,
      packet.ackRequired,
      packet.sequence,
      packet.type,
      packet.payload,
    );
    assert.deepEqual(encodedBytes, bytes);
  });

  test('encode', () => {
    const bytes = encode(
      false,
      1,
      new Uint8Array([1, 2, 3, 4, 5, 6]),
      true,
      false,
      0,
      2,
      new Uint8Array([1, 2, 3, 4, 5, 6]),
    );
    assert.deepEqual(bytes, new Uint8Array([
      0x2a, 0x00, 0x00, 0x14, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06,
    ]));
  });
});
