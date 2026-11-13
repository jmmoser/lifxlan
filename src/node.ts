/**
 * Batteries-included setup for Node.js and Bun, exposed as the
 * 'lifxlan/node' subpath so the package root stays runtime-agnostic. It
 * packages the wiring every `node:dgram` program repeats — create a socket,
 * connect Router/Devices/Client to it, bind, enable broadcast — behind one
 * async call. The pieces it returns are the ordinary public abstractions, so
 * everything composable about them (discovery, taps, extra clients on the
 * same router) still works; and nothing here is required — any runtime can
 * keep wiring its own socket exactly as before.
 *
 * Bun runs this module through its `node:dgram` implementation; the Deno
 * counterpart lives in 'lifxlan/deno' (neither module is ever loaded unless
 * imported).
 */

import dgram from 'node:dgram';

import { wire } from './lan.js';

import type { Lan as LanOf, OpenLanOptions } from './lan.js';

export type { OpenLanOptions };

/**
 * What {@link openLan} resolves to: a Router, Devices registry, and Client
 * wired to one `node:dgram` socket, plus `close()`.
 */
export type Lan = LanOf<dgram.Socket>;

/**
 * Opens a UDP socket via `node:dgram` and returns a ready-to-use
 * `Router`, `Devices` registry, and `Client` wired to it:
 * outbound messages go out the socket, inbound datagrams flow through
 * `router.receive()` into `devices.register()`, the socket is bound (with
 * broadcast enabled, so discovery works) by the time the promise resolves.
 *
 * Works on Node.js ≥ 22.12 and Bun. The zero-copy buffer-ownership caveat
 * documented on `router.receive()` does not apply here: `node:dgram`
 * allocates a fresh buffer per datagram.
 *
 * @example
 * ```javascript
 * import { SetPower } from 'lifxlan';
 * import { openLan } from 'lifxlan/node';
 * import { discover } from 'lifxlan/discovery';
 *
 * const { client, devices, router, close } = await openLan();
 * using discovery = discover(router, devices);
 * const device = await devices.waitFor('d07123456789');
 * await client.send(SetPower(true), device);
 * await close();
 * ```
 */
export async function openLan(options: OpenLanOptions = {}): Promise<Lan> {
  const socket = dgram.createSocket('udp4');

  const onSocketError = options.onSocketError;

  // Created before the socket is bound, so a rejected option (a NaN
  // defaultTimeoutMs) fails before the port is taken; the socket is closed
  // on that path all the same.
  let wired: ReturnType<typeof wire>;
  try {
    wired = wire(options, (message, port, address) => {
      // Without a callback, an async send failure is emitted as a socket
      // 'error' event; routing it through the callback keeps per-packet
      // failures observable (or deliberately discarded) without touching
      // the socket-wide error path.
      socket.send(message, port, address, (err) => {
        if (err && onSocketError) onSocketError(err);
      });
    });
  } catch (err) {
    try { socket.close(); } catch { /* already closed */ }
    throw err;
  }
  const { router, devices, client } = wired;

  socket.on('message', (message, remote) => {
    devices.register(remote.port, remote.address, router.receive(message));
  });

  await new Promise<void>((resolve, reject) => {
    const onBindError = (err: Error) => {
      // A socket that failed to bind is unusable; release it before
      // rejecting so callers don't have to know it was ever created.
      try { socket.close(); } catch { /* already closed */ }
      reject(err);
    };
    socket.once('error', onBindError);
    socket.once('listening', () => {
      socket.removeListener('error', onBindError);
      resolve();
    });
    // bind() also throws synchronously on some invalid arguments (a
    // non-string address from an untyped caller) instead of emitting
    // 'error'; that path must release the socket too.
    try {
      socket.bind(options.port ?? 0, options.address);
    } catch (err) {
      onBindError(err instanceof Error ? err : new Error(String(err)));
    }
  });

  // From here on the socket must not crash the process on a stray 'error'
  // event (dgram throws when the event has no listener) — forward or discard.
  socket.on('error', (err) => {
    if (onSocketError) onSocketError(err);
  });

  // Discovery broadcasts to 255.255.255.255; setBroadcast is only valid on a
  // bound socket, which is exactly the ordering bug this helper exists to
  // absorb.
  socket.setBroadcast(true);

  let closed: Promise<void> | undefined;
  function close(): Promise<void> {
    if (!closed) {
      client.dispose();
      closed = new Promise<void>((resolve) => {
        try {
          socket.close(resolve);
        } catch {
          // The caller closed the raw socket themselves; close() has nothing
          // left to release.
          resolve();
        }
      });
    }
    return closed;
  }

  return {
    router,
    devices,
    client,
    socket,
    close,
    // Enables `await using lan = await openLan()`: end of scope closes the
    // socket. Requiring Node >= 22 (where Symbol.asyncDispose exists
    // natively) is what makes defining this safe — on older runtimes the
    // symbol was undefined and the computed key silently became the string
    // "undefined".
    [Symbol.asyncDispose]: close,
  };
}
