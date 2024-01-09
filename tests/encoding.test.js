// eslint-disable-next-line import/no-unresolved
import { describe, test } from 'bun:test';
import assert from 'node:assert';
import * as Encoding from '../src/encoding.js';

describe('encoding', () => {
  test('uuid', () => {
    const bytes = new Uint8Array(16);
    Encoding.encodeUuidTo(bytes, 0, '4e0352bf-1994-4ff2-b425-1c4455479f33');
    assert.deepEqual(bytes, new Uint8Array([
      0x4e, 0x03, 0x52, 0xbf, 0x19, 0x94, 0x4f, 0xf2,
      0xb4, 0x25, 0x1c, 0x44, 0x55, 0x47, 0x9f, 0x33,
    ]));
  });
  test('encode string', () => {
    const bytes = Encoding.encodeString('abc', 32);
    assert.deepEqual(bytes, new Uint8Array([
      0x61, 0x62, 0x63, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]));
  });

  test('decode', () => {
    const bytes = new Uint8Array([
      0x24, 0x00, 0x00, 0x34, 0x99, 0x9c, 0x8c, 0xc9,
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x05,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x00, 0x00,
    ]);
    const packet = Encoding.decodeHeader(bytes, { current: 0 });

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

    const encodedBytes = Encoding.encode(
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
    const bytes = Encoding.encode(
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
