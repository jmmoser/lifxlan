import { describe, test } from 'bun:test';
import assert from 'node:assert';
import { Router } from '../src/router.js';
import { encode, Header } from '../src/encoding.js';
import { Type } from '../src/constants/index.js';
import { ValidationError } from '../src/errors.js';

describe('router', () => {
  test('register allocates a distinct source on each call', () => {
    const router = Router({
      onSend() {},
    });

    const source1 = router.register(() => {});
    const source2 = router.register(() => {});

    assert.ok(source1 >= 2);
    assert.ok(source2 >= 2);
    assert.notEqual(source1, source2);
  });

  test('register and deregister handler', () => {
    const router = Router({
      onSend() {},
    });

    const handler = () => {};
    const source = router.register(handler);

    router.deregister(source, handler);
  });

  test('register throws error for invalid explicit source', () => {
    const router = Router({
      onSend() {},
    });

    const handler = () => {};

    assert.throws(() => router.register(handler, 0), /Invalid source/);
    assert.throws(() => router.register(handler, 1), /Invalid source/);
    assert.throws(() => router.register(handler, 0x100000000), /Invalid source/);
  });

  test('register throws error for already registered source', () => {
    const router = Router({
      onSend() {},
    });

    const handler1 = () => {};
    const handler2 = () => {};
    const source = router.register(handler1);

    assert.throws(() => router.register(handler2, source), (error) => (
      error instanceof ValidationError && error.name === 'ValidationError' && error.parameter === 'source'
    ));
  });

  test('deregister throws error for handler mismatch', () => {
    const router = Router({
      onSend() {},
    });

    const handler1 = () => {};
    const handler2 = () => {};
    const source = router.register(handler1);

    assert.throws(() => router.deregister(source, handler2), (error) => (
      error instanceof ValidationError && error.name === 'ValidationError' && error.parameter === 'messageHandler'
    ));
  });

  test('send calls onSend with correct parameters', () => {
    let sentMessage: Uint8Array | undefined, sentPort: number | undefined, sentAddress: string | undefined, sentSerialNumber: string | undefined;
    
    const router = Router({
      onSend(message, port, address, serialNumber) {
        sentMessage = message;
        sentPort = port;
        sentAddress = address;
        sentSerialNumber = serialNumber;
      },
    });
    
    const message = new Uint8Array([1, 2, 3, 4]);
    router.send(message, 56700, '192.168.1.100', 'abcdef123456');
    
    assert.deepEqual(sentMessage, message);
    assert.equal(sentPort, 56700);
    assert.equal(sentAddress, '192.168.1.100');
    assert.equal(sentSerialNumber, 'abcdef123456');
  });

  test('send calls onSend without serial number', () => {
    let sentMessage: Uint8Array | undefined, sentPort: number | undefined, sentAddress: string | undefined, sentSerialNumber: string | undefined;
    
    const router = Router({
      onSend(message, port, address, serialNumber) {
        sentMessage = message;
        sentPort = port;
        sentAddress = address;
        sentSerialNumber = serialNumber;
      },
    });
    
    const message = new Uint8Array([1, 2, 3, 4]);
    router.send(message, 56700, '192.168.1.100');
    
    assert.deepEqual(sentMessage, message);
    assert.equal(sentPort, 56700);
    assert.equal(sentAddress, '192.168.1.100');
    assert.equal(sentSerialNumber, undefined);
  });

  test('receive routes message to registered handler', () => {
    let receivedHeader: Header | undefined, receivedPayload: Uint8Array | undefined, receivedSerialNumber: string | undefined;
    
    const router = Router({
      onSend() {},
    });
    
    const handler = (header: Header, payload: Uint8Array, serialNumber: string) => {
      receivedHeader = header;
      receivedPayload = payload;
      receivedSerialNumber = serialNumber;
    };
    
    const source = 12345;
    router.register(handler, source);

    const message = encode(
      false, // tagged
      source, // source
      new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]), // target
      false, // res_required
      false, // ack_required
      10, // sequence
      Type.StatePower, // type
      new Uint8Array([0xff, 0xff]) // payload
    );
    
    const result = router.receive(message);
    if (!result) throw new Error('expected receive to decode message');

    assert.ok(receivedHeader);
    assert.equal(receivedHeader.source, source);
    assert.equal(receivedHeader.sequence, 10);
    assert.equal(receivedHeader.type, Type.StatePower);
    assert.deepEqual(receivedPayload, new Uint8Array([0xff, 0xff]));
    assert.equal(receivedSerialNumber, '010203040506');

    assert.deepEqual(result.header, receivedHeader);
    assert.deepEqual(result.payload, receivedPayload);
    assert.equal(result.serialNumber, receivedSerialNumber);
  });

  test('receive calls onMessage when provided', () => {
    let onMessageHeader: any, onMessagePayload: Uint8Array | undefined, onMessageSerialNumber: string | undefined;
    
    const router = Router({
      onSend() {},
      onMessage(header, payload, serialNumber) {
        onMessageHeader = header;
        onMessagePayload = payload;
        onMessageSerialNumber = serialNumber;
      },
    });
    
    const message = encode(
      false, // tagged
      54321, // source
      new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]), // target
      false, // res_required
      false, // ack_required
      5, // sequence
      Type.StateLabel, // type
      new Uint8Array([0x41, 0x42, 0x43]) // payload
    );
    
    router.receive(message);
    
    assert.ok(onMessageHeader);
    assert.equal(onMessageHeader.source, 54321);
    assert.equal(onMessageHeader.sequence, 5);
    assert.equal(onMessageHeader.type, Type.StateLabel);
    assert.deepEqual(onMessagePayload, new Uint8Array([0x41, 0x42, 0x43]));
    assert.equal(onMessageSerialNumber, 'aabbccddeeff');
  });

  test('receive handles message with no registered handler', () => {
    const router = Router({
      onSend() {},
    });
    
    const message = encode(
      false, // tagged
      99999, // source (not registered)
      new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]), // target
      false, // res_required
      false, // ack_required
      1, // sequence
      Type.GetService, // type
      new Uint8Array() // payload
    );
    
    // Should not throw an error
    const result = router.receive(message);
    if (!result) throw new Error('expected receive to decode message');

    assert.ok(result.header);
    assert.equal(result.header.source, 99999);
    assert.equal(result.serialNumber, '010203040506');
  });

  test('register keeps allocating distinct sources past a pre-filled range', () => {
    const router = Router({
      onSend() {},
    });

    // Reserve sources 2..99 explicitly so allocation must skip past them.
    for (let i = 2; i < 100; i++) {
      router.register(() => {}, i);
    }

    const allocated = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const source = router.register(() => {});
      assert.ok(source >= 100, 'allocated source should skip the pre-filled range');
      assert.ok(!allocated.has(source), 'allocated sources must be distinct');
      allocated.add(source);
    }

    assert.equal(allocated.size, 200);
  });

  test('register skips reserved values 0 and 1', () => {
    const router = Router({
      onSend() {},
    });

    const source = router.register(() => {});
    assert.ok(source >= 2);
  });

  test('receive calls both handler and onMessage', () => {
    let handlerCalled = false;
    let onMessageCalled = false;
    
    const router = Router({
      onSend() {},
      onMessage() {
        onMessageCalled = true;
      },
    });
    
    const handler = () => {
      handlerCalled = true;
    };
    
    const source = 12345;
    router.register(handler, source);

    const message = encode(
      false, // tagged
      source, // source
      new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]), // target
      false, // res_required
      false, // ack_required
      1, // sequence
      Type.GetService, // type
      new Uint8Array() // payload
    );

    router.receive(message);

    assert.ok(handlerCalled);
    assert.ok(onMessageCalled);
  });

  test('register advances past a contiguous filled range', () => {
    const router = Router({
      onSend() {},
    });

    // Reserve values 2-100 to force the allocator to advance.
    for (let i = 2; i <= 100; i++) {
      router.register(() => {}, i);
    }

    const source = router.register(() => {});
    assert.ok(source > 100, 'allocated source should be beyond the filled range');
  });

  test('register with explicit source validates boundary conditions', () => {
    const router = Router({
      onSend() {},
    });

    const handler = () => {};

    // Invalid explicit sources.
    assert.throws(() => router.register(handler, -1), /Invalid source/);
    assert.throws(() => router.register(handler, 0x100000000), /Invalid source/);

    // Valid boundary values.
    router.register(handler, 2);
    router.deregister(2, handler);

    router.register(handler, 0xFFFFFFFF);
    router.deregister(0xFFFFFFFF, handler);
  });

  test('receive does not throw on malformed packet and reports via onError', () => {
    let errorMessage: Uint8Array | undefined;
    let errorObj: unknown;
    const router = Router({
      onSend() {},
      onError(err, message) {
        errorObj = err;
        errorMessage = message;
      },
    });

    const tooShort = new Uint8Array(10);
    const result = router.receive(tooShort);

    assert.equal(result, undefined);
    assert.ok(errorObj);
    assert.deepEqual(errorMessage, tooShort);
  });

  test('receive silently swallows malformed packet when no onError provided', () => {
    const router = Router({
      onSend() {},
    });

    const tooShort = new Uint8Array(10);
    const result = router.receive(tooShort);

    assert.equal(result, undefined);
  });

  test('receive rejects packet whose declared size exceeds buffer', () => {
    let errorObj: unknown;
    const router = Router({
      onSend() {},
      onError(err) {
        errorObj = err;
      },
    });

    // Build a 36-byte header but claim size = 1000
    const message = new Uint8Array(36);
    new DataView(message.buffer).setUint16(0, 1000, true);

    const result = router.receive(message);
    assert.equal(result, undefined);
    assert.ok(errorObj);
  });

  test('register searches through a large filled range', () => {
    const router = Router({
      onSend() {},
    });

    // Reserve a large contiguous range to force the allocator to scan past it.
    for (let i = 2; i < 1000; i++) {
      router.register(() => {}, i);
    }

    const source = router.register(() => {});
    assert.ok(source >= 1000, 'allocated source should be outside the filled range');
  });
});