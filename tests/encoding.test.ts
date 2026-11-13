import { describe, test } from 'bun:test';
import assert from 'node:assert';
import * as Encoding from '../src/wire.js';
import type { Color } from '../src/wire.js';
import { DecodeError, ValidationError } from '../src/errors.js';

/** Asserts `fn` throws a ValidationError naming `parameter`. */
function assertInvalid(fn: () => unknown, parameter: string) {
  assert.throws(
    fn,
    (err: unknown) => err instanceof ValidationError && err.parameter === parameter,
    `expected a ValidationError for ${parameter}`,
  );
}

const UUID = '550e8400e29b41d4a716446655440000';
const DATE = new Date('2023-01-01T00:00:00.000Z');
const COLOR: Color = { hue: 1, saturation: 2, brightness: 3, kelvin: 3500 };

/** A 36-byte header-only message with every field zero except `size`. */
function blankHeader(): Uint8Array {
  const bytes = new Uint8Array(36);
  bytes[0] = 36;
  return bytes;
}

describe('encoding', () => {
  test('uuid', () => {
    // UUIDs are encoded by the SetLocation/SetGroup payload builders.
    const payload = Encoding.encodeSetGroup('4e0352bf-1994-4ff2-b425-1c4455479f33', '', DATE);
    assert.deepEqual(payload.subarray(0, 16), new Uint8Array([
      0x4e, 0x03, 0x52, 0xbf, 0x19, 0x94, 0x4f, 0xf2,
      0xb4, 0x25, 0x1c, 0x44, 0x55, 0x47, 0x9f, 0x33,
    ]));
    // Dashes are optional and hex is case-insensitive.
    assert.deepEqual(
      Encoding.encodeSetGroup('4E0352BF19944FF2B4251C4455479F33', '', DATE).subarray(0, 16),
      payload.subarray(0, 16),
    );
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

  test('a label is written at its field offset without disturbing its neighbours', () => {
    const id = new Uint8Array(16).fill(0xff);
    const payload = Encoding.encodeSetLocation(id, 'test', DATE);

    // The 16 id bytes before the label field are untouched.
    assert.deepEqual(payload.subarray(0, 16), id);

    // The label field (32 bytes at offset 16) holds 'test', zero-padded.
    assert.deepEqual(payload.subarray(16, 20), new Uint8Array([0x74, 0x65, 0x73, 0x74]));
    assert.deepEqual(payload.subarray(20, 48), new Uint8Array(28));

    // The timestamp after it is intact.
    assert.equal(new DataView(payload.buffer).getBigUint64(48, true), BigInt(DATE.getTime()) * 1000000n);
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

    assert.equal(header.size, bytes.length);
    assert.equal(header.type, 2);
    assert.equal(header.protocol, 1024);
    assert.equal(header.addressable, true);
    assert.equal(header.tagged, true);
    assert.equal(header.origin, 0);
    assert.equal(header.source, 3381435545);
    assert.deepEqual(header.target, new Uint8Array([1, 2, 3, 4, 5, 6]));
    assert.equal(header.resRequired, true);
    assert.equal(header.ackRequired, false);
    assert.equal(header.sequence, 5);

    const encodedBytes = Encoding.encode(
      header.tagged,
      header.source,
      header.target,
      header.resRequired,
      header.ackRequired,
      header.sequence,
      header.type,
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

  test('timestamps encode as nanoseconds since the epoch', () => {
    const date = new Date('2023-01-01T00:00:00.123Z');
    const payload = Encoding.encodeSetGroup(UUID, 'x', date);

    const expectedNanoseconds = BigInt(date.getTime()) * 1000000n;
    assert.equal(new DataView(payload.buffer).getBigUint64(48, true), expectedNanoseconds);

    // And decode back to the same instant.
    const state = new Uint8Array(56);
    state.set(payload);
    assert.equal(Encoding.decodeStateGroup(state).updatedAt.getTime(), date.getTime());
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

  test('decodeHeader reads the size field', () => {
    const bytes = new Uint8Array(0x124);
    bytes[0] = 0x24;
    bytes[1] = 0x01;
    assert.equal(Encoding.decodeHeader(bytes).size, 0x124);
  });

  test('decodeHeader splits the flags field', () => {
    const bytes = blankHeader();
    bytes[2] = 0x34;
    bytes[3] = 0x60; // origin = 1, tagged = 1, addressable = 0, protocol = 0x034
    const header = Encoding.decodeHeader(bytes);
    assert.equal(header.protocol, 0x034);
    assert.equal(header.addressable, false);
    assert.equal(header.tagged, true);
    assert.equal(header.origin, 1);

    const all = blankHeader();
    all[2] = 0xff;
    all[3] = 0xff;
    const allSet = Encoding.decodeHeader(all);
    assert.equal(allSet.protocol, 0xfff);
    assert.equal(allSet.addressable, true);
    assert.equal(allSet.tagged, true);
    assert.equal(allSet.origin, 3);
  });

  test('decodeHeader reads the tagged bit', () => {
    const bytes1 = blankHeader();
    bytes1[3] = 0x20; // tagged = 1 (bit 13 = 1, 0x2000)
    assert.equal(Encoding.decodeHeader(bytes1).tagged, true);

    const bytes2 = blankHeader();
    bytes2[3] = 0x10; // tagged = 0 (bit 13 = 0; bit 12 is addressable, not tagged)
    assert.equal(Encoding.decodeHeader(bytes2).tagged, false);
    assert.equal(Encoding.decodeHeader(bytes2).addressable, true);

    // Must agree with encode() on where the tagged bit lives.
    const tagged = Encoding.encode(true, 2, new Uint8Array(6), false, false, 0, 2);
    assert.equal(Encoding.decodeHeader(tagged).tagged, true);
    const untagged = Encoding.encode(false, 2, new Uint8Array(6), false, false, 0, 2);
    assert.equal(Encoding.decodeHeader(untagged).tagged, false);
  });

  test('decodeHeader reads the source as an unsigned 32-bit value', () => {
    const bytes = blankHeader();
    const view = new DataView(bytes.buffer);
    view.setUint32(4, 0x12345678, true);
    assert.equal(Encoding.decodeHeader(bytes).source, 0x12345678);

    // The top bit must not turn the source negative.
    view.setUint32(4, 0xFFFFFFFF, true);
    assert.equal(Encoding.decodeHeader(bytes).source, 0xFFFFFFFF);
  });

  test('decodeHeader exposes the 6-byte target as a view', () => {
    const bytes = blankHeader();
    bytes.set([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0xaa, 0xbb], 8);
    const { target } = Encoding.decodeHeader(bytes);
    // Only the serial: the two reserved bytes that follow are not part of it.
    assert.deepEqual(target, new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]));
    assert.strictEqual(target.buffer, bytes.buffer, 'zero-copy view into the message');
  });

  test('decodeHeader reads the response flags', () => {
    const flags = (value: number) => {
      const bytes = blankHeader();
      bytes[22] = value;
      const header = Encoding.decodeHeader(bytes);
      return [header.resRequired, header.ackRequired];
    };
    assert.deepEqual(flags(0b00), [false, false]);
    assert.deepEqual(flags(0b01), [true, false]);
    assert.deepEqual(flags(0b10), [false, true]);
    assert.deepEqual(flags(0b11), [true, true]);
    // The six reserved bits above them are ignored.
    assert.deepEqual(flags(0b11111100), [false, false]);
  });

  test('decodeHeader reads the type', () => {
    const bytes = blankHeader();
    new DataView(bytes.buffer).setUint16(32, 0x1234, true);
    assert.equal(Encoding.decodeHeader(bytes).type, 0x1234);
  });

  test('decodeHeader reads the sequence', () => {
    const bytes = blankHeader();
    bytes[23] = 42;
    assert.equal(Encoding.decodeHeader(bytes).sequence, 42);
  });

  test('decodeHeader decodes a message at an offset', () => {
    const message = Encoding.encode(true, 0xdeadbeef, new Uint8Array([1, 2, 3, 4, 5, 6]), true, true, 9, 0x1234, new Uint8Array([7, 8]));
    const bytes = new Uint8Array(10 + message.length);
    bytes.fill(0xff);
    bytes.set(message, 10);

    const header = Encoding.decodeHeader(bytes, 10);
    assert.equal(header.size, 38);
    assert.equal(header.tagged, true);
    assert.equal(header.source, 0xdeadbeef);
    assert.deepEqual(header.target, new Uint8Array([1, 2, 3, 4, 5, 6]));
    assert.equal(header.resRequired, true);
    assert.equal(header.ackRequired, true);
    assert.equal(header.sequence, 9);
    assert.equal(header.type, 0x1234);
    assert.deepEqual(Encoding.getPayload(bytes, 10, header.size), new Uint8Array([7, 8]));
  });

  test('decodeHeader returns a plain object with no reserved fields', () => {
    const header = Encoding.decodeHeader(blankHeader());
    assert.deepStrictEqual(Object.keys(header), [
      'size', 'protocol', 'addressable', 'tagged', 'origin', 'source',
      'target', 'resRequired', 'ackRequired', 'sequence', 'type',
    ]);
    assert.strictEqual(Object.getPrototypeOf(header), Object.prototype);
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

  test('getPayload bounded by the header size ignores trailing bytes', () => {
    const bytes = new Uint8Array(50);
    bytes.set([0x01, 0x02, 0x03, 0x04, 0x05, 0x06], 36);
    assert.deepEqual(Encoding.getPayload(bytes, 0, 40), new Uint8Array([0x01, 0x02, 0x03, 0x04]));
    assert.strictEqual(Encoding.getPayload(bytes, 0, 40).buffer, bytes.buffer, 'zero-copy view');
  });

  test('decodeStateService', () => {
    const bytes = new Uint8Array(5);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, 1); // service
    view.setUint32(1, 56700, true); // port
    
    const result = Encoding.decodeStateService(bytes);
    
    assert.equal(result.service, 1);
    assert.equal(result.port, 56700);
  });

  test('decodeStatePower', () => {
    const bytes = new Uint8Array(2);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, 65535, true);
    
    const result = Encoding.decodeStatePower(bytes);
    
    assert.equal(result, 65535);
  });

  test('decodeStateLabel', () => {
    const bytes = new Uint8Array(32);
    const label = 'Test Light';
    new TextEncoder().encodeInto(label, bytes);
    bytes[label.length] = 0; // null terminator
    
    const result = Encoding.decodeStateLabel(bytes);
    
    assert.equal(result, label);
  });

  test('decodeEchoResponse', () => {
    const bytes = new Uint8Array(64);
    bytes.set([1, 2, 3, 4, 5], 0);
    
    const result = Encoding.decodeEchoResponse(bytes);
    
    assert.deepEqual(result, bytes);
    assert.strictEqual(result.buffer, bytes.buffer, 'zero-copy view into the payload');
    // Bytes past the 64-byte echo are not part of it.
    assert.equal(Encoding.decodeEchoResponse(new Uint8Array(70)).length, 64);
  });

  test('decodeStateUnhandled', () => {
    const bytes = new Uint8Array(2);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, 0x1234, true);
    
    const result = Encoding.decodeStateUnhandled(bytes);
    
    assert.equal(result, 0x1234);
  });

  test('decodeStateHostFirmware', () => {
    const bytes = new Uint8Array(20);
    const view = new DataView(bytes.buffer);
    
    // Set timestamp (8 bytes)
    const timestamp = BigInt(Date.now()) * 1000000n;
    view.setBigUint64(0, timestamp, true);
    
    // Skip reserved (8 bytes)
    
    // Set versionMinor and versionMajor
    view.setUint16(16, 42, true); // versionMinor
    view.setUint16(18, 1, true);  // versionMajor
    
    const result = Encoding.decodeStateHostFirmware(bytes);
    
    assert.equal(result.build.getTime(), Number(timestamp / 1000000n));
    assert.equal(result.versionMinor, 42);
    assert.equal(result.versionMajor, 1);
    assert.deepStrictEqual(Object.keys(result), ['build', 'versionMinor', 'versionMajor']);
  });

  test('decodeStateWifiInfo', () => {
    const bytes = new Uint8Array(14);
    const view = new DataView(bytes.buffer);
    view.setFloat32(0, -50.5, true); // signal
    
    const result = Encoding.decodeStateWifiInfo(bytes);
    
    assert.equal(result.signal, -50.5);
    assert.deepStrictEqual(result, { signal: -50.5 });
  });

  test('decodeStateWifiFirmware', () => {
    const bytes = new Uint8Array(20);
    const view = new DataView(bytes.buffer);
    
    // Set timestamp (8 bytes)
    const timestamp = BigInt(Date.now()) * 1000000n;
    view.setBigUint64(0, timestamp, true);
    
    // Skip reserved6 (8 bytes)
    
    // Set versionMinor and versionMajor
    view.setUint16(16, 15, true); // versionMinor
    view.setUint16(18, 2, true);  // versionMajor
    
    const result = Encoding.decodeStateWifiFirmware(bytes);
    
    assert.equal(result.build.getTime(), Number(timestamp / 1000000n));
    assert.equal(result.versionMinor, 15);
    assert.equal(result.versionMajor, 2);
    assert.deepStrictEqual(Object.keys(result), ['build', 'versionMinor', 'versionMajor']);
  });

  test('decodeStateVersion', () => {
    const bytes = new Uint8Array(8);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 1, true);    // vendor
    view.setUint32(4, 22, true);   // product
    
    const result = Encoding.decodeStateVersion(bytes);
    
    assert.equal(result.vendor, 1);
    assert.equal(result.product, 22);
  });

  test('decodeStateInfo', () => {
    const bytes = new Uint8Array(24);
    const view = new DataView(bytes.buffer);
    
    const time = BigInt(Date.now()) * 1000000n;
    const uptime = BigInt(123456) * 1000000n;
    const downtime = BigInt(0) * 1000000n;
    
    view.setBigUint64(0, time, true);
    view.setBigUint64(8, uptime, true);
    view.setBigUint64(16, downtime, true);
    
    const result = Encoding.decodeStateInfo(bytes);

    assert.equal(result.time.getTime(), Number(time / 1000000n));
    // uptime/downtime are durations, decoded as raw nanosecond counts.
    assert.equal(result.uptimeNs, uptime);
    assert.equal(result.downtimeNs, downtime);
  });

  test('decodeStateLocation', () => {
    const bytes = new Uint8Array(56);
    const view = new DataView(bytes.buffer);
    
    // Set location UUID (16 bytes)
    const locationBytes = new Uint8Array([
      0x4e, 0x03, 0x52, 0xbf, 0x19, 0x94, 0x4f, 0xf2,
      0xb4, 0x25, 0x1c, 0x44, 0x55, 0x47, 0x9f, 0x33
    ]);
    bytes.set(locationBytes, 0);
    
    // Set label (32 bytes)
    const label = 'Living Room';
    new TextEncoder().encodeInto(label, bytes.subarray(16, 48));
    bytes[16 + label.length] = 0; // null terminator
    
    // Set timestamp (8 bytes)
    const timestamp = BigInt(Date.now()) * 1000000n;
    view.setBigUint64(48, timestamp, true);
    
    const result = Encoding.decodeStateLocation(bytes);
    
    // Same 32-hex-digit form as StateGroup.group.
    assert.equal(result.location, Array.from(locationBytes, (b) => b.toString(16).padStart(2, '0')).join(''));
    assert.equal(result.label, label);
    assert.equal(result.updatedAt.getTime(), Number(timestamp / 1000000n));
  });

  test('decodeStateGroup', () => {
    const bytes = new Uint8Array(56);
    const view = new DataView(bytes.buffer);
    
    // Set group UUID (16 bytes) - encoded as hex string
    const groupBytes = new Uint8Array([
      0x4e, 0x03, 0x52, 0xbf, 0x19, 0x94, 0x4f, 0xf2,
      0xb4, 0x25, 0x1c, 0x44, 0x55, 0x47, 0x9f, 0x33
    ]);
    bytes.set(groupBytes, 0);
    
    // Set label (32 bytes)
    const label = 'Office Lights';
    new TextEncoder().encodeInto(label, bytes.subarray(16, 48));
    bytes[16 + label.length] = 0; // null terminator
    
    // Set timestamp (8 bytes) as bigint
    const timestamp = 1640995200000;
    view.setBigUint64(48, 1000000n * BigInt(timestamp), true);
    
    const result = Encoding.decodeStateGroup(bytes);
    
    assert.equal(result.group, '4e0352bf19944ff2b4251c4455479f33');
    assert.equal(result.label, label);
    assert.equal(result.updatedAt.getTime(), timestamp);
  });

  test('decodeLightState', () => {
    const bytes = new Uint8Array(52);
    const view = new DataView(bytes.buffer);
    
    view.setUint16(0, 120, true);    // hue
    view.setUint16(2, 65535, true);  // saturation
    view.setUint16(4, 32768, true);  // brightness
    view.setUint16(6, 3500, true);   // kelvin
    // reserved2 (2 bytes) at offset 8
    view.setUint16(10, 65535, true); // power
    
    // label (32 bytes) at offset 12
    const label = 'Bedroom Light';
    new TextEncoder().encodeInto(label, bytes.subarray(12, 44));
    bytes[12 + label.length] = 0; // null terminator
    
    // reserved8 (8 bytes) at offset 44
    
    const result = Encoding.decodeLightState(bytes);
    
    assert.equal(result.hue, 120);
    assert.equal(result.saturation, 65535);
    assert.equal(result.brightness, 32768);
    assert.equal(result.kelvin, 3500);
    assert.equal(result.power, 65535);
    assert.equal(result.label, label);
    assert.deepStrictEqual(Object.keys(result), ['hue', 'saturation', 'brightness', 'kelvin', 'power', 'label']);
    assert.strictEqual(Object.getPrototypeOf(result), Object.prototype);
  });

  test('decodeStateLightPower', () => {
    const bytes = new Uint8Array(2);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, 32768, true);
    
    const result = Encoding.decodeStateLightPower(bytes);
    
    assert.equal(result, 32768);
  });

  test('decodeStateInfrared', () => {
    const bytes = new Uint8Array(2);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, 16384, true);
    
    const result = Encoding.decodeStateInfrared(bytes);
    
    assert.equal(result, 16384);
  });

  test('decodeStateHevCycle', () => {
    const bytes = new Uint8Array(9);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 3600, true);  // durationSeconds
    view.setUint32(4, 1800, true);  // remainingSeconds
    view.setUint8(8, 1);            // lastPower
    
    const result = Encoding.decodeStateHevCycle(bytes);
    
    assert.equal(result.durationSeconds, 3600);
    assert.equal(result.remainingSeconds, 1800);
    assert.equal(result.lastPower, true);
  });

  test('decodeStateHevCycleConfiguration', () => {
    const bytes = new Uint8Array(5);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, 1);           // indication
    view.setUint32(1, 7200, true); // durationSeconds
    
    const result = Encoding.decodeStateHevCycleConfiguration(bytes);
    
    assert.equal(result.indication, true);
    assert.equal(result.durationSeconds, 7200);
  });

  test('decodeStateHevCycleConfiguration decodes indication as a boolean', () => {
    assert.strictEqual(Encoding.decodeStateHevCycleConfiguration(new Uint8Array(5)).indication, false);
    // Any non-zero byte is true, matching StateHevCycle.lastPower.
    const bytes = new Uint8Array(5);
    bytes[0] = 2;
    assert.strictEqual(Encoding.decodeStateHevCycleConfiguration(bytes).indication, true);
    bytes[0] = 255;
    assert.strictEqual(Encoding.decodeStateHevCycleConfiguration(bytes).indication, true);
  });

  test('decodeStateHevCycle decodes lastPower as a boolean', () => {
    assert.strictEqual(Encoding.decodeStateHevCycle(new Uint8Array(9)).lastPower, false);
    const bytes = new Uint8Array(9);
    bytes[8] = 2;
    assert.strictEqual(Encoding.decodeStateHevCycle(bytes).lastPower, true);
  });

  test('decodeStateLastHevCycleResult', () => {
    const bytes = new Uint8Array(1);
    bytes[0] = 42;
    
    const result = Encoding.decodeStateLastHevCycleResult(bytes);
    
    assert.equal(result, 42);
  });

  test('decodeStateRPower', () => {
    const bytes = new Uint8Array(3);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, 2);           // relayIndex
    view.setUint16(1, 32000, true); // level
    
    const result = Encoding.decodeStateRPower(bytes);
    
    assert.equal(result.relayIndex, 2);
    assert.equal(result.level, 32000);
  });

  test('decodeStateDeviceChain', () => {
    // Calculate correct size: 1 byte startIndex + 16 devices * 55 bytes each + 1 byte tileDevicesCount
    const deviceSize = 2 + 2 + 2 + 2 + 4 + 4 + 1 + 1 + 1 + 4 + 4 + 4 + 8 + 8 + 2 + 2 + 4; // = 55 bytes per device
    const totalSize = 1 + 16 * deviceSize + 1; // = 881 bytes
    const bytes = new Uint8Array(totalSize);
    const view = new DataView(bytes.buffer);
    
    view.setUint8(0, 5); // startIndex
    
    // Fill first device data only (other devices will be zeros which is fine)
    let offset = 1;
    view.setInt16(offset, -100, true); offset += 2; // accelMeasX
    view.setInt16(offset, 200, true); offset += 2;  // accelMeasY
    view.setInt16(offset, 50, true); offset += 2;   // accelMeasZ
    view.setUint8(offset, 0xab); view.setUint8(offset + 1, 0xcd); offset += 2; // reserved6
    view.setFloat32(offset, 1.5, true); offset += 4; // userX
    view.setFloat32(offset, 2.5, true); offset += 4; // userY
    view.setUint8(offset, 8); offset += 1;  // width
    view.setUint8(offset, 8); offset += 1;  // height
    offset += 1; // reserved7
    view.setUint32(offset, 1, true); offset += 4;   // deviceVersionVendor
    view.setUint32(offset, 22, true); offset += 4;  // deviceVersionProduct
    offset += 4; // reserved8
    
    // firmwareBuild timestamp
    const timestamp = BigInt(Date.now()) * 1000000n;
    view.setBigUint64(offset, timestamp, true); offset += 8;
    offset += 8; // reserved9
    view.setUint16(offset, 42, true); offset += 2; // firmwareVersionMinor
    view.setUint16(offset, 3, true); offset += 2;  // firmwareVersionMajor
    // offset += 4; // reserved10 - already zeros
    
    // Set tileDevicesCount at the very end
    view.setUint8(totalSize - 1, 1); // tileDevicesCount
    
    const result = Encoding.decodeStateDeviceChain(bytes);
    
    assert.equal(result.startIndex, 5);
    // Only the one device the message reports, not the 16 wire slots.
    assert.equal(result.devices.length, 1);
    assert.deepStrictEqual(Object.keys(result), ['startIndex', 'devices']);
    
    const firstDevice = result.devices[0];
    assert.ok(firstDevice);
    assert.equal(firstDevice.accelMeasX, -100);
    assert.equal(firstDevice.accelMeasY, 200);
    assert.equal(firstDevice.accelMeasZ, 50);
    assert.equal(firstDevice.userX, 1.5);
    assert.equal(firstDevice.userY, 2.5);
    assert.equal(firstDevice.width, 8);
    assert.equal(firstDevice.height, 8);
    assert.equal(firstDevice.deviceVersionVendor, 1);
    assert.equal(firstDevice.deviceVersionProduct, 22);
    assert.equal(firstDevice.firmwareBuild.getTime(), Number(timestamp / 1000000n));
    assert.equal(firstDevice.firmwareVersionMinor, 42);
    assert.equal(firstDevice.firmwareVersionMajor, 3);
    assert.deepStrictEqual(Object.keys(firstDevice), [
      'accelMeasX', 'accelMeasY', 'accelMeasZ', 'userX', 'userY', 'width', 'height',
      'deviceVersionVendor', 'deviceVersionProduct', 'firmwareBuild',
      'firmwareVersionMinor', 'firmwareVersionMajor',
    ]);
  });

  test('decodeStateDeviceChain trims devices to the reported count', () => {
    const payload = (count: number) => {
      const bytes = new Uint8Array(882);
      for (let i = 0; i < 16; i++) {
        bytes[1 + i * 55 + 16] = i + 1; // width identifies the slot
      }
      bytes[881] = count;
      return bytes;
    };

    assert.deepStrictEqual(Encoding.decodeStateDeviceChain(payload(0)).devices, []);

    const five = Encoding.decodeStateDeviceChain(payload(5)).devices;
    assert.deepEqual(five.map((device) => device.width), [1, 2, 3, 4, 5]);

    const full = Encoding.decodeStateDeviceChain(payload(16)).devices;
    assert.equal(full.length, 16);
    assert.equal(full[15]!.width, 16);

    // A count past the 16 slots the message carries is clamped, never read
    // past the payload.
    const clamped = Encoding.decodeStateDeviceChain(payload(200)).devices;
    assert.equal(clamped.length, 16);
    assert.equal(clamped[15]!.width, 16);


  });

  test('decodeState64', () => {
    const bytes = new Uint8Array(517); // 1 + 1 + 1 + 1 + 1 + 64*8
    const view = new DataView(bytes.buffer);
    
    bytes[0] = 2;  // tileIndex
    bytes[1] = 0;  // reserved6
    bytes[2] = 1;  // x
    bytes[3] = 2;  // y
    bytes[4] = 8;  // width
    
    // Set first color
    let offset = 5;
    view.setUint16(offset, 120, true); offset += 2;    // hue
    view.setUint16(offset, 65535, true); offset += 2;  // saturation
    view.setUint16(offset, 32768, true); offset += 2;  // brightness
    view.setUint16(offset, 3500, true); offset += 2;   // kelvin
    
    const result = Encoding.decodeState64(bytes);
    
    assert.equal(result.tileIndex, 2);
    assert.equal(result.x, 1);
    assert.equal(result.y, 2);
    assert.equal(result.width, 8);
    assert.equal(result.colors.length, 64);
    
    const firstColor = result.colors[0];
    assert.ok(firstColor);
    assert.equal(firstColor.hue, 120);
    assert.equal(firstColor.saturation, 65535);
    assert.equal(firstColor.brightness, 32768);
    assert.equal(firstColor.kelvin, 3500);

    assert.deepStrictEqual(Object.keys(result), ['tileIndex', 'x', 'y', 'width', 'colors']);
  });

  test('decodeState64 always decodes the full 64-color frame', () => {
    const bytes = new Uint8Array(517);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < 64; i++) {
      view.setUint16(5 + i * 8, i + 1, true); // hue identifies the pixel
    }
    const { colors } = Encoding.decodeState64(bytes);
    assert.equal(colors.length, 64);
    assert.deepEqual(colors.map((color) => color.hue), Array.from({ length: 64 }, (_, i) => i + 1));
  });

  test('decodeStateZone', () => {
    const bytes = new Uint8Array(10);
    const view = new DataView(bytes.buffer);
    
    view.setUint8(0, 16);          // zonesCount
    view.setUint8(1, 5);           // zoneIndex
    view.setUint16(2, 240, true);  // hue
    view.setUint16(4, 65535, true); // saturation
    view.setUint16(6, 40000, true); // brightness
    view.setUint16(8, 2700, true);  // kelvin
    
    const result = Encoding.decodeStateZone(bytes);
    
    assert.equal(result.zonesCount, 16);
    assert.equal(result.zoneIndex, 5);
    assert.equal(result.hue, 240);
    assert.equal(result.saturation, 65535);
    assert.equal(result.brightness, 40000);
    assert.equal(result.kelvin, 2700);
  });

  test('decodeStateMultiZone', () => {
    const bytes = new Uint8Array(66); // 1 + 1 + 8*8
    const view = new DataView(bytes.buffer);
    
    view.setUint8(0, 16); // zonesCount
    view.setUint8(1, 0);  // zoneIndex
    
    // Set first color
    let offset = 2;
    view.setUint16(offset, 180, true); offset += 2;    // hue
    view.setUint16(offset, 50000, true); offset += 2;  // saturation
    view.setUint16(offset, 45000, true); offset += 2;  // brightness
    view.setUint16(offset, 4000, true); offset += 2;   // kelvin
    
    const result = Encoding.decodeStateMultiZone(bytes);
    
    assert.equal(result.zonesCount, 16);
    assert.equal(result.zoneIndex, 0);
    assert.equal(result.colors.length, 8);
    
    const firstColor = result.colors[0];
    assert.ok(firstColor);
    assert.equal(firstColor.hue, 180);
    assert.equal(firstColor.saturation, 50000);
    assert.equal(firstColor.brightness, 45000);
    assert.equal(firstColor.kelvin, 4000);

    assert.deepStrictEqual(Object.keys(result), ['zonesCount', 'zoneIndex', 'colors']);
  });

  test('decodeStateMultiZone trims colors to the zones the device has', () => {
    const payload = (zonesCount: number, zoneIndex: number) => {
      const bytes = new Uint8Array(66);
      const view = new DataView(bytes.buffer);
      bytes[0] = zonesCount;
      bytes[1] = zoneIndex;
      for (let i = 0; i < 8; i++) {
        view.setUint16(2 + i * 8, zoneIndex + i + 1000, true); // hue identifies the zone
      }
      return bytes;
    };
    const hues = (zonesCount: number, zoneIndex: number) =>
      Encoding.decodeStateMultiZone(payload(zonesCount, zoneIndex)).colors.map((color) => color.hue);

    // A 12-zone strip: the first packet is full, the second carries 4.
    assert.deepEqual(hues(12, 0), [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007]);
    assert.deepEqual(hues(12, 8), [1008, 1009, 1010, 1011]);
    // Exactly at the boundary.
    assert.deepEqual(hues(8, 0).length, 8);
    assert.deepEqual(hues(9, 8), [1008]);
    assert.deepEqual(hues(1, 0), [1000]);
    // Nothing to report: no zones, or a zoneIndex at or past the last zone
    // (a hostile packet must not produce a negative length).
    assert.deepEqual(hues(0, 0), []);
    assert.deepEqual(hues(8, 8), []);
    assert.deepEqual(hues(4, 200), []);
    // The largest strip the uint8 fields can describe.
    assert.deepEqual(hues(255, 248), [1248, 1249, 1250, 1251, 1252, 1253, 1254]);
  });

  test('decodeStateMultiZoneEffect', () => {
    const bytes = new Uint8Array(59);
    const view = new DataView(bytes.buffer);
    
    view.setUint32(0, 12345, true);  // instanceId
    view.setUint8(4, 2);             // type
    // reserved6 (2 bytes) at offset 5
    view.setUint32(7, 1000, true);   // speed
    view.setBigUint64(11, 5000n, true); // duration
    // reserved7 (4 bytes) at offset 19
    // reserved8 (4 bytes) at offset 23
    // parameters (32 bytes) at offset 27
    bytes.set([1, 2, 3, 4], 27); // First few parameter bytes
    
    const result = Encoding.decodeStateMultiZoneEffect(bytes);
    
    assert.equal(result.instanceId, 12345);
    assert.equal(result.effectType, 2);
    assert.equal(result.speedMs, 1000);
    assert.equal(result.durationNs, 5000n);
    assert.equal(result.parameters.length, 32);
    assert.deepEqual(result.parameters.subarray(0, 4), new Uint8Array([1, 2, 3, 4]));
    assert.strictEqual(result.parameters.buffer, bytes.buffer, 'zero-copy view into the payload');
    assert.deepStrictEqual(Object.keys(result), ['instanceId', 'effectType', 'speedMs', 'durationNs', 'parameters']);
  });

  test('decodeStateExtendedColorZones', () => {
    const bytes = new Uint8Array(661); // 2 + 2 + 1 + 82*8
    const view = new DataView(bytes.buffer);
    
    view.setUint16(0, 82, true);  // zonesCount
    view.setUint16(2, 0, true);   // zoneIndex
    view.setUint8(4, 10);         // colorsCount
    
    // Set first color
    let offset = 5;
    view.setUint16(offset, 300, true); offset += 2;    // hue
    view.setUint16(offset, 40000, true); offset += 2;  // saturation
    view.setUint16(offset, 50000, true); offset += 2;  // brightness
    view.setUint16(offset, 3200, true); offset += 2;   // kelvin
    
    const result = Encoding.decodeStateExtendedColorZones(bytes);
    
    assert.equal(result.zonesCount, 82);
    assert.equal(result.zoneIndex, 0);
    // Only the 10 colors the packet reports as valid, not the 82 wire slots.
    assert.equal(result.colors.length, 10);
    assert.deepStrictEqual(Object.keys(result), ['zonesCount', 'zoneIndex', 'colors']);
    
    const firstColor = result.colors[0];
    assert.ok(firstColor);
    assert.equal(firstColor.hue, 300);
    assert.equal(firstColor.saturation, 40000);
    assert.equal(firstColor.brightness, 50000);
    assert.equal(firstColor.kelvin, 3200);
  });

  test('decodeStateExtendedColorZones trims colors to colors_count', () => {
    const payload = (zonesCount: number, zoneIndex: number, colorsCount: number) => {
      const bytes = new Uint8Array(661);
      const view = new DataView(bytes.buffer);
      view.setUint16(0, zonesCount, true);
      view.setUint16(2, zoneIndex, true);
      bytes[4] = colorsCount;
      for (let i = 0; i < 82; i++) {
        view.setUint16(5 + i * 8, zoneIndex + i + 1, true); // hue identifies the zone
      }
      return bytes;
    };

    assert.deepStrictEqual(Encoding.decodeStateExtendedColorZones(payload(10, 0, 0)).colors, []);

    const one = Encoding.decodeStateExtendedColorZones(payload(1, 0, 1));
    assert.deepEqual(one.colors.map((color) => color.hue), [1]);

    const full = Encoding.decodeStateExtendedColorZones(payload(82, 0, 82));
    assert.equal(full.colors.length, 82);
    assert.equal(full.colors[81]!.hue, 82);

    // The second packet of a 120-zone device: 38 valid colors starting at 82.
    const second = Encoding.decodeStateExtendedColorZones(payload(120, 82, 38));
    assert.equal(second.zonesCount, 120);
    assert.equal(second.zoneIndex, 82);
    assert.equal(second.colors.length, 38);
    assert.equal(second.colors[0]!.hue, 83);
    assert.equal(second.colors[37]!.hue, 120);

    // A count past the 82 slots the message carries is clamped, never read
    // past the payload.
    const clamped = Encoding.decodeStateExtendedColorZones(payload(500, 0, 255));
    assert.equal(clamped.colors.length, 82);
    assert.equal(clamped.colors[81]!.hue, 82);
  });

  test('decodeStateTileEffect', () => {
    const bytes = new Uint8Array(188);
    const view = new DataView(bytes.buffer);
    
    view.setUint8(0, 0);             // reserved0
    view.setUint32(1, 98765, true);  // instanceId
    view.setUint8(5, 3);             // type
    view.setUint32(6, 2000, true);   // speed
    view.setBigUint64(10, 10000n, true); // duration
    // reserved1 (4 bytes) at offset 18
    // reserved2 (4 bytes) at offset 22
    view.setUint8(26, 1);            // skyType
    // reserved3 (3 bytes) at offset 27
    view.setUint8(30, 50);           // cloudSaturationMin
    // reserved4 (3 bytes) at offset 31
    view.setUint8(34, 80);           // cloudSaturationMax
    // reserved5 (23 bytes) at offset 35
    view.setUint8(58, 5);            // paletteCount
    
    // Set first palette color
    let offset = 59;
    view.setUint16(offset, 60, true); offset += 2;     // hue
    view.setUint16(offset, 55000, true); offset += 2;  // saturation
    view.setUint16(offset, 35000, true); offset += 2;  // brightness
    view.setUint16(offset, 6500, true); offset += 2;   // kelvin
    
    const result = Encoding.decodeStateTileEffect(bytes);
    
    assert.equal(result.instanceId, 98765);
    assert.equal(result.effectType, 3);
    assert.equal(result.speedMs, 2000);
    assert.equal(result.durationNs, 10000n);
    assert.equal(result.skyType, 1);
    assert.equal(result.cloudSaturationMin, 50);
    assert.equal(result.cloudSaturationMax, 80);
    // Only the 5 palette entries in use, not the 16 wire slots.
    assert.equal(result.palette.length, 5);
    assert.deepStrictEqual(Object.keys(result), [
      'instanceId', 'effectType', 'speedMs', 'durationNs', 'skyType',
      'cloudSaturationMin', 'cloudSaturationMax', 'palette',
    ]);
    
    const firstPaletteColor = result.palette[0];
    assert.ok(firstPaletteColor);
    assert.equal(firstPaletteColor.hue, 60);
    assert.equal(firstPaletteColor.saturation, 55000);
    assert.equal(firstPaletteColor.brightness, 35000);
    assert.equal(firstPaletteColor.kelvin, 6500);
  });

  test('decodeStateTileEffect trims the palette to palette_count', () => {
    const payload = (paletteCount: number) => {
      const bytes = new Uint8Array(187);
      const view = new DataView(bytes.buffer);
      bytes[58] = paletteCount;
      for (let i = 0; i < 16; i++) {
        view.setUint16(59 + i * 8, i + 1, true); // hue identifies the entry
      }
      return bytes;
    };
    const hues = (paletteCount: number) =>
      Encoding.decodeStateTileEffect(payload(paletteCount)).palette.map((color) => color.hue);

    assert.deepEqual(hues(0), []);
    assert.deepEqual(hues(3), [1, 2, 3]);
    assert.deepEqual(hues(16), Array.from({ length: 16 }, (_, i) => i + 1));
    // A count past the 16 slots the message carries is clamped.
    assert.deepEqual(hues(255), Array.from({ length: 16 }, (_, i) => i + 1));
  });

  test('decodeSensorStateAmbientLight', () => {
    const bytes = new Uint8Array(4);
    const view = new DataView(bytes.buffer);
    view.setFloat32(0, 123.45, true);
    
    const result = Encoding.decodeSensorStateAmbientLight(bytes);
    
    // Use approximate comparison for float32 precision
    assert.ok(Math.abs(result.lux - 123.45) < 0.01);
  });

  // Test encoding functions that weren't fully covered

  test('encodeSetPower with boolean', () => {
    const payloadTrue = Encoding.encodeSetPower(true);
    const payloadFalse = Encoding.encodeSetPower(false);
    
    const viewTrue = new DataView(payloadTrue.buffer);
    const viewFalse = new DataView(payloadFalse.buffer);
    
    assert.equal(viewTrue.getUint16(0, true), 65535);
    assert.equal(viewFalse.getUint16(0, true), 0);
  });

  test('encodeSetPower with number', () => {
    const payload = Encoding.encodeSetPower(32768);
    const view = new DataView(payload.buffer);
    assert.equal(view.getUint16(0, true), 32768);
  });

  test('encodeSetLocation with string UUID', () => {
    const payload = Encoding.encodeSetLocation(
      '4e0352bf-1994-4ff2-b425-1c4455479f33',
      'Kitchen',
      new Date('2023-01-01T00:00:00.000Z')
    );
    
    assert.equal(payload.length, 56);
    
    // Check UUID was encoded correctly
    const expectedUuid = new Uint8Array([
      0x4e, 0x03, 0x52, 0xbf, 0x19, 0x94, 0x4f, 0xf2,
      0xb4, 0x25, 0x1c, 0x44, 0x55, 0x47, 0x9f, 0x33
    ]);
    assert.deepEqual(payload.subarray(0, 16), expectedUuid);
    
    // Check label
    const labelBytes = payload.subarray(16, 48);
    const label = new TextDecoder().decode(labelBytes.subarray(0, labelBytes.indexOf(0)));
    assert.equal(label, 'Kitchen');
  });

  test('encodeSetLocation with Uint8Array UUID', () => {
    const uuid = new Uint8Array([
      0x4e, 0x03, 0x52, 0xbf, 0x19, 0x94, 0x4f, 0xf2,
      0xb4, 0x25, 0x1c, 0x44, 0x55, 0x47, 0x9f, 0x33
    ]);
    
    const payload = Encoding.encodeSetLocation(
      uuid,
      'Bathroom',
      new Date('2023-01-01T00:00:00.000Z')
    );
    
    assert.equal(payload.length, 56);
    assert.deepEqual(payload.subarray(0, 16), uuid);
  });

  test('encodeSetGroup with string UUID', () => {
    const payload = Encoding.encodeSetGroup(
      '4e0352bf-1994-4ff2-b425-1c4455479f33',
      'Upstairs',
      new Date('2023-01-01T00:00:00.000Z')
    );
    
    assert.equal(payload.length, 56);
    
    // Check UUID was encoded correctly
    const expectedUuid = new Uint8Array([
      0x4e, 0x03, 0x52, 0xbf, 0x19, 0x94, 0x4f, 0xf2,
      0xb4, 0x25, 0x1c, 0x44, 0x55, 0x47, 0x9f, 0x33
    ]);
    assert.deepEqual(payload.subarray(0, 16), expectedUuid);
  });

  test('encodeSetGroup with Uint8Array UUID', () => {
    const uuid = new Uint8Array([
      0x4e, 0x03, 0x52, 0xbf, 0x19, 0x94, 0x4f, 0xf2,
      0xb4, 0x25, 0x1c, 0x44, 0x55, 0x47, 0x9f, 0x33
    ]);
    
    const payload = Encoding.encodeSetGroup(
      uuid,
      'Downstairs',
      new Date('2023-01-01T00:00:00.000Z')
    );
    
    assert.equal(payload.length, 56);
    assert.deepEqual(payload.subarray(0, 16), uuid);
  });

  test('encodeEchoRequest', () => {
    const echoing = new Uint8Array([1, 2, 3, 4, 5]);
    const payload = Encoding.encodeEchoRequest(echoing);
    
    assert.equal(payload.length, 64);
    assert.deepEqual(payload.subarray(0, 5), echoing);
    assert.deepEqual(payload.subarray(5), new Uint8Array(59)); // remaining bytes should be zero
  });

  test('encodeEchoRequest rejects more than 64 bytes', () => {
    assert.throws(() => Encoding.encodeEchoRequest(new Uint8Array(65)), /Invalid echoing: 65 \(must be at most 64 bytes\)/);
    assert.equal(Encoding.encodeEchoRequest(new Uint8Array(64)).length, 64);
  });

  test('encodeSetLocation/encodeSetGroup reject a byte id that is not 16 bytes', () => {
    const date = new Date('2023-01-01T00:00:00.000Z');
    // A longer id left stray bytes in the label field; a shorter one was zero-padded.
    assert.throws(() => Encoding.encodeSetLocation(new Uint8Array(17), 'x', date), /Invalid location: 17 \(must be 16 bytes\)/);
    assert.throws(() => Encoding.encodeSetGroup(new Uint8Array(15), 'x', date), /Invalid group: 15 \(must be 16 bytes\)/);
    // Both directions for each encoder.
    assert.throws(() => Encoding.encodeSetLocation(new Uint8Array(15), 'x', date), /Invalid location: 15 \(must be 16 bytes\)/);
    assert.throws(() => Encoding.encodeSetGroup(new Uint8Array(17), 'x', date), /Invalid group: 17 \(must be 16 bytes\)/);
  });

  test('encodeSetLocation/encodeSetGroup reject an invalid or pre-epoch date', () => {
    const uuid = '550e8400e29b41d4a716446655440000';
    assert.throws(() => Encoding.encodeSetLocation(uuid, 'x', new Date(Number.NaN)), /Invalid date/);
    assert.throws(() => Encoding.encodeSetGroup(uuid, 'x', new Date(-1)), /Invalid date/);
    // Past the uint64 nanosecond range (~2554) the value would wrap to an
    // unrelated date.
    assert.throws(() => Encoding.encodeSetGroup(uuid, 'x', new Date('2600-01-01T00:00:00Z')), /Invalid date/);
    // Both ends of the representable range encode.
    assert.equal(Encoding.encodeSetGroup(uuid, 'x', new Date(0)).length, 56);
    const latest = Encoding.encodeSetGroup(uuid, 'x', new Date(18446744073709));
    assert.equal(new DataView(latest.buffer).getBigUint64(48, true), 18446744073709000000n);
  });

  test('uint32 time fields reject values setUint32 would wrap', () => {
    // -1 would encode as 0xFFFFFFFF: a ~49.7 day transition, a ~136 year HEV cycle.
    assert.throws(() => Encoding.encodeSetColor(0, 0, 0, 3500, -1), /Invalid durationMs: -1/);
    assert.throws(() => Encoding.encodeSetLightPower(true, -1), /Invalid durationMs: -1/);
    assert.throws(() => Encoding.encodeSetHevCycle(true, -1), /Invalid durationSeconds: -1/);
    assert.throws(() => Encoding.encodeSetHevCycleConfiguration(true, 2 ** 32), /Invalid durationSeconds/);
    assert.throws(() => Encoding.encodeSetWaveform(false, 0, 0, 0, 3500, -1, 1, 0, 0), /Invalid periodMs: -1/);
    assert.throws(() => Encoding.encodeSetWaveformOptional(false, 0, 0, 0, 3500, Number.NaN, 1, 0, 0, true, true, true, true), /Invalid periodMs: NaN/);
    assert.throws(() => Encoding.encodeSetColorZones(0, 7, 0, 0, 0, 3500, -1, 1), /Invalid durationMs: -1/);
    assert.throws(() => Encoding.encodeSetExtendedColorZones(-1, 1, 0, [COLOR]), /Invalid durationMs: -1/);
    assert.throws(() => Encoding.encodeSet64(0, 1, 0, 0, 8, -1, []), /Invalid durationMs: -1/);
    assert.throws(() => Encoding.encodeSetMultiZoneEffect(1, 1, -1, 0n, new Uint8Array(0)), /Invalid speedMs: -1/);
    assert.throws(() => Encoding.encodeSetTileEffect(1, 2, -1, 0n, 0, 0, 0, []), /Invalid speedMs: -1/);
    // The ends of the range encode.
    assert.equal(new DataView(Encoding.encodeSetColor(0, 0, 0, 3500, 0xFFFFFFFF).buffer).getUint32(9, true), 0xFFFFFFFF);
    assert.equal(Encoding.encodeSetHevCycle(true, 0).length, 5);
  });

  test('effect encoders reject a duration outside the uint64 range', () => {
    // setBigUint64 would wrap -1n to 2^64 - 1 (an effect that never ends).
    assert.throws(() => Encoding.encodeSetMultiZoneEffect(1, 1, 1000, -1n, new Uint8Array(0)), /Invalid durationNs/);
    assert.throws(() => Encoding.encodeSetTileEffect(1, 2, 1000, 2n ** 64n, 0, 0, 0, []), /Invalid durationNs/);
    // Both ends of the uint64 range encode (0n means "run until stopped").
    assert.equal(new DataView(Encoding.encodeSetMultiZoneEffect(1, 1, 1000, 0n, new Uint8Array(0)).buffer).getBigUint64(11, true), 0n);
    assert.equal(new DataView(Encoding.encodeSetTileEffect(1, 2, 1000, 2n ** 64n - 1n, 0, 0, 0, []).buffer).getBigUint64(11, true), 2n ** 64n - 1n);
    // An untyped omitted or number duration is a ValidationError too, not a
    // bare TypeError from setBigUint64.
    // @ts-expect-error -- an untyped caller omitting the bigint duration
    assert.throws(() => Encoding.encodeSetMultiZoneEffect(1, 1, 1000, undefined, new Uint8Array(0)), /Invalid durationNs/);
    // @ts-expect-error -- an untyped caller passing a number where a bigint is required
    assert.throws(() => Encoding.encodeSetTileEffect(1, 2, 1000, 5000, 0, 0, 0, []), /Invalid durationNs/);
  });

  test('encodeSetWaveform', () => {
    const payload = Encoding.encodeSetWaveform(
      true,  // transient
      120,   // hue
      65535, // saturation
      32768, // brightness
      3500,  // kelvin
      1000,  // period
      2.5,   // cycles
      0,     // skewRatio
      1      // waveform
    );
    
    assert.equal(payload.length, 21);
    
    const view = new DataView(payload.buffer);
    assert.equal(payload[1], 1);  // transient
    assert.equal(view.getUint16(2, true), 120);     // hue
    assert.equal(view.getUint16(4, true), 65535);   // saturation
    assert.equal(view.getUint16(6, true), 32768);   // brightness
    assert.equal(view.getUint16(8, true), 3500);    // kelvin
    assert.equal(view.getUint32(10, true), 1000);   // period
    assert.equal(view.getFloat32(14, true), 2.5);   // cycles
    assert.equal(view.getInt16(18, true), 0);       // skewRatio
    assert.equal(view.getUint8(20), 1);             // waveform
  });

  test('encodeSetLightPower with boolean', () => {
    const payloadTrue = Encoding.encodeSetLightPower(true, 1000);
    const payloadFalse = Encoding.encodeSetLightPower(false, 500);
    
    const viewTrue = new DataView(payloadTrue.buffer);
    const viewFalse = new DataView(payloadFalse.buffer);
    
    assert.equal(viewTrue.getUint16(0, true), 65535);
    assert.equal(viewTrue.getUint32(2, true), 1000);
    assert.equal(viewFalse.getUint16(0, true), 0);
    assert.equal(viewFalse.getUint32(2, true), 500);
  });

  test('encodeSetLightPower with number', () => {
    const payload = Encoding.encodeSetLightPower(32768, 2000);
    const view = new DataView(payload.buffer);
    
    assert.equal(view.getUint16(0, true), 32768);
    assert.equal(view.getUint32(2, true), 2000);
  });

  test('encodeSetWaveformOptional', () => {
    const payload = Encoding.encodeSetWaveformOptional(
      false, // transient
      240,   // hue
      50000, // saturation
      40000, // brightness
      2700,  // kelvin
      2000,  // period
      1.0,   // cycles
      -100,  // skewRatio
      2,     // waveform
      true,  // setHue
      false, // setSaturation
      true,  // setBrightness
      false  // setKelvin
    );
    
    assert.equal(payload.length, 25);
    
    const view = new DataView(payload.buffer);
    assert.equal(payload[1], 0);  // transient = false
    assert.equal(view.getUint16(2, true), 240);     // hue
    assert.equal(view.getUint16(4, true), 50000);   // saturation
    assert.equal(view.getUint16(6, true), 40000);   // brightness
    assert.equal(view.getUint16(8, true), 2700);    // kelvin
    assert.equal(view.getUint32(10, true), 2000);   // period
    assert.equal(view.getFloat32(14, true), 1.0);   // cycles
    assert.equal(view.getInt16(18, true), -100);    // skewRatio
    assert.equal(view.getUint8(20), 2);             // waveform
    assert.equal(payload[21], 1);  // setHue = true
    assert.equal(payload[22], 0);  // setSaturation = false
    assert.equal(payload[23], 1);  // setBrightness = true
    assert.equal(payload[24], 0);  // setKelvin = false
  });

  test('encodeSetInfrared', () => {
    const payload = Encoding.encodeSetInfrared(16384);
    const view = new DataView(payload.buffer);
    
    assert.equal(payload.length, 2);
    assert.equal(view.getUint16(0, true), 16384);
  });

  test('encodeSetHevCycle', () => {
    const payload = Encoding.encodeSetHevCycle(true, 3600);
    const view = new DataView(payload.buffer);
    
    assert.equal(payload.length, 5);
    assert.equal(view.getUint8(0), 1);
    assert.equal(view.getUint32(1, true), 3600);
  });

  test('encodeSetHevCycleConfiguration', () => {
    const payload = Encoding.encodeSetHevCycleConfiguration(false, 7200);
    const view = new DataView(payload.buffer);
    
    assert.equal(payload.length, 5);
    assert.equal(view.getUint8(0), 0);
    assert.equal(view.getUint32(1, true), 7200);
  });

  test('encodeGetRPower', () => {
    const payload = Encoding.encodeGetRPower(3);
    const view = new DataView(payload.buffer);
    
    assert.equal(payload.length, 1);
    assert.equal(view.getUint8(0), 3);
  });

  test('encodeSetRPower', () => {
    const payload = Encoding.encodeSetRPower(2, 45000);
    const view = new DataView(payload.buffer);
    
    assert.equal(payload.length, 3);
    assert.equal(view.getUint8(0), 2);
    assert.equal(view.getUint16(1, true), 45000);
  });

  test('encodeGet64', () => {
    const payload = Encoding.encodeGet64(1, 8, 2, 3, 8);
    const view = new DataView(payload.buffer);
    
    assert.equal(payload.length, 6);
    assert.equal(view.getUint8(0), 1);  // tileIndex
    assert.equal(view.getUint8(1), 8);  // length
    assert.equal(view.getUint8(2), 0);  // reserved
    assert.equal(view.getUint8(3), 2);  // x
    assert.equal(view.getUint8(4), 3);  // y
    assert.equal(view.getUint8(5), 8);  // width
  });

  test('encodeGetColorZones', () => {
    const payload = Encoding.encodeGetColorZones(0, 15);
    const view = new DataView(payload.buffer);
    
    assert.equal(payload.length, 2);
    assert.equal(view.getUint8(0), 0);   // startIndex
    assert.equal(view.getUint8(1), 15);  // endIndex
  });

  test('encodeSetColorZones', () => {
    const payload = Encoding.encodeSetColorZones(
      5,     // startIndex
      10,    // endIndex
      180,   // hue
      65535, // saturation
      32768, // brightness
      4000,  // kelvin
      1500,  // duration
      1      // apply
    );
    
    assert.equal(payload.length, 15);
    
    const view = new DataView(payload.buffer);
    assert.equal(view.getUint8(0), 5);     // startIndex
    assert.equal(view.getUint8(1), 10);    // endIndex
    assert.equal(view.getUint16(2, true), 180);    // hue
    assert.equal(view.getUint16(4, true), 65535);  // saturation
    assert.equal(view.getUint16(6, true), 32768);  // brightness
    assert.equal(view.getUint16(8, true), 4000);   // kelvin
    assert.equal(view.getUint32(10, true), 1500);  // duration
    assert.equal(view.getUint8(14), 1);    // apply
  });

  test('encodeSetMultiZoneEffect', () => {
    const parameters = new Uint8Array(32);
    parameters.set([1, 2, 3, 4, 5], 0);
    
    const payload = Encoding.encodeSetMultiZoneEffect(
      12345,     // instanceId
      2,         // effectType
      1000,      // speed
      5000n,     // duration
      parameters // parameters
    );
    
    assert.equal(payload.length, 59);
    
    const view = new DataView(payload.buffer);
    assert.equal(view.getUint32(0, true), 12345);      // instanceId
    assert.equal(view.getUint8(4), 2);                 // effectType
    assert.equal(view.getUint8(5), 0);                 // reserved
    assert.equal(view.getUint8(6), 0);                 // reserved
    assert.equal(view.getUint32(7, true), 1000);       // speed
    assert.equal(view.getBigUint64(11, true), 5000n);  // duration
    assert.equal(view.getUint32(19, true), 0);         // reserved
    assert.equal(view.getUint32(23, true), 0);         // reserved
    assert.deepEqual(payload.subarray(27, 32), new Uint8Array([1, 2, 3, 4, 5]));
  });

  test('encodeSetExtendedColorZones', () => {
    const colors = [
      { hue: 120, saturation: 65535, brightness: 32768, kelvin: 3500 },
      { hue: 240, saturation: 50000, brightness: 40000, kelvin: 2700 }
    ];
    
    const payload = Encoding.encodeSetExtendedColorZones(
      2000,  // duration
      1,     // apply
      0,     // zoneIndex
      colors // colors
    );
    
    assert.equal(payload.length, 664);
    
    const view = new DataView(payload.buffer);
    assert.equal(view.getUint32(0, true), 2000);  // duration
    assert.equal(view.getUint8(4), 1);            // apply
    assert.equal(view.getUint16(5, true), 0);     // zoneIndex
    assert.equal(view.getUint8(7), 2);            // colorsCount, derived from colors.length
    
    // Check first color
    assert.equal(view.getUint16(8, true), 120);    // hue
    assert.equal(view.getUint16(10, true), 65535); // saturation
    assert.equal(view.getUint16(12, true), 32768); // brightness
    assert.equal(view.getUint16(14, true), 3500);  // kelvin
    
    // Check second color
    assert.equal(view.getUint16(16, true), 240);   // hue
    assert.equal(view.getUint16(18, true), 50000); // saturation
    assert.equal(view.getUint16(20, true), 40000); // brightness
    assert.equal(view.getUint16(22, true), 2700);  // kelvin
  });

  test('encodeSetUserPosition', () => {
    const payload = Encoding.encodeSetUserPosition(1, 1.5, 2.5);
    const view = new DataView(payload.buffer);
    
    assert.equal(payload.length, 11);
    assert.equal(view.getUint8(0), 1);               // tileIndex
    assert.equal(view.getUint8(1), 0);               // reserved
    assert.equal(view.getUint8(2), 0);               // reserved
    assert.equal(view.getFloat32(3, true), 1.5);    // userX
    assert.equal(view.getFloat32(7, true), 2.5);    // userY
  });

  test('encodeSet64', () => {
    const colors = [
      { hue: 60, saturation: 30000, brightness: 25000, kelvin: 5000 },
      { hue: 180, saturation: 40000, brightness: 35000, kelvin: 3000 }
    ];
    
    const payload = Encoding.encodeSet64(
      2,     // tileIndex
      64,    // length
      1,     // x
      2,     // y
      8,     // width
      1000,  // duration
      colors // colors
    );
    
    assert.equal(payload.length, 522);
    
    const view = new DataView(payload.buffer);
    assert.equal(view.getUint8(0), 2);               // tileIndex
    assert.equal(view.getUint8(1), 64);              // length
    assert.equal(view.getUint8(2), 0);               // reserved
    assert.equal(view.getUint8(3), 1);               // x
    assert.equal(view.getUint8(4), 2);               // y
    assert.equal(view.getUint8(5), 8);               // width
    assert.equal(view.getUint32(6, true), 1000);     // duration
    
    // Check first color
    assert.equal(view.getUint16(10, true), 60);      // hue
    assert.equal(view.getUint16(12, true), 30000);   // saturation
    assert.equal(view.getUint16(14, true), 25000);   // brightness
    assert.equal(view.getUint16(16, true), 5000);    // kelvin
    
    // Check second color
    assert.equal(view.getUint16(18, true), 180);     // hue
    assert.equal(view.getUint16(20, true), 40000);   // saturation
    assert.equal(view.getUint16(22, true), 35000);   // brightness
    assert.equal(view.getUint16(24, true), 3000);    // kelvin
  });

  test('encodeGetTileEffect', () => {
    const payload = Encoding.encodeGetTileEffect();
    
    assert.equal(payload.length, 2);
    assert.equal(payload[0], 0);  // reserved6
    assert.equal(payload[1], 0);  // reserved7
  });

  test('encodeSetTileEffect', () => {
    const palette = [
      { hue: 30, saturation: 20000, brightness: 15000, kelvin: 6500 },
      { hue: 90, saturation: 25000, brightness: 20000, kelvin: 4000 }
    ];
    
    const payload = Encoding.encodeSetTileEffect(
      98765,  // instanceId
      3,      // effectType
      2000,   // speed
      10000n, // duration
      1,      // skyType
      50,     // cloudSaturationMin
      180,    // cloudSaturationMax
      palette // palette
    );
    
    assert.equal(payload.length, 188);
    
    const view = new DataView(payload.buffer);
    assert.equal(view.getUint8(0), 0);                 // reserved0
    assert.equal(view.getUint8(1), 0);                 // reserved1
    assert.equal(view.getUint32(2, true), 98765);      // instanceId
    assert.equal(view.getUint8(6), 3);                 // effectType
    assert.equal(view.getUint32(7, true), 2000);       // speed
    assert.equal(view.getBigUint64(11, true), 10000n); // duration
    assert.equal(view.getUint32(19, true), 0);         // reserved2
    assert.equal(view.getUint32(23, true), 0);         // reserved3
    assert.equal(view.getUint8(27), 1);                // skyType
    assert.equal(view.getUint8(31), 50);               // cloudSaturationMin
    assert.equal(view.getUint8(35), 180);              // cloudSaturationMax
    assert.equal(view.getUint8(59), 2);                // paletteCount, derived from palette.length
    
    // Check first palette color
    assert.equal(view.getUint16(60, true), 30);        // hue
    assert.equal(view.getUint16(62, true), 20000);     // saturation
    assert.equal(view.getUint16(64, true), 15000);     // brightness
    assert.equal(view.getUint16(66, true), 6500);      // kelvin
    
    // Check second palette color
    assert.equal(view.getUint16(68, true), 90);        // hue
    assert.equal(view.getUint16(70, true), 25000);     // saturation
    assert.equal(view.getUint16(72, true), 20000);     // brightness
    assert.equal(view.getUint16(74, true), 4000);      // kelvin
  });

  // Test edge cases for string encoding

  test('encodeString without null terminator when string fills buffer', () => {
    // Exactly fills the field: no room, and no need, for a terminator.
    assert.deepEqual(Encoding.encodeString('test', 4), new Uint8Array([0x74, 0x65, 0x73, 0x74])); // 'test'
  });

  test('encodeString with exact length match', () => {
    const bytes = Encoding.encodeString('hello', 5);

    // Should not have null terminator since string exactly fills buffer
    assert.deepEqual(bytes, new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f])); // 'hello'
  });

  test('encodeString with multi-byte UTF-8 characters places null terminator after bytes, not code units', () => {
    // 'café' is 4 code units in UTF-16 but 5 bytes in UTF-8 (c=0x63, a=0x61, f=0x66, é=0xc3 0xa9)
    const bytes = Encoding.encodeString('café', 8);
    assert.deepEqual(bytes.subarray(0, 5), new Uint8Array([0x63, 0x61, 0x66, 0xc3, 0xa9]));
    // Null terminator should follow the encoded bytes, not the code-unit length
    assert.equal(bytes[5], 0);
  });

  test('encodeString does not write past byteLength when input is too long', () => {
    // 'hello world' is 11 bytes; field is only 5 bytes
    const bytes = Encoding.encodeString('hello world', 5);
    assert.deepEqual(bytes, new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]));
  });

  test('an over-long label is truncated to its field and never spills into the next one', () => {
    const label = 'x'.repeat(40); // the label field is 32 bytes
    const payload = Encoding.encodeSetGroup(UUID, label, DATE);
    assert.deepEqual(payload.subarray(16, 48), new Uint8Array(32).fill(0x78));
    // The timestamp that follows is intact.
    assert.equal(new DataView(payload.buffer).getBigUint64(48, true), BigInt(DATE.getTime()) * 1000000n);
    // And it round-trips as the truncated label.
    assert.equal(Encoding.decodeStateGroup(payload).label, 'x'.repeat(32));
  });

  test('encodeString never writes part of a multi-byte character', () => {
    // 'café' needs 5 bytes; in a 4-byte field the 2-byte 'é' does not fit,
    // so it is dropped whole and the freed byte is the terminator.
    assert.deepEqual(Encoding.encodeString('café', 4), new Uint8Array([0x63, 0x61, 0x66, 0x00]));
  });

  test('SetLocation/SetGroup reject malformed UUIDs', () => {
    assertInvalid(() => Encoding.encodeSetGroup('4e0352bf-XXXX-4ff2-b425-1c4455479f33', 'x', DATE), 'uuid');
    assertInvalid(() => Encoding.encodeSetGroup('too-short', 'x', DATE), 'uuid');
    assertInvalid(() => Encoding.encodeSetLocation('4e0352bf-XXXX-4ff2-b425-1c4455479f33', 'x', DATE), 'uuid');
    assertInvalid(() => Encoding.encodeSetLocation(`${UUID}00`, 'x', DATE), 'uuid');
  });

  test('decodeHeader throws on packet shorter than 36 bytes', () => {
    const tooShort = new Uint8Array(20);
    assert.throws(() => Encoding.decodeHeader(tooShort), DecodeError);
    assert.throws(() => Encoding.decodeHeader(tooShort), /at least 36 bytes for its header, got 20/);
    // Also when the offset leaves fewer than 36 bytes, or is negative.
    assert.throws(() => Encoding.decodeHeader(new Uint8Array(40), 5), DecodeError);
    assert.throws(() => Encoding.decodeHeader(new Uint8Array(40), -1), DecodeError);
  });

  test('decodeHeader throws when declared size exceeds buffer', () => {
    const message = new Uint8Array(36);
    new DataView(message.buffer).setUint16(0, 1000, true);
    assert.throws(() => Encoding.decodeHeader(message), DecodeError);
    assert.throws(() => Encoding.decodeHeader(message), /header size field 1000 is out of range/);
  });

  test('decodeHeader throws when declared size is smaller than a header', () => {
    const message = new Uint8Array(36);
    message[0] = 35;
    assert.throws(() => Encoding.decodeHeader(message), DecodeError);
    assert.throws(() => Encoding.decodeHeader(message), /header size field 35 is out of range/);
  });

  test('decodeHeader errors are DecodeError, not ValidationError', () => {
    // A malformed datagram is network input, not the caller's bad argument.
    try {
      Encoding.decodeHeader(new Uint8Array(3));
      assert.fail('expected decodeHeader to throw');
    } catch (err) {
      assert.ok(err instanceof DecodeError);
      assert.ok(!(err instanceof ValidationError));
      assert.equal(err.context['available'], 3);
    }
  });

  test('decodeHeader rejects oversized declared size when bytes is a subarray of a larger buffer', () => {
    // Hostile case: bytes is a 36-byte subarray of a 1000-byte buffer.
    // Without DataView bounded by byteLength, the size check could pass and
    // downstream reads would access bytes past the subarray.
    const big = new Uint8Array(1000);
    const view = new DataView(big.buffer);
    view.setUint16(0, 500, true); // claim size = 500 bytes
    const subarray = big.subarray(0, 36);
    assert.throws(() => Encoding.decodeHeader(subarray), /header size field 500 is out of range/);
  });

  test('encodeString with multi-byte UTF-8 string that exactly fills byteLength does not write null terminator', () => {
    // 'café' is 5 bytes in UTF-8 — exactly fills the 5-byte field
    assert.deepEqual(Encoding.encodeString('café', 5), new Uint8Array([0x63, 0x61, 0x66, 0xc3, 0xa9]));
  });
});

/**
 * Every numeric field an encoder writes is range-checked by its wire width.
 * A typed-array store wraps out-of-range values instead of failing, so
 * without the checks `brightness: -1` would encode as full brightness and
 * `startIndex: 256` as zone 0.
 */
describe('encoder field validation', () => {
  const u16 = (payload: Uint8Array, offset: number) => new DataView(payload.buffer).getUint16(offset, true);
  const u32 = (payload: Uint8Array, offset: number) => new DataView(payload.buffer).getUint32(offset, true);

  describe('uint16 magnitudes', () => {
    const fields: Array<{ parameter: string; encode: (value: number) => Uint8Array; offset: number }> = [
      { parameter: 'hue', encode: (v) => Encoding.encodeSetColor(v, 0, 0, 3500, 0), offset: 1 },
      { parameter: 'saturation', encode: (v) => Encoding.encodeSetColor(0, v, 0, 3500, 0), offset: 3 },
      { parameter: 'brightness', encode: (v) => Encoding.encodeSetColor(0, 0, v, 3500, 0), offset: 5 },
      { parameter: 'kelvin', encode: (v) => Encoding.encodeSetColor(0, 0, 0, v, 0), offset: 7 },
      { parameter: 'power', encode: (v) => Encoding.encodeSetPower(v), offset: 0 },
      { parameter: 'level', encode: (v) => Encoding.encodeSetLightPower(v, 0), offset: 0 },
      { parameter: 'level', encode: (v) => Encoding.encodeSetRPower(0, v), offset: 1 },
      { parameter: 'brightness', encode: (v) => Encoding.encodeSetInfrared(v), offset: 0 },
      { parameter: 'hue', encode: (v) => Encoding.encodeSetWaveform(false, v, 0, 0, 3500, 0, 1, 0, 0), offset: 2 },
      { parameter: 'kelvin', encode: (v) => Encoding.encodeSetWaveform(false, 0, 0, 0, v, 0, 1, 0, 0), offset: 8 },
      { parameter: 'saturation', encode: (v) => Encoding.encodeSetWaveformOptional(false, 0, v, 0, 3500, 0, 1, 0, 0, true, true, true, true), offset: 4 },
      { parameter: 'brightness', encode: (v) => Encoding.encodeSetColorZones(0, 7, 0, 0, v, 3500, 0, 1), offset: 6 },
      { parameter: 'hue', encode: (v) => Encoding.encodeSetExtendedColorZones(0, 1, 0, [{ ...COLOR, hue: v }]), offset: 8 },
      { parameter: 'saturation', encode: (v) => Encoding.encodeSet64(0, 1, 0, 0, 8, 0, [{ ...COLOR, saturation: v }]), offset: 12 },
      { parameter: 'kelvin', encode: (v) => Encoding.encodeSetTileEffect(1, 2, 0, 0n, 0, 0, 0, [{ ...COLOR, kelvin: v }]), offset: 66 },
    ];

    for (const [i, { parameter, encode, offset }] of fields.entries()) {
      test(`#${i} ${parameter}: rejects out-of-range and NaN, accepts both ends`, () => {
        for (const bad of [-1, -0.5, 65536, 65535.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
          assertInvalid(() => encode(bad), parameter);
        }
        assert.equal(u16(encode(0), offset), 0);
        assert.equal(u16(encode(65535), offset), 65535);
        assert.equal(u16(encode(0x1234), offset), 0x1234);
      });

      test(`#${i} ${parameter}: a fractional value truncates toward zero`, () => {
        // A computed hue rarely lands on an integer; truncating matches
        // what DataView.setUint16 does.
        assert.equal(u16(encode(1.9), offset), 1);
        assert.equal(u16(encode(65534.9), offset), 65534);
        assert.equal(u16(encode(0.9), offset), 0);
      });
    }

    test('the documented wrap cases now throw', () => {
      // Before: hue wrapped to 4464, brightness to 65535, kelvin to 0.
      assertInvalid(() => Encoding.encodeSetColor(70000, 0, 0, 3500, 0), 'hue');
      assertInvalid(() => Encoding.encodeSetColor(0, 0, -1, 3500, 0), 'brightness');
      assertInvalid(() => Encoding.encodeSetColor(0, 0, 0, Number.NaN, 0), 'kelvin');
    });

    test('a boolean power is the on/off pair on every power encoder', () => {
      assert.equal(u16(Encoding.encodeSetPower(true), 0), 65535);
      assert.equal(u16(Encoding.encodeSetLightPower(false, 0), 0), 0);
      assert.equal(u16(Encoding.encodeSetRPower(3, true), 1), 65535);
      assert.equal(u16(Encoding.encodeSetRPower(3, false), 1), 0);
    });
  });

  describe('uint8 indices, counts, and enums', () => {
    const fields: Array<{ parameter: string; encode: (value: number) => Uint8Array; offset: number }> = [
      { parameter: 'relayIndex', encode: (v) => Encoding.encodeGetRPower(v), offset: 0 },
      { parameter: 'relayIndex', encode: (v) => Encoding.encodeSetRPower(v, 0), offset: 0 },
      { parameter: 'tileIndex', encode: (v) => Encoding.encodeGet64(v, 1, 0, 0, 8), offset: 0 },
      { parameter: 'tileCount', encode: (v) => Encoding.encodeGet64(0, v, 0, 0, 8), offset: 1 },
      { parameter: 'x', encode: (v) => Encoding.encodeGet64(0, 1, v, 0, 8), offset: 3 },
      { parameter: 'y', encode: (v) => Encoding.encodeGet64(0, 1, 0, v, 8), offset: 4 },
      { parameter: 'width', encode: (v) => Encoding.encodeGet64(0, 1, 0, 0, v), offset: 5 },
      { parameter: 'startIndex', encode: (v) => Encoding.encodeGetColorZones(v, 0), offset: 0 },
      { parameter: 'endIndex', encode: (v) => Encoding.encodeGetColorZones(0, v), offset: 1 },
      { parameter: 'startIndex', encode: (v) => Encoding.encodeSetColorZones(v, 7, 0, 0, 0, 3500, 0, 1), offset: 0 },
      { parameter: 'endIndex', encode: (v) => Encoding.encodeSetColorZones(0, v, 0, 0, 0, 3500, 0, 1), offset: 1 },
      // @ts-expect-error -- an untyped caller passing a number outside the enum
      { parameter: 'apply', encode: (v) => Encoding.encodeSetColorZones(0, 7, 0, 0, 0, 3500, 0, v), offset: 14 },
      // @ts-expect-error -- an untyped caller passing a number outside the enum
      { parameter: 'apply', encode: (v) => Encoding.encodeSetExtendedColorZones(0, v, 0, [COLOR]), offset: 4 },
      // @ts-expect-error -- an untyped caller passing a number outside the enum
      { parameter: 'waveform', encode: (v) => Encoding.encodeSetWaveform(false, 0, 0, 0, 3500, 0, 1, 0, v), offset: 20 },
      // @ts-expect-error -- an untyped caller passing a number outside the enum
      { parameter: 'waveform', encode: (v) => Encoding.encodeSetWaveformOptional(false, 0, 0, 0, 3500, 0, 1, 0, v, true, true, true, true), offset: 20 },
      // @ts-expect-error -- an untyped caller passing a number outside the enum
      { parameter: 'effectType', encode: (v) => Encoding.encodeSetMultiZoneEffect(1, v, 0, 0n, new Uint8Array(0)), offset: 4 },
      // @ts-expect-error -- an untyped caller passing a number outside the enum
      { parameter: 'effectType', encode: (v) => Encoding.encodeSetTileEffect(1, v, 0, 0n, 0, 0, 0, []), offset: 6 },
      // @ts-expect-error -- an untyped caller passing a number outside the enum
      { parameter: 'skyType', encode: (v) => Encoding.encodeSetTileEffect(1, 2, 0, 0n, v, 0, 0, []), offset: 27 },
      { parameter: 'tileIndex', encode: (v) => Encoding.encodeSetUserPosition(v, 0, 0), offset: 0 },
      { parameter: 'tileIndex', encode: (v) => Encoding.encodeSet64(v, 1, 0, 0, 8, 0, []), offset: 0 },
      { parameter: 'tileCount', encode: (v) => Encoding.encodeSet64(0, v, 0, 0, 8, 0, []), offset: 1 },
      { parameter: 'x', encode: (v) => Encoding.encodeSet64(0, 1, v, 0, 8, 0, []), offset: 3 },
      { parameter: 'y', encode: (v) => Encoding.encodeSet64(0, 1, 0, v, 8, 0, []), offset: 4 },
      { parameter: 'width', encode: (v) => Encoding.encodeSet64(0, 1, 0, 0, v, 0, []), offset: 5 },
    ];

    for (const [i, { parameter, encode, offset }] of fields.entries()) {
      test(`#${i} ${parameter}: must be an integer between 0 and 255`, () => {
        // Unlike a magnitude, half an index is a bug, not a rounding matter.
        for (const bad of [-1, 256, 1.5, 0.5, 254.5, Number.NaN, Number.POSITIVE_INFINITY]) {
          assertInvalid(() => encode(bad), parameter);
        }
        assert.equal(encode(0)[offset], 0);
        assert.equal(encode(255)[offset], 255);
        assert.equal(encode(7)[offset], 7);
      });
    }

    test('the documented wrap case now throws', () => {
      // Before: startIndex 300 encoded as zone 44.
      assertInvalid(() => Encoding.encodeSetColorZones(300, 7, 0, 0, 0, 3500, 0, 1), 'startIndex');
    });
  });

  describe('uint8 magnitudes', () => {
    test('cloud saturation rejects out-of-range and NaN, truncates fractions', () => {
      const min = (v: number) => Encoding.encodeSetTileEffect(1, 5, 0, 0n, 2, v, 0, []);
      const max = (v: number) => Encoding.encodeSetTileEffect(1, 5, 0, 0n, 2, 0, v, []);
      for (const bad of [-1, 256, 255.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assertInvalid(() => min(bad), 'cloudSaturationMin');
        assertInvalid(() => max(bad), 'cloudSaturationMax');
      }
      assert.equal(min(255)[31], 255);
      assert.equal(max(255)[35], 255);
      assert.equal(min(50.9)[31], 50);
      assert.equal(max(0.9)[35], 0);
    });
  });

  describe('extended zone index (uint16 index)', () => {
    const encode = (zoneIndex: number) => Encoding.encodeSetExtendedColorZones(0, 1, zoneIndex, [COLOR]);

    test('must be an integer between 0 and 65535', () => {
      for (const bad of [-1, 65536, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assertInvalid(() => encode(bad), 'zoneIndex');
      }
      assert.equal(u16(encode(0), 5), 0);
      assert.equal(u16(encode(65535), 5), 65535);
      assert.equal(u16(encode(300), 5), 300);
    });
  });

  describe('int16', () => {
    const encode = (skewRatio: number) => Encoding.encodeSetWaveform(false, 0, 0, 0, 3500, 0, 1, skewRatio, 0);
    const i16 = (payload: Uint8Array) => new DataView(payload.buffer).getInt16(18, true);

    test('skewRatio rejects out-of-range and NaN, accepts both ends', () => {
      for (const bad of [-32769, 32768, 65535, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        assertInvalid(() => encode(bad), 'skewRatio');
        assertInvalid(() => Encoding.encodeSetWaveformOptional(false, 0, 0, 0, 3500, 0, 1, bad, 0, true, true, true, true), 'skewRatio');
      }
      assert.equal(i16(encode(-32768)), -32768);
      assert.equal(i16(encode(32767)), 32767);
      assert.equal(i16(encode(0)), 0);
      assert.equal(i16(encode(-1)), -1);
      assert.equal(i16(encode(-12345)), -12345);
      assert.equal(i16(encode(12345)), 12345);
    });

    test('a fractional skewRatio truncates toward zero', () => {
      assert.equal(i16(encode(-1.5)), -1);
      assert.equal(i16(encode(1.9)), 1);
      assert.equal(i16(encode(-0.5)), 0);
      assert.equal(i16(encode(-300.7)), -300);
    });
  });

  describe('uint32', () => {
    const fields: Array<{ parameter: string; encode: (value: number) => Uint8Array; offset: number }> = [
      { parameter: 'durationMs', encode: (v) => Encoding.encodeSetColor(0, 0, 0, 3500, v), offset: 9 },
      { parameter: 'durationMs', encode: (v) => Encoding.encodeSetLightPower(true, v), offset: 2 },
      { parameter: 'durationMs', encode: (v) => Encoding.encodeSetColorZones(0, 7, 0, 0, 0, 3500, v, 1), offset: 10 },
      { parameter: 'durationMs', encode: (v) => Encoding.encodeSetExtendedColorZones(v, 1, 0, [COLOR]), offset: 0 },
      { parameter: 'durationMs', encode: (v) => Encoding.encodeSet64(0, 1, 0, 0, 8, v, []), offset: 6 },
      { parameter: 'periodMs', encode: (v) => Encoding.encodeSetWaveform(false, 0, 0, 0, 3500, v, 1, 0, 0), offset: 10 },
      { parameter: 'periodMs', encode: (v) => Encoding.encodeSetWaveformOptional(false, 0, 0, 0, 3500, v, 1, 0, 0, true, true, true, true), offset: 10 },
      { parameter: 'durationSeconds', encode: (v) => Encoding.encodeSetHevCycle(true, v), offset: 1 },
      { parameter: 'durationSeconds', encode: (v) => Encoding.encodeSetHevCycleConfiguration(true, v), offset: 1 },
      { parameter: 'instanceId', encode: (v) => Encoding.encodeSetMultiZoneEffect(v, 1, 0, 0n, new Uint8Array(0)), offset: 0 },
      { parameter: 'speedMs', encode: (v) => Encoding.encodeSetMultiZoneEffect(1, 1, v, 0n, new Uint8Array(0)), offset: 7 },
      { parameter: 'instanceId', encode: (v) => Encoding.encodeSetTileEffect(v, 2, 0, 0n, 0, 0, 0, []), offset: 2 },
      { parameter: 'speedMs', encode: (v) => Encoding.encodeSetTileEffect(1, 2, v, 0n, 0, 0, 0, []), offset: 7 },
    ];

    for (const [i, { parameter, encode, offset }] of fields.entries()) {
      test(`#${i} ${parameter}: rejects out-of-range and NaN, accepts both ends`, () => {
        for (const bad of [-1, 2 ** 32, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
          assertInvalid(() => encode(bad), parameter);
        }
        assert.equal(u32(encode(0), offset), 0);
        assert.equal(u32(encode(0xFFFFFFFF), offset), 0xFFFFFFFF);
        assert.equal(u32(encode(0x12345678), offset), 0x12345678);
        // The top bit must survive the 32-bit shifts.
        assert.equal(u32(encode(0x80000000), offset), 0x80000000);
        // Fractions truncate toward zero.
        assert.equal(u32(encode(1000.7), offset), 1000);
      });
    }
  });

  describe('uint64', () => {
    test('durationNs must be a bigint in range', () => {
      const multi = (v: bigint) => Encoding.encodeSetMultiZoneEffect(1, 1, 0, v, new Uint8Array(0));
      const tile = (v: bigint) => Encoding.encodeSetTileEffect(1, 2, 0, v, 0, 0, 0, []);
      for (const bad of [-1n, 2n ** 64n]) {
        assertInvalid(() => multi(bad), 'durationNs');
        assertInvalid(() => tile(bad), 'durationNs');
      }
      const value = 0x0102030405060708n;
      assert.equal(new DataView(multi(value).buffer).getBigUint64(11, true), value);
      assert.equal(new DataView(tile(value).buffer).getBigUint64(11, true), value);
    });
  });

  describe('float32', () => {
    test('cycles must be a finite number', () => {
      const encode = (cycles: number) => Encoding.encodeSetWaveform(false, 0, 0, 0, 3500, 0, cycles, 0, 0);
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        assertInvalid(() => encode(bad), 'cycles');
        assertInvalid(() => Encoding.encodeSetWaveformOptional(false, 0, 0, 0, 3500, 0, bad, 0, 0, true, true, true, true), 'cycles');
      }
      const view = (payload: Uint8Array) => new DataView(payload.buffer).getFloat32(14, true);
      assert.equal(view(encode(2.5)), 2.5);
      assert.equal(view(encode(0)), 0);
      // Unlike the integer fields, a float may be negative or fractional.
      assert.equal(view(encode(-0.25)), -0.25);
    });

    test('user position must be finite numbers', () => {
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        assertInvalid(() => Encoding.encodeSetUserPosition(0, bad, 0), 'userX');
        assertInvalid(() => Encoding.encodeSetUserPosition(0, 0, bad), 'userY');
      }
      const payload = Encoding.encodeSetUserPosition(0, -1.5, 0.25);
      const view = new DataView(payload.buffer);
      assert.equal(view.getFloat32(3, true), -1.5);
      assert.equal(view.getFloat32(7, true), 0.25);
    });

    test('an untyped non-number is rejected, not coerced', () => {
      // @ts-expect-error -- an untyped caller passing a numeric string
      assertInvalid(() => Encoding.encodeSetUserPosition(0, '1.5', 0), 'userX');
      // @ts-expect-error -- an untyped caller omitting cycles
      assertInvalid(() => Encoding.encodeSetWaveform(false, 0, 0, 0, 3500, 0, undefined, 0, 0), 'cycles');
    });
  });

  describe('length limits', () => {
    test('effect parameters hold at most 32 bytes and are zero-padded', () => {
      const full = Encoding.encodeSetMultiZoneEffect(1, 1, 0, 0n, new Uint8Array(32).fill(0xaa));
      assert.equal(full.length, 59);
      assert.deepEqual(full.subarray(27, 59), new Uint8Array(32).fill(0xaa));

      const short = Encoding.encodeSetMultiZoneEffect(1, 1, 0, 0n, new Uint8Array([1, 2, 3]));
      assert.deepEqual(short.subarray(27, 30), new Uint8Array([1, 2, 3]));
      assert.deepEqual(short.subarray(30, 59), new Uint8Array(29));

      const none = Encoding.encodeSetMultiZoneEffect(1, 1, 0, 0n, new Uint8Array(0));
      assert.deepEqual(none.subarray(27, 59), new Uint8Array(32));

      // Before, a longer block was silently truncated.
      assert.throws(
        () => Encoding.encodeSetMultiZoneEffect(1, 1, 0, 0n, new Uint8Array(33)),
        (err: unknown) => err instanceof ValidationError && err.parameter === 'parameters' && err.value === 33,
      );
    });

    test('SetExtendedColorZones carries between 1 and 82 colors', () => {
      const colors = (n: number) => Array.from({ length: n }, () => COLOR);
      assert.throws(
        () => Encoding.encodeSetExtendedColorZones(0, 1, 0, []),
        (err: unknown) => err instanceof ValidationError && err.parameter === 'colors' && err.value === 0,
      );
      assert.throws(
        () => Encoding.encodeSetExtendedColorZones(0, 1, 0, colors(83)),
        (err: unknown) => err instanceof ValidationError && err.parameter === 'colors' && err.value === 83,
      );

      const one = Encoding.encodeSetExtendedColorZones(0, 1, 0, colors(1));
      assert.equal(one.length, 664);
      assert.equal(one[7], 1, 'colors_count');

      const full = Encoding.encodeSetExtendedColorZones(0, 1, 0, colors(82));
      assert.equal(full.length, 664);
      assert.equal(full[7], 82, 'colors_count');
      // The last color lands in the last slot.
      assert.equal(new DataView(full.buffer).getUint16(8 + 81 * 8 + 6, true), 3500);
    });

    test('Set64 carries at most 64 colors', () => {
      const colors = (n: number) => Array.from({ length: n }, () => COLOR);
      assert.throws(
        () => Encoding.encodeSet64(0, 1, 0, 0, 8, 0, colors(65)),
        (err: unknown) => err instanceof ValidationError && err.parameter === 'colors' && err.value === 65,
      );

      const full = Encoding.encodeSet64(0, 1, 0, 0, 8, 0, colors(64));
      assert.equal(full.length, 522);
      assert.equal(new DataView(full.buffer).getUint16(10 + 63 * 8 + 6, true), 3500);

      // Fewer colors leave the remaining pixels zero.
      const partial = Encoding.encodeSet64(0, 1, 0, 0, 8, 0, colors(1));
      assert.deepEqual(partial.subarray(18), new Uint8Array(504));
      assert.deepEqual(Encoding.encodeSet64(0, 1, 0, 0, 8, 0, []).subarray(10), new Uint8Array(512));
    });

    test('SetTileEffect carries at most 16 palette colors', () => {
      const colors = (n: number) => Array.from({ length: n }, () => COLOR);
      assert.throws(
        () => Encoding.encodeSetTileEffect(1, 2, 0, 0n, 0, 0, 0, colors(17)),
        (err: unknown) => err instanceof ValidationError && err.parameter === 'palette' && err.value === 17,
      );

      const full = Encoding.encodeSetTileEffect(1, 2, 0, 0n, 0, 0, 0, colors(16));
      assert.equal(full.length, 188);
      assert.equal(full[59], 16, 'palette_count');
      assert.equal(new DataView(full.buffer).getUint16(60 + 15 * 8 + 6, true), 3500);

      const empty = Encoding.encodeSetTileEffect(1, 2, 0, 0n, 0, 0, 0, []);
      assert.equal(empty[59], 0, 'palette_count');
      assert.deepEqual(empty.subarray(60), new Uint8Array(128));
    });

    test('a missing entry in a color list stays zero', () => {
      const sparse: Color[] = [];
      sparse[1] = COLOR; // index 0 is a hole
      const payload = Encoding.encodeSet64(0, 1, 0, 0, 8, 0, sparse);
      assert.deepEqual(payload.subarray(10, 18), new Uint8Array(8));
      assert.equal(new DataView(payload.buffer).getUint16(18, true), COLOR.hue);
    });

    test('an invalid component anywhere in a color list is rejected', () => {
      const colors = Array.from({ length: 10 }, () => COLOR);
      colors[9] = { ...COLOR, brightness: 65536 };
      assertInvalid(() => Encoding.encodeSetExtendedColorZones(0, 1, 0, colors), 'brightness');
      assertInvalid(() => Encoding.encodeSet64(0, 1, 0, 0, 8, 0, colors), 'brightness');
      assertInvalid(() => Encoding.encodeSetTileEffect(1, 2, 0, 0n, 0, 0, 0, colors), 'brightness');
    });
  });

  test('a float32 field rejects a finite double that overflows to Infinity', () => {
    // 1e40 is finite as a double but past the float32 range.
    assert.throws(() => Encoding.encodeSetWaveform(false, 0, 0, 0, 3500, 0, 1e40, 0, 0), ValidationError);
    assert.throws(() => Encoding.encodeSetUserPosition(0, -1e40, 0), ValidationError);
    assert.throws(() => Encoding.encodeSetUserPosition(0, 0, 1e40), ValidationError);
    // The largest float32 itself still encodes.
    assert.doesNotThrow(() => Encoding.encodeSetUserPosition(0, 3.4028234663852886e38, 0));
  });

  test('numeric fields reject non-numbers from untyped callers instead of coercing them', () => {
    // A bigint would throw a bare TypeError from the typed-array store, and
    // a string or boolean would be silently coerced ('300' to 300, true to 1).
    // @ts-expect-error -- untyped caller passing a bigint
    assert.throws(() => Encoding.encodeSetColor(5n, 0, 0, 3500, 0), ValidationError);
    // @ts-expect-error -- untyped caller passing a string
    assert.throws(() => Encoding.encodeSetColor('300', 0, 0, 3500, 0), ValidationError);
    // @ts-expect-error -- untyped caller passing a boolean
    assert.throws(() => Encoding.encodeSetColor(0, true, 0, 3500, 0), ValidationError);
    // @ts-expect-error -- untyped caller passing a string duration
    assert.throws(() => Encoding.encodeSetColor(0, 0, 0, 3500, '1000'), ValidationError);
    // @ts-expect-error -- untyped caller passing a string index
    assert.throws(() => Encoding.encodeGetColorZones('0', 7), ValidationError);
    // @ts-expect-error -- untyped caller passing a string skew
    assert.throws(() => Encoding.encodeSetWaveform(false, 0, 0, 0, 3500, 0, 1, '0', 0), ValidationError);
    // @ts-expect-error -- untyped caller passing a string saturation
    assert.throws(() => Encoding.encodeSetTileEffect(1, 2, 0, 0n, 0, '5', 0, []), ValidationError);
    // Booleans remain valid where the API documents them.
    assert.doesNotThrow(() => Encoding.encodeSetPower(true));
    assert.doesNotThrow(() => Encoding.encodeSetRPower(0, false));
  });

  test('validation failures are ValidationError, not DecodeError', () => {
    try {
      Encoding.encodeSetColor(-1, 0, 0, 3500, 0);
      assert.fail('expected encodeSetColor to throw');
    } catch (err) {
      assert.ok(err instanceof ValidationError);
      assert.ok(!(err instanceof DecodeError));
      assert.equal(err.parameter, 'hue');
      assert.equal(err.value, -1);
    }
  });
});
