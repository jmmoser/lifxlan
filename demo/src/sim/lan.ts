/**
 * A UDP network that exists only in memory: sockets bound to an address and
 * port, datagrams delivered after a delay, and a share of them lost on the
 * way. It stands in for the one thing a browser cannot provide.
 */

export const BROADCAST = '255.255.255.255';

export interface Endpoint {
  readonly address: string;
  readonly port: number;
}

export interface Datagram {
  readonly id: number;
  readonly from: Endpoint;
  /** The destination as addressed — the broadcast address for a broadcast. */
  readonly to: Endpoint;
  readonly bytes: Uint8Array;
}

/** One recipient's copy of a datagram. */
export interface Hop {
  readonly to: Endpoint;
  readonly delayMs: number;
  readonly lost: boolean;
}

export type LanEvent =
  | { readonly kind: 'send'; readonly datagram: Datagram; readonly hops: readonly Hop[] }
  | { readonly kind: 'deliver'; readonly datagram: Datagram; readonly to: Endpoint };

export type Receiver = (bytes: Uint8Array, remote: Endpoint) => void;

export interface VirtualSocket {
  readonly endpoint: Endpoint;
  send(bytes: Uint8Array, port: number, address: string): void;
  close(): void;
}

export class VirtualLan {
  /** One-way delay of every datagram, in milliseconds. */
  latencyMs = 25;
  /** Random extra delay on top of `latencyMs`, in milliseconds. */
  jitterMs = 10;
  /** Probability (0..1) that a recipient never sees a datagram. */
  loss = 0;

  private nextId = 1;
  private readonly sockets = new Map<string, { endpoint: Endpoint; receive: Receiver }>();
  private readonly observers = new Set<(event: LanEvent) => void>();

  constructor(private readonly random: () => number = Math.random) {}

  bind(endpoint: Endpoint, receive: Receiver): VirtualSocket {
    const key = `${endpoint.address}:${endpoint.port}`;
    if (this.sockets.has(key)) throw new Error(`${key} is already bound`);
    this.sockets.set(key, { endpoint, receive });
    return {
      endpoint,
      send: (bytes, port, address) => this.transmit(endpoint, { address, port }, bytes),
      close: () => { this.sockets.delete(key); },
    };
  }

  /** Watches every datagram put on the network. Returns the unsubscribe function. */
  observe(observer: (event: LanEvent) => void): () => void {
    this.observers.add(observer);
    return () => { this.observers.delete(observer); };
  }

  private emit(event: LanEvent): void {
    for (const observer of this.observers) observer(event);
  }

  private transmit(from: Endpoint, to: Endpoint, bytes: Uint8Array): void {
    // The sender may reuse its buffer; the network owns a copy.
    const datagram: Datagram = { id: this.nextId++, from, to, bytes: bytes.slice() };

    const hops: Hop[] = [];
    for (const socket of this.sockets.values()) {
      const { endpoint } = socket;
      if (endpoint.port !== to.port) continue;
      const isSender = endpoint.address === from.address && endpoint.port === from.port;
      if (to.address === BROADCAST ? isSender : endpoint.address !== to.address) continue;
      hops.push({
        to: endpoint,
        delayMs: this.latencyMs + this.random() * this.jitterMs,
        lost: this.random() < this.loss,
      });
    }

    this.emit({ kind: 'send', datagram, hops });

    for (const hop of hops) {
      if (hop.lost) continue;
      setTimeout(() => {
        const socket = this.sockets.get(`${hop.to.address}:${hop.to.port}`);
        if (!socket) return;
        this.emit({ kind: 'deliver', datagram, to: hop.to });
        // Each recipient gets its own buffer, as a real socket would hand out.
        socket.receive(datagram.bytes.slice(), from);
      }, hop.delayMs);
    }
  }
}
