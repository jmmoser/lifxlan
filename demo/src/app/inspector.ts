/**
 * The inspector: one datagram, byte by byte. Each byte is coloured by the
 * field it belongs to (from the demo's layout tables), and underneath is
 * what the library's own decoders make of the same bytes.
 */
import {
  decodeEchoResponse,
  decodeHeader,
  decodeLightState,
  decodeState64,
  decodeStateDeviceChain,
  decodeStateExtendedColorZones,
  decodeStateGroup,
  decodeStateHostFirmware,
  decodeStateInfo,
  decodeStateInfrared,
  decodeStateLabel,
  decodeStateLightPower,
  decodeStateLocation,
  decodeStateMultiZone,
  decodeStateMultiZoneEffect,
  decodeStatePower,
  decodeStateService,
  decodeStateTileEffect,
  decodeStateUnhandled,
  decodeStateVersion,
  decodeStateWifiFirmware,
  decodeStateWifiInfo,
  decodeStateZone,
  getPayload,
} from '../../../src/encoding.js';
import { LifxError, Type, convertTargetToSerialNumber } from '../../../src/index.js';
import type { Color, Header } from '../../../src/index.js';
import { HEADER_FIELDS, HEADER_SIZE, isDeviceMessage, layoutFor, readStruct, typeName } from '../protocol/layouts.js';
import type { Entry as StructEntry, Field, Value } from '../protocol/layouts.js';
import { describeColor, swatch } from './color.js';
import { append, button, clear, h } from './dom.js';
import type { Child } from './dom.js';
import { describeError, hex, hexByte, pretty } from './format.js';
import type { Entry, Packet } from './wirelog.js';

/** The library decoder for each message type devices send. */
const DECODERS = new Map<number, { name: string; decode: (payload: Uint8Array) => unknown }>([
  [Type.StateService, { name: 'decodeStateService', decode: decodeStateService }],
  [Type.StateHostFirmware, { name: 'decodeStateHostFirmware', decode: decodeStateHostFirmware }],
  [Type.StateWifiInfo, { name: 'decodeStateWifiInfo', decode: decodeStateWifiInfo }],
  [Type.StateWifiFirmware, { name: 'decodeStateWifiFirmware', decode: decodeStateWifiFirmware }],
  [Type.StatePower, { name: 'decodeStatePower', decode: decodeStatePower }],
  [Type.StateLabel, { name: 'decodeStateLabel', decode: decodeStateLabel }],
  [Type.StateVersion, { name: 'decodeStateVersion', decode: decodeStateVersion }],
  [Type.StateInfo, { name: 'decodeStateInfo', decode: decodeStateInfo }],
  [Type.StateLocation, { name: 'decodeStateLocation', decode: decodeStateLocation }],
  [Type.StateGroup, { name: 'decodeStateGroup', decode: decodeStateGroup }],
  [Type.EchoResponse, { name: 'decodeEchoResponse', decode: decodeEchoResponse }],
  [Type.StateUnhandled, { name: 'decodeStateUnhandled', decode: decodeStateUnhandled }],
  [Type.LightState, { name: 'decodeLightState', decode: decodeLightState }],
  [Type.StateLightPower, { name: 'decodeStateLightPower', decode: decodeStateLightPower }],
  [Type.StateInfrared, { name: 'decodeStateInfrared', decode: decodeStateInfrared }],
  [Type.StateZone, { name: 'decodeStateZone', decode: decodeStateZone }],
  [Type.StateMultiZone, { name: 'decodeStateMultiZone', decode: decodeStateMultiZone }],
  [Type.StateMultiZoneEffect, { name: 'decodeStateMultiZoneEffect', decode: decodeStateMultiZoneEffect }],
  [Type.StateExtendedColorZones, { name: 'decodeStateExtendedColorZones', decode: decodeStateExtendedColorZones }],
  [Type.StateDeviceChain, { name: 'decodeStateDeviceChain', decode: decodeStateDeviceChain }],
  [Type.State64, { name: 'decodeState64', decode: decodeState64 }],
  [Type.StateTileEffect, { name: 'decodeStateTileEffect', decode: decodeStateTileEffect }],
]);

/** A field placed in the whole datagram. */
interface Placed {
  readonly field: Field;
  readonly offset: number;
  readonly section: 'header' | 'payload';
  readonly display: Child;
}

function isColor(value: Value): value is Color {
  return typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array);
}

function chip(c: Color): HTMLElement {
  const node = h('span', { class: 'swatch', title: describeColor(c) });
  node.style.background = swatch(c);
  return node;
}

function displayValue(entry: StructEntry): Child {
  const { field, value } = entry;
  if (value === undefined) return h('span', { class: 'dim' }, 'reserved');
  if (typeof value === 'bigint') {
    return field.kind === 'time' ? `${new Date(Number(value / 1_000_000n)).toISOString()}` : `${value}`;
  }
  if (typeof value === 'number') {
    if (field.kind === 'f32') return String(Number(value.toPrecision(6)));
    if (field.name === 'unhandled_type') return `${value} (${typeName(value)})`;
    return String(value);
  }
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (value instanceof Uint8Array) return h('span', { class: 'mono' }, hex(value.subarray(0, 20)) + (value.length > 20 ? ' …' : ''));
  if (isColor(value)) {
    return h('span', { class: 'color-value' }, chip(value), `${describeColor(value)}`,
      h('span', { class: 'dim' }, ` · ${value.hue} ${value.saturation} ${value.brightness} ${value.kelvin}`));
  }
  return h('span', { class: value.length === 64 ? 'swatches n64' : 'swatches' }, ...value.map(chip));
}

function headerDisplay(field: Field, header: Header): Child {
  switch (field.name) {
    case 'size': return `${header.size} bytes`;
    case 'source': return `${header.source}`;
    case 'target': {
      const serial = convertTargetToSerialNumber(header.target);
      return serial === '000000000000' ? 'all zeros — every device' : `serial ${serial}`;
    }
    case 'sequence': return `${header.sequence}`;
    case 'type': return `${header.type} — ${typeName(header.type)}`;
    default:
      if (field.kind === 'reserved') return h('span', { class: 'dim' }, 'reserved');
      if (field.name.startsWith('protocol')) {
        return `protocol ${header.protocol} · addressable ${header.addressable} · tagged ${header.tagged} · origin ${header.origin}`;
      }
      return `res_required ${header.resRequired} · ack_required ${header.ackRequired}`;
  }
}

function place(packet: Packet, header: Header): { fields: Placed[]; problem: string | undefined } {
  const fields: Placed[] = [];
  let offset = 0;
  for (const field of HEADER_FIELDS) {
    fields.push({ field, offset, section: 'header', display: headerDisplay(field, header) });
    offset += field.size;
  }
  const payload = getPayload(packet.bytes, 0, header.size);
  let problem: string | undefined;
  try {
    for (const entry of readStruct(layoutFor(header.type, payload), payload).entries) {
      fields.push({ field: entry.field, offset: HEADER_SIZE + entry.offset, section: 'payload', display: displayValue(entry) });
    }
  } catch (error) {
    problem = error instanceof Error ? error.message : String(error);
    if (payload.length > 0) {
      fields.push({ field: { name: 'payload', kind: 'bytes', size: payload.length }, offset: HEADER_SIZE, section: 'payload', display: hex(payload.subarray(0, 20)) });
    }
  }
  return { fields, problem };
}

export class Inspector {
  readonly root: HTMLElement;
  /** Copies a packet's bytes into the raw packet lab. */
  onEdit: (packet: Packet) => void = () => {};

  private readonly body: HTMLElement;
  private current: Entry | undefined;
  private scheduled = false;

  constructor() {
    this.body = h('div', { class: 'inspector-body' });
    this.root = h('section', { class: 'card inspector' },
      h('header', { class: 'card-head' }, h('h2', null, 'Packet')),
      this.body,
    );
    // Hovering a byte or a field row lights up the other.
    this.body.addEventListener('pointerover', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-f]') : null;
      for (const node of this.body.querySelectorAll('.hot')) node.classList.remove('hot');
      const index = target?.getAttribute('data-f');
      if (index === null || index === undefined) return;
      for (const node of this.body.querySelectorAll(`[data-f="${index}"]`)) node.classList.add('hot');
    });
    this.show(undefined);
  }

  show(entry: Entry | undefined): void {
    this.current = entry;
    if (this.scheduled) return;
    this.scheduled = true;
    // A dragged slider updates the same row many times a frame; draw once.
    requestAnimationFrame(() => {
      this.scheduled = false;
      this.render();
    });
  }

  private render(): void {
    const entry = this.current;
    clear(this.body);
    if (!entry) {
      this.body.append(h('p', { class: 'empty' }, 'Select a row in the wire log to take it apart.'));
    } else if (entry.kind === 'call') {
      this.renderCall(entry);
    } else {
      this.renderPacket(entry.packet);
    }
  }

  private renderCall(entry: Entry & { kind: 'call' }): void {
    const { call } = entry;
    const error = call.error;
    this.body.append(
      h('div', { class: 'summary' }, h('span', { class: 'tag call' }, 'call'), h('strong', null, 'Library call')),
      h('pre', { class: 'code-block' }, call.code),
    );
    if (call.status === 'pending') {
      this.body.append(h('p', { class: 'note' }, 'Waiting for the device to answer.'));
    } else if (call.status === 'sent') {
      this.body.append(h('p', { class: 'note' }, call.count > 1
        ? `Run ${call.count} times so far. Nothing is awaited: no acknowledgement or reply is requested.`
        : 'Fire-and-forget: nothing is awaited.'));
    } else if (call.status === 'ok') {
      this.body.append(
        h('h3', null, `Resolved after ${Math.round(call.elapsedMs ?? 0)} ms with`),
        h('pre', { class: 'code-block result' }, pretty(call.result)),
      );
    } else {
      this.body.append(
        h('h3', null, `Rejected after ${Math.round(call.elapsedMs ?? 0)} ms with`),
        h('pre', { class: 'code-block bad' }, describeError(error) + (error instanceof LifxError ? `\ncontext: ${pretty(error.context)}` : '')),
      );
    }
  }

  private renderPacket(packet: Packet): void {
    const { bytes, header } = packet;
    const route = `${packet.from.address}:${packet.from.port} → ${packet.to.address}:${packet.to.port}`;
    const edit = button('Edit and resend', () => this.onEdit(packet), { class: 'chip', id: 'inspector-edit' });

    if (!header) {
      let reason = '';
      try { decodeHeader(bytes); } catch (error) { reason = describeError(error); }
      this.body.append(
        h('div', { class: 'summary' }, h('span', { class: `tag ${packet.direction}` }, packet.direction.toUpperCase()),
          h('strong', null, 'Not a LIFX frame'), h('span', { class: 'route' }, route), edit),
        h('p', { class: 'note bad' }, `decodeHeader() rejects these ${bytes.length} bytes — ${reason}`),
        h('pre', { class: 'code-block' }, hex(bytes)),
      );
      return;
    }

    const { fields, problem } = place(packet, header);
    const owner = new Int16Array(bytes.length).fill(-1);
    fields.forEach((f, i) => owner.fill(i, f.offset, Math.min(bytes.length, f.offset + f.field.size)));

    const grid = h('div', { class: 'hex', 'aria-label': 'The datagram as hexadecimal bytes' });
    let colour = 0;
    const colours = fields.map((f) => (f.field.kind === 'reserved' ? -1 : colour++ % 8));
    for (let i = 0; i < bytes.length; i++) {
      if (i % 16 === 0) grid.append(h('span', { class: 'offset' }, i.toString(16).padStart(4, '0')));
      const f = owner[i]!;
      const tone = f < 0 ? -1 : colours[f]!;
      grid.append(h('span', { class: tone < 0 ? 'b rsv' : `b f${tone}`, 'data-f': f < 0 ? undefined : f }, hexByte(bytes[i]!)));
    }

    const table = h('div', { class: 'fields' });
    let section = '';
    fields.forEach((f, i) => {
      if (f.section !== section) {
        section = f.section;
        table.append(h('div', { class: 'section' }, section === 'header' ? 'Header · 36 bytes' : `Payload · ${bytes.length - HEADER_SIZE} bytes`));
      }
      const tone = colours[i]!;
      table.append(h('div', { class: `field${f.field.kind === 'reserved' ? ' reserved' : ''}`, 'data-f': i },
        h('span', { class: tone < 0 ? 'key rsv' : `key f${tone}` }),
        h('span', { class: 'name' }, f.field.name),
        h('span', { class: 'at' }, f.field.size === 1 ? `${f.offset}` : `${f.offset}–${f.offset + f.field.size - 1}`),
        h('span', { class: 'value' }, f.display),
      ));
    });

    const fromDevice = isDeviceMessage(header.type);
    const decoder = DECODERS.get(header.type);
    const payload = getPayload(bytes, 0, header.size);
    const headerText = `decodeHeader(bytes)\n${pretty({ ...header, target: convertTargetToSerialNumber(header.target) })}`;
    let payloadText = '';
    if (decoder) {
      try {
        payloadText = `${decoder.name}(payload)\n${pretty(decoder.decode(payload))}\n\n`;
      } catch (error) {
        payloadText = `${decoder.name}(payload)\n${describeError(error)}\n\n`;
      }
    }
    const decoded = payloadText + headerText;

    append(this.body, [
      h('div', { class: 'summary' },
        h('span', { class: `tag ${packet.direction}` }, packet.direction.toUpperCase()),
        h('strong', null, typeName(header.type)),
        h('span', { class: 'route' }, `${bytes.length} bytes · ${route}`),
        edit,
      ),
      packet.lost && h('p', { class: 'note bad' }, `This datagram never arrived: ${packet.note ?? 'lost'}.`),
      packet.count > 1 && h('p', { class: 'note' }, `Latest of ${packet.count} like it. The bytes below update as new ones are sent.`),
      problem !== undefined && h('p', { class: 'note bad' }, `The payload does not fit the ${typeName(header.type)} layout: ${problem}.`),
      h('div', { class: 'anatomy' }, grid, table),
      h('h3', null, fromDevice ? 'What lifxlan decodes from these bytes' : 'The header as lifxlan decodes it'),
      h('pre', { class: 'code-block result' }, decoded),
    ]);
  }
}
