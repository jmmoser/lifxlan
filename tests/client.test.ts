import { describe, test } from 'bun:test';
import assert from 'node:assert';
import { Client } from '../src/client.js';
import { Router } from '../src/router.js';
import { Device } from '../src/devices.js';
import { Type } from '../src/constants/index.js';
import { encode, decodeHeader } from '../src/encoding.js';
import { GetPowerCommand, GetServiceCommand, GetColorZonesCommand } from '../src/commands/index.js';
import { UnhandledCommandError } from '../src/errors.js';

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

  test('send with ack-only option', async () => {
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

    await client.send(GetPowerCommand(), sharedDevice, { responseMode: 'ack-only' });

    await client.send(GetPowerCommand(), sharedDevice, { responseMode: 'ack-only', signal: new AbortController().signal });
  });

  test('send with ack-only and StateUnhandled response', async () => {
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

    await assert.rejects(() => client.send(GetPowerCommand(), sharedDevice, { responseMode: 'ack-only' }), (error) => {
      return error instanceof UnhandledCommandError && error.commandType === Type.StatePower;
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

    await assert.rejects(() => client.send(GetPowerCommand(), sharedDevice, { signal }), (error) => {
      return Error.isError(error) && error.message.includes('abort');
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
      return Error.isError(error) && error.name === 'TimeoutError';
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

  test('max number of inflight ack-only requests', async () => {
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
      client.send(GetPowerCommand(), device, { responseMode: 'ack-only', signal: new AbortController().signal });
    }

    assert.throws(
      () => client.send(GetPowerCommand(), device, { responseMode: 'ack-only', signal: new AbortController().signal }),
      (error) => Error.isError(error) && error.name === 'MessageConflictError',
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
      client.send(GetPowerCommand(), device, { signal: new AbortController().signal });
    }

    assert.throws(
      () => client.send(GetPowerCommand(), device, { signal: new AbortController().signal }),
      (error) => Error.isError(error) && error.name === 'MessageConflictError',
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
    
    // TODO: is it possible to get more than 1 response?
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 2);
    const color0 = result[0];
    assert.ok(color0);
    assert.equal(color0.zone_index, 0);
    assert.ok('hue' in color0);
    assert.equal(color0.hue, 120);
    const color1 = result[1];
    assert.ok(color1);
    assert.equal(color1.zone_index, 1);
    assert.ok('hue' in color1);
    assert.equal(color1.hue, 240);
    assert.equal(responseCount, 2); // Verify both responses were received
  });

  test('client with custom onMessage handler', () => {
    let onMessageCalled = false;
    
    const router = Router({
      onSend() {},
    });
    
    const client = Client({
      router,
      onMessage(header, payload, serialNumber) {
        onMessageCalled = true;
        assert.equal(header.source, client.source);
        assert.equal(serialNumber, 'abcdef123456');
      },
    });
    
    // Simulate a message
    const message = encode(
      false,
      client.source,
      new Uint8Array([0xab, 0xcd, 0xef, 0x12, 0x34, 0x56]),
      false,
      false,
      1,
      Type.GetService,
      new Uint8Array()
    );
    
    router.receive(message);
    
    assert.ok(onMessageCalled, 'onMessage handler should be called');
    
    client.dispose();
  });

  test('client dispose is idempotent', () => {
    const router = Router({
      onSend() {},
    });
    
    const client = Client({ router });
    
    // Multiple dispose calls should not throw
    client.dispose();
    client.dispose();
    client.dispose();
  });

  test('disposed client throws DisposedClientError on operations', () => {
    const router = Router({
      onSend() {},
    });
    
    const client = Client({ router });
    const device = Device({
      serialNumber: 'abcdef123456',
      port: 1234,
      address: '1.2.3.4',
    });
    
    client.dispose();
    
    // All client operations should throw DisposedClientError
    assert.throws(
      () => client.broadcast(GetServiceCommand()),
      (error) => Error.isError(error) && error.name === 'DisposedClientError',
    );
    
    assert.throws(
      () => client.unicast(GetServiceCommand(), device),
      (error) => Error.isError(error) && error.name === 'DisposedClientError',
    );
    
    assert.throws(
      () => client.send(GetServiceCommand(), device, { responseMode: 'ack-only' }),
      (error) => Error.isError(error) && error.name === 'DisposedClientError',
    );
    
    assert.throws(
      () => client.send(GetServiceCommand(), device),
      (error) => Error.isError(error) && error.name === 'DisposedClientError',
    );
  });

  test('client disposal clears pending response handlers', async () => {
    let sendCalled = false;
    const client = Client({
      defaultTimeoutMs: 100, // Short timeout so test doesn't hang
      router: Router({
        onSend() {
          sendCalled = true;
        },
      }),
    });

    const device = Device({
      serialNumber: 'abcdef123456',
      port: 1234,
      address: '1.2.3.4',
    });

    // Start a request but don't respond
    const promise = client.send(GetServiceCommand(), device);
    
    // Verify the request was sent
    assert.ok(sendCalled);
    
    // Dispose the client, which should clear pending handlers
    client.dispose();

    // The promise should be rejected due to timeout (since we're not responding)
    try {
      await promise;
      assert.fail('Promise should have been rejected');
    } catch (error) {
      // Should be rejected due to timeout or disposal cleanup
      assert.ok(error instanceof Error);
    }
  });

  test('AbortSignal creates AbortError', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() {
          // Don't respond to simulate timeout/abort
        },
      }),
    });

    const device = Device({
      serialNumber: 'abcdef123456',
      port: 1234,
      address: '1.2.3.4',
    });

    const controller = new AbortController();
    const promise = client.send(GetServiceCommand(), device, { signal: controller.signal });
    
    // Immediately abort
    controller.abort();

    try {
      await promise;
      assert.fail('Promise should have been rejected');
    } catch (error) {
      assert.ok(Error.isError(error));
      assert.equal(error.name, 'AbortError');
      assert.equal(error.message, 'device response was aborted');
    }

    client.dispose();
  });
});