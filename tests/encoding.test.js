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

  test('encodeStringTo with offset', () => {
    const bytes = new Uint8Array(20);
    bytes.fill(0xff); // Fill with non-zero values to detect offset bug
    
    Encoding.encodeStringTo(bytes, 10, 'test', 8);
    
    // First 10 bytes should remain 0xff
    assert.deepEqual(bytes.subarray(0, 10), new Uint8Array(10).fill(0xff));
    
    // Next 4 bytes should be 'test' (0x74, 0x65, 0x73, 0x74)
    assert.deepEqual(bytes.subarray(10, 14), new Uint8Array([0x74, 0x65, 0x73, 0x74]));
    
    // Byte at offset 14 should be null terminator
    assert.equal(bytes[14], 0);
    
    // Remaining bytes should be 0xff
    assert.deepEqual(bytes.subarray(15), new Uint8Array(5).fill(0xff));
  });

  test('decode', () => {
    const bytes = new Uint8Array([
      0x24, 0x00, 0x00, 0x34, 0x99, 0x9c, 0x8c, 0xc9,
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x05,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x00, 0x00,
    ]);
    const header = Encoding.decodeHeader(bytes);

    assert.deepEqual(header, {
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
      res_required: true,
      ack_required: false,
      reserved3: 0,
      reserved4: new Uint8Array(8),
      sequence: 5,
      reserved5: new Uint8Array(2),
    });

    const encodedBytes = Encoding.encode(
      header.tagged,
      header.source,
      header.target,
      header.res_required,
      header.ack_required,
      header.sequence,
      header.type,
      header.payload,
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
