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

  test('encode without payload', () => {
    const bytes = Encoding.encode(
      true, // tagged
      12345, // source
      new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]), // target
      false, // resRequired
      true, // ackRequired
      255, // sequence
      100 // type
    );
    
    assert.equal(bytes.length, 36); // Header only
    
    const view = new DataView(bytes.buffer);
    assert.equal(view.getUint16(0, true), 36); // size
    assert.equal(view.getUint32(4, true), 12345); // source
    assert.deepEqual(bytes.subarray(8, 14), new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff])); // target
    assert.equal(view.getUint8(22), 0b10); // ack required, not res required
    assert.equal(view.getUint8(23), 255); // sequence
    assert.equal(view.getUint16(32, true), 100); // type
  });

  test('encodeTimestampTo', () => {
    const bytes = new Uint8Array(16);
    const view = new DataView(bytes.buffer);
    const date = new Date('2023-01-01T00:00:00.000Z');
    
    Encoding.encodeTimestampTo(view, 8, date);
    
    const expectedMicroseconds = BigInt(date.getTime()) * 1000000n;
    assert.equal(view.getBigUint64(8, true), expectedMicroseconds);
  });

  test('encodeSetColor', () => {
    const payload = Encoding.encodeSetColor(120, 65535, 32768, 3500, 1000);
    assert.equal(payload.length, 13);
    
    const view = new DataView(payload.buffer);
    assert.equal(view.getUint8(0), 0); // reserved
    assert.equal(view.getUint16(1, true), 120); // hue
    assert.equal(view.getUint16(3, true), 65535); // saturation
    assert.equal(view.getUint16(5, true), 32768); // brightness
    assert.equal(view.getUint16(7, true), 3500); // kelvin
    assert.equal(view.getUint32(9, true), 1000); // duration
  });

  test('getHeaderSize', () => {
    const bytes = new Uint8Array([0x24, 0x00]);
    const view = new DataView(bytes.buffer);
    assert.equal(Encoding.getHeaderSize(view), 0x24);
  });

  test('getHeaderFlags', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x34, 0x20]);
    const view = new DataView(bytes.buffer);
    assert.equal(Encoding.getHeaderFlags(view), 0x2034);
  });

  test('getHeaderTagged', () => {
    const bytes1 = new Uint8Array([0x00, 0x00, 0x00, 0x10]); // tagged = 1 (bit 12 = 1, 0x1000)
    const view1 = new DataView(bytes1.buffer);
    assert.equal(Encoding.getHeaderTagged(view1), true);
    
    const bytes2 = new Uint8Array([0x00, 0x00, 0x00, 0x00]); // tagged = 0 (bit 12 = 0)
    const view2 = new DataView(bytes2.buffer);
    assert.equal(Encoding.getHeaderTagged(view2), false);
  });

  test('getHeaderSource', () => {
    const bytes = new Uint8Array(8);
    const view = new DataView(bytes.buffer);
    view.setUint32(4, 0x12345678, true);
    assert.equal(Encoding.getHeaderSource(view), 0x12345678);
  });

  test('getHeaderTarget', () => {
    const bytes = new Uint8Array(20);
    bytes.set([0x01, 0x02, 0x03, 0x04, 0x05, 0x06], 8);
    const target = Encoding.getHeaderTarget(bytes);
    assert.deepEqual(target, new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]));
  });

  test('getHeaderResponseFlags', () => {
    const bytes = new Uint8Array(25);
    const view = new DataView(bytes.buffer);
    view.setUint8(22, 0b11);
    assert.equal(Encoding.getHeaderResponseFlags(view), 0b11);
  });

  test('getHeaderResponseRequired', () => {
    assert.equal(Encoding.getHeaderResponseRequired(0b01), true);
    assert.equal(Encoding.getHeaderResponseRequired(0b10), false);
    assert.equal(Encoding.getHeaderResponseRequired(0b11), true);
    assert.equal(Encoding.getHeaderResponseRequired(0b00), false);
  });

  test('getHeaderAcknowledgeRequired', () => {
    assert.equal(Encoding.getHeaderAcknowledgeRequired(0b01), false);
    assert.equal(Encoding.getHeaderAcknowledgeRequired(0b10), true);
    assert.equal(Encoding.getHeaderAcknowledgeRequired(0b11), true);
    assert.equal(Encoding.getHeaderAcknowledgeRequired(0b00), false);
  });

  test('getHeaderType', () => {
    const bytes = new Uint8Array(40);
    const view = new DataView(bytes.buffer);
    view.setUint16(32, 0x1234, true);
    assert.equal(Encoding.getHeaderType(view), 0x1234);
  });

  test('getHeaderSequence', () => {
    const bytes = new Uint8Array(30);
    const view = new DataView(bytes.buffer);
    view.setUint8(23, 42);
    assert.equal(Encoding.getHeaderSequence(view), 42);
  });

  test('getPayload', () => {
    const bytes = new Uint8Array(40);
    bytes.set([0x01, 0x02, 0x03, 0x04], 36);
    const payload = Encoding.getPayload(bytes);
    assert.deepEqual(payload, new Uint8Array([0x01, 0x02, 0x03, 0x04]));
  });

  test('getPayload with offset', () => {
    const bytes = new Uint8Array(50);
    bytes.set([0xaa, 0xbb, 0xcc, 0xdd], 46); // offset 10 + 36
    const payload = Encoding.getPayload(bytes, 10);
    assert.deepEqual(payload, new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]));
  });

  test('decodeStateService', () => {
    const bytes = new Uint8Array(5);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, 1); // service
    view.setUint32(1, 56700, true); // port
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateService(bytes, offsetRef);
    
    assert.equal(result.service, 1);
    assert.equal(result.port, 56700);
    assert.equal(offsetRef.current, 5);
  });

  test('decodeStatePower', () => {
    const bytes = new Uint8Array(2);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, 65535, true);
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStatePower(bytes, offsetRef);
    
    assert.equal(result, 65535);
    assert.equal(offsetRef.current, 2);
  });

  test('decodeStateLabel', () => {
    const bytes = new Uint8Array(32);
    const label = 'Test Light';
    new TextEncoder().encodeInto(label, bytes);
    bytes[label.length] = 0; // null terminator
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateLabel(bytes, offsetRef);
    
    assert.equal(result, label);
    assert.equal(offsetRef.current, 32);
  });

  test('decodeEchoResponse', () => {
    const bytes = new Uint8Array(64);
    bytes.set([1, 2, 3, 4, 5], 0);
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeEchoResponse(bytes, offsetRef);
    
    assert.deepEqual(result, bytes);
    assert.equal(offsetRef.current, 64);
  });

  test('decodeStateUnhandled', () => {
    const bytes = new Uint8Array(2);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, 0x1234, true);
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateUnhandled(bytes, offsetRef);
    
    assert.equal(result, 0x1234);
    assert.equal(offsetRef.current, 2);
  });
});
