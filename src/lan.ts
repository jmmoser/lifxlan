/**
 * What the two `openLan()` helpers ('lifxlan/node' and 'lifxlan/deno')
 * share: their options, the shape they return, and the Router/Devices/Client
 * construction. Internal module — each helper re-exports the public types.
 */

import { Client } from './client.js';
import { Devices } from './devices.js';
import { Router } from './router.js';

import type { DeviceEventHandlers } from './devices.js';
import type { MessageHandler, RouterOptions } from './router.js';

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
   * the default unless you know you need this (and then broadcast to the
   * subnet's directed address — see `BroadcastOptions.address`).
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
   * Observes inbound datagrams that could not be decoded and errors thrown
   * by the `onMessage` tap (or a client's handler) while processing one,
   * forwarded to {@link Router}. When omitted they are discarded, so neither
   * a malformed packet nor a buggy callback can crash the process or stop
   * reception.
   */
  onError?: (error: unknown, message: Uint8Array) => void;
  /**
   * Observes socket-level errors after setup: asynchronous send failures
   * (e.g. a transiently unreachable host), any 'error' a `node:dgram`
   * socket emits after binding, and an unexpected end of the Deno read
   * loop. When omitted they are discarded, matching the library's
   * UDP-is-best-effort semantics — a lost packet already surfaces as
   * TimeoutError on acknowledged sends, and swallowing the event keeps a
   * routine EHOSTUNREACH from crashing the process. Setup failures (a bind
   * error, missing Deno permissions) are not routed here; they reject the
   * promise `openLan()` returns, and the interruption `close()` inflicts is
   * normal shutdown, never reported.
   */
  onSocketError?: (error: Error) => void;
}

/**
 * What `openLan()` resolves to: the three ordinary building blocks, wired
 * to one socket of type `Socket`.
 */
export interface Lan<Socket> extends AsyncDisposable {
  readonly router: Router;
  readonly devices: Devices;
  readonly client: Client;
  /**
   * The underlying socket — the escape hatch for anything the options don't
   * cover (the bound port, multicast membership, TTL). Its receive path
   * already feeds the router: adding your own listeners to a `node:dgram`
   * socket is fine, replacing them is not, and a Deno socket's async
   * iterator is already being consumed.
   */
  readonly socket: Socket;
  /**
   * Disposes the client (pending sends reject with DisposedClientError
   * instead of dangling until their timeouts) and closes the socket,
   * resolving once teardown has finished: the OS has released the socket
   * (Node) or the background read loop has ended (Deno), so no further
   * datagram handling will run. Awaiting is optional — teardown starts
   * synchronously — but is what makes an immediate rebind of the same port
   * race-free. Idempotent — every call returns the same promise. An
   * `await using` declaration does the same through `Symbol.asyncDispose`
   * at end of scope. A freestanding closure (nothing on this instance
   * relies on `this`), so destructuring it off the instance is safe.
   */
  close(): Promise<void>;
}

/**
 * Builds the Router/Devices/Client trio over a transport. Throws whatever
 * `Client()` throws for a rejected option (a NaN `defaultTimeoutMs`), so
 * callers release their socket on that path.
 */
export function wire(options: OpenLanOptions, onSend: RouterOptions['onSend']): { router: Router; devices: Devices; client: Client } {
  const router = Router({
    onSend,
    ...(options.onMessage ? { onMessage: options.onMessage } : {}),
    ...(options.onError ? { onError: options.onError } : {}),
  });

  const devices = Devices({
    ...(options.onAdded ? { onAdded: options.onAdded } : {}),
    ...(options.onChanged ? { onChanged: options.onChanged } : {}),
    ...(options.onRemoved ? { onRemoved: options.onRemoved } : {}),
  });

  const client = options.defaultTimeoutMs === undefined
    ? Client({ router })
    : Client({ router, defaultTimeoutMs: options.defaultTimeoutMs });

  return { router, devices, client };
}
