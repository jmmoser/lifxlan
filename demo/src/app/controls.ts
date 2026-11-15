/**
 * The controls: scenes for the whole room, and a panel for whichever
 * discovered device is selected. Every control ends in a Session method,
 * which is a library call.
 */
import { TimeoutError, UnhandledCommandError, getRssiStatus } from '../../../src/index.js';
import type { Color } from '../../../src/index.js';
import { degrees, gradient, hsbk, kelvinToRgb, percent, rgba, swatch, tint } from './color.js';
import { button, clear, h } from './dom.js';
import type { Child } from './dom.js';
import { describeError } from './format.js';
import { GRADIENTS, PATTERNS, SWATCHES, zoneGradient } from './presets.js';
import type { Lamp, SceneName, Session, TileEffectName, WaveformName } from './session.js';

const FADES: readonly { label: string; ms: number }[] = [
  { label: 'Instant', ms: 0 },
  { label: '0.3 s', ms: 300 },
  { label: '1 s', ms: 1000 },
  { label: '3 s', ms: 3000 },
];

const SCENES: readonly { name: SceneName; label: string }[] = [
  { name: 'sunset', label: 'Sunset' },
  { name: 'aurora', label: 'Aurora' },
  { name: 'fireside', label: 'Fireside' },
  { name: 'focus', label: 'Focus' },
];

const WAVEFORMS: readonly { name: WaveformName; label: string }[] = [
  { name: 'breathe', label: 'Breathe' },
  { name: 'pulse', label: 'Pulse' },
  { name: 'strobe', label: 'Strobe' },
  { name: 'saw', label: 'Saw' },
  { name: 'triangle', label: 'Triangle' },
];

const TILE_EFFECTS: readonly { name: TileEffectName; label: string }[] = [
  { name: 'off', label: 'Off' },
  { name: 'morph', label: 'Morph' },
  { name: 'flame', label: 'Flame' },
  { name: 'sunrise', label: 'Sunrise' },
  { name: 'sunset', label: 'Sunset' },
  { name: 'clouds', label: 'Clouds' },
];

const MOVE_SPEEDS: readonly { label: string; ms: number }[] = [
  { label: 'Slow', ms: 9000 },
  { label: 'Medium', ms: 4000 },
  { label: 'Fast', ms: 1500 },
];

const cssGradient = (stops: readonly Color[]): string => `linear-gradient(90deg, ${stops.map(swatch).join(', ')})`;

interface Slider {
  readonly input: HTMLInputElement;
  readonly readout: HTMLElement;
}

export class Controls {
  readonly root: HTMLElement;
  /** Called when a device tab is chosen. */
  onSelect: (serial: string) => void = () => {};

  private readonly session: Session;
  private readonly scenes: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly status: HTMLElement;
  private selected: string | undefined;
  private signature = '';
  private fadeMs = 300;
  /** The color the sliders show: a bulb's color, or the brush for zones and pixels. */
  private brush: Color = hsbk(190, 1, 1);
  private moveSpeed = 4000;
  private moveForward = true;
  private streamQueued = false;
  private sliders: { hue: Slider; saturation: Slider; brightness: Slider; kelvin: Slider } | undefined;

  constructor(session: Session) {
    this.session = session;
    this.scenes = h('div', { class: 'chips' });
    this.tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Discovered devices' });
    this.panel = h('div', { class: 'panel' });
    this.status = h('p', { class: 'status', 'aria-live': 'polite' });
    this.root = h('section', { class: 'card controls' },
      h('header', { class: 'card-head' }, h('h2', null, 'Whole house'), this.scenes),
      h('header', { class: 'card-head devices-head' }, h('h2', null, 'Devices'), this.tabs),
      this.panel,
      this.status,
    );
    session.listen({ lampsChanged: () => this.refresh() });
    this.refresh();
  }

  get selectedSerial(): string | undefined {
    return this.selected;
  }

  private lamp(): Lamp | undefined {
    return this.session.lamps.find((lamp) => lamp.device.serialNumber === this.selected);
  }

  /** Runs a library-backed action and reports how it ended. */
  private run(action: () => Promise<unknown>, done?: string | ((value: unknown) => string)): void {
    this.say('', false);
    action().then((value) => {
      if (done !== undefined) this.say(typeof done === 'string' ? done : done(value), false);
    }, (error: unknown) => {
      if (error instanceof TimeoutError) {
        this.say(`TimeoutError: no reply within ${this.session.timeoutMs} ms. The request or its reply was lost on the network.`, true);
      } else if (error instanceof UnhandledCommandError) {
        this.say('UnhandledCommandError: the device answered StateUnhandled, its way of saying it has no such feature.', true);
      } else {
        this.say(describeError(error), true);
      }
    });
  }

  private say(text: string, bad: boolean): void {
    this.status.textContent = text;
    this.status.className = bad ? 'status bad' : 'status';
  }

  select(serial: string): void {
    if (serial === this.selected) return;
    this.selected = serial;
    this.signature = '';
    this.refresh();
  }

  /* ---------------------------------------------------------------- */
  /* Rendering                                                         */
  /* ---------------------------------------------------------------- */

  private refresh(): void {
    const { session } = this;
    if (this.selected === undefined || !this.lamp()) {
      const first = session.lamps[0];
      if (first) {
        this.selected = first.device.serialNumber;
        this.onSelect(this.selected);
      }
    }
    const lamp = this.lamp();
    // A bulb's sliders show the bulb's color; for zones and pixels they are a brush.
    if (lamp && lamp.ready && lamp.kind === 'bulb') this.brush = lamp.color;

    const signature = JSON.stringify([
      session.lamps.map((l) => [l.device.serialNumber, l.label, l.ready, l.power]),
      this.selected, lamp?.kind, lamp?.moving, lamp?.tileEffect, lamp?.rssi, lamp?.firmware,
      lamp?.kind === 'bulb' && lamp.color,
      session.partying, session.plasmaFor?.device.serialNumber,
    ]);
    if (signature === this.signature) return;
    this.signature = signature;

    const focused = document.activeElement instanceof HTMLElement && this.root.contains(document.activeElement) ? document.activeElement.id : '';

    this.renderScenes();
    this.renderTabs();
    this.renderPanel(lamp);

    if (focused) document.getElementById(focused)?.focus({ preventScroll: true });
  }

  private renderScenes(): void {
    const { session } = this;
    const anyOn = session.lamps.some((lamp) => lamp.power);
    clear(this.scenes);
    this.scenes.append(
      ...SCENES.map((scene) => button(scene.label, () => this.run(() => session.scene(scene.name)), { class: 'chip', id: `scene-${scene.name}` })),
      button('Party', () => {
        if (session.partying) session.stopAnimation();
        else this.run(() => session.startParty());
      }, { class: 'chip toggle', 'aria-pressed': String(session.partying), id: 'scene-party' }),
      button(anyOn ? 'All off' : 'All on', () => this.run(() => session.allPower(!anyOn)), { class: 'chip', id: 'scene-power' }),
      button('Rediscover', () => session.rescan(), { class: 'chip quiet', id: 'scene-rescan' }),
    );
  }

  private renderTabs(): void {
    clear(this.tabs);
    if (this.session.lamps.length === 0) {
      this.tabs.append(h('span', { class: 'note' }, 'Broadcasting GetService and waiting for StateService replies…'));
      return;
    }
    for (const lamp of this.session.lamps) {
      const serial = lamp.device.serialNumber;
      const tab = button(h('span', null, h('span', { class: `dot${lamp.power ? ' on' : ''}` }), lamp.ready ? lamp.label : 'Identifying…'), () => {
        this.select(serial);
        this.onSelect(serial);
      }, { class: 'tab', role: 'tab', 'aria-selected': String(serial === this.selected), id: `tab-${serial}` });
      this.tabs.append(tab);
    }
  }

  private renderPanel(lamp: Lamp | undefined): void {
    clear(this.panel);
    this.sliders = undefined;
    if (!lamp) {
      this.panel.append(h('p', { class: 'empty' }, 'No devices yet. Discovery broadcasts GetService and registers whatever answers.'));
      return;
    }
    if (!lamp.ready) {
      this.panel.append(h('p', { class: 'empty' }, `Found ${lamp.device.serialNumber} at ${lamp.device.address}. Asking it what it is: label, product, firmware, signal, state.`));
      return;
    }

    const { session } = this;
    const zoned = lamp.kind !== 'bulb';
    const features = lamp.features;
    const capabilities = features
      ? [features.color && 'color', features.multizone && 'multizone', features.extended_multizone && 'extended multizone', features.matrix && 'matrix', features.chain && 'chain']
        .filter((name): name is string => typeof name === 'string')
      : [];

    const label = h('input', { id: 'device-label', type: 'text', maxlength: 32, value: lamp.label, 'aria-label': 'Device label' });
    const rename = () => {
      const next = label.value.trim();
      if (next && next !== lamp.label) this.run(() => session.rename(lamp, next), 'Renamed. The device stores its own label; the name in the room is read from it.');
    };
    label.addEventListener('keydown', (event) => { if (event.key === 'Enter') rename(); });

    this.panel.append(
      h('div', { class: 'identity' },
        h('div', { class: 'label-edit' }, label, button('Rename', rename, { class: 'chip', id: 'device-rename' })),
        h('div', { class: 'tools' },
          button(lamp.power ? 'On' : 'Off', () => this.run(() => session.setPower(lamp, !lamp.power, this.fadeMs)),
            { class: 'chip toggle power', 'aria-pressed': String(lamp.power), 'aria-label': `Power: ${lamp.power ? 'on' : 'off'}`, id: 'device-power' }),
          button('Read state', () => this.run(async () => {
            await session.readState(lamp);
            if (lamp.kind === 'bulb') this.setBrush(lamp.color);
          }, 'State read back from the device.'), { class: 'chip', id: 'device-read' }),
          button('Ping', () => this.run(() => session.ping(lamp), (ms) => `Echo matched: 64 random bytes went out and the same 64 came back in ${typeof ms === 'number' ? Math.round(ms) : '?'} ms.`),
            { class: 'chip', id: 'device-ping' }),
        ),
      ),
      h('p', { class: 'meta' },
        `${lamp.productName} · ${lamp.device.serialNumber} · ${lamp.device.address} · firmware ${lamp.firmware}`,
        lamp.rssi !== undefined && ` · ${lamp.rssi} dBm (${getRssiStatus(lamp.rssi)})`,
        ...capabilities.map((name) => h('span', { class: 'pill' }, name)),
      ),
    );

    this.panel.append(this.colorBlock(lamp, zoned));

    if (lamp.kind === 'bulb') this.panel.append(this.bulbBlock(lamp));
    else if (lamp.kind === 'strip') this.panel.append(this.stripBlock(lamp));
    else this.panel.append(this.tilesBlock(lamp));
  }

  /* ---------------------------------------------------------------- */
  /* Color                                                             */
  /* ---------------------------------------------------------------- */

  private slider(id: string, name: string, min: number, max: number, step: number, value: number): Slider & { row: HTMLElement } {
    const input = h('input', { id, type: 'range', min, max, step, value, 'aria-label': name });
    const readout = h('output', { class: 'readout', for: id });
    return { input, readout, row: h('div', { class: 'slider' }, h('label', { for: id }, name), input, readout) };
  }

  private colorBlock(lamp: Lamp, zoned: boolean): HTMLElement {
    const { session } = this;
    const c = this.brush;
    const hue = this.slider('color-hue', 'Hue', 0, 360, 1, degrees(c.hue));
    const saturation = this.slider('color-saturation', 'Saturation', 0, 100, 1, percent(c.saturation));
    const brightness = this.slider('color-brightness', 'Brightness', 0, 100, 1, percent(c.brightness));
    const kelvin = this.slider('color-kelvin', 'Kelvin', 1500, 9000, 100, c.kelvin);
    this.sliders = { hue, saturation, brightness, kelvin };

    const read = (): Color => hsbk(Number(hue.input.value), Number(saturation.input.value) / 100, Number(brightness.input.value) / 100, Number(kelvin.input.value));

    for (const s of [hue, saturation, brightness, kelvin]) {
      s.input.addEventListener('input', () => {
        this.brush = read();
        this.paintSliders();
        if (zoned || this.streamQueued) return;
        // A drag sends one unacknowledged packet per frame…
        this.streamQueued = true;
        requestAnimationFrame(() => {
          this.streamQueued = false;
          session.streamColor(lamp, this.brush, 60);
        });
      });
      // …and letting go sends one more that waits for its acknowledgement.
      s.input.addEventListener('change', () => {
        if (!zoned) this.run(() => session.setColor(lamp, this.brush, 0));
      });
    }

    const fades = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Fade time for the next change' },
      ...FADES.map((fade) => {
        const option = button(fade.label, () => {
          this.fadeMs = fade.ms;
          for (const node of fades.children) node.setAttribute('aria-pressed', String(node === option));
        }, { 'aria-pressed': String(fade.ms === this.fadeMs), id: `fade-${fade.ms}` });
        return option;
      }));

    const swatches = h('div', { class: 'swatch-row' }, ...SWATCHES.map((preset) => {
      const node = button('', () => {
        this.setBrush(preset.color);
        if (!zoned) this.run(() => session.setColor(lamp, preset.color, this.fadeMs));
      }, { class: 'swatch-button', title: preset.name, 'aria-label': preset.name });
      node.style.background = swatch(preset.color);
      return node;
    }));

    const block = h('div', { class: 'block' },
      h('div', { class: 'block-head' },
        h('h3', null, zoned ? 'Brush' : 'Color'),
        h('div', { class: 'fade' }, h('span', null, 'Fade'), fades),
      ),
      hue.row, saturation.row, brightness.row, kelvin.row,
      swatches,
      zoned
        ? h('div', { class: 'chips' },
          button(lamp.kind === 'strip' ? 'Fill the strip' : 'Fill the tiles', () => this.run(async () => {
            if (lamp.kind === 'tiles' && lamp.tileEffect !== 'off') await session.setTileEffect(lamp, 'off');
            await session.setColor(lamp, this.brush, this.fadeMs);
          }), { class: 'primary', id: 'color-fill' }),
          h('span', { class: 'hint' }, lamp.kind === 'strip'
            ? 'Or drag along the strip in the room to paint zones with this color.'
            : 'Or drag across the tiles in the room to paint pixels with this color.'))
        : h('p', { class: 'hint' }, 'Dragging streams unacknowledged SetColor packets. Letting go sends one that waits for its Acknowledgement. Kelvin shows as saturation drops.'),
    );
    this.paintSliders();
    return block;
  }

  private setBrush(c: Color): void {
    this.brush = c;
    const s = this.sliders;
    if (!s) return;
    s.hue.input.value = String(degrees(c.hue));
    s.saturation.input.value = String(percent(c.saturation));
    s.brightness.input.value = String(percent(c.brightness));
    s.kelvin.input.value = String(c.kelvin);
    this.paintSliders();
  }

  /** Updates the readouts (human units and the uint16 that goes on the wire) and the track colors. */
  private paintSliders(): void {
    const s = this.sliders;
    if (!s) return;
    const c = this.brush;
    s.hue.readout.textContent = `${degrees(c.hue)}° · ${c.hue}`;
    s.saturation.readout.textContent = `${percent(c.saturation)}% · ${c.saturation}`;
    s.brightness.readout.textContent = `${percent(c.brightness)}% · ${c.brightness}`;
    s.kelvin.readout.textContent = `${c.kelvin} K`;
    const full = { ...c, brightness: 65535 };
    s.hue.input.style.setProperty('--track', 'linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)');
    s.saturation.input.style.setProperty('--track', `linear-gradient(90deg, ${rgba(tint({ ...full, saturation: 0 }), 1)}, ${rgba(tint({ ...full, saturation: 65535 }), 1)})`);
    s.brightness.input.style.setProperty('--track', `linear-gradient(90deg, #000, ${rgba(tint(full), 1)})`);
    s.kelvin.input.style.setProperty('--track', `linear-gradient(90deg, ${[1500, 2700, 4000, 6500, 9000].map((k) => rgba(kelvinToRgb(k), 1)).join(', ')})`);
  }

  /* ---------------------------------------------------------------- */
  /* Per-kind blocks                                                   */
  /* ---------------------------------------------------------------- */

  private block(title: string, ...children: Child[]): HTMLElement {
    return h('div', { class: 'block' }, h('h3', null, title), ...children);
  }

  private bulbBlock(lamp: Lamp): HTMLElement {
    const { session } = this;
    return h('div', { class: 'blocks' },
      this.block('Waveforms',
        h('div', { class: 'chips' }, ...WAVEFORMS.map((w) => button(w.label, () => this.run(() => session.waveform(lamp, w.name)), { class: 'chip', id: `waveform-${w.name}` }))),
        h('p', { class: 'hint' }, 'One SetWaveform packet. The bulb runs the whole animation itself, then returns to its color.')),
      this.block('A message this bulb cannot handle',
        h('div', { class: 'chips' }, button('Ask for its infrared level', () => this.run(() => session.unsupported(lamp)), { class: 'chip', id: 'device-unsupported' })),
        h('p', { class: 'hint' }, 'An A19 has no infrared LEDs. It answers StateUnhandled and the call rejects.')),
    );
  }

  private stripBlock(lamp: Lamp): HTMLElement {
    const { session } = this;
    const speeds = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Move speed' }, ...MOVE_SPEEDS.map((speed) => {
      const option = button(speed.label, () => {
        this.moveSpeed = speed.ms;
        for (const node of speeds.children) node.setAttribute('aria-pressed', String(node === option));
        if (lamp.moving) this.run(() => session.setMove(lamp, true, this.moveSpeed, this.moveForward));
      }, { 'aria-pressed': String(speed.ms === this.moveSpeed), id: `move-${speed.ms}` });
      return option;
    }));
    return h('div', { class: 'blocks' },
      this.block('Gradients',
        h('div', { class: 'chips' }, ...GRADIENTS.map((preset) => {
          const node = button(preset.name, () => this.run(async () => {
            if (lamp.moving) await session.setMove(lamp, false, this.moveSpeed, this.moveForward);
            await session.setGradient(lamp, zoneGradient(preset.name, lamp.zones.length), this.fadeMs);
          }), { class: 'chip gradient', id: `gradient-${preset.name}` });
          node.style.setProperty('--preview', cssGradient(gradient(preset.stops, 6)));
          return node;
        })),
        h('p', { class: 'hint' }, `All ${lamp.zones.length} zones in one SetExtendedColorZones packet.`)),
      this.block('Move effect',
        h('div', { class: 'chips' },
          button(lamp.moving ? 'Moving' : 'Start moving', () => this.run(() => session.setMove(lamp, !lamp.moving, this.moveSpeed, this.moveForward)),
            { class: 'chip toggle', 'aria-pressed': String(lamp.moving), id: 'move-toggle' }),
          speeds,
          button(this.moveForward ? 'Direction →' : 'Direction ←', () => {
            this.moveForward = !this.moveForward;
            this.signature = '';
            if (lamp.moving) this.run(() => session.setMove(lamp, true, this.moveSpeed, this.moveForward));
            else this.refresh();
          }, { class: 'chip', id: 'move-direction' })),
        h('p', { class: 'hint' }, 'SetMultiZoneEffect: the strip scrolls its own zones. No packets are sent while it runs.')),
      this.block('Read the zones back',
        h('div', { class: 'chips' },
          button('GetColorZones', () => this.run(() => session.readZones(lamp, false), 'Four StateMultiZone packets of 8 zones each, assembled into one result.'), { class: 'chip', id: 'zones-read' }),
          button('GetExtendedColorZones', () => this.run(() => session.readZones(lamp, true), 'One StateExtendedColorZones packet carrying every zone.'), { class: 'chip', id: 'zones-read-extended' })),
        h('p', { class: 'hint' }, 'Two ways to ask the same question. Compare the packet counts in the log.')),
    );
  }

  private tilesBlock(lamp: Lamp): HTMLElement {
    const { session } = this;
    const streaming = session.plasmaFor === lamp;
    return h('div', { class: 'blocks' },
      this.block('Firmware effects',
        h('div', { class: 'chips' }, ...TILE_EFFECTS.map((effect) => button(effect.label, () => this.run(() => session.setTileEffect(lamp, effect.name)),
          { class: 'chip toggle', 'aria-pressed': String(lamp.tileEffect === effect.name && !streaming), id: `effect-${effect.name}` }))),
        h('p', { class: 'hint' }, 'One SetTileEffect packet starts an animation the tiles run on their own.')),
      this.block('Pixel patterns',
        h('div', { class: 'chips' },
          ...PATTERNS.map((pattern) => button(pattern.name, () => this.run(() => session.setPattern(lamp, pattern.name, this.fadeMs)), { class: 'chip', id: `pattern-${pattern.name}` })),
          button(streaming ? 'Streaming plasma' : 'Stream plasma', () => {
            if (streaming) session.stopAnimation();
            else this.run(() => session.startPlasma(lamp));
          }, { class: 'chip toggle', 'aria-pressed': String(streaming), id: 'pattern-plasma' })),
        h('p', { class: 'hint' }, 'A pattern is five Set64 packets of 64 colors, one per tile. Plasma is computed in this page and streamed: 60 packets a second.')),
      this.block('Read the tiles back',
        h('div', { class: 'chips' },
          button('Get64 for all five', () => this.run(() => session.readTiles(lamp), 'Five State64 packets, one per tile, assembled in tile order.'), { class: 'chip', id: 'tiles-read' }),
          button('GetDeviceChain', () => this.run(() => session.readChain(lamp), 'One 918-byte StateDeviceChain describing all five tiles.'), { class: 'chip', id: 'tiles-chain' }))),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Painting from the room                                            */
  /* ---------------------------------------------------------------- */

  /** A drag in the room over zone or pixel `index` of the selected device. */
  paint(serial: string, index: number): void {
    const lamp = this.session.lamps.find((candidate) => candidate.device.serialNumber === serial);
    if (!lamp || !lamp.ready) return;
    if (lamp.kind === 'strip') {
      if (lamp.moving) {
        this.run(() => this.session.setMove(lamp, false, this.moveSpeed, this.moveForward), 'Stopped the move effect so you can paint.');
        return;
      }
      this.session.paintZone(lamp, index, this.brush);
    } else if (lamp.kind === 'tiles') {
      if (this.session.plasmaFor === lamp) {
        this.session.stopAnimation();
        return;
      }
      if (lamp.tileEffect !== 'off') {
        this.run(() => this.session.setTileEffect(lamp, 'off'), 'Stopped the effect so you can paint.');
        return;
      }
      this.session.paintPixel(lamp, Math.floor(index / 64), index % 64, this.brush);
    }
  }
}
