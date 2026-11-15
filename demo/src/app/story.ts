/**
 * The last exchange on the network, told as a conversation: what the
 * library asked a device, in plain words, and what the device said back —
 * each with the bytes that actually carried it.
 *
 * The words are a reading of real packets. Requests are parsed with the
 * demo's own layouts; replies are decoded by the library.
 */
import {
  decodeHeader,
  decodeLightState,
  decodeState64,
  decodeStateDeviceChain,
  decodeStateExtendedColorZones,
  decodeStateHostFirmware,
  decodeStateLabel,
  decodeStatePower,
  decodeStateVersion,
  decodeStateWifiInfo,
  getPayload,
} from '../../../src/encoding.js';
import { MultiZoneEffectType, TileEffectType, Type, convertSignalToRssi } from '../../../src/index.js';
import type { Color, Header } from '../../../src/index.js';
import { HEADER_SIZE, LAYOUTS, layoutFor, readStruct, typeName } from '../protocol/layouts.js';
import { BROADCAST } from '../sim/lan.js';
import type { Datagram, VirtualLan } from '../sim/lan.js';
import { swatch } from './color.js';
import { clear, h } from './dom.js';
import type { Child } from './dom.js';
import { hexByte } from './format.js';
import type { Session } from './session.js';

const NAMES: readonly [number, string][] = [
  [0, 'red'], [30, 'orange'], [60, 'yellow'], [120, 'green'], [180, 'cyan'], [240, 'blue'], [275, 'violet'], [300, 'magenta'], [330, 'pink'], [360, 'red'],
];

/** A colour as a person would say it. */
export function colourName(c: Color): string {
  if (c.brightness < 2000) return 'dark';
  if (c.saturation < 13000) return c.kelvin < 3200 ? 'warm white' : c.kelvin > 5000 ? 'cool white' : 'white';
  const degrees = (c.hue / 65535) * 360;
  let best = 'red';
  let nearest = Infinity;
  for (const [at, name] of NAMES) {
    if (Math.abs(at - degrees) < nearest) {
      nearest = Math.abs(at - degrees);
      best = name;
    }
  }
  return best;
}

const seconds = (ns: bigint): string => {
  const s = Number(ns / 1_000_000n) / 1000;
  return s === 0 ? 'until told otherwise' : `for ${s} second${s === 1 ? '' : 's'}`;
};

/** What a request says, in words. */
function ask(type: number, payload: Uint8Array): string {
  try {
    switch (type) {
      case Type.GetService: return 'Is anyone out there?';
      case Type.GetLabel: return 'What are you called?';
      case Type.GetVersion: return 'What product are you?';
      case Type.GetHostFirmware: return 'Which firmware are you running?';
      case Type.GetWifiInfo: return 'How strong is your signal?';
      case Type.GetColor: return 'What colour are you right now?';
      case Type.GetPower: case Type.GetLightPower: return 'Are you on?';
      case Type.GetColorZones: case Type.GetExtendedColorZones: return 'What colour is each of your zones?';
      case Type.GetDeviceChain: return 'How many tiles do you have, and where are they?';
      case Type.Get64: return 'What is every pixel showing?';
      case Type.GetInfrared: return 'How bright is your infrared?';
      case Type.GetMultiZoneEffect: case Type.GetTileEffect: return 'Which effect are you running?';
      case Type.EchoRequest: return 'Repeat these 64 bytes back to me.';
      case Type.SetColor: {
        const p = readStruct(LAYOUTS.SetColor, payload);
        const fade = p.number('duration');
        return `Turn ${colourName(p.color('color'))}${fade >= 300 ? `, fading over ${(fade / 1000).toFixed(1)} s` : ''}.`;
      }
      case Type.SetColorZones: {
        const p = readStruct(LAYOUTS.SetColorZones, payload);
        return `Turn your zones ${p.number('start_index')} to ${p.number('end_index')} ${colourName(p.color('color'))}.`;
      }
      case Type.SetExtendedColorZones: {
        const p = readStruct(LAYOUTS.SetExtendedColorZones, payload);
        return `Here is a colour for each of ${p.number('colors_count')} zones. Show them.`;
      }
      case Type.Set64: {
        const p = readStruct(LAYOUTS.Set64, payload);
        const pixels = p.colors('colors');
        const first = pixels[0];
        const flat = first !== undefined && pixels.every((c) => c.hue === first.hue && c.saturation === first.saturation && c.brightness === first.brightness);
        return flat && first ? `Turn all 64 pixels of tile ${p.number('tile_index')} ${colourName(first)}.` : `Here are all 64 pixels for tile ${p.number('tile_index')}. Show them.`;
      }
      case Type.SetWaveform: {
        const p = readStruct(LAYOUTS.SetWaveform, payload);
        return `Flash ${colourName(p.color('color'))} ${Math.round(p.number('cycles'))} times. Do it yourself; I won't send more.`;
      }
      case Type.SetMultiZoneEffect: {
        const p = readStruct(LAYOUTS.SetMultiZoneEffect, payload);
        return p.number('type') === MultiZoneEffectType.OFF ? 'Stop scrolling.' : `Scroll your zones along the strip ${seconds(p.bigint('duration'))}. Do it yourself.`;
      }
      case Type.SetTileEffect: {
        const p = readStruct(LAYOUTS.SetTileEffect, payload);
        const effect = p.number('type');
        if (effect === TileEffectType.OFF) return 'Stop the effect.';
        return `${effect === TileEffectType.FLAME ? 'Burn like fire' : effect === TileEffectType.MORPH ? 'Drift through these colours' : 'Show me the sky'} ${seconds(p.bigint('duration'))}. Do it yourself.`;
      }
      case Type.SetPower: return readStruct(LAYOUTS.SetPower, payload).number('level') > 0 ? 'Turn on.' : 'Turn off.';
      case Type.SetLightPower: return readStruct(LAYOUTS.SetLightPower, payload).number('level') > 0 ? 'Turn on.' : 'Turn off.';
      case Type.SetLabel: return `From now on you are called “${readStruct(LAYOUTS.SetLabel, payload).text('label')}”.`;
      default: return `${typeName(type)}.`;
    }
  } catch {
    return `${typeName(type)}, but the payload is cut short.`;
  }
}

/** What a reply says, in words — decoded by the library. */
function answer(type: number, payload: Uint8Array): string {
  try {
    switch (type) {
      case Type.Acknowledgement: return 'Got it.';
      case Type.StateService: return 'I’m here.';
      case Type.StateLabel: return `I’m “${decodeStateLabel(payload)}”.`;
      case Type.StateVersion: { const v = decodeStateVersion(payload); return `Vendor ${v.vendor}, product ${v.product}.`; }
      case Type.StateHostFirmware: { const f = decodeStateHostFirmware(payload); return `Firmware ${f.versionMajor}.${f.versionMinor}.`; }
      case Type.StateWifiInfo: return `About ${convertSignalToRssi(decodeStateWifiInfo(payload).signal)} dBm.`;
      case Type.LightState: { const s = decodeLightState(payload); return `I’m ${colourName(s)}, ${s.power > 0 ? 'switched on' : 'switched off'}, and I’m called “${s.label}”.`; }
      case Type.StatePower: case Type.StateLightPower: return decodeStatePower(payload) > 0 ? 'I’m on.' : 'I’m off.';
      case Type.StateExtendedColorZones: return `I have ${decodeStateExtendedColorZones(payload).zonesCount} zones. Here is every one.`;
      case Type.StateMultiZone: return 'Here are eight of my zones.';
      case Type.StateZone: return 'Here is that zone.';
      case Type.StateDeviceChain: return `${decodeStateDeviceChain(payload).devices.length} tiles, each 8 × 8 pixels.`;
      case Type.State64: return `Tile ${decodeState64(payload).tileIndex}: here are its 64 pixels.`;
      case Type.StateUnhandled: return 'I can’t do that.';
      case Type.EchoResponse: return 'Here they are, the same 64 bytes.';
      case Type.StateMultiZoneEffect: case Type.StateTileEffect: return 'Here is the effect I’m running.';
      default: return `${typeName(type)}.`;
    }
  } catch {
    return `${typeName(type)}, but it arrived cut short.`;
  }
}

interface Reply {
  readonly from: string;
  readonly header: Header;
  readonly bytes: Uint8Array;
  readonly ms: number;
  readonly lost: boolean;
}

interface Exchange {
  readonly header: Header;
  readonly bytes: Uint8Array;
  readonly to: string;
  readonly at: number;
  readonly lost: boolean;
  readonly nobody: boolean;
  readonly replies: Reply[];
}

export class Story {
  readonly root: HTMLElement;

  private readonly session: Session;
  private exchange: Exchange | undefined;
  private queued = false;

  constructor(session: Session, lan: VirtualLan) {
    this.session = session;
    this.root = h('section', { class: 'story', 'aria-label': 'The last exchange on the network, in words', 'aria-live': 'off' },
      h('p', { class: 'story-empty' }, 'Everything the game does goes over the network as LIFX messages. The last one, and its answer, will show up here in plain words.'));
    const me = session.endpoint;

    lan.observe((event) => {
      const { datagram } = event;
      const mine = datagram.from.address === me.address && datagram.from.port === me.port;
      if (event.kind === 'send' && mine) {
        const header = this.header(datagram);
        if (!header) return;
        this.exchange = {
          header, bytes: datagram.bytes, to: datagram.to.address, at: performance.now(),
          nobody: event.hops.length === 0, lost: event.hops.length > 0 && event.hops.every((hop) => hop.lost), replies: [],
        };
        this.refresh();
      } else if (event.kind === 'send' && !mine) {
        // A reply that will be lost on the way back is still part of the story.
        if (event.hops.some((hop) => hop.lost && hop.to.address === me.address)) this.reply(datagram, true);
      } else if (event.kind === 'deliver' && event.to.address === me.address) {
        this.reply(datagram, false);
      }
    });
  }

  private header(datagram: Datagram): Header | undefined {
    try {
      return decodeHeader(datagram.bytes);
    } catch {
      return undefined;
    }
  }

  private reply(datagram: Datagram, lost: boolean): void {
    const exchange = this.exchange;
    const header = this.header(datagram);
    if (!exchange || !header) return;
    // A reply echoes the request's source and sequence; that is all that ties the two together.
    if (header.source !== exchange.header.source || header.sequence !== exchange.header.sequence) return;
    exchange.replies.push({ from: datagram.from.address, header, bytes: datagram.bytes, ms: performance.now() - exchange.at, lost });
    this.refresh();
  }

  private refresh(): void {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      this.render();
    });
  }

  private name(address: string): string {
    if (address === BROADCAST) return 'every device';
    const lamp = this.session.lamps.find((candidate) => candidate.device.address === address);
    return lamp && lamp.name !== 'device' ? lamp.label : `the device at ${address}`;
  }

  /** The packet's bytes, header dimmed, with the two bytes that carry the hue picked out. */
  private bytes(header: Header, bytes: Uint8Array): HTMLElement {
    const payload = getPayload(bytes, 0, header.size);
    let hueAt = -1;
    let colour: Color | undefined;
    try {
      for (const entry of readStruct(layoutFor(header.type, payload), payload).entries) {
        if (entry.field.kind !== 'color' && entry.field.kind !== 'colors') continue;
        hueAt = HEADER_SIZE + entry.offset;
        colour = entry.field.kind === 'color' ? readStruct([entry.field], payload.subarray(entry.offset)).color(entry.field.name) : readStruct([entry.field], payload.subarray(entry.offset)).colors(entry.field.name)[0];
        break;
      }
    } catch {
      hueAt = -1;
    }
    const shown = Math.min(bytes.length, 56);
    const code = h('code', { class: 'bytes' });
    for (let i = 0; i < shown; i++) {
      const node = h('span', { class: i < HEADER_SIZE ? 'hd' : i === hueAt || i === hueAt + 1 ? 'hue' : 'pl' }, hexByte(bytes[i]!));
      if (colour && (i === hueAt || i === hueAt + 1)) node.style.background = swatch({ ...colour, brightness: 65535 });
      code.append(node, ' ');
    }
    if (bytes.length > shown) code.append(h('span', { class: 'hd' }, `… ${bytes.length - shown} more`));
    const wrap = h('div', { class: 'wire' }, code);
    if (colour && hueAt >= 0) {
      wrap.append(h('span', { class: 'gloss' },
        `The two highlighted bytes are the hue: ${hexByte(bytes[hueAt]!)} ${hexByte(bytes[hueAt + 1]!)} = ${colour.hue} of 65535 = ${Math.round((colour.hue / 65535) * 360)}°.`));
    }
    return wrap;
  }

  private bubble(side: 'you' | 'them' | 'none', who: string, words: string, meta: string, detail: Child): HTMLElement {
    return h('div', { class: `say ${side}` },
      h('span', { class: 'who' }, who),
      h('p', { class: 'words' }, words),
      h('span', { class: 'meta' }, meta),
      detail,
    );
  }

  private render(): void {
    const exchange = this.exchange;
    if (!exchange) return;
    const { header, bytes } = exchange;
    const payload = getPayload(bytes, 0, header.size);
    const expects = header.ackRequired || header.resRequired || exchange.to === BROADCAST;

    const nodes: HTMLElement[] = [
      this.bubble('you', `You, through lifxlan, to ${this.name(exchange.to)}`, ask(header.type, payload),
        `${typeName(header.type)} · ${bytes.length} bytes${exchange.to === BROADCAST ? ' · broadcast' : ''}${header.ackRequired ? ' · asks for an Acknowledgement' : ''}`,
        this.bytes(header, bytes)),
    ];

    if (exchange.nobody) {
      nodes.push(this.bubble('none', 'Nobody', 'Nothing is listening at that address any more.', 'The packet went nowhere. The call will time out.', null));
    } else if (exchange.lost) {
      nodes.push(this.bubble('none', 'The network', 'That one never arrived.', 'Lost on the way. With no reply, the call times out and is sent again.', null));
    } else if (exchange.replies.length === 0) {
      nodes.push(this.bubble('none', this.name(exchange.to), expects ? '…' : 'No reply asked for.',
        expects ? 'waiting for the answer' : 'Sent without waiting: the next one will replace it anyway.', null));
    } else {
      const shown = exchange.replies.slice(0, 2);
      for (const reply of shown) {
        const replyPayload = getPayload(reply.bytes, 0, reply.header.size);
        nodes.push(reply.lost
          ? this.bubble('none', this.name(reply.from), 'I answered, but the answer got lost.', `${typeName(reply.header.type)} · lost on the way back`, null)
          : this.bubble('them', this.name(reply.from), answer(reply.header.type, replyPayload),
            `${typeName(reply.header.type)} · ${reply.bytes.length} bytes · ${Math.round(reply.ms)} ms later`, this.bytes(reply.header, reply.bytes)));
      }
      if (exchange.replies.length > shown.length) {
        nodes.push(h('p', { class: 'more' }, `…and ${exchange.replies.length - shown.length} more ${exchange.replies.length - shown.length === 1 ? 'reply' : 'replies'}.`));
      }
    }
    clear(this.root);
    this.root.append(...nodes);
  }
}
