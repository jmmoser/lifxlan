/**
 * lifxlan in a browser. A browser has no UDP sockets, so the network and
 * the devices on it are simulated in the page (src/sim); everything else —
 * discovery, every command, every decoded reply — is the library itself,
 * wired to that network by src/app/session.ts.
 */
import { VirtualDevice } from './sim/firmware.js';
import { FLEET } from './sim/fleet.js';
import { VirtualLan } from './sim/lan.js';
import { Controls } from './app/controls.js';
import { h } from './app/dom.js';
import { Inspector } from './app/inspector.js';
import { Lab } from './app/lab.js';
import { Session } from './app/session.js';
import { Stage } from './app/stage.js';
import { WireLog } from './app/wirelog.js';

function start(): void {
  const mount = document.getElementById('app');
  if (!mount) return;

  const lan = new VirtualLan();
  const fleet = FLEET.map((spec) => new VirtualDevice(spec, lan));
  const session = new Session(lan);

  const controls = new Controls(session);
  const stage = new Stage(fleet, lan, session.endpoint, {
    select: (serial) => controls.select(serial),
    paint: (serial, index) => controls.paint(serial, index),
  });
  const log = new WireLog(session, lan);
  const inspector = new Inspector();
  const lab = new Lab(session);

  const syncSelection = (serial: string | undefined) => {
    stage.selected = serial;
    const kind = fleet.find((device) => device.spec.serial === serial)?.spec.kind;
    stage.canvas.classList.toggle('paintable', kind === 'strip' || kind === 'tiles');
  };
  controls.onSelect = syncSelection;
  session.listen({ lampsChanged: () => syncSelection(controls.selectedSerial) });
  log.onSelect = (entry) => inspector.show(entry);
  inspector.onEdit = (packet) => lab.load(packet);

  /* Network conditions */
  const latency = h('input', { id: 'net-latency', type: 'range', min: 0, max: 600, step: 5, value: lan.latencyMs, 'aria-label': 'One-way latency' });
  const latencyOut = h('output', { class: 'readout', for: 'net-latency' });
  const loss = h('input', { id: 'net-loss', type: 'range', min: 0, max: 100, step: 1, value: 0, 'aria-label': 'Packet loss' });
  const lossOut = h('output', { class: 'readout', for: 'net-loss' });
  const counters = h('p', { class: 'counters' });
  const syncNetwork = () => {
    lan.latencyMs = Number(latency.value);
    lan.jitterMs = Math.min(40, lan.latencyMs * 0.4);
    lan.loss = Number(loss.value) / 100;
    latencyOut.textContent = `${lan.latencyMs} ms each way`;
    lossOut.textContent = `${loss.value}% lost`;
  };
  latency.addEventListener('input', syncNetwork);
  loss.addEventListener('input', syncNetwork);
  syncNetwork();

  let countersQueued = false;
  const syncCounters = () => {
    if (countersQueued) return;
    countersQueued = true;
    requestAnimationFrame(() => {
      countersQueued = false;
      const { sent, received, lost, bytes } = log.stats;
      counters.replaceChildren(
        h('span', null, h('b', null, sent.toLocaleString()), ' sent'),
        h('span', null, h('b', null, received.toLocaleString()), ' received'),
        h('span', null, h('b', null, lost.toLocaleString()), ' lost'),
        h('span', null, h('b', null, session.timeouts.toLocaleString()), ' timed out'),
        h('span', null, h('b', null, bytes < 1e6 ? `${(bytes / 1024).toFixed(1)} kB` : `${(bytes / 1048576).toFixed(2)} MB`), ' on the wire'),
      );
    });
  };
  log.onStats = syncCounters;
  session.listen({ callUpdated: syncCounters });
  syncCounters();

  const network = h('section', { class: 'card network' },
    h('header', { class: 'card-head' }, h('h2', null, 'Network')),
    h('div', { class: 'slider' }, h('label', { for: 'net-latency' }, 'Latency'), latency, latencyOut),
    h('div', { class: 'slider' }, h('label', { for: 'net-loss' }, 'Packet loss'), loss, lossOut),
    h('p', { class: 'hint' }, 'UDP promises nothing. Raise the loss and calls start rejecting with TimeoutError; at 100% nothing in the room can change.'),
    counters,
  );

  mount.replaceChildren(
    h('header', { class: 'masthead' },
      h('div', null,
        h('h1', null, 'lifxlan, live in a browser tab'),
        h('p', { class: 'lede' },
          'Browsers cannot open UDP sockets, so the four LIFX devices in this room and the network they sit on are simulated. ',
          'Everything that talks to them is the real ', h('code', null, 'lifxlan'), ' library: it discovers them, encodes every request and decodes every reply. ',
          'The lights are drawn from the devices’ own state, which only bytes on the network can change.'),
      ),
    ),
    h('main', { class: 'layout' },
      h('div', { class: 'column' },
        h('section', { class: 'room' }, stage.canvas,
          h('p', { class: 'caption' }, h('span', { class: 'key tx' }), 'request', h('span', { class: 'key rx' }), 'reply', h('span', { class: 'key lost' }), 'lost',
            h('span', { class: 'grow' }), 'Click a device to select it.')),
        controls.root,
        lab.root,
      ),
      h('div', { class: 'column' }, network, log.root, inspector.root),
    ),
    h('footer', { class: 'foot' },
      h('p', null, 'The devices parse requests with their own byte layouts, written separately from the library, and share no state with the page. ',
        'Source: ', h('a', { href: 'https://github.com/jmmoser/lifxlan', target: '_blank', rel: 'noopener' }, 'github.com/jmmoser/lifxlan'), '.'),
    ),
  );

  session.startDiscovery();
}

start();
