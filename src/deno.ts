/**
 * Batteries-included setup for Deno, exposed as the 'lifxlan/deno' subpath —
 * the Deno counterpart to 'lifxlan/node'. It packages the wiring from the
 * Deno example — `Deno.listenDatagram`, Router/Devices/Client connected to
 * it, a background read loop feeding `router.receive()` into
 * `devices.register()` — behind the same `openLan()` call, returning the
 * same shape. Requires `--allow-net` and `--unstable-net`, exactly like the
 * manual wiring it replaces.
 *
 * The library's own toolchain compiles without Deno's type definitions, so
 * this module declares the minimal structural slice of the `Deno` namespace
 * it touches; at runtime those lookups resolve to the real global. Importing
 * it outside Deno throws a ReferenceError — by design, this module is never
 * loaded unless asked for.
 */

import { wire } from './lan.js';

import type { Lan as LanOf, OpenLanOptions } from './lan.js';

export type { OpenLanOptions };

/** The slice of `Deno.NetAddr` this module reads and sends. */
export interface DenoNetAddr {
  transport: string;
  hostname: string;
  port: number;
}

/** The slice of `Deno.DatagramConn` this module uses. */
export interface DenoDatagramConn {
  readonly addr: DenoNetAddr;
  send(p: Uint8Array, addr: DenoNetAddr): Promise<number>;
  close(): void;
  [Symbol.asyncIterator](): AsyncIterableIterator<[Uint8Array, DenoNetAddr]>;
}

declare const Deno: {
  listenDatagram(options: { hostname?: string; port: number; transport: 'udp' }): DenoDatagramConn;
};

/**
 * What {@link openLan} resolves to: a Router, Devices registry, and Client
 * wired to one `Deno.DatagramConn` (typed as the structural slice this
 * module declares), plus `close()`. Closing the raw socket yourself ends
 * the read loop, after which sends through the router throw; Deno reports
 * that close asynchronously, so a send in the same tick still goes to the
 * closed socket (its failure reaches `onSocketError` and a `send()` waits
 * out its timeout). Prefer `close()`, which takes effect at once.
 */
export type Lan = LanOf<DenoDatagramConn>;

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Opens a UDP socket via `Deno.listenDatagram` and returns a ready-to-use
 * `Router`, `Devices` registry, and `Client` wired to it:
 * outbound messages go out the socket, and a background read loop feeds
 * inbound datagrams through `router.receive()` into `devices.register()`.
 * The socket is bound synchronously; the function is async only for
 * symmetry with 'lifxlan/node', so the two are interchangeable in code.
 *
 * Run with `--allow-net --unstable-net`. The zero-copy buffer-ownership
 * caveat documented on `router.receive()` does not apply here:
 * `Deno.listenDatagram` yields a fresh buffer per datagram.
 *
 * @example
 * ```javascript
 * import { SetPower } from 'npm:lifxlan';
 * import { openLan } from 'npm:lifxlan/deno';
 * import { discover } from 'npm:lifxlan/discovery';
 *
 * const { client, devices, router, close } = await openLan();
 * using discovery = discover(router, devices);
 * const device = await devices.waitFor('d07123456789');
 * await client.send(SetPower(true), device);
 * await close();
 * ```
 */
export async function openLan(options: OpenLanOptions = {}): Promise<Lan> {
  const socket = Deno.listenDatagram({
    hostname: options.address ?? '0.0.0.0',
    port: options.port ?? 0,
    transport: 'udp',
  });

  const onSocketError = options.onSocketError;

  let closing = false;
  let readEnded = false;

  // Created before the read loop starts, so a rejected option (a NaN
  // defaultTimeoutMs) releases the socket instead of leaking it.
  let wired: ReturnType<typeof wire>;
  try {
    wired = wire(options, (message, port, address) => {
      // Deno's send() is async, so a closed socket only rejects; throw
      // synchronously instead, as node:dgram does, so senders that stop on a
      // throwing transport (discover()) end — once close() has begun, or
      // once the read loop has ended (the caller closed the raw socket, or
      // reception failed), since no reply could arrive then anyway.
      if (closing || readEnded) {
        throw new Error('socket closed');
      }
      // A rejection here would otherwise be an unhandled promise rejection
      // per packet.
      socket.send(message, { transport: 'udp', hostname: address, port }).catch((err) => {
        if (onSocketError) onSocketError(toError(err));
      });
    });
  } catch (err) {
    try { socket.close(); } catch { /* already closed */ }
    throw err;
  }
  const { router, devices, client } = wired;

  const reading = (async () => {
    try {
      for await (const [message, remote] of socket) {
        if (remote.transport !== 'udp') continue;
        devices.register(remote.port, remote.hostname, router.receive(message));
      }
    } catch (err) {
      // Deno's iterator ends cleanly on close(); should a version instead
      // surface the BadResource, that's still normal shutdown. Anything
      // else ended reception unexpectedly. Either way the loop has ended,
      // which the finally records for onSend.
      if (!closing && onSocketError) onSocketError(toError(err));
    } finally {
      readEnded = true;
    }
  })();

  let closed: Promise<void> | undefined;
  function close(): Promise<void> {
    if (!closed) {
      closing = true;
      client.dispose();
      try {
        socket.close();
      } catch {
        // The caller closed the raw socket themselves; close() has nothing
        // left to release.
      }
      closed = reading;
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
    // socket. Deno has supported Symbol.asyncDispose (and the `using`
    // syntax itself) since 1.38.
    [Symbol.asyncDispose]: close,
  };
}
