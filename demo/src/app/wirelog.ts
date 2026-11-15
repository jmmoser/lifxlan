/**
 * The wire log: one timeline of the library calls the page made and the
 * datagrams that crossed the network, in the order they happened. Packets
 * come from watching the network itself, not from the library, so a call
 * that put nothing on the wire would show up here with nothing under it.
 */
import { decodeHeader } from '../../../src/encoding.js';
import type { Header } from '../../../src/index.js';
import { Type } from '../../../src/index.js';
import { typeName } from '../protocol/layouts.js';
import { BROADCAST } from '../sim/lan.js';
import type { Datagram, Endpoint, LanEvent, VirtualLan } from '../sim/lan.js';
import { button, clear, h } from './dom.js';
import type { Call, Session } from './session.js';

export interface Packet {
  readonly at: number;
  readonly direction: 'tx' | 'rx';
  readonly from: Endpoint;
  readonly to: Endpoint;
  bytes: Uint8Array;
  /** Undefined when the bytes are not a decodable LIFX frame. */
  header: Header | undefined;
  /** No recipient received it. */
  readonly lost: boolean;
  /** Why it went nowhere, when it did. */
  readonly note: string | undefined;
  /** How many identical-shaped fire-and-forget packets this row stands for. */
  count: number;
}

export type Entry =
  | { readonly kind: 'call'; readonly call: Call; readonly row: HTMLButtonElement }
  | { readonly kind: 'packet'; readonly packet: Packet; readonly row: HTMLButtonElement };

export interface WireStats {
  sent: number;
  received: number;
  lost: number;
  bytes: number;
}

const MAX_ROWS = 500;

function tryHeader(bytes: Uint8Array): Header | undefined {
  try {
    return decodeHeader(bytes);
  } catch {
    return undefined;
  }
}

const seconds = (ms: number): string => (ms / 1000).toFixed(3);

/**
 * Whether "follow latest" should move to a packet. Bare acknowledgements say
 * nothing, and discovery repeats in the background for as long as the page
 * is open; neither should pull the inspector away from what the user did.
 */
function worthFollowing(header: Header | undefined): boolean {
  return header?.type !== Type.Acknowledgement && header?.type !== Type.GetService && header?.type !== Type.StateService;
}

export class WireLog {
  readonly root: HTMLElement;
  readonly stats: WireStats = { sent: 0, received: 0, lost: 0, bytes: 0 };
  /** The entry the inspector should show. */
  onSelect: (entry: Entry | undefined) => void = () => {};
  /** The user clicked a row (as opposed to the log following the latest packet). */
  onPick: () => void = () => {};
  /** Called when counters change. */
  onStats: () => void = () => {};

  private readonly list: HTMLElement;
  private readonly followButton: HTMLButtonElement;
  private readonly session: Session;
  private readonly entries: Entry[] = [];
  private readonly byCall = new Map<number, Entry>();
  /** Fire-and-forget rows still being folded, by type and destination. */
  private readonly streams = new Map<string, Entry & { kind: 'packet' }>();
  private readonly origin = performance.now();
  private selected: Entry | undefined;
  private following = true;
  private pending: HTMLElement[] = [];
  private scheduled = false;

  constructor(session: Session, lan: VirtualLan) {
    this.session = session;
    this.list = h('div', { class: 'log-list', role: 'log', 'aria-label': 'Library calls and datagrams, oldest first' });
    this.followButton = button('Follow latest', () => this.follow(), { class: 'chip', 'aria-pressed': 'true', id: 'log-follow' });
    this.root = h('section', { class: 'card log' },
      h('header', { class: 'card-head' },
        h('h2', null, 'Wire log'),
        h('div', { class: 'head-tools' },
          this.followButton,
          button('Clear', () => this.clear(), { class: 'chip', id: 'log-clear' }),
        ),
      ),
      h('div', { class: 'log-legend' },
        h('span', { class: 'tag call' }, 'call'), 'a line of code the page ran',
        h('span', { class: 'tag tx' }, 'TX'), 'bytes the library sent',
        h('span', { class: 'tag rx' }, 'RX'), 'bytes a device sent back',
      ),
      this.list,
    );

    lan.observe((event) => this.onLan(event));
    session.listen({
      call: (call) => this.addCall(call),
      callUpdated: (call) => this.updateCall(call),
    });
  }

  /* ---------------------------------------------------------------- */
  /* Recording                                                         */
  /* ---------------------------------------------------------------- */

  private onLan(event: LanEvent): void {
    const { datagram } = event;
    const controller = this.session.endpoint;
    const fromController = datagram.from.address === controller.address && datagram.from.port === controller.port;

    if (event.kind === 'send') {
      if (fromController) {
        this.stats.sent++;
        this.stats.bytes += datagram.bytes.length;
        const nobody = event.hops.length === 0;
        const lost = nobody || event.hops.every((hop) => hop.lost);
        if (lost && !nobody) this.stats.lost++;
        this.addPacket(datagram, 'tx', datagram.to, lost, nobody ? 'nothing listens at this address' : lost ? 'lost on the way' : undefined);
      } else {
        for (const hop of event.hops) {
          if (hop.lost && hop.to.address === controller.address) {
            this.stats.lost++;
            this.addPacket(datagram, 'rx', hop.to, true, 'lost on the way');
          }
        }
      }
    } else if (event.to.address === controller.address && event.to.port === controller.port) {
      this.stats.received++;
      this.stats.bytes += datagram.bytes.length;
      this.addPacket(datagram, 'rx', event.to, false, undefined);
    }
    this.onStats();
  }

  private addPacket(datagram: Datagram, direction: 'tx' | 'rx', to: Endpoint, lost: boolean, note: string | undefined): void {
    const header = tryHeader(datagram.bytes);

    // A stream of unacknowledged packets of one type to one device is one row with a counter.
    const streamable = direction === 'tx' && !lost && header !== undefined && !header.tagged && !header.ackRequired && !header.resRequired;
    const key = `${header?.type}>${to.address}`;
    if (streamable) {
      const open = this.streams.get(key);
      if (open) {
        open.packet.count++;
        open.packet.bytes = datagram.bytes;
        open.packet.header = header;
        this.renderPacket(open.row, open.packet);
        if (this.selected === open || this.following) this.select(open, false);
        return;
      }
    }

    const packet: Packet = { at: performance.now(), direction, from: datagram.from, to, bytes: datagram.bytes, header, lost, note, count: 1 };
    const row = h('button', { type: 'button', class: `row packet ${direction}${lost ? ' lost' : ''}` });
    const entry: Entry & { kind: 'packet' } = { kind: 'packet', packet, row };
    this.renderPacket(row, packet);
    if (streamable) this.streams.set(key, entry);
    this.add(entry);
    if (this.following && worthFollowing(header)) this.select(entry, false);
  }

  private addCall(call: Call): void {
    if (call.streamKey === undefined) this.streams.clear();
    const row = h('button', { type: 'button', class: 'row call' });
    const entry: Entry = { kind: 'call', call, row };
    this.byCall.set(call.id, entry);
    this.renderCall(row, call);
    this.add(entry);
  }

  private updateCall(call: Call): void {
    const entry = this.byCall.get(call.id);
    if (!entry || entry.kind !== 'call') return;
    this.renderCall(entry.row, call);
    if (this.selected === entry) this.onSelect(entry);
  }

  private add(entry: Entry): void {
    entry.row.addEventListener('click', () => this.select(entry, true));
    this.entries.push(entry);
    this.pending.push(entry.row);
    if (this.entries.length > MAX_ROWS) {
      const dropped = this.entries.shift();
      if (dropped) {
        dropped.row.remove();
        if (dropped.kind === 'call') this.byCall.delete(dropped.call.id);
      }
    }
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  private flush(): void {
    this.scheduled = false;
    const fragment = document.createDocumentFragment();
    for (const row of this.pending) fragment.appendChild(row);
    this.pending = [];
    this.list.appendChild(fragment);
    if (this.following) this.list.scrollTop = this.list.scrollHeight;
  }

  /* ---------------------------------------------------------------- */
  /* Rows                                                              */
  /* ---------------------------------------------------------------- */

  private peer(address: string): string {
    if (address === BROADCAST) return 'everyone';
    const lamp = this.session.lamps.find((candidate) => candidate.device.address === address);
    return lamp && lamp.name !== 'device' ? lamp.label : address;
  }

  private renderPacket(row: HTMLElement, packet: Packet): void {
    clear(row);
    const { header } = packet;
    const flags: string[] = [];
    if (header?.tagged) flags.push('tagged');
    if (header?.ackRequired) flags.push('ack');
    if (header?.resRequired) flags.push('res');
    const peer = packet.direction === 'tx' ? `→ ${this.peer(packet.to.address)}` : `← ${this.peer(packet.from.address)}`;
    row.append(
      h('span', { class: 'time' }, seconds(packet.at - this.origin)),
      h('span', { class: `tag ${packet.direction}` }, packet.direction.toUpperCase()),
      h('span', { class: 'what' }, header ? typeName(header.type) : 'not a LIFX frame'),
      h('span', { class: 'peer' }, peer),
      h('span', { class: 'meta' },
        packet.count > 1 && h('span', { class: 'count' }, `×${packet.count}`),
        packet.lost && h('span', { class: 'bad' }, packet.note ?? 'lost'),
        !packet.lost && header && `seq ${header.sequence}`,
        flags.length > 0 && ` · ${flags.join(' ')}`,
        ` · ${packet.bytes.length} B`,
      ),
    );
  }

  private renderCall(row: HTMLElement, call: Call): void {
    clear(row);
    row.className = `row call ${call.status}${this.selected?.row === row ? ' selected' : ''}`;
    const outcome = call.status === 'pending' ? '…'
      : call.status === 'ok' ? `✓ ${Math.round(call.elapsedMs ?? 0)} ms`
        : call.status === 'error' ? `✗ ${call.error instanceof Error ? call.error.name : 'error'}`
          : call.count > 1 ? `×${call.count}` : '';
    row.append(
      h('span', { class: 'time' }, seconds(call.at - this.origin)),
      h('span', { class: 'tag call' }, 'call'),
      h('code', { class: 'code' }, call.code),
      h('span', { class: `outcome ${call.status}` }, outcome),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Selection                                                         */
  /* ---------------------------------------------------------------- */

  private select(entry: Entry, byUser: boolean): void {
    if (byUser) {
      this.setFollowing(false);
      this.onPick();
    }
    if (this.selected !== entry) {
      this.selected?.row.classList.remove('selected');
      entry.row.classList.add('selected');
      this.selected = entry;
    }
    this.onSelect(entry);
  }

  private setFollowing(on: boolean): void {
    this.following = on;
    this.followButton.setAttribute('aria-pressed', String(on));
  }

  /** Goes back to showing the newest packet as it arrives. */
  follow(): void {
    this.setFollowing(true);
    this.list.scrollTop = this.list.scrollHeight;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i]!;
      if (entry.kind === 'packet' && worthFollowing(entry.packet.header)) {
        this.select(entry, false);
        return;
      }
    }
  }

  private clear(): void {
    this.entries.length = 0;
    this.pending = [];
    this.byCall.clear();
    this.streams.clear();
    this.selected = undefined;
    clear(this.list);
    this.setFollowing(true);
    this.onSelect(undefined);
  }
}
