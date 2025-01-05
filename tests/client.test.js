import { describe, test } from 'bun:test';
import assert from 'node:assert';
import { Client } from '../src/client.js';
import { Router } from '../src/router.js';
import { Device } from '../src/devices.js';
import { Type } from '../src/constants.js';
import { encode, decodeHeader } from '../src/encoding.js';
import { GetPowerCommand, GetServiceCommand } from '../src/commands.js';

describe('client', () => {
  const sharedDevice = Device({
    serialNumber: 'abcdef123456',
    port: 1234,
    address: '1.2.3.4',
  });

  test('send', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(messsage) {
          const header = decodeHeader(messsage);
          const payload = new Uint8Array(2);
          new DataView(payload.buffer).setUint16(0, 65535, true);
          assert.equal(header.source, client.source);
          assert.equal(header.sequence, 0);
          client.router.receive(
            encode(
              header.tagged,
              header.source,
              header.target,
              false,
              false,
              header.sequence,
              Type.StatePower,
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

    assert.equal(res, 0xFFFF);
  });

  test('sendOnlyAcknowledgement', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(messsage) {
          const header = decodeHeader(messsage);
          assert.equal(header.source, client.source);
          client.router.receive(
            encode(
              header.tagged,
              header.source,
              header.target,
              false,
              false,
              header.sequence,
              Type.Acknowledgement,
            ),
          );
        },
      }),
    });

    await client.sendOnlyAcknowledgement(GetPowerCommand(), sharedDevice);

    await client.sendOnlyAcknowledgement(GetPowerCommand(), sharedDevice, new AbortController().signal);
  });

  test('sendOnlyAcknowledgement with StateUnhandled response', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(messsage) {
          const header = decodeHeader(messsage);
          assert.equal(header.source, client.source);
          const payload = new Uint8Array(2);
          new DataView(payload.buffer).setUint16(0, Type.StatePower, true);
          client.router.receive(
            encode(
              header.tagged,
              header.source,
              header.target,
              false,
              false,
              header.sequence,
              Type.StateUnhandled,
              payload,
            ),
          );
        },
      }),
    });

    await assert.rejects(() => client.sendOnlyAcknowledgement(GetPowerCommand(), sharedDevice), new Error(`Unhandled request type: ${Type.StatePower}`));
  });

  test('broadcast', () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() {},
      }),
    });

    client.broadcast(GetServiceCommand());
  });

  test('unicast', () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() {},
      }),
    });

    client.unicast(GetServiceCommand(), sharedDevice);
  });

  test('abort send', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() {},
      }),
    });

    const signal = AbortSignal.timeout(0);

    await assert.rejects(() => client.send(GetPowerCommand(), sharedDevice, signal), new Error('Abort'));
  });

  test('timeout send', async () => {
    const client = Client({
      defaultTimeoutMs: 1,
      router: Router({
        onSend() { },
      }),
    });

    await assert.rejects(() => client.send(GetPowerCommand(), sharedDevice), new Error('Timeout'));
  });

  test('dispose', () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() {},
      }),
    });

    client.dispose();
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
