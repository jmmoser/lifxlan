import { describe, test, expect } from 'bun:test';
import { Router } from '../src/router.js';
import { Devices } from '../src/devices.js';
import { discover } from '../src/discovery.js';
import { Type } from '../src/constants/index.js';
import { decodeHeader } from '../src/encoding.js';

const SERIAL_A = 'd073d5000001';
const SERIAL_B = 'd073d5000002';
const SERIAL_C = 'd073d5000003';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function recordingRouter() {
  const sent: Uint8Array[] = [];
  const waiters: Array<{ n: number; resolve: () => void }> = [];
  const router = Router({
    onSend(message) {
      sent.push(message);
      for (let i = waiters.length - 1; i >= 0; i--) {
        const waiter = waiters[i];
        if (waiter !== undefined && sent.length >= waiter.n) {
          waiters.splice(i, 1);
          waiter.resolve();
        }
      }
    },
  });
  // Resolves the moment the cumulative send count first reaches n, so timing
  // assertions wait exactly as long as needed instead of a fixed sleep.
  function untilSent(n: number): Promise<void> {
    if (sent.length >= n) return Promise.resolve();
    return new Promise((resolve) => { waiters.push({ n, resolve }); });
  }
  return { router, sent, untilSent };
}

describe('discovery', () => {
  test('broadcasts GetService immediately and on the interval, and stops on dispose', async () => {
    const { router, sent, untilSent } = recordingRouter();
    const devices = Devices();

    const discovery = discover(router, devices, { intervalMs: 1 });
    expect(sent.length).toBe(1);
    const initial = sent[0];
    if (initial === undefined) throw new Error('no initial broadcast');
    expect(decodeHeader(initial).type).toBe(Type.GetService);

    // Wait for exactly the second broadcast rather than guessing a duration.
    await untilSent(2);
    expect(sent.length).toBeGreaterThanOrEqual(2);

    discovery.dispose();
    const sendsAtDispose = sent.length;
    // With intervalMs:1 a leaked timer would fire ~20 more times in this window,
    // so a cleared timer is asserted by margin, not by luck.
    await sleep(20);
    expect(sent.length).toBe(sendsAtDispose);
  });

  test('yields devices registered before the call first, then new registrations', async () => {
    const { router } = recordingRouter();
    const devices = Devices();
    devices.register(SERIAL_A, 56700, '10.0.0.1');

    const discovery = discover(router, devices);
    devices.register(SERIAL_B, 56700, '10.0.0.2');

    const first = await discovery.next();
    const second = await discovery.next();
    expect(first.done).toBe(false);
    expect(first.value?.serialNumber).toBe(SERIAL_A);
    expect(second.done).toBe(false);
    expect(second.value?.serialNumber).toBe(SERIAL_B);

    discovery.dispose();
  });

  test('a pending next() resolves when a device is registered', async () => {
    const { router } = recordingRouter();
    const devices = Devices();
    const discovery = discover(router, devices);

    const pending = discovery.next();
    devices.register(SERIAL_A, 56700, '10.0.0.1');

    const result = await pending;
    expect(result.done).toBe(false);
    expect(result.value?.serialNumber).toBe(SERIAL_A);

    discovery.dispose();
  });

  test('concurrent next() calls all settle', async () => {
    const { router } = recordingRouter();
    const devices = Devices();
    const discovery = discover(router, devices);

    const pending = Promise.all([discovery.next(), discovery.next()]);
    devices.register(SERIAL_A, 56700, '10.0.0.1');
    devices.register(SERIAL_B, 56700, '10.0.0.2');

    const [first, second] = await pending;
    expect(first.done).toBe(false);
    expect(second.done).toBe(false);
    const serials = [first.value?.serialNumber, second.value?.serialNumber].sort();
    expect(serials).toEqual([SERIAL_A, SERIAL_B]);

    discovery.dispose();
  });

  test('abort ends iteration normally and drains already-queued devices', async () => {
    const { router } = recordingRouter();
    const devices = Devices();
    const controller = new AbortController();
    const discovery = discover(router, devices, { signal: controller.signal });

    devices.register(SERIAL_A, 56700, '10.0.0.1');
    controller.abort();

    const first = await discovery.next();
    expect(first.done).toBe(false);
    expect(first.value?.serialNumber).toBe(SERIAL_A);
    const second = await discovery.next();
    expect(second.done).toBe(true);
  });

  test('an already-aborted signal drains the registry snapshot then ends, doing no network work', async () => {
    const { router, sent } = recordingRouter();
    const devices = Devices();
    devices.register(SERIAL_A, 56700, '10.0.0.1');
    const controller = new AbortController();
    controller.abort();

    const discovery = discover(router, devices, { signal: controller.signal });
    // No client, no broadcast, no timer — but the snapshot is still yielded.
    expect(sent.length).toBe(0);

    const first = await discovery.next();
    expect(first.done).toBe(false);
    expect(first.value?.serialNumber).toBe(SERIAL_A);

    const second = await discovery.next();
    expect(second.done).toBe(true);
  });

  test('an already-aborted signal owns no source id', () => {
    const handlers = new Map();
    const router = Router({ onSend() {}, handlers });
    const devices = Devices();
    const controller = new AbortController();
    controller.abort();

    discover(router, devices, { signal: controller.signal });
    expect(handlers.size).toBe(0);
  });

  test('timeoutMs ends iteration normally and drains the queue', async () => {
    const { router } = recordingRouter();
    const devices = Devices();
    const discovery = discover(router, devices, { timeoutMs: 5 });

    devices.register(SERIAL_A, 56700, '10.0.0.1');
    devices.register(SERIAL_B, 56700, '10.0.0.2');

    // The two devices are queued synchronously; the loop yields them, then
    // blocks on next() until the deadline fires finish() — no sleep needed.
    const collected: string[] = [];
    for await (const device of discovery) {
      collected.push(device.serialNumber);
    }
    expect(collected).toEqual([SERIAL_A, SERIAL_B]);
  });

  test('a pending next() resolves done when the timeout elapses', async () => {
    const { router } = recordingRouter();
    const devices = Devices();
    const discovery = discover(router, devices, { timeoutMs: 5 });

    const result = await discovery.next();
    expect(result.done).toBe(true);
  });

  test('breaking out of for-await stops broadcasting and discards the queue', async () => {
    const { router, sent } = recordingRouter();
    const devices = Devices();
    devices.register(SERIAL_A, 56700, '10.0.0.1');
    devices.register(SERIAL_B, 56700, '10.0.0.2');

    const discovery = discover(router, devices, { intervalMs: 1 });
    for await (const device of discovery) {
      expect(device.serialNumber).toBe(SERIAL_A);
      break;
    }

    // return() ran: post-close next() must report done despite SERIAL_B
    // having been queued, and the broadcast timer must be gone.
    const after = await discovery.next();
    expect(after.done).toBe(true);
    const sendsAtBreak = sent.length;
    // With intervalMs:1 a surviving timer would fire many times in this window.
    await sleep(20);
    expect(sent.length).toBe(sendsAtBreak);
  });

  test('owns and releases its source id', () => {
    const handlers = new Map();
    const router = Router({ onSend() {}, handlers });
    const devices = Devices();

    const discovery = discover(router, devices);
    expect(handlers.size).toBe(1);
    discovery.dispose();
    expect(handlers.size).toBe(0);
  });

  test('Symbol.dispose stops discovery like dispose()', async () => {
    const handlers = new Map();
    const router = Router({ onSend() {}, handlers });
    const devices = Devices();
    const discovery = discover(router, devices);

    expect(typeof discovery[Symbol.dispose]).toBe('function');
    expect(handlers.size).toBe(1);

    discovery[Symbol.dispose]();
    expect(handlers.size).toBe(0);
    const result = await discovery.next();
    expect(result.done).toBe(true);
  });

  test('dispose is idempotent and resolves pending next() calls', async () => {
    const { router } = recordingRouter();
    const devices = Devices();
    const discovery = discover(router, devices);

    const pending = discovery.next();
    discovery.dispose();
    discovery.dispose();

    const result = await pending;
    expect(result.done).toBe(true);
  });

  test('a synchronous transport failure on the initial broadcast throws and cleans up', () => {
    const handlers = new Map();
    const router = Router({
      onSend() {
        throw new Error('socket closed');
      },
      handlers,
    });
    const devices = Devices();

    expect(() => discover(router, devices)).toThrow('socket closed');
    // The owned client and the registry subscription must not leak.
    expect(handlers.size).toBe(0);
    devices.register(SERIAL_C, 56700, '10.0.0.3');
  });

  test('a transport failure on a later tick ends iteration instead of crashing', async () => {
    let calls = 0;
    const router = Router({
      onSend() {
        calls += 1;
        if (calls > 1) {
          throw new Error('socket closed');
        }
      },
    });
    const devices = Devices();
    const discovery = discover(router, devices, { intervalMs: 1 });

    const result = await discovery.next();
    expect(result.done).toBe(true);
  });

  test('a device removed and re-registered is yielded again', async () => {
    const { router } = recordingRouter();
    const devices = Devices();
    const discovery = discover(router, devices);

    devices.register(SERIAL_A, 56700, '10.0.0.1');
    expect((await discovery.next()).value?.serialNumber).toBe(SERIAL_A);

    devices.remove(SERIAL_A);
    devices.register(SERIAL_A, 56700, '10.0.0.9');
    const again = await discovery.next();
    expect(again.done).toBe(false);
    expect(again.value?.address).toBe('10.0.0.9');

    discovery.dispose();
  });
});
