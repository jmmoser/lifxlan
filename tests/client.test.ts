import { describe, test } from 'bun:test';
import assert from 'node:assert';
import { Client } from '../src/client.js';
import { Router } from '../src/router.js';
import { Device } from '../src/devices.js';
import { Type } from '../src/constants/index.js';
import { encode, decodeHeader } from '../src/encoding.js';
import { GetPowerCommand, GetServiceCommand, GetColorZonesCommand, SetPowerCommand } from '../src/commands/index.js';
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

  test('Set command default (ack-only) resolves undefined', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(message) {
          const header = decodeHeader(message);
          // A Set command defaults to ack-only: request an ack, not a response.
          assert.equal(header.ack_required, true);
          assert.equal(header.res_required, false);
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

    // The static type is Promise<void>; assert the runtime agrees (no payload).
    const result = await client.send(SetPowerCommand(true), sharedDevice);
    assert.equal(result, undefined);

    client.dispose();
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

  test('send rejects when decoder throws', async () => {
    const client = Client({
      defaultTimeoutMs: 60000,
      router: Router({
        onSend(message) {
          const header = decodeHeader(message);
          // Echo back StatePower with a 1-byte payload so the StatePower
          // decoder reads past the buffer and throws.
          client.router.receive(
            encode(
              header.tagged,
              header.source,
              header.target,
              false,
              false,
              header.sequence,
              Type.StatePower,
              new Uint8Array(1),
            ),
          );
        },
      }),
    });

    await assert.rejects(() => client.send(GetPowerCommand(), sharedDevice));
  });

  test('dispose rejects pending send promises with DisposedClientError', async () => {
    const client = Client({
      defaultTimeoutMs: 60000,
      router: Router({
        onSend() {},
      }),
    });

    const pending = client.send(GetPowerCommand(), sharedDevice);
    client.dispose();

    await assert.rejects(pending, (error: unknown) => Error.isError(error) && error.name === 'DisposedClientError');
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

  test('AbortSignal with custom Error', async () => {
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
    const customError = new Error('Custom abort reason');
    const promise = client.send(GetServiceCommand(), device, { signal: controller.signal });
    
    // Abort with custom reason
    controller.abort(customError);

    try {
      await promise;
      assert.fail('Promise should have been rejected');
    } catch (error) {
      // Should receive the custom error when AbortController.abort() is called with a reason
      // In some environments, this might still be wrapped in an AbortError
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('abort') || error === customError);
    }

    client.dispose();
  });

  test('send with both response mode', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(message) {
          const header = decodeHeader(message);
          assert.equal(header.source, client.source);
          assert.equal(header.ack_required, true);
          assert.equal(header.res_required, true);
          
          // Send both acknowledgment and response
          client.router.receive(
            encode(
              header.tagged,
              header.source,
              header.target,
              false,
              false,
              header.sequence,
              Type.Acknowledgement,
              new Uint8Array(),
            ),
          );
          
          const payload = new Uint8Array(2);
          new DataView(payload.buffer).setUint16(0, 65535, true);
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

    const result = await client.send(GetPowerCommand(), sharedDevice, { responseMode: 'both' });
    assert.equal(result, 0xFFFF);
    
    client.dispose();
  });

  test('send with auto response mode and no defaultResponseMode', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(message) {
          const header = decodeHeader(message);
          assert.equal(header.res_required, true); // Should default to 'response'
          
          const payload = new Uint8Array(2);
          new DataView(payload.buffer).setUint16(0, 65535, true);
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

    // Create a command without defaultResponseMode
    const commandWithoutDefault = {
      type: Type.GetPower,
      payload: new Uint8Array(),
      decode: GetPowerCommand().decode,
    };

    const result = await client.send(commandWithoutDefault, sharedDevice, { responseMode: 'auto' });
    assert.equal(result, 0xFFFF);
    
    client.dispose();
  });

  test('custom source assignment', () => {
    const customSource = 12345;
    const client = Client({
      source: customSource,
      router: Router({
        onSend() {},
      }),
    });

    assert.equal(client.source, customSource);
    client.dispose();
  });

  test('sequence number increments correctly', () => {
    const client = Client({
      router: Router({
        onSend() {},
      }),
    });

    const device = Device({
      serialNumber: 'abcdef123456',
      port: 1234,
      address: '1.2.3.4',
    });

    // Initial sequence should be 0
    assert.equal(device.sequence, 0);
    
    client.unicast(GetServiceCommand(), device);
    assert.equal(device.sequence, 1);
    
    client.unicast(GetServiceCommand(), device);
    assert.equal(device.sequence, 2);
    
    // Test sequence wrapping at 255
    device.sequence = 254;
    client.unicast(GetServiceCommand(), device);
    assert.equal(device.sequence, 0); // Should wrap to 0
    
    client.dispose();
  });

  test('multi-response command with 4+ decode parameters', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(message) {
          const header = decodeHeader(message);
          
          // Simulate response with responseType parameter
          const payload = new Uint8Array(2);
          new DataView(payload.buffer).setUint16(0, 65535, true);
          
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

    // Create command with decode function that accepts responseType (4th parameter)
    const commandWithResponseType = {
      type: Type.GetPower,
      payload: new Uint8Array(),
      decode: (bytes: Uint8Array, offsetRef: { current: number }, _continuation?: { expectMore: boolean }, _responseType?: number) => {
        const view = new DataView(bytes.buffer, bytes.byteOffset + offsetRef.current);
        return view.getUint16(0, true);
      },
    };

    const result = await client.send(commandWithResponseType, sharedDevice);
    assert.equal(result, 0xFFFF);
    
    client.dispose();
  });

  test('disposal cleanup error handling', () => {
    const client = Client({
      router: Router({
        onSend() {},
      }),
    });

    const device = Device({
      serialNumber: 'abcdef123456',
      port: 1234,
      address: '1.2.3.4',
    });

    // Start a request to create a response handler
    client.send(GetServiceCommand(), device).catch(() => {
      // Ignore the rejection - we're testing disposal cleanup
    });

    // Disposal should not throw even if there are pending handlers
    // The actual error handling is internal to the client disposal
    assert.doesNotThrow(() => {
      client.dispose();
    });
  });

  test('unicastEach fans out to every device and advances each sequence', () => {
    const targets: string[] = [];
    const client = Client({
      router: Router({
        onSend() {
          throw new Error('onSend should not be used when onSendMany is wired up');
        },
        onSendMany(packets) {
          for (const packet of packets) {
            const header = decodeHeader(packet.message);
            assert.equal(header.source, client.source);
            assert.equal(header.res_required, false);
            assert.equal(header.ack_required, false);
            targets.push(packet.serialNumber!);
          }
        },
      }),
    });

    const deviceA = Device({ serialNumber: 'aaaaaaaaaaaa', port: 1, address: '1.1.1.1' });
    const deviceB = Device({ serialNumber: 'bbbbbbbbbbbb', port: 2, address: '2.2.2.2' });

    client.unicastEach(SetPowerCommand(true), [deviceA, deviceB]);

    assert.deepEqual(targets, ['aaaaaaaaaaaa', 'bbbbbbbbbbbb']);
    assert.equal(deviceA.sequence, 1);
    assert.equal(deviceB.sequence, 1);
  });

  test('sendEach resolves a device-tagged outcome per device in order', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() { throw new Error('onSend should not be used when onSendMany is wired up'); },
        onSendMany(packets) {
          for (const packet of packets) {
            const header = decodeHeader(packet.message);
            const payload = new Uint8Array(2);
            new DataView(payload.buffer).setUint16(0, 65535, true);
            client.router.receive(
              encode(header.tagged, header.source, header.target, false, false, header.sequence, Type.StatePower, payload),
            );
          }
        },
      }),
    });

    const deviceA = Device({ serialNumber: 'aaaaaaaaaaaa', port: 1, address: '1.1.1.1' });
    const deviceB = Device({ serialNumber: 'bbbbbbbbbbbb', port: 2, address: '2.2.2.2' });

    const results = await client.sendEach(GetPowerCommand(), [deviceA, deviceB]);

    assert.equal(results.length, 2);
    assert.equal(results[0]!.device, deviceA);
    assert.equal(results[1]!.device, deviceB);
    assert.equal(results[0]!.ok, true);
    assert.equal(results[1]!.ok, true);
    assert.equal(results[0]!.ok && results[0]!.value, 0xFFFF);
    assert.equal(results[1]!.ok && results[1]!.value, 0xFFFF);
  });

  test('sendEach isolates failures so one unreachable device does not reject the batch', async () => {
    const client = Client({
      defaultTimeoutMs: 50,
      router: Router({
        onSend() { throw new Error('onSend should not be used when onSendMany is wired up'); },
        onSendMany(packets) {
          // Only the first device answers; the second times out.
          const packet = packets[0]!;
          const header = decodeHeader(packet.message);
          const payload = new Uint8Array(2);
          new DataView(payload.buffer).setUint16(0, 65535, true);
          client.router.receive(
            encode(header.tagged, header.source, header.target, false, false, header.sequence, Type.StatePower, payload),
          );
        },
      }),
    });

    const deviceA = Device({ serialNumber: 'aaaaaaaaaaaa', port: 1, address: '1.1.1.1' });
    const deviceB = Device({ serialNumber: 'bbbbbbbbbbbb', port: 2, address: '2.2.2.2' });

    const results = await client.sendEach(GetPowerCommand(), [deviceA, deviceB]);

    assert.equal(results[0]!.ok, true);
    assert.equal(results[1]!.ok, false);
    // The failing outcome carries its device and a real error (not `any`).
    assert.equal(results[1]!.device, deviceB);
    assert.ok(!results[1]!.ok && results[1]!.error instanceof Error);
  });

  test('sendEach honors ack-only response mode', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() { throw new Error('onSend should not be used when onSendMany is wired up'); },
        onSendMany(packets) {
          for (const packet of packets) {
            const header = decodeHeader(packet.message);
            assert.equal(header.ack_required, true);
            assert.equal(header.res_required, false);
            client.router.receive(
              encode(header.tagged, header.source, header.target, false, false, header.sequence, Type.Acknowledgement),
            );
          }
        },
      }),
    });

    const deviceA = Device({ serialNumber: 'aaaaaaaaaaaa', port: 1, address: '1.1.1.1' });
    const deviceB = Device({ serialNumber: 'bbbbbbbbbbbb', port: 2, address: '2.2.2.2' });

    const results = await client.sendEach(GetPowerCommand(), [deviceA, deviceB], { responseMode: 'ack-only' });

    assert.equal(results[0]!.ok, true);
    assert.equal(results[1]!.ok, true);
    assert.equal(results[0]!.ok && results[0]!.value, undefined);
  });

  test('sendEach without onSendMany falls back to per-packet send', async () => {
    let sendCount = 0;
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(message) {
          sendCount += 1;
          const header = decodeHeader(message);
          const payload = new Uint8Array(2);
          new DataView(payload.buffer).setUint16(0, 65535, true);
          client.router.receive(
            encode(header.tagged, header.source, header.target, false, false, header.sequence, Type.StatePower, payload),
          );
        },
      }),
    });

    const deviceA = Device({ serialNumber: 'aaaaaaaaaaaa', port: 1, address: '1.1.1.1' });
    const deviceB = Device({ serialNumber: 'bbbbbbbbbbbb', port: 2, address: '2.2.2.2' });

    const results = await client.sendEach(GetPowerCommand(), [deviceA, deviceB]);

    assert.equal(sendCount, 2);
    assert.equal(results[0]!.ok, true);
    assert.equal(results[1]!.ok, true);
  });

  test('unicastEach and sendEach throw once the client is disposed', () => {
    const client = Client({
      router: Router({ onSend() {}, onSendMany() {} }),
    });
    const device = Device({ serialNumber: 'aaaaaaaaaaaa', port: 1, address: '1.1.1.1' });

    client.dispose();

    assert.throws(() => client.unicastEach(SetPowerCommand(true), [device]), /disposed/i);
    assert.throws(() => client.sendEach(GetPowerCommand(), [device]), /disposed/i);
  });
});

describe('Client heterogeneous batch (sendBatch / unicastBatch)', () => {
  // Replies StatePower to any res_required packet and Acknowledgement to any
  // ack_required one, so a single emulator serves Get, Set, and overridden Set.
  function emulate(client: ReturnType<typeof Client>, packets: readonly { message: Uint8Array }[]) {
    for (const packet of packets) {
      const header = decodeHeader(packet.message);
      if (header.res_required) {
        const payload = new Uint8Array(2);
        new DataView(payload.buffer).setUint16(0, 65535, true);
        client.router.receive(
          encode(header.tagged, header.source, header.target, false, false, header.sequence, Type.StatePower, payload),
        );
      }
      if (header.ack_required) {
        client.router.receive(
          encode(header.tagged, header.source, header.target, false, false, header.sequence, Type.Acknowledgement),
        );
      }
    }
  }

  test('sendBatch sends different commands to different devices and tags each outcome', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() { throw new Error('onSend should not be used when onSendMany is wired up'); },
        onSendMany(packets) { emulate(client, packets); },
      }),
    });

    const deviceA = Device({ serialNumber: 'aaaaaaaaaaaa', port: 1, address: '1.1.1.1' });
    const deviceB = Device({ serialNumber: 'bbbbbbbbbbbb', port: 2, address: '2.2.2.2' });

    // GetPower (response default) + SetPower (ack-only default) in one flush.
    const results = await client.sendBatch([
      { command: GetPowerCommand(), device: deviceA },
      { command: SetPowerCommand(true), device: deviceB },
    ]);

    assert.equal(results.length, 2);
    assert.equal(results[0].device, deviceA);
    assert.equal(results[1].device, deviceB);
    // The Get entry resolves the decoded power; the Set entry resolves void.
    assert.equal(results[0].ok && results[0].value, 0xFFFF);
    assert.equal(results[1].ok, true);
    assert.equal(results[1].ok && results[1].value, undefined);
    // Each device's sequence advanced exactly once.
    assert.equal(deviceA.sequence, 1);
    assert.equal(deviceB.sequence, 1);
  });

  test('sendBatch honors a per-entry response-mode override', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() { throw new Error('onSend should not be used when onSendMany is wired up'); },
        onSendMany(packets) { emulate(client, packets); },
      }),
    });

    const device = Device({ serialNumber: 'aaaaaaaaaaaa', port: 1, address: '1.1.1.1' });

    // Force a response out of an otherwise ack-only Set command.
    const results = await client.sendBatch([
      { command: SetPowerCommand(true), device, options: { responseMode: 'response' } },
    ]);

    assert.equal(results[0].ok && results[0].value, 0xFFFF);
  });

  test('sendBatch isolates failures so one unreachable entry does not reject the batch', async () => {
    const client = Client({
      defaultTimeoutMs: 50,
      router: Router({
        onSend() { throw new Error('onSend should not be used when onSendMany is wired up'); },
        onSendMany(packets) {
          // Only the first packet is answered; the second times out.
          emulate(client, [packets[0]!]);
        },
      }),
    });

    const deviceA = Device({ serialNumber: 'aaaaaaaaaaaa', port: 1, address: '1.1.1.1' });
    const deviceB = Device({ serialNumber: 'bbbbbbbbbbbb', port: 2, address: '2.2.2.2' });

    const results = await client.sendBatch([
      { command: GetPowerCommand(), device: deviceA },
      { command: GetPowerCommand(), device: deviceB },
    ]);

    assert.equal(results[0].ok, true);
    assert.equal(results[1].ok, false);
    assert.equal(results[1].device, deviceB);
    assert.ok(!results[1].ok && results[1].error instanceof Error);
  });

  test('sendBatch without onSendMany falls back to per-packet send', async () => {
    let sendCount = 0;
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(message) {
          sendCount += 1;
          emulate(client, [{ message }]);
        },
      }),
    });

    const deviceA = Device({ serialNumber: 'aaaaaaaaaaaa', port: 1, address: '1.1.1.1' });
    const deviceB = Device({ serialNumber: 'bbbbbbbbbbbb', port: 2, address: '2.2.2.2' });

    const results = await client.sendBatch([
      { command: GetPowerCommand(), device: deviceA },
      { command: SetPowerCommand(true), device: deviceB },
    ]);

    assert.equal(sendCount, 2);
    assert.equal(results[0].ok, true);
    assert.equal(results[1].ok, true);
  });

  test('unicastBatch fans out heterogeneous fire-and-forget packets in one flush', () => {
    const seen: { type: number; serial: string; res: boolean; ack: boolean }[] = [];
    const client = Client({
      router: Router({
        onSend() { throw new Error('onSend should not be used when onSendMany is wired up'); },
        onSendMany(packets) {
          for (const packet of packets) {
            const header = decodeHeader(packet.message);
            seen.push({ type: header.type, serial: packet.serialNumber!, res: header.res_required, ack: header.ack_required });
          }
        },
      }),
    });

    const deviceA = Device({ serialNumber: 'aaaaaaaaaaaa', port: 1, address: '1.1.1.1' });
    const deviceB = Device({ serialNumber: 'bbbbbbbbbbbb', port: 2, address: '2.2.2.2' });

    client.unicastBatch([
      { command: SetPowerCommand(true), device: deviceA },
      { command: GetPowerCommand(), device: deviceB },
    ]);

    // Different command types, fire-and-forget (no res/ack required), in order.
    assert.deepEqual(seen, [
      { type: Type.SetPower, serial: 'aaaaaaaaaaaa', res: false, ack: false },
      { type: Type.GetPower, serial: 'bbbbbbbbbbbb', res: false, ack: false },
    ]);
    assert.equal(deviceA.sequence, 1);
    assert.equal(deviceB.sequence, 1);
  });

  test('sendBatch and unicastBatch throw once the client is disposed', () => {
    const client = Client({
      router: Router({ onSend() {}, onSendMany() {} }),
    });
    const device = Device({ serialNumber: 'aaaaaaaaaaaa', port: 1, address: '1.1.1.1' });

    client.dispose();

    assert.throws(() => client.unicastBatch([{ command: SetPowerCommand(true), device }]), /disposed/i);
    assert.throws(() => client.sendBatch([{ command: GetPowerCommand(), device }]), /disposed/i);
  });
});