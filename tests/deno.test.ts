/**
 * Exercises the `lifxlan/deno` helper's wiring - send path, read loop,
 * registration, close semantics, error routing - against an in-memory fake
 * of the structural `Deno.DatagramConn` slice the module declares. The
 * module resolves `Deno` from the global scope at call time, so installing
 * a fake namespace on globalThis lets the whole helper run under bun:test.
 * The real-runtime counterpart is scripts/smoke-deno.mjs, which CI runs on
 * actual Deno over loopback UDP.
 */
import { describe, test } from 'bun:test';
import assert from 'node:assert';
import { openLan, type DenoDatagramConn, type DenoNetAddr } from '../src/deno.js';
import { Device } from '../src/devices.js';
import { Type } from '../src/constants/index.js';
import { encode, decodeHeader } from '../src/encoding.js';
import { GetPower } from '../src/commands/index.js';
import { DisposedClientError } from '../src/errors.js';
import { convertSerialNumberToTarget } from '../src/utils/index.js';

const SERIAL = 'd073d5123456';
const DEVICE_ADDR: DenoNetAddr = { transport: 'udp', hostname: '10.0.0.9', port: 56700 };

interface FakeConn extends DenoDatagramConn {
  sent: Array<{ data: Uint8Array; addr: DenoNetAddr }>;
  /** Delivers a datagram to the helper's read loop, as if it arrived. */
  push(data: Uint8Array, from: DenoNetAddr): void;
  failNextSend(err: Error): void;
  /** Called synchronously for each send; lets a test act as the device. */
  onSend?: (data: Uint8Array, addr: DenoNetAddr) => void;
}

function fakeConn(): FakeConn {
  const queue: Array<[Uint8Array, DenoNetAddr]> = [];
  let waiter: {
    resolve: (r: IteratorResult<[Uint8Array, DenoNetAddr]>) => void;
    reject: (err: Error) => void;
  } | undefined;
  let closed = false;
  let nextSendError: Error | undefined;

  const conn: FakeConn = {
    addr: { transport: 'udp', hostname: '127.0.0.1', port: 41000 },
    sent: [],
    push(data, from) {
      if (waiter) {
        const w = waiter;
        waiter = undefined;
        w.resolve({ value: [data, from], done: false });
      } else {
        queue.push([data, from]);
      }
    },
    failNextSend(err) {
      nextSendError = err;
    },
    send(data, addr) {
      conn.sent.push({ data, addr });
      if (conn.onSend) conn.onSend(data, addr);
      if (nextSendError) {
        const err = nextSendError;
        nextSendError = undefined;
        return Promise.reject(err);
      }
      return Promise.resolve(data.length);
    },
    close() {
      closed = true;
      if (waiter) {
        const w = waiter;
        waiter = undefined;
        // Matches Deno, where close() interrupts a pending iteration with
        // a BadResource error rather than ending it cleanly.
        w.reject(new Error('BadResource: socket closed'));
      }
    },
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<[Uint8Array, DenoNetAddr]>> {
          const item = queue.shift();
          if (item) return Promise.resolve({ value: item, done: false });
          if (closed) return Promise.reject(new Error('BadResource: socket closed'));
          return new Promise((resolve, reject) => {
            waiter = { resolve, reject };
          });
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    },
  };
  return conn;
}

interface ListenOptions { hostname?: string; port: number; transport: 'udp' }

declare global {
  // The helper's `Deno.listenDatagram` lookup resolves against globalThis at
  // call time; this makes the fake installable without `any`.
  var Deno: { listenDatagram(options: ListenOptions): DenoDatagramConn } | undefined;
}

let conn: FakeConn;
let listenOptions: ListenOptions | undefined;

globalThis.Deno = {
  listenDatagram(options) {
    listenOptions = options;
    return conn;
  },
};

function stateServiceFrom(serialNumber: string): Uint8Array {
  return encode(
    false,
    99,
    convertSerialNumberToTarget(serialNumber),
    false,
    false,
    0,
    Type.StateService,
    new Uint8Array([1, 0x7c, 0xdd, 0x00, 0x00]),
  );
}

describe('openLan (deno)', () => {
  test('binds with mapped options and completes a request/response round trip', async () => {
    conn = fakeConn();
    conn.onSend = (data, addr) => {
      const header = decodeHeader(data);
      if (header.type !== Type.GetPower) return;
      const reply = encode(
        false,
        header.source,
        header.target,
        false,
        false,
        header.sequence,
        Type.StatePower,
        new Uint8Array([0xff, 0xff]),
      );
      conn.push(reply, { transport: 'udp', hostname: addr.hostname, port: addr.port });
    };

    // Destructured on purpose: the documented contract is that nothing on
    // the instance relies on `this`, so unbound use must keep working.
    const { client, devices, close } = await openLan({ address: '127.0.0.1', port: 41000 });
    assert.deepEqual(listenOptions, { hostname: '127.0.0.1', port: 41000, transport: 'udp' });

    const device = Device({ serialNumber: SERIAL, address: DEVICE_ADDR.hostname, port: DEVICE_ADDR.port });
    const power = await client.send(GetPower(), device);
    assert.equal(power, 0xffff);
    assert.deepEqual(conn.sent[0]?.addr, DEVICE_ADDR);
    // The reply flowed through the read loop, so the device registered too.
    assert.equal(devices.registered.get(SERIAL)?.address, DEVICE_ADDR.hostname);

    await close();
  });

  test('read loop registers unsolicited udp datagrams and skips other transports', async () => {
    conn = fakeConn();
    const added: string[] = [];
    const lan = await openLan({
      onAdded(device) {
        added.push(device.serialNumber);
      },
    });

    conn.push(stateServiceFrom(SERIAL), { transport: 'unix', hostname: 'n/a', port: 0 });
    conn.push(stateServiceFrom(SERIAL), DEVICE_ADDR);

    const device = await lan.devices.get(SERIAL, { timeoutMs: 1000 });
    assert.equal(device.port, DEVICE_ADDR.port);
    assert.deepEqual(added, [SERIAL]); // the non-udp datagram registered nothing

    await lan.close();
  });

  test('close() rejects pending sends, ends the read loop, and is idempotent', async () => {
    conn = fakeConn();
    const errors: Error[] = [];
    const lan = await openLan({
      onSocketError(err) {
        errors.push(err);
      },
    });

    const device = Device({ serialNumber: SERIAL, address: DEVICE_ADDR.hostname, port: DEVICE_ADDR.port });
    const pending = lan.client.send(GetPower(), device, { timeoutMs: 10_000 });

    const first = lan.close();
    assert.equal(lan.close(), first);
    await first; // resolves only once the read loop has ended

    await assert.rejects(pending, DisposedClientError);
    assert.equal(errors.length, 0); // close() interrupting the loop is not an error
    assert.equal(typeof lan[Symbol.asyncDispose], 'function');
    await lan[Symbol.asyncDispose]();
  });

  test('async send failures route to onSocketError instead of rejecting anything', async () => {
    conn = fakeConn();
    const errors: Error[] = [];
    const lan = await openLan({
      onSocketError(err) {
        errors.push(err);
      },
    });

    const device = Device({ serialNumber: SERIAL, address: DEVICE_ADDR.hostname, port: DEVICE_ADDR.port });
    conn.failNextSend(new Error('NetworkUnreachable'));
    lan.client.unicast(GetPower(), device); // fire-and-forget: nothing to await

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.message, 'NetworkUnreachable');

    await lan.close();
  });
});
