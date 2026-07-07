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

import { Client } from './client.js';
import { Devices } from './devices.js';
import { Router } from './router.js';

import type { ClientInstance } from './client.js';
import type { DeviceEventHandlers, DevicesInstance } from './devices.js';
import type { MessageHandler, RouterInstance } from './router.js';

export interface OpenLanOptions extends DeviceEventHandlers {
  /**
   * Local UDP port to bind. Defaults to 0 (an ephemeral port picked by the
   * OS), which is what you want unless a firewall rule requires a fixed
   * port — LIFX devices reply to whatever port the request came from.
   */
  port?: number;
  /**
   * Local address to bind. Defaults to all interfaces. Binding a specific
   * interface address can prevent the limited broadcast (255.255.255.255)
   * used by discovery from leaving the machine on some platforms; prefer
   * the default unless you know you need this.
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
   * Observes socket-level errors: asynchronous send failures (e.g. a
   * transiently unreachable host) and any 'error' the socket emits after
   * binding. When omitted they are discarded, matching the library's
   * UDP-is-best-effort semantics — a lost packet already surfaces as
   * TimeoutError on acknowledged sends, and swallowing the event keeps a
   * routine EHOSTUNREACH from crashing the process (an unobserved dgram
   * 'error' event throws). Bind errors are not routed here; they reject the
   * promise returned by {@link openLan}.
   */
  onSocketError?: (error: Error) => void;
}

export interface LanInstance extends AsyncDisposable {
  readonly router: RouterInstance;
  readonly devices: DevicesInstance;
  readonly client: ClientInstance;
  /**
   * The underlying `node:dgram` socket — the escape hatch for anything the
   * options don't cover (multicast membership, TTL, `address()` for the
   * bound port). The socket's 'message' handler feeding the router is
   * already attached; adding your own listeners is fine, replacing them is
   * not.
   */
  readonly socket: dgram.Socket;
  /**
   * Disposes the client (pending sends reject with DisposedClientError
   * instead of dangling until their timeouts) and closes the socket,
   * resolving once the socket has closed. Idempotent — every call returns
   * the same promise. An `await using` declaration does the same through
   * `Symbol.asyncDispose` at end of scope. A freestanding closure (nothing
   * on this instance relies on `this`), so destructuring it off the
   * instance is safe.
   */
  close(): Promise<void>;
}

/**
 * Opens a UDP socket via `node:dgram` and returns a ready-to-use
 * {@link Router}, {@link Devices} registry, and {@link Client} wired to it:
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
 * import { SetPowerCommand } from 'lifxlan';
 * import { openLan } from 'lifxlan/node';
 * import { discover } from 'lifxlan/discovery';
 *
 * const { client, devices, router, close } = await openLan();
 * using discovery = discover(router, devices);
 * const device = await devices.get('d07123456789');
 * await client.send(SetPowerCommand(true), device);
 * await close();
 * ```
 */
export async function openLan(options: OpenLanOptions = {}): Promise<LanInstance> {
  const socket = dgram.createSocket('udp4');

  const onSocketError = options.onSocketError;

  const router = Router({
    onSend(message, port, address) {
      // Without a callback, an async send failure is emitted as a socket
      // 'error' event; routing it through the callback keeps per-packet
      // failures observable (or deliberately discarded) without touching
      // the socket-wide error path.
      socket.send(message, port, address, (err) => {
        if (err && onSocketError) onSocketError(err);
      });
    },
    ...(options.onMessage ? { onMessage: options.onMessage } : {}),
  });

  const devices = Devices({
    ...(options.onAdded ? { onAdded: options.onAdded } : {}),
    ...(options.onChanged ? { onChanged: options.onChanged } : {}),
    ...(options.onRemoved ? { onRemoved: options.onRemoved } : {}),
  });

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
    socket.bind(options.port ?? 0, options.address);
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

  const client = options.defaultTimeoutMs === undefined
    ? Client({ router })
    : Client({ router, defaultTimeoutMs: options.defaultTimeoutMs });

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
