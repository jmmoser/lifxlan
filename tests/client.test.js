import { describe, test } from 'node:test';
import assert from 'node:assert';
import { Client } from '../src/client.js';
import { TYPE } from '../src/constants.js';
import { encode, decodeHeader } from '../src/encoding.js';
import { GetPowerCommand } from '../src/commands.js';

describe('client', () => {
  test('send', async () => {
    const client = Client({
      defaultTimeoutMs: 10,
      onSend(messsage, port, address) {
        const packet = decodeHeader(messsage, { current: 0 });
        const payload = new Uint8Array(2);
        new DataView(payload.buffer).setUint16(0, 65535, true);
        assert.equal(packet.source, 2);
        assert.equal(packet.sequence, 0);
        client.onReceived(
          encode(
            packet.tagged,
            packet.source,
            packet.target,
            false,
            false,
            packet.sequence,
            TYPE.StatePower,
            payload,
          ),
          port,
          address,
        );
      },
    });

    const device = client.registerDevice('abcdef123456', 1234, '1.2.3.4');

    const res = await client.send(GetPowerCommand(), device);

    assert.equal(res.on, true);
  });
  test('sendOnlyAcknowledgement', async () => {
    const client = Client({
      defaultTimeoutMs: 10,
      onSend(messsage, port, address) {
        const packet = decodeHeader(messsage, { current: 0 });
        assert.equal(packet.source, 2);
        assert.equal(packet.sequence, 0);
        client.onReceived(
          encode(
            packet.tagged,
            packet.source,
            packet.target,
            false,
            false,
            packet.sequence,
            TYPE.Acknowledgement,
          ),
          port,
          address,
        );
      },
    });

    const device = client.registerDevice('abcdef123456', 1234, '1.2.3.4');

    await client.sendOnlyAcknowledgement(GetPowerCommand(), device);
  });
});
