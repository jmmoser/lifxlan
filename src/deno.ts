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

import { Client } from './client.js';
import { Devices } from './devices.js';
import { Router } from './router.js';

import type { ClientInstance } from './client.js';
import type { DeviceEventHandlers, DevicesInstance } from './devices.js';
import type { MessageHandler, RouterInstance } from './router.js';

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

export interface OpenLanOptions extends DeviceEventHandlers {
  /**
   * Local UDP port to bind. Defaults to 0 (an ephemeral port picked by the
   * OS), which is what you want unless a firewall rule requires a fixed
   * port — LIFX devices reply to whatever port the request came from.
   */
  port?: number;
  /**
   * Local address to bind (Deno calls this `hostname`; named `address` here
   * for symmetry with 'lifxlan/node'). Defaults to '0.0.0.0'.
   */
  address?: string;
  /**
   * How long `client.send()` waits before rejecting with TimeoutError,
   * forwarded to the {@link Client}. Defaults to 3000ms.
   */
  defaultTimeoutMs?: number;
  /**
   * Router-wide tap invoked for every successfully decoded inbound message,
   * forwarded to {@link Router}.
   */
  onMessage?: MessageHandler;
  /**
   * Observes asynchronous send failures and an unexpected end of the read
   * loop. When omitted they are discarded, matching the library's
   * UDP-is-best-effort semantics — a lost packet already surfaces as
   * TimeoutError on acknowledged sends. The interruption `close()` inflicts
   * on the read loop is normal shutdown and is never reported here.
   * Synchronous `Deno.listenDatagram` failures (missing permissions, port in
   * use) are not routed here either; they reject the promise returned by
   * {@link openLan}.
   */
  onSocketError?: (error: Error) => void;
}

export interface LanInstance extends AsyncDisposable {
  readonly router: RouterInstance;
  readonly devices: DevicesInstance;
  readonly client: ClientInstance;
  /**
   * The underlying `Deno.DatagramConn` (typed as the structural slice this
   * module declares) — the escape hatch for anything the options don't
   * cover, such as `socket.addr.port` for the bound port. The background
   * read loop already consumes the socket's async iterator; don't iterate it
   * yourself.
   */
  readonly socket: DenoDatagramConn;
  /**
   * Disposes the client (pending sends reject with DisposedClientError
   * instead of dangling until their timeouts) and closes the socket,
   * resolving once the read loop has ended — the settled promise is the
   * guarantee that no further datagram handling (registration, onMessage)
   * will run; awaiting is optional, since teardown starts synchronously.
   * Idempotent — every call returns the same promise. An `await using`
   * declaration does the same through `Symbol.asyncDispose` at end of
   * scope. A freestanding closure (nothing on this instance relies on
   * `this`), so destructuring it off the instance is safe.
   */
  close(): Promise<void>;
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Opens a UDP socket via `Deno.listenDatagram` and returns a ready-to-use
 * {@link Router}, {@link Devices} registry, and {@link Client} wired to it:
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
 * const device = await devices.get('d07123456789');
 * await client.send(SetPower(true), device);
 * await close();
 * ```
 */
export async function openLan(options: OpenLanOptions = {}): Promise<LanInstance> {
  const socket = Deno.listenDatagram({
    hostname: options.address ?? '0.0.0.0',
    port: options.port ?? 0,
    transport: 'udp',
  });

  const onSocketError = options.onSocketError;

  const router = Router({
    onSend(message, port, address) {
      // send() is async in Deno; a rejection here would otherwise be an
      // unhandled promise rejection per packet.
      socket.send(message, { transport: 'udp', hostname: address, port }).catch((err) => {
        if (onSocketError) onSocketError(toError(err));
      });
    },
    ...(options.onMessage ? { onMessage: options.onMessage } : {}),
  });

  const devices = Devices({
    ...(options.onAdded ? { onAdded: options.onAdded } : {}),
    ...(options.onChanged ? { onChanged: options.onChanged } : {}),
    ...(options.onRemoved ? { onRemoved: options.onRemoved } : {}),
  });

  let closing = false;
  const reading = (async () => {
    try {
      for await (const [message, remote] of socket) {
        if (remote.transport !== 'udp') continue;
        devices.register(remote.port, remote.hostname, router.receive(message));
      }
    } catch (err) {
      // socket.close() interrupts the iterator with BadResource — that's
      // normal shutdown. Anything else ended reception unexpectedly.
      if (!closing && onSocketError) onSocketError(toError(err));
    }
  })();

  const client = options.defaultTimeoutMs === undefined
    ? Client({ router })
    : Client({ router, defaultTimeoutMs: options.defaultTimeoutMs });

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
