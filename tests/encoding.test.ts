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

    assert.equal(header.size, bytes.length);
    assert.equal(header.type, 2);
    assert.equal(header.protocol, 1024);
    assert.equal(header.addressable, true);
    assert.equal(header.tagged, true);
    assert.equal(header.origin, 0);
    assert.equal(header.source, 3381435545);
    assert.deepEqual(header.target, new Uint8Array([1, 2, 3, 4, 5, 6]));
    assert.equal(header.res_required, true);
    assert.equal(header.ack_required, false);
    assert.equal(header.reserved3, 0);
    assert.equal(header.sequence, 5);

    const encodedBytes = Encoding.encode(
      header.tagged,
      header.source,
      header.target,
      header.res_required,
      header.ack_required,
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

  test('decodeStateHostFirmware', () => {
    const bytes = new Uint8Array(20);
    const view = new DataView(bytes.buffer);
    
    // Set timestamp (8 bytes)
    const timestamp = BigInt(Date.now()) * 1000000n;
    view.setBigUint64(0, timestamp, true);
    
    // Skip reserved (8 bytes)
    
    // Set version_minor and version_major
    view.setUint16(16, 42, true); // version_minor
    view.setUint16(18, 1, true);  // version_major
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateHostFirmware(bytes, offsetRef);
    
    assert.equal(result.build.getTime(), Number(timestamp / 1000000n));
    assert.equal(result.reserved.length, 8);
    assert.equal(result.version_minor, 42);
    assert.equal(result.version_major, 1);
    assert.equal(offsetRef.current, 20);
  });

  test('decodeStateWifiInfo', () => {
    const bytes = new Uint8Array(14);
    const view = new DataView(bytes.buffer);
    view.setFloat32(0, -50.5, true); // signal
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateWifiInfo(bytes, offsetRef);
    
    assert.equal(result.signal, -50.5);
    assert.equal(result.reserved6.length, 4);
    assert.equal(result.reserved7.length, 4);
    assert.equal(result.reserved8.length, 2);
    assert.equal(offsetRef.current, 14);
  });

  test('decodeStateWifiFirmware', () => {
    const bytes = new Uint8Array(20);
    const view = new DataView(bytes.buffer);
    
    // Set timestamp (8 bytes)
    const timestamp = BigInt(Date.now()) * 1000000n;
    view.setBigUint64(0, timestamp, true);
    
    // Skip reserved6 (8 bytes)
    
    // Set version_minor and version_major
    view.setUint16(16, 15, true); // version_minor
    view.setUint16(18, 2, true);  // version_major
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateWifiFirmware(bytes, offsetRef);
    
    assert.equal(result.build.getTime(), Number(timestamp / 1000000n));
    assert.equal(result.reserved6.length, 8);
    assert.equal(result.version_minor, 15);
    assert.equal(result.version_major, 2);
    assert.equal(offsetRef.current, 20);
  });

  test('decodeStateVersion', () => {
    const bytes = new Uint8Array(8);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 1, true);    // vendor
    view.setUint32(4, 22, true);   // product
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateVersion(bytes, offsetRef);
    
    assert.equal(result.vendor, 1);
    assert.equal(result.product, 22);
    assert.equal(offsetRef.current, 8);
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
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateInfo(bytes, offsetRef);
    
    assert.equal(result.time.getTime(), Number(time / 1000000n));
    assert.equal(result.uptime.getTime(), Number(uptime / 1000000n));
    assert.equal(result.downtime.getTime(), Number(downtime / 1000000n));
    assert.equal(offsetRef.current, 24);
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
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateLocation(bytes, offsetRef);
    
    assert.deepEqual(result.location, locationBytes);
    assert.equal(result.label, label);
    assert.equal(result.updated_at.getTime(), Number(timestamp / 1000000n));
    assert.equal(offsetRef.current, 56);
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
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateGroup(bytes, offsetRef);
    
    assert.equal(result.group, '4e0352bf19944ff2b4251c4455479f33');
    assert.equal(result.label, label);
    assert.equal(result.updated_at.getTime(), timestamp);
    assert.equal(offsetRef.current, 56);
  });

  test('decodeSetColor', () => {
    const bytes = new Uint8Array(13);
    const view = new DataView(bytes.buffer);
    
    bytes[0] = 0; // reserved
    view.setUint16(1, 120, true);    // hue
    view.setUint16(3, 65535, true);  // saturation
    view.setUint16(5, 32768, true);  // brightness
    view.setUint16(7, 3500, true);   // kelvin
    view.setUint32(9, 1000, true);   // duration
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeSetColor(bytes, offsetRef);
    
    assert.equal(result.reserved.length, 1);
    assert.equal(result.hue, 120);
    assert.equal(result.saturation, 65535);
    assert.equal(result.brightness, 32768);
    assert.equal(result.kelvin, 3500);
    assert.equal(result.duration, 1000);
    assert.equal(offsetRef.current, 13);
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
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeLightState(bytes, offsetRef);
    
    assert.equal(result.hue, 120);
    assert.equal(result.saturation, 65535);
    assert.equal(result.brightness, 32768);
    assert.equal(result.kelvin, 3500);
    assert.equal(result.power, 65535);
    assert.equal(result.label, label);
    assert.equal(result.reserved2.length, 2);
    assert.equal(result.reserved8.length, 8);
    assert.equal(offsetRef.current, 52);
  });

  test('decodeStateLightPower', () => {
    const bytes = new Uint8Array(2);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, 32768, true);
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateLightPower(bytes, offsetRef);
    
    assert.equal(result, 32768);
    assert.equal(offsetRef.current, 2);
  });

  test('decodeStateInfrared', () => {
    const bytes = new Uint8Array(2);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, 16384, true);
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateInfrared(bytes, offsetRef);
    
    assert.equal(result, 16384);
    assert.equal(offsetRef.current, 2);
  });

  test('decodeStateHevCycle', () => {
    const bytes = new Uint8Array(9);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 3600, true);  // duration_s
    view.setUint32(4, 1800, true);  // remaining_s
    view.setUint8(8, 1);            // last_power
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateHevCycle(bytes, offsetRef);
    
    assert.equal(result.duration_s, 3600);
    assert.equal(result.remaining_s, 1800);
    assert.equal(result.last_power, true);
    assert.equal(offsetRef.current, 9);
  });

  test('decodeStateHevCycleConfiguration', () => {
    const bytes = new Uint8Array(5);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, 1);           // indication
    view.setUint32(1, 7200, true); // duration_s
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateHevCycleConfiguration(bytes, offsetRef);
    
    assert.equal(result.indication, 1);
    assert.equal(result.duration_s, 7200);
    assert.equal(offsetRef.current, 5);
  });

  test('decodeStateLastHevCycleResult', () => {
    const bytes = new Uint8Array(1);
    bytes[0] = 42;
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateLastHevCycleResult(bytes, offsetRef);
    
    assert.equal(result, 42);
    assert.equal(offsetRef.current, 1);
  });

  test('decodeStateRPower', () => {
    const bytes = new Uint8Array(3);
    const view = new DataView(bytes.buffer);
    view.setUint8(0, 2);           // relay_index
    view.setUint16(1, 32000, true); // level
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateRPower(bytes, offsetRef);
    
    assert.equal(result.relay_index, 2);
    assert.equal(result.level, 32000);
    assert.equal(offsetRef.current, 3);
  });

  test('decodeStateDeviceChain', () => {
    // Calculate correct size: 1 byte start_index + 16 devices * 55 bytes each + 1 byte tile_devices_count
    const deviceSize = 2 + 2 + 2 + 2 + 4 + 4 + 1 + 1 + 1 + 4 + 4 + 4 + 8 + 8 + 2 + 2 + 4; // = 55 bytes per device
    const totalSize = 1 + 16 * deviceSize + 1; // = 881 bytes
    const bytes = new Uint8Array(totalSize);
    const view = new DataView(bytes.buffer);
    
    view.setUint8(0, 5); // start_index
    
    // Fill first device data only (other devices will be zeros which is fine)
    let offset = 1;
    view.setInt16(offset, -100, true); offset += 2; // accel_meas_x
    view.setInt16(offset, 200, true); offset += 2;  // accel_meas_y
    view.setInt16(offset, 50, true); offset += 2;   // accel_meas_z
    offset += 2; // reserved6
    view.setFloat32(offset, 1.5, true); offset += 4; // user_x
    view.setFloat32(offset, 2.5, true); offset += 4; // user_y
    view.setUint8(offset, 8); offset += 1;  // width
    view.setUint8(offset, 8); offset += 1;  // height
    offset += 1; // reserved7
    view.setUint32(offset, 1, true); offset += 4;   // device_version_vendor
    view.setUint32(offset, 22, true); offset += 4;  // device_version_product
    offset += 4; // reserved8
    
    // firmware_build timestamp
    const timestamp = BigInt(Date.now()) * 1000000n;
    view.setBigUint64(offset, timestamp, true); offset += 8;
    offset += 8; // reserved9
    view.setUint16(offset, 42, true); offset += 2; // firmware_version_minor
    view.setUint16(offset, 3, true); offset += 2;  // firmware_version_major
    // offset += 4; // reserved10 - already zeros
    
    // Set tile_devices_count at the very end
    view.setUint8(totalSize - 1, 1); // tile_devices_count
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateDeviceChain(bytes, offsetRef);
    
    assert.equal(result.start_index, 5);
    assert.equal(result.devices.length, 16);
    assert.equal(result.tile_devices_count, 1);
    
    const firstDevice = result.devices[0];
    assert.ok(firstDevice);
    assert.equal(firstDevice.accel_meas_x, -100);
    assert.equal(firstDevice.accel_meas_y, 200);
    assert.equal(firstDevice.accel_meas_z, 50);
    assert.equal(firstDevice.user_x, 1.5);
    assert.equal(firstDevice.user_y, 2.5);
    assert.equal(firstDevice.width, 8);
    assert.equal(firstDevice.height, 8);
    assert.equal(firstDevice.device_version_vendor, 1);
    assert.equal(firstDevice.device_version_product, 22);
    assert.equal(firstDevice.firmware_build.getTime(), Number(timestamp / 1000000n));
    assert.equal(firstDevice.firmware_version_minor, 42);
    assert.equal(firstDevice.firmware_version_major, 3);
    
    assert.equal(offsetRef.current, totalSize);
  });

  test('decodeState64', () => {
    const bytes = new Uint8Array(517); // 1 + 1 + 1 + 1 + 1 + 64*8
    const view = new DataView(bytes.buffer);
    
    bytes[0] = 2;  // tile_index
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
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeState64(bytes, offsetRef);
    
    assert.equal(result.tile_index, 2);
    assert.equal(result.reserved6.length, 1);
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
    
    assert.equal(offsetRef.current, 517);
  });

  test('decodeStateZone', () => {
    const bytes = new Uint8Array(10);
    const view = new DataView(bytes.buffer);
    
    view.setUint8(0, 16);          // zones_count
    view.setUint8(1, 5);           // zone_index
    view.setUint16(2, 240, true);  // hue
    view.setUint16(4, 65535, true); // saturation
    view.setUint16(6, 40000, true); // brightness
    view.setUint16(8, 2700, true);  // kelvin
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateZone(bytes, offsetRef);
    
    assert.equal(result.zones_count, 16);
    assert.equal(result.zone_index, 5);
    assert.equal(result.hue, 240);
    assert.equal(result.saturation, 65535);
    assert.equal(result.brightness, 40000);
    assert.equal(result.kelvin, 2700);
    assert.equal(offsetRef.current, 10);
  });

  test('decodeStateMultiZone', () => {
    const bytes = new Uint8Array(66); // 1 + 1 + 8*8
    const view = new DataView(bytes.buffer);
    
    view.setUint8(0, 16); // zones_count
    view.setUint8(1, 0);  // zone_index
    
    // Set first color
    let offset = 2;
    view.setUint16(offset, 180, true); offset += 2;    // hue
    view.setUint16(offset, 50000, true); offset += 2;  // saturation
    view.setUint16(offset, 45000, true); offset += 2;  // brightness
    view.setUint16(offset, 4000, true); offset += 2;   // kelvin
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateMultiZone(bytes, offsetRef);
    
    assert.equal(result.zones_count, 16);
    assert.equal(result.zone_index, 0);
    assert.equal(result.colors.length, 8);
    
    const firstColor = result.colors[0];
    assert.ok(firstColor);
    assert.equal(firstColor.hue, 180);
    assert.equal(firstColor.saturation, 50000);
    assert.equal(firstColor.brightness, 45000);
    assert.equal(firstColor.kelvin, 4000);
    
    assert.equal(offsetRef.current, 66);
  });

  test('decodeStateMultiZoneEffect', () => {
    const bytes = new Uint8Array(59);
    const view = new DataView(bytes.buffer);
    
    view.setUint32(0, 12345, true);  // instanceid
    view.setUint8(4, 2);             // type
    // reserved6 (2 bytes) at offset 5
    view.setUint32(7, 1000, true);   // speed
    view.setBigUint64(11, 5000n, true); // duration
    // reserved7 (4 bytes) at offset 19
    // reserved8 (4 bytes) at offset 23
    // parameters (32 bytes) at offset 27
    bytes.set([1, 2, 3, 4], 27); // First few parameter bytes
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateMultiZoneEffect(bytes, offsetRef);
    
    assert.equal(result.instanceid, 12345);
    assert.equal(result.type, 2);
    assert.equal(result.reserved6.length, 2);
    assert.equal(result.speed, 1000);
    assert.equal(result.duration, 5000n);
    assert.equal(result.reserved7.length, 4);
    assert.equal(result.reserved8.length, 4);
    assert.equal(result.parameters.length, 32);
    assert.deepEqual(result.parameters.subarray(0, 4), new Uint8Array([1, 2, 3, 4]));
    assert.equal(offsetRef.current, 59);
  });

  test('decodeStateExtendedColorZones', () => {
    const bytes = new Uint8Array(661); // 2 + 2 + 1 + 82*8
    const view = new DataView(bytes.buffer);
    
    view.setUint16(0, 82, true);  // zones_count
    view.setUint16(2, 0, true);   // zone_index
    view.setUint8(4, 10);         // colors_count
    
    // Set first color
    let offset = 5;
    view.setUint16(offset, 300, true); offset += 2;    // hue
    view.setUint16(offset, 40000, true); offset += 2;  // saturation
    view.setUint16(offset, 50000, true); offset += 2;  // brightness
    view.setUint16(offset, 3200, true); offset += 2;   // kelvin
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateExtendedColorZones(bytes, offsetRef);
    
    assert.equal(result.zones_count, 82);
    assert.equal(result.zone_index, 0);
    assert.equal(result.colors_count, 10);
    assert.equal(result.colors.length, 82);
    
    const firstColor = result.colors[0];
    assert.ok(firstColor);
    assert.equal(firstColor.hue, 300);
    assert.equal(firstColor.saturation, 40000);
    assert.equal(firstColor.brightness, 50000);
    assert.equal(firstColor.kelvin, 3200);
    
    assert.equal(offsetRef.current, 661);
  });

  test('decodeStateTileEffect', () => {
    const bytes = new Uint8Array(188);
    const view = new DataView(bytes.buffer);
    
    view.setUint8(0, 0);             // reserved0
    view.setUint32(1, 98765, true);  // instanceid
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
    view.setUint8(58, 5);            // palette_count
    
    // Set first palette color
    let offset = 59;
    view.setUint16(offset, 60, true); offset += 2;     // hue
    view.setUint16(offset, 55000, true); offset += 2;  // saturation
    view.setUint16(offset, 35000, true); offset += 2;  // brightness
    view.setUint16(offset, 6500, true); offset += 2;   // kelvin
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeStateTileEffect(bytes, offsetRef);
    
    assert.equal(result.reserved0, 0);
    assert.equal(result.instanceid, 98765);
    assert.equal(result.type, 3);
    assert.equal(result.speed, 2000);
    assert.equal(result.duration, 10000n);
    assert.equal(result.reserved1.length, 4);
    assert.equal(result.reserved2.length, 4);
    assert.equal(result.skyType, 1);
    assert.equal(result.reserved3.length, 3);
    assert.equal(result.cloudSaturationMin, 50);
    assert.equal(result.reserved4.length, 3);
    assert.equal(result.cloudSaturationMax, 80);
    assert.equal(result.reserved5.length, 23);
    assert.equal(result.palette_count, 5);
    assert.equal(result.palette.length, 16);
    
    const firstPaletteColor = result.palette[0];
    assert.ok(firstPaletteColor);
    assert.equal(firstPaletteColor.hue, 60);
    assert.equal(firstPaletteColor.saturation, 55000);
    assert.equal(firstPaletteColor.brightness, 35000);
    assert.equal(firstPaletteColor.kelvin, 6500);
    
    // The actual offset should be 187, not 188 based on the structure
    assert.equal(offsetRef.current, 187);
  });

  test('decodeSensorStateAmbientLight', () => {
    const bytes = new Uint8Array(4);
    const view = new DataView(bytes.buffer);
    view.setFloat32(0, 123.45, true);
    
    const offsetRef = { current: 0 };
    const result = Encoding.decodeSensorStateAmbientLight(bytes, offsetRef);
    
    // Use approximate comparison for float32 precision
    assert.ok(Math.abs(result.lux - 123.45) < 0.01);
    assert.equal(offsetRef.current, 4);
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
      12345,     // instanceid
      2,         // effectType
      1000,      // speed
      5000n,     // duration
      parameters // parameters
    );
    
    assert.equal(payload.length, 59);
    
    const view = new DataView(payload.buffer);
    assert.equal(view.getUint32(0, true), 12345);      // instanceid
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
      2,     // colorsCount
      colors // colors
    );
    
    assert.equal(payload.length, 664);
    
    const view = new DataView(payload.buffer);
    assert.equal(view.getUint32(0, true), 2000);  // duration
    assert.equal(view.getUint8(4), 1);            // apply
    assert.equal(view.getUint16(5, true), 0);     // zoneIndex
    assert.equal(view.getUint8(7), 2);            // colorsCount
    
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
      98765,  // instanceid
      3,      // effectType
      2000,   // speed
      10000n, // duration
      1,      // skyType
      50,     // cloudSaturationMin
      2,      // paletteCount
      palette // palette
    );
    
    assert.equal(payload.length, 188);
    
    const view = new DataView(payload.buffer);
    assert.equal(view.getUint8(0), 0);                 // reserved0
    assert.equal(view.getUint8(1), 0);                 // reserved1
    assert.equal(view.getUint32(2, true), 98765);      // instanceid
    assert.equal(view.getUint8(6), 3);                 // effectType
    assert.equal(view.getUint32(7, true), 2000);       // speed
    assert.equal(view.getBigUint64(11, true), 10000n); // duration
    assert.equal(view.getUint32(19, true), 0);         // reserved2
    assert.equal(view.getUint32(23, true), 0);         // reserved3
    assert.equal(view.getUint8(27), 1);                // skyType
    assert.equal(view.getUint8(31), 50);               // cloudSaturationMin
    assert.equal(view.getUint8(59), 2);                // paletteCount
    
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

  test('encodeStringTo without null terminator when string fills buffer', () => {
    const bytes = new Uint8Array(4);
    bytes.fill(0xff);
    
    Encoding.encodeStringTo(bytes, 0, 'test', 4); // Exactly fills the buffer
    
    // Should not add null terminator since string fills entire buffer
    assert.deepEqual(bytes, new Uint8Array([0x74, 0x65, 0x73, 0x74])); // 'test'
  });

  test('encodeString with exact length match', () => {
    const bytes = Encoding.encodeString('hello', 5);
    
    // Should not have null terminator since string exactly fills buffer
    assert.deepEqual(bytes, new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f])); // 'hello'
  });
});