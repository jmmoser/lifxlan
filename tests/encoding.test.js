import { describe, test } from 'node:test';
import assert from 'node:assert';
import { decodeHeader } from '../src/encoding.js';

describe('encoding', () => {
  test('decode', () => {
    const bytes = new Uint8Array([0x24, 0x00, 0x00, 0x34, 0x99, 0x9c, 0x8c, 0xc9, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00]);
    const packet = decodeHeader(bytes, { current: 0 });
    assert.equal(packet.type, 2);
    assert.equal(packet.protocol, 1024);
    assert.equal(packet.addressable, true);
    assert.equal(packet.tagged, true);
    assert.equal(packet.origin, 0);
    assert.equal(packet.source, 3381435545);
    assert.deepEqual(packet.target, new Uint8Array([1, 2, 3, 4, 5, 6]));
    assert.equal(packet.res_required, false);
    assert.equal(packet.ack_required, false);
    assert.equal(packet.sequence, 0);
  });
});
