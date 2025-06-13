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

    await assert.rejects(() => client.send(GetPowerCommand(), sharedDevice, signal), (error) => {
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
      client.send(GetPowerCommand(), device, new AbortController().signal);
    }

    assert.throws(
      () => client.send(GetPowerCommand(), device, new AbortController().signal),
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
      () => client.sendOnlyAcknowledgement(GetServiceCommand(), device),
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
    const promise = client.send(GetServiceCommand(), device, controller.signal);
    
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

  test('batchUnicast sends multiple commands using batchSend', () => {
    const sentMessages: any[] = [];
    
    const client = Client({
      router: Router({
        onSend() {
          assert.fail('onSend should not be called for batch operations');
        },
        onBatchSend(messages) {
          sentMessages.push(...messages);
        },
      }),
    });

    const device1 = Device({
      serialNumber: 'abcdef123456',
      port: 56700,
      address: '192.168.1.100',
    });

    const device2 = Device({
      serialNumber: 'fedcba654321',
      port: 56701,
      address: '192.168.1.101',
    });

    const commands = [
      { command: SetPowerCommand(true), device: device1 },
      { command: SetPowerCommand(false), device: device2 },
    ];

    client.batchUnicast(commands);

    assert.equal(sentMessages.length, 2);
    
    // Verify first message
    const header1 = decodeHeader(sentMessages[0].message);
    assert.equal(header1.source, client.source);
    assert.equal(header1.res_required, false);
    assert.equal(header1.ack_required, false);
    assert.equal(sentMessages[0].port, 56700);
    assert.equal(sentMessages[0].address, '192.168.1.100');
    assert.equal(sentMessages[0].serialNumber, 'abcdef123456');
    
    // Verify second message
    const header2 = decodeHeader(sentMessages[1].message);
    assert.equal(header2.source, client.source);
    assert.equal(header2.res_required, false);
    assert.equal(header2.ack_required, false);
    assert.equal(sentMessages[1].port, 56701);
    assert.equal(sentMessages[1].address, '192.168.1.101');
    assert.equal(sentMessages[1].serialNumber, 'fedcba654321');

    // Verify sequence numbers were incremented
    assert.equal(device1.sequence, 1);
    assert.equal(device2.sequence, 1);

    client.dispose();
  });

  test('batchSendOnlyAcknowledgement waits for acknowledgements', async () => {
    const sentMessages: any[] = [];
    
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() {
          assert.fail('onSend should not be called for batch operations');
        },
        onBatchSend(messages) {
          sentMessages.push(...messages);
          
          // Simulate acknowledgement responses
          for (const msg of messages) {
            const header = decodeHeader(msg.message);
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
          }
        },
      }),
    });

    const device1 = Device({
      serialNumber: 'abcdef123456',
      port: 56700,
      address: '192.168.1.100',
    });

    const device2 = Device({
      serialNumber: 'fedcba654321',
      port: 56701,
      address: '192.168.1.101',
    });

    const commands = [
      { command: SetPowerCommand(true), device: device1 },
      { command: SetPowerCommand(false), device: device2 },
    ];

    const results = await client.batchSendOnlyAcknowledgement(commands);

    assert.equal(results.length, 2);
    assert.equal(results[0], undefined); // ACK-only returns void
    assert.equal(results[1], undefined);
    assert.equal(sentMessages.length, 2);
    
    // Verify ACK required flag is set
    const header1 = decodeHeader(sentMessages[0].message);
    const header2 = decodeHeader(sentMessages[1].message);
    assert.equal(header1.ack_required, true);
    assert.equal(header1.res_required, false);
    assert.equal(header2.ack_required, true);
    assert.equal(header2.res_required, false);

    client.dispose();
  });

  test('batchSend waits for responses', async () => {
    const sentMessages: any[] = [];
    
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() {
          assert.fail('onSend should not be called for batch operations');
        },
        onBatchSend(messages) {
          sentMessages.push(...messages);
          
          // Simulate responses
          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i]!;
            const header = decodeHeader(msg.message);
            const payload = new Uint8Array(2);
            // First device gets power 65535, second gets 0
            new DataView(payload.buffer).setUint16(0, i === 0 ? 65535 : 0, true);
            
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
          }
        },
      }),
    });

    const device1 = Device({
      serialNumber: 'abcdef123456',
      port: 56700,
      address: '192.168.1.100',
    });

    const device2 = Device({
      serialNumber: 'fedcba654321',
      port: 56701,
      address: '192.168.1.101',
    });

    const commands = [
      { command: GetPowerCommand(), device: device1 },
      { command: GetPowerCommand(), device: device2 },
    ];

    const results = await client.batchSend(commands);

    assert.equal(results.length, 2);
    assert.equal(results[0], 65535); // Power on
    assert.equal(results[1], 0);     // Power off
    assert.equal(sentMessages.length, 2);
    
    // Verify response required flag is set
    const header1 = decodeHeader(sentMessages[0].message);
    const header2 = decodeHeader(sentMessages[1].message);
    assert.equal(header1.res_required, true);
    assert.equal(header1.ack_required, false);
    assert.equal(header2.res_required, true);
    assert.equal(header2.ack_required, false);

    client.dispose();
  });

  test('batch methods handle empty arrays', async () => {
    let batchSendCalled = false;
    
    const client = Client({
      router: Router({
        onSend() {
          assert.fail('onSend should not be called for empty batch');
        },
        onBatchSend(messages) {
          batchSendCalled = true;
          assert.equal(messages.length, 0);
        },
      }),
    });

    // Test empty batchUnicast
    client.batchUnicast([]);
    assert.ok(batchSendCalled);

    // Test empty batchSendOnlyAcknowledgement
    batchSendCalled = false;
    const ackResults = await client.batchSendOnlyAcknowledgement([]);
    assert.equal(ackResults.length, 0);
    assert.ok(batchSendCalled);

    // Test empty batchSend
    batchSendCalled = false;
    const sendResults = await client.batchSend([]);
    assert.equal(sendResults.length, 0);
    assert.ok(batchSendCalled);

    client.dispose();
  });

  test('batch methods work with router fallback', () => {
    const sentCalls: any[] = [];
    
    const client = Client({
      router: Router({
        onSend(message, port, address, serialNumber) {
          sentCalls.push({ message, port, address, serialNumber });
        },
        // No onBatchSend - should fallback to individual onSend calls
      }),
    });

    const device = Device({
      serialNumber: 'abcdef123456',
      port: 56700,
      address: '192.168.1.100',
    });

    const commands = [
      { command: SetPowerCommand(true), device },
      { command: SetPowerCommand(false), device },
    ];

    client.batchUnicast(commands);

    assert.equal(sentCalls.length, 2);
    assert.equal(sentCalls[0].port, 56700);
    assert.equal(sentCalls[0].address, '192.168.1.100');
    assert.equal(sentCalls[0].serialNumber, 'abcdef123456');
    assert.equal(sentCalls[1].port, 56700);
    assert.equal(sentCalls[1].address, '192.168.1.100');
    assert.equal(sentCalls[1].serialNumber, 'abcdef123456');

    client.dispose();
  });

  test('batch methods throw DisposedClientError when client is disposed', () => {
    const client = Client({
      router: Router({
        onSend() {},
      }),
    });

    const device = Device({
      serialNumber: 'abcdef123456',
      port: 56700,
      address: '192.168.1.100',
    });

    const commands = [{ command: GetPowerCommand(), device }];

    client.dispose();

    assert.throws(() => client.batchUnicast(commands), (error: any) => {
      return error.name === 'DisposedClientError';
    });

    assert.rejects(() => client.batchSendOnlyAcknowledgement(commands), (error: any) => {
      return error.name === 'DisposedClientError';
    });

    assert.rejects(() => client.batchSend(commands), (error: any) => {
      return error.name === 'DisposedClientError';
    });
  });

  test('batchSend handles different devices with same command type', async () => {
    const sentMessages: any[] = [];
    
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() {
          assert.fail('onSend should not be called for batch operations');
        },
        onBatchSend(messages) {
          sentMessages.push(...messages);
          
          // Simulate different power responses
          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i]!;
            const header = decodeHeader(msg.message);
            
            const payload = new Uint8Array(2);
            // Different power levels for different devices
            new DataView(payload.buffer).setUint16(0, i === 0 ? 65535 : 32768, true);
            client.router.receive(
              encode(header.tagged, header.source, header.target, false, false, header.sequence, Type.StatePower, payload)
            );
          }
        },
      }),
    });

    const device1 = Device({
      serialNumber: 'abcdef123456',
      port: 56700,
      address: '192.168.1.100',
    });

    const device2 = Device({
      serialNumber: 'fedcba654321',
      port: 56701,
      address: '192.168.1.101',
    });

    const commands = [
      { command: GetPowerCommand(), device: device1 },
      { command: GetPowerCommand(), device: device2 },
    ];

    const results = await client.batchSend(commands);

    assert.equal(results.length, 2);
    assert.equal(results[0], 65535); // Full power
    assert.equal(results[1], 32768); // Half power

    client.dispose();
  });
});