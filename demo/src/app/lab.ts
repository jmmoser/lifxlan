/**
 * The raw packet lab: type bytes, put them on the network. Nothing here
 * goes through the library's encoder, so a hand-written datagram that moves
 * the lights shows the devices really are parsing the wire format.
 */
import { PORT } from '../../../src/index.js';
import { decodeHeader } from '../../../src/encoding.js';
import { typeName } from '../protocol/layouts.js';
import { BROADCAST } from '../sim/lan.js';
import { button, clear, h } from './dom.js';
import { describeError, hex, parseHex } from './format.js';
import { RAW_PACKETS } from './presets.js';
import type { Session } from './session.js';
import type { Packet } from './wirelog.js';

export class Lab {
  readonly root: HTMLElement;

  private readonly session: Session;
  private readonly input: HTMLTextAreaElement;
  private readonly destination: HTMLSelectElement;
  private readonly status: HTMLElement;
  private readonly about: HTMLElement;
  private readonly sendButton: HTMLButtonElement;

  constructor(session: Session) {
    this.session = session;
    this.input = h('textarea', { id: 'lab-bytes', class: 'lab-input', rows: 4, spellcheck: 'false', autocapitalize: 'off', 'aria-label': 'Datagram bytes in hexadecimal' });
    this.destination = h('select', { id: 'lab-destination', 'aria-label': 'Destination address' });
    this.status = h('p', { class: 'note', 'aria-live': 'polite' });
    this.about = h('p', { class: 'note' });
    this.sendButton = button('Send these bytes', () => this.send(), { class: 'primary', id: 'lab-send' });

    this.root = h('section', { class: 'card lab' },
      h('header', { class: 'card-head' }, h('h2', null, 'Raw packet lab')),
      h('p', { class: 'lede' }, 'Skip the library. Type a datagram in hex and put it straight on the network; the devices only ever see bytes.'),
      h('div', { class: 'chips' }, ...RAW_PACKETS.map((preset) => button(preset.name, () => {
        this.input.value = preset.hex;
        this.destination.value = BROADCAST;
        this.about.textContent = preset.about;
        this.check();
      }, { class: 'chip' }))),
      this.about,
      this.input,
      this.status,
      h('div', { class: 'lab-send' }, h('label', { for: 'lab-destination' }, 'Send to'), this.destination, this.sendButton),
    );

    this.input.addEventListener('input', () => { this.about.textContent = ''; this.check(); });
    this.refreshDestinations();
    session.listen({ lampsChanged: () => this.refreshDestinations() });

    const first = RAW_PACKETS[0];
    if (first) {
      this.input.value = first.hex;
      this.about.textContent = first.about;
    }
    this.check();
  }

  private refreshDestinations(): void {
    const chosen = this.destination.value || BROADCAST;
    clear(this.destination);
    this.destination.append(h('option', { value: BROADCAST }, `${BROADCAST} — broadcast`));
    for (const lamp of this.session.lamps) {
      this.destination.append(h('option', { value: lamp.device.address }, `${lamp.device.address} — ${lamp.label}`));
    }
    this.destination.value = chosen;
    if (this.destination.value !== chosen) this.destination.value = BROADCAST;
  }

  /** Describes the typed bytes the way the library's header decoder sees them. */
  private check(): Uint8Array | undefined {
    const bytes = parseHex(this.input.value);
    this.status.className = 'note';
    if (!bytes) {
      this.status.textContent = 'Not valid hex yet: pairs of 0–9 and a–f, any spacing.';
      this.sendButton.disabled = true;
      return undefined;
    }
    this.sendButton.disabled = false;
    try {
      const header = decodeHeader(bytes);
      const target = header.target.every((byte) => byte === 0) ? 'every device' : `serial ${hex(header.target, '')}`;
      this.status.textContent = `${bytes.length} bytes. decodeHeader() reads: ${typeName(header.type)} (type ${header.type}) for ${target}, source ${header.source}, sequence ${header.sequence}.`;
    } catch (error) {
      this.status.className = 'note bad';
      this.status.textContent = `${bytes.length} bytes. decodeHeader() rejects them — ${describeError(error)}. You can still send them; devices drop what they cannot parse.`;
    }
    return bytes;
  }

  private send(): void {
    const bytes = this.check();
    if (bytes) this.session.sendRaw(bytes, this.destination.value, PORT);
  }

  /** Loads a captured packet for editing. */
  load(packet: Packet): void {
    this.input.value = hex(packet.bytes);
    this.about.textContent = 'Loaded from the wire log. Change any byte and send it again.';
    this.refreshDestinations();
    this.destination.value = packet.direction === 'tx' ? packet.to.address : BROADCAST;
    if (!this.destination.value) this.destination.value = BROADCAST;
    this.check();
    this.root.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    this.input.focus({ preventScroll: true });
  }
}
