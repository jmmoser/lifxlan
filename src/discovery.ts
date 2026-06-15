/**
 * Optional discovery helper, exposed as the 'lifxlan/discovery' subpath so
 * the package root keeps only passive building blocks — this is the one
 * piece of the library that acts on a timer. It automates the
 * broadcast-GetService-on-an-interval recipe from the README; receiving is
 * still the caller's socket handler feeding `router.receive()` into
 * `devices.register()`, exactly as without the helper.
 */

import { Client } from './client.js';
import { GetServiceCommand } from './commands/device.js';

import type { RouterInstance } from './router.js';
import type { Device, DevicesInstance } from './devices.js';

export interface DiscoveryOptions {
  /** How often the GetService broadcast repeats. Defaults to 1000ms. */
  intervalMs?: number;
  /**
   * Ends iteration when aborted. Unlike devices.get() — where abort rejects
   * because the awaited lookup never happened — stopping a discovery stream
   * is its expected ending, so the iterator completes normally instead of
   * throwing. Devices already queued are still yielded before it completes.
   */
  signal?: AbortSignal;
  /**
   * Total discovery budget: iteration ends normally (like the signal, and
   * draining the queue the same way) once this elapses. Defaults to 0
   * (disabled) — unlike the 3000ms default of devices.get(), because an
   * open-ended stream silently ending mid-loop would surprise more than a
   * single lookup timing out.
   */
  timeoutMs?: number;
}

export interface DiscoveryInstance extends AsyncIterableIterator<Device, undefined>, Disposable {
  /**
   * Stops discovery immediately: clears the broadcast timer, releases the
   * helper's source id, unsubscribes from the registry, discards any
   * not-yet-consumed devices, and ends iteration. Idempotent. Breaking out
   * of a `for await` loop does the same through the iterator's return(), and
   * a `using` declaration does the same through `Symbol.dispose` at end of
   * scope.
   */
  dispose(): void;
}

/**
 * Discovers LIFX devices by broadcasting GetService immediately and then on
 * an interval, yielding each device exactly once as it lands in `devices`:
 * devices already registered before the call are yielded first, then new
 * registrations as they arrive. (A device removed from the registry and
 * later re-registered counts as a new registration and is yielded again.)
 *
 * The helper creates and owns a Client on `router` — one source id for the
 * lifetime of the loop, released on completion — so no outside code can
 * dispose its transport mid-broadcast. Should the router's onSend itself
 * start throwing (e.g. the socket was closed), iteration ends instead of
 * the timer crashing the process; the initial synchronous broadcast inside
 * the discover() call itself still throws, matching client.broadcast().
 *
 * Iteration ends normally — never with an error — on signal abort, on the
 * timeoutMs budget elapsing (both deliver already-queued devices first), on
 * dispose(), or on breaking out of the loop (both discard the queue).
 *
 * @example
 * ```javascript
 * for await (const device of discover(router, devices, { timeoutMs: 3000 })) {
 *   console.log('found', device.serialNumber, device.address);
 * }
 * ```
 *
 * @example
 * ```javascript
 * // `using` disposes the stream at end of scope (Node >= 22, or any
 * // toolchain that downlevels `using` against Symbol.dispose).
 * using discovery = discover(router, devices);
 * const device = await devices.get('d07123456789');
 * ```
 */
export function discover(
  router: RouterInstance,
  devices: DevicesInstance,
  options: DiscoveryOptions = {},
): DiscoveryInstance {
  const signal = options.signal;

  const queue: Device[] = [];
  // Every waiter is woken on every event (new device, completion); next()
  // re-checks the queue in a loop, so a wakeup without an item for a given
  // waiter just puts it back to sleep. A single resolver slot instead of a
  // set would drop all but the latest concurrent next() call.
  const waiters = new Set<() => void>();
  let done = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let teardown: (() => void) | undefined;

  function wake() {
    if (waiters.size === 0) return;
    const pending = Array.from(waiters);
    waiters.clear();
    for (const resolve of pending) {
      resolve();
    }
  }

  function finish() {
    if (done) return;
    done = true;
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
    if (deadline !== undefined) {
      clearTimeout(deadline);
      deadline = undefined;
    }
    if (teardown) {
      teardown();
    }
    wake();
  }

  if (signal?.aborted) {
    // The caller already cancelled. An already-aborted signal never fires
    // another 'abort' event, so the listener below would never run; end
    // up front instead, before any client, broadcast, or timer exists.
    done = true;
  } else {
    // Snapshot-then-subscribe runs synchronously, so a device registered
    // between the two cannot be missed (and none can be yielded twice).
    queue.push(...devices.registered.values());
    const unsubscribe = devices.subscribe({
      onAdded(device) {
        queue.push(device);
        wake();
      },
    });

    const client = Client({ router });

    teardown = () => {
      // finish() can be invoked by the abort listener itself; removal is a
      // no-op then, but every other path must detach it or a long-lived
      // signal accumulates a closure per discovery.
      signal?.removeEventListener('abort', finish);
      unsubscribe();
      client.dispose();
    };

    signal?.addEventListener('abort', finish, { once: true });

    const timeoutMs = options.timeoutMs ?? 0;
    if (timeoutMs > 0) {
      deadline = setTimeout(finish, timeoutMs);
    }

    try {
      client.broadcast(GetServiceCommand());
    } catch (err) {
      finish();
      throw err;
    }
    timer = setInterval(() => {
      try {
        client.broadcast(GetServiceCommand());
      } catch {
        // The transport refused the packet (socket closed, router onSend
        // threw). Inside a timer callback the throw would otherwise be an
        // uncaught exception every tick; the stream is over, end it.
        finish();
      }
    }, options.intervalMs ?? 1000);
  }

  function disposeNow() {
    queue.length = 0;
    finish();
  }

  const iterator: DiscoveryInstance = {
    dispose: disposeNow,
    // Enables `using discovery = discover(...)`: end of scope disposes the
    // stream. Requiring Node >= 22 (where Symbol.dispose exists natively)
    // is what makes defining this safe — on older runtimes the symbol was
    // undefined and the computed key silently became the string "undefined".
    [Symbol.dispose]: disposeNow,
    [Symbol.asyncIterator]() {
      return iterator;
    },
    async next(): Promise<IteratorResult<Device, undefined>> {
      while (queue.length === 0 && !done) {
        await new Promise<void>((resolve) => {
          waiters.add(resolve);
        });
      }
      const device = queue.shift();
      if (device !== undefined) {
        return { value: device, done: false };
      }
      return { value: undefined, done: true };
    },
    return(): Promise<IteratorResult<Device, undefined>> {
      // Per iterator protocol a closed iterator must not produce values, so
      // unlike abort/timeout (which drain), return() discards the queue.
      queue.length = 0;
      finish();
      return Promise.resolve({ value: undefined, done: true });
    },
  };

  return iterator;
}
