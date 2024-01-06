import { describe, test } from 'node:test';
import assert from 'node:assert';
import { Client } from '../src/client.js';
import { Router } from '../src/router.js';
import { Device } from '../src/devices.js';
import { TYPE } from '../src/constants.js';
import { encode, decodeHeader } from '../src/encoding.js';
import { GetPowerCommand } from '../src/commands.js';

describe('client', () => {
  test('send', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(messsage) {
          const packet = decodeHeader(messsage, { current: 0 });
          const payload = new Uint8Array(2);
          new DataView(payload.buffer).setUint16(0, 65535, true);
          assert.equal(packet.source, client.source);
          assert.equal(packet.sequence, 0);
          client.router.onReceived(
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
          );
        },
      }),
    });

    const device = Device({
      serialNumber: 'abcdef123456',
      port: 1234,
      address: '1.2.3.4',
    });

    const res = await client.send(GetPowerCommand(), device);

    assert.equal(res.on, true);
  });

  test('sendOnlyAcknowledgement', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(messsage) {
          const packet = decodeHeader(messsage, { current: 0 });
          assert.equal(packet.source, client.source);
          assert.equal(packet.sequence, 0);
          client.router.onReceived(
            encode(
              packet.tagged,
              packet.source,
              packet.target,
              false,
              false,
              packet.sequence,
              TYPE.Acknowledgement,
            ),
          );
        },
      }),
    });

    const device = Device({
      serialNumber: 'abcdef123456',
      port: 1234,
      address: '1.2.3.4',
    });

    await client.sendOnlyAcknowledgement(GetPowerCommand(), device);
  });

  test('sendOnlyAcknowledgement with StateUnhandled response', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(messsage) {
          const packet = decodeHeader(messsage, { current: 0 });
          assert.equal(packet.source, client.source);
          assert.equal(packet.sequence, 0);
          const payload = new Uint8Array(2);
          new DataView(payload.buffer).setUint16(0, TYPE.StatePower, true);
          client.router.onReceived(
            encode(
              packet.tagged,
              packet.source,
              packet.target,
              false,
              false,
              packet.sequence,
              TYPE.StateUnhandled,
              payload,
            ),
          );
        },
      }),
    });

    try {
      const device = Device({
        serialNumber: 'abcdef123456',
        port: 1234,
        address: '1.2.3.4',
      });

      await client.sendOnlyAcknowledgement(GetPowerCommand(), device);
      assert.fail('should throw');
    } catch (err) {
      assert(err instanceof Error);
      assert.match(err.message, /Unhandled/);
    }
  });

  test('max number of inflight sendOnlyAcknowledgement requests', async () => {
    const client = Client({
      router: Router({
        onSend() { },
      }),
    });

    const device = Device({
      serialNumber: 'abcdef123456',
      port: 1234,
      address: '1.2.3.4',
    });

    for (let i = 0; i < 255; i++) {
      client.sendOnlyAcknowledgement(GetPowerCommand(), device, new AbortController().signal);
    }

    assert.throws(
      () => client.sendOnlyAcknowledgement(GetPowerCommand(), device, new AbortController().signal),
      new Error('Conflict'),
    );
  });

  test('max number of inflight send requests', async () => {
    const client = Client({
      router: Router({
        onSend() { },
      }),
    });

    const device = Device({
      serialNumber: 'abcdef123456',
      port: 1234,
      address: '1.2.3.4',
    });

    for (let i = 0; i < 255; i++) {
      client.send(GetPowerCommand(), device, new AbortController().signal);
    }

    assert.throws(
      () => client.send(GetPowerCommand(), device, new AbortController().signal),
      new Error('Conflict'),
    );
  });
});
