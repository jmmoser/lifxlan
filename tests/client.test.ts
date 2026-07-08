import { describe, test } from 'bun:test';
import assert from 'node:assert';
import { Client } from '../src/client.js';
import { Router, type ClientRouter, type MessageHandler } from '../src/router.js';
import { Device } from '../src/devices.js';
import { Type } from '../src/constants/index.js';
import { encode, decodeHeader } from '../src/encoding.js';
import { GetPower, GetService, GetColorZones, SetPower } from '../src/commands/index.js';
import { UnhandledCommandError, TimeoutError } from '../src/errors.js';

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

    const res = await client.send(GetPower(), device);

    assert.equal(res, 0xFFFF);
  });

  test('works with a custom router that implements only ClientRouter', async () => {
    // This router has no receive() pipeline - it synthesizes responses in
    // send() - proving Client needs only ClientRouter, not RouterInstance.
    const handlers = new Map<number, MessageHandler>();
    const router: ClientRouter = {
      register(handler, source) {
        const resolved = source ?? 2;
        handlers.set(resolved, handler);
        return resolved;
      },
      deregister(source, handler) {
        if (handlers.get(source) === handler) {
          handlers.delete(source);
        }
      },
      send(message, _port, _address, serialNumber) {
        const request = decodeHeader(message);
        const payload = new Uint8Array(2);
        new DataView(payload.buffer).setUint16(0, 0xABCD, true);
        const response = decodeHeader(encode(
          false,
          request.source,
          request.target,
          false,
          false,
          request.sequence,
          Type.StatePower,
          payload,
        ));
        handlers.get(request.source)?.(response, payload, serialNumber ?? '');
      },
    };

    const client = Client({ router });
    try {
      const res = await client.send(GetPower(), sharedDevice);
      assert.equal(res, 0xABCD);
    } finally {
      client.dispose();
    }
    assert.equal(handlers.size, 0);
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

    await client.send(GetPower(), sharedDevice, { responseMode: 'ack-only' });

    await client.send(GetPower(), sharedDevice, { responseMode: 'ack-only', signal: new AbortController().signal });
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
    const result = await client.send(SetPower(true), sharedDevice);
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

    await assert.rejects(() => client.send(GetPower(), sharedDevice, { responseMode: 'ack-only' }), (error) => {
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

    client.broadcast(GetService());
  });

  test('unicast', () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() {},
      }),
    });

    client.unicast(GetService(), sharedDevice);
  });

  test('abort send', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() {},
      }),
    });

    const signal = AbortSignal.timeout(0);

    // Rejects with the signal's reason (a DOMException named TimeoutError here).
    await assert.rejects(() => client.send(GetPower(), sharedDevice, { signal }), (error) => {
      return error instanceof DOMException && error.name === 'TimeoutError';
    });
  });

  test('send rejects with the abort reason', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() {},
      }),
    });

    const controller = new AbortController();
    const promise = client.send(GetPower(), sharedDevice, { signal: controller.signal });

    const reason = new Error('user cancelled');
    controller.abort(reason);

    await assert.rejects(promise, (error) => error === reason);
  });

  test('pre-aborted signal rejects immediately', async () => {
    const client = Client({
      // No timeout fallback: a hang here would never resolve.
      defaultTimeoutMs: 0,
      router: Router({
        onSend() {},
      }),
    });

    const reason = new Error('already cancelled');
    const signal = AbortSignal.abort(reason);

    await assert.rejects(() => client.send(GetPower(), sharedDevice, { signal }), (error) => {
      return error === reason;
    });
  });

  test('pre-aborted signal does not transmit or consume a sequence number', async () => {
    let sendCount = 0;
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(message) {
          sendCount++;
          const header = decodeHeader(message);
          // The aborted send below must not have consumed sequence 0.
          assert.equal(header.sequence, 0);
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

    await assert.rejects(
      () => client.send(GetPower(), sharedDevice, { signal: AbortSignal.abort() }),
    );
    assert.equal(sendCount, 0); // nothing was transmitted for the aborted call

    await client.send(GetPower(), sharedDevice);
    assert.equal(sendCount, 1);

    client.dispose();
  });

  test('abort after the response has settled is a no-op', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(message) {
          const header = decodeHeader(message);
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

    const controller = new AbortController();
    const result = await client.send(GetPower(), sharedDevice, { signal: controller.signal });
    assert.equal(result, 65535);

    // The settled exchange already removed its abort listener; this must not
    // re-settle the promise or surface an unhandled rejection.
    controller.abort(new Error('too late'));
    await new Promise((resolve) => setTimeout(resolve, 1));

    client.dispose();
  });

  test('multi-response command times out when only partially complete', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(message) {
          const header = decodeHeader(message);
          // Deliver only zone 0 of the two requested zones; the exchange
          // stays open (expectMore) and must be settled by the timeout.
          const payload = new Uint8Array(10);
          const view = new DataView(payload.buffer);
          view.setUint8(0, 2); // zones_count
          view.setUint8(1, 0); // zone_index
          client.router.receive(
            encode(
              header.tagged,
              header.source,
              header.target,
              false,
              false,
              header.sequence,
              Type.StateZone,
              payload,
            ),
          );
        },
      }),
    });

    await assert.rejects(
      () => client.send(GetColorZones(0, 1), sharedDevice, { timeoutMs: 10 }),
      (error) => error instanceof TimeoutError,
    );

    client.dispose();
  });

  test('send times out even when a signal is provided', async () => {
    const client = Client({
      defaultTimeoutMs: 1,
      router: Router({
        onSend() {},
      }),
    });

    // The signal never aborts; the timeout must still settle the promise
    // instead of hanging forever on the lost response.
    await assert.rejects(
      () => client.send(GetPower(), sharedDevice, { signal: new AbortController().signal }),
      (error) => error instanceof TimeoutError,
    );
  });

  test('per-send timeoutMs overrides the default', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend() {},
      }),
    });

    await assert.rejects(
      () => client.send(GetPower(), sharedDevice, { timeoutMs: 1 }),
      (error) => error instanceof TimeoutError && error.timeoutMs === 1,
    );
  });

  test('timeoutMs: 0 disables the timeout for a call', async () => {
    const client = Client({
      defaultTimeoutMs: 1,
      router: Router({
        onSend() {},
      }),
    });

    const controller = new AbortController();
    const promise = client.send(GetPower(), sharedDevice, { timeoutMs: 0, signal: controller.signal });

    // Give the (overridden) 1ms default timeout a chance to fire first; the
    // abort reason below proves it did not.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const reason = new Error('done waiting');
    controller.abort(reason);

    await assert.rejects(promise, (error) => error === reason);
  });

  test('timeout send', async () => {
    const client = Client({
      defaultTimeoutMs: 1,
      router: Router({
        onSend() { },
      }),
    });

    await assert.rejects(() => client.send(GetPower(), sharedDevice), (error) => {
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

    await assert.rejects(() => client.send(GetPower(), sharedDevice));
  });

  test('send on a disposed client rejects instead of throwing', async () => {
    const client = Client({
      router: Router({ onSend() {} }),
    });
    client.dispose();

    // Must not throw synchronously: the failure has to surface through the
    // returned promise so Promise.all fan-outs observe it uniformly.
    const promise = client.send(GetPower(), sharedDevice);
    await assert.rejects(promise, (error: unknown) => Error.isError(error) && error.name === 'DisposedClientError');
  });

  test('send rejects when the transport throws synchronously', async () => {
    const client = Client({
      defaultTimeoutMs: 60000,
      router: Router({
        onSend() {
          throw new Error('socket closed');
        },
      }),
    });

    const promise = client.send(GetPower(), sharedDevice);
    await assert.rejects(promise, /socket closed/);

    // The failed exchange must release its sequence/handler immediately
    // (not wait for the timeout), so a retry can reuse the slot.
    const retry = client.send(GetPower(), sharedDevice, { timeoutMs: 1 });
    await assert.rejects(retry, /socket closed/);
  });

  test('send rejects when createDecoder throws synchronously', async () => {
    const client = Client({
      router: Router({ onSend() {} }),
    });

    const promise = client.send(
      { type: 1234, createDecoder: () => { throw new Error('decoder construction failed'); } },
      sharedDevice,
    );
    await assert.rejects(promise, /decoder construction failed/);

    // The failed exchange must not leave per-device state behind; a normal
    // send afterwards still works.
    await assert.rejects(client.send(GetPower(), sharedDevice, { timeoutMs: 1 }), TimeoutError);
  });

  test('send rejects response modes on commands without a decoder', async () => {
    const client = Client({
      router: Router({ onSend() {} }),
    });

    await assert.rejects(
      client.send({ type: 1234 }, sharedDevice),
      (error: unknown) => Error.isError(error) && error.name === 'ValidationError',
    );
    await assert.rejects(
      client.send({ type: 1234 }, sharedDevice, { responseMode: 'both' }),
      (error: unknown) => Error.isError(error) && error.name === 'ValidationError',
    );

    // ack-only needs no decoder and must still work.
    let sent = 0;
    const ackClient = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(message) {
          sent++;
          const header = decodeHeader(message);
          ackClient.router.receive(
            encode(header.tagged, header.source, header.target, false, false, header.sequence, Type.Acknowledgement),
          );
        },
      }),
    });
    await ackClient.send({ type: 1234 }, sharedDevice, { responseMode: 'ack-only' });
    assert.equal(sent, 1);
  });

  test('send skips sequence numbers held by in-flight requests', async () => {
    const observed: number[] = [];
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(message) {
          const header = decodeHeader(message);
          observed.push(header.sequence);
          if (observed.length > 1) {
            // Answer everything except the first (stuck) request.
            const payload = new Uint8Array(2);
            client.router.receive(
              encode(header.tagged, header.source, header.target, false, false, header.sequence, Type.StatePower, payload),
            );
          }
        },
      }),
    });

    // Request with sequence 0 never gets a response and never times out.
    const stuck = client.send(GetPower(), sharedDevice, { signal: new AbortController().signal });

    // Drive the counter through the entire sequence space. Each send must
    // skip the still-pending sequence 0 instead of conflicting with it.
    for (let i = 0; i < 300; i++) {
      await client.send(GetPower(), sharedDevice);
    }

    assert.equal(observed[0], 0);
    assert.ok(observed.slice(1).every((sequence) => sequence !== 0), 'in-flight sequence 0 must never be reused');

    client.dispose();
    await assert.rejects(stuck, (error: unknown) => Error.isError(error) && error.name === 'DisposedClientError');
  });

  test('dispose rejects pending send promises with DisposedClientError', async () => {
    const client = Client({
      defaultTimeoutMs: 60000,
      router: Router({
        onSend() {},
      }),
    });

    const pending = client.send(GetPower(), sharedDevice);
    client.dispose();

    await assert.rejects(pending, (error: unknown) => Error.isError(error) && error.name === 'DisposedClientError');
  });

  test('max number of inflight ack-only requests', async () => {
    const client = Client({
      // No timeout: the dangling sends must stay pending instead of piling
      // up unhandled TimeoutError rejections after the test ends.
      defaultTimeoutMs: 0,
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
      client.send(GetPower(), device, { responseMode: 'ack-only', signal: new AbortController().signal });
    }

    await assert.rejects(
      client.send(GetPower(), device, { responseMode: 'ack-only', signal: new AbortController().signal }),
      (error: unknown) => Error.isError(error) && error.name === 'SequenceExhaustionError',
    );
  });

  test('max number of inflight send requests', async () => {
    const client = Client({
      // No timeout: the dangling sends must stay pending instead of piling
      // up unhandled TimeoutError rejections after the test ends.
      defaultTimeoutMs: 0,
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
      client.send(GetPower(), device, { signal: new AbortController().signal });
    }

    await assert.rejects(
      client.send(GetPower(), device, { signal: new AbortController().signal }),
      (error: unknown) => Error.isError(error) && error.name === 'SequenceExhaustionError',
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
    const result = await client.send(GetColorZones(0, 1), device);
    
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

  test('multi-response command instance is reusable across concurrent sends', async () => {
    const client = Client({
      defaultTimeoutMs: 0,
      router: Router({
        onSend(message) {
          const header = decodeHeader(message);
          // Respond synchronously with both zones for whichever device was
          // addressed; handlers are registered before router.send() runs.
          for (const zoneIndex of [0, 1]) {
            const payload = new Uint8Array(10);
            const view = new DataView(payload.buffer);
            view.setUint8(0, 2); // zones_count
            view.setUint8(1, zoneIndex); // zone_index
            view.setUint16(2, 120 + zoneIndex, true); // hue
            client.router.receive(
              encode(
                header.tagged,
                header.source,
                header.target,
                false,
                false,
                header.sequence,
                Type.StateZone,
                payload,
              ),
            );
          }
        },
      }),
    });

    const deviceA = Device({ serialNumber: 'abcdef123401', port: 1234, address: '1.2.3.4' });
    const deviceB = Device({ serialNumber: 'abcdef123402', port: 1234, address: '1.2.3.5' });

    // The same command object drives both exchanges.
    const command = GetColorZones(0, 1);
    const [resultA, resultB] = await Promise.all([
      client.send(command, deviceA),
      client.send(command, deviceB),
    ]);

    // Each exchange must get fresh accumulation state: two zones each, not a
    // shared array interleaving both devices' responses.
    assert.equal(resultA.length, 2);
    assert.equal(resultB.length, 2);
    assert.equal(resultA[0]?.zone_index, 0);
    assert.equal(resultA[1]?.zone_index, 1);
    assert.equal(resultB[0]?.zone_index, 0);
    assert.equal(resultB[1]?.zone_index, 1);

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

  test('Symbol.dispose disposes the client like dispose()', async () => {
    const router = Router({ onSend() {} });

    const client = Client({ router });

    assert.strictEqual(typeof client[Symbol.dispose], 'function');
    // While the client is live its source id is held by the router.
    assert.throws(
      () => router.register(() => {}, client.source),
      (error: unknown) => Error.isError(error) && error.name === 'ValidationError',
    );

    client[Symbol.dispose]();
    // The source id is released back to the router: reserving it now succeeds...
    assert.strictEqual(router.register(() => {}, client.source), client.source);
    // ...and the client is disposed: further sends reject.
    const device = Device({
      serialNumber: 'abcdef123456',
      port: 1234,
      address: '1.2.3.4',
    });
    await assert.rejects(
      client.send(GetService(), device),
      (error: unknown) => Error.isError(error) && error.name === 'DisposedClientError',
    );
  });

  test('disposed client throws DisposedClientError on operations', async () => {
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

    // The fire-and-forget (non-promise) operations throw synchronously...
    assert.throws(
      () => client.broadcast(GetService()),
      (error) => Error.isError(error) && error.name === 'DisposedClientError',
    );

    assert.throws(
      () => client.unicast(GetService(), device),
      (error) => Error.isError(error) && error.name === 'DisposedClientError',
    );

    // ...while send() always reports failure through its promise.
    await assert.rejects(
      client.send(GetService(), device, { responseMode: 'ack-only' }),
      (error: unknown) => Error.isError(error) && error.name === 'DisposedClientError',
    );

    await assert.rejects(
      client.send(GetService(), device),
      (error: unknown) => Error.isError(error) && error.name === 'DisposedClientError',
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
    const promise = client.send(GetService(), device);
    
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

  test('AbortSignal without reason rejects with the default abort reason', async () => {
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
    const promise = client.send(GetService(), device, { signal: controller.signal });
    
    // Immediately abort
    controller.abort();

    try {
      await promise;
      assert.fail('Promise should have been rejected');
    } catch (error) {
      // abort() without a reason → the signal's default DOMException reason.
      assert.ok(error instanceof DOMException);
      assert.equal(error.name, 'AbortError');
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
    const promise = client.send(GetService(), device, { signal: controller.signal });
    
    // Abort with custom reason
    controller.abort(customError);

    try {
      await promise;
      assert.fail('Promise should have been rejected');
    } catch (error) {
      // abort(reason) → the promise rejects with exactly that reason.
      assert.equal(error, customError);
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

    const result = await client.send(GetPower(), sharedDevice, { responseMode: 'both' });
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
      decode: GetPower().decode,
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

  test('sequence number increments and wraps per serial number', () => {
    const sequences: number[] = [];
    const client = Client({
      router: Router({
        onSend(message) {
          sequences.push(decodeHeader(message).sequence);
        },
      }),
    });

    const device = Device({
      serialNumber: 'abcdef123456',
      port: 1234,
      address: '1.2.3.4',
    });

    // Send 256 messages to observe increment and wrap (255 is reserved, so
    // sequences run 0..254 then wrap back to 0).
    for (let i = 0; i < 256; i++) {
      client.unicast(GetService(), device);
    }

    assert.equal(sequences[0], 0);
    assert.equal(sequences[1], 1);
    assert.equal(sequences[254], 254);
    assert.equal(sequences[255], 0); // wraps after 254

    client.dispose();
  });

  test('two clients keep independent sequences for the same device', () => {
    const seen = new Map<number, number[]>();
    const router = Router({
      onSend(message) {
        const header = decodeHeader(message);
        const list = seen.get(header.source) ?? [];
        list.push(header.sequence);
        seen.set(header.source, list);
      },
    });

    const a = Client({ router });
    const b = Client({ router });

    const device = Device({
      serialNumber: 'abcdef123456',
      port: 1234,
      address: '1.2.3.4',
    });

    a.unicast(GetService(), device);
    a.unicast(GetService(), device);
    b.unicast(GetService(), device);

    // Each client owns its own sequence space; b's counter is not advanced
    // by a's sends even though they target the same device.
    assert.deepEqual(seen.get(a.source), [0, 1]);
    assert.deepEqual(seen.get(b.source), [0]);

    a.dispose();
    b.dispose();
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
    client.send(GetService(), device).catch(() => {
      // Ignore the rejection - we're testing disposal cleanup
    });

    // Disposal should not throw even if there are pending handlers
    // The actual error handling is internal to the client disposal
    assert.doesNotThrow(() => {
      client.dispose();
    });
  });
});