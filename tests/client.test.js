import { describe, test } from 'bun:test';
import assert from 'node:assert';
import { Client } from '../src/client.js';
import { Router } from '../src/router.js';
import { Device } from '../src/devices.js';
import { Type } from '../src/constants.js';
import { encode, decodeHeader } from '../src/encoding.js';
import { GetPowerCommand, GetServiceCommand, GetColorZonesCommand } from '../src/commands.js';

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

    await assert.rejects(() => client.sendOnlyAcknowledgement(GetPowerCommand(), sharedDevice), (error) => {
      return error.name === 'UnhandledCommandError' && error.commandType === Type.StatePower;
    });
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

    await assert.rejects(() => client.send(GetPowerCommand(), sharedDevice, signal), (error) => {
      return error.message.includes('abort');
    });
  });

  test('timeout send', async () => {
    const client = Client({
      defaultTimeoutMs: 1,
      router: Router({
        onSend() { },
      }),
    });

    await assert.rejects(() => client.send(GetPowerCommand(), sharedDevice), (error) => {
      return error.name === 'TimeoutError';
    });
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
      (error) => error.name === 'MessageConflictError',
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
      (error) => error.name === 'MessageConflictError',
    );
  });

  test('send multi-response command with expectMore true', async () => {
    let responseCount = 0;
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(message) {
          const header = decodeHeader(message);
          assert.equal(header.source, client.source);
          
          // Simulate multiple responses arriving
          setTimeout(() => {
            // First response: StateZone for zone 0 (expectMore = true)
            const stateZoneBytes = new Uint8Array(36 + 13);
            const view = new DataView(stateZoneBytes.buffer);
            view.setUint16(32, Type.StateZone, true); // message type
            view.setUint8(36, 2); // zones_count
            view.setUint8(37, 0); // zone_index
            view.setUint16(38, 120, true); // hue
            view.setUint16(40, 65535, true); // saturation
            view.setUint16(42, 32768, true); // brightness
            view.setUint16(44, 3500, true); // kelvin
            
            client.router.receive(
              encode(
                header.tagged,
                header.source,
                header.target,
                false,
                false,
                header.sequence,
                Type.StateZone,
                stateZoneBytes.subarray(36), // payload only
              ),
            );
            responseCount++;
          }, 0);
          
          setTimeout(() => {
            // Second response: StateZone for zone 1 (expectMore = false)
            const stateZoneBytes = new Uint8Array(36 + 13);
            const view = new DataView(stateZoneBytes.buffer);
            view.setUint16(32, Type.StateZone, true); // message type
            view.setUint8(36, 2); // zones_count
            view.setUint8(37, 1); // zone_index
            view.setUint16(38, 240, true); // hue
            view.setUint16(40, 65535, true); // saturation
            view.setUint16(42, 32768, true); // brightness
            view.setUint16(44, 3500, true); // kelvin
            
            client.router.receive(
              encode(
                header.tagged,
                header.source,
                header.target,
                false,
                false,
                header.sequence,
                Type.StateZone,
                stateZoneBytes.subarray(36), // payload only
              ),
            );
            responseCount++;
          }, 1);
        },
      }),
    });

    const device = Device({
      serialNumber: 'abcdef123456',
      port: 1234,
      address: '1.2.3.4',
    });

    // Request zones 0-1, should receive 2 StateZone responses
    const result = await client.send(GetColorZonesCommand(0, 1), device);
    
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 2);
    assert.equal(result[0].zone_index, 0);
    assert.equal(result[0].hue, 120);
    assert.equal(result[1].zone_index, 1);
    assert.equal(result[1].hue, 240);
    assert.equal(responseCount, 2); // Verify both responses were received
  });
});
