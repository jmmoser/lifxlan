/**
 * Nightwire: lifxlan in a browser, as a game.
 *
 * A browser has no UDP sockets, so the network and the devices on it are
 * simulated in the page (src/sim). Everything that talks to them is the
 * library itself, wired to that network by src/app/session.ts — every shot
 * in the game is a library call, and the house is lit only by what the
 * simulated devices do with the packets that reach them.
 */
import { Type } from '../../src/index.js';
import { Controls } from './app/controls.js';
import { button, clear, h } from './app/dom.js';
import type { Child } from './app/dom.js';
import { Inspector } from './app/inspector.js';
import { Lab } from './app/lab.js';
import { Session } from './app/session.js';
import { Story } from './app/story.js';
import type { Call } from './app/session.js';
import { WireLog } from './app/wirelog.js';
import { Sound } from './game/audio.js';
import { Game } from './game/game.js';
import type { GameEvent } from './game/game.js';
import { Renderer } from './game/render.js';
import { NIGHTS } from './game/waves.js';
import { fixtureFor } from './game/world.js';
import { VirtualDevice } from './sim/firmware.js';
import { FLEET } from './sim/fleet.js';
import { VirtualLan } from './sim/lan.js';

const BEST_KEY = 'nightwire-best';

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0; // storage is unavailable here; the score just is not kept
  }
}

function writeBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // nothing to do
  }
}

/** On a touch screen nobody clicks: say "tap". */
const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const words = (text: string): string => (touch ? text.replace(/\bClick/g, 'Tap').replace(/\bclick/g, 'tap') : text);

function start(): void {
  const mount = document.getElementById('app');
  if (!mount) return;

  const lan = new VirtualLan();
  const fleet = FLEET.map((spec) => new VirtualDevice(spec, lan));
  const session = new Session(lan);
  const game = new Game(session, lan, fleet, fleet.map(fixtureFor));
  const renderer = new Renderer(game, fleet, lan, session.endpoint);
  const sound = new Sound();

  const controls = new Controls(session);
  const log = new WireLog(session, lan);
  const inspector = new Inspector();
  const lab = new Lab(session);
  const story = new Story(session, lan);
  let best = readBest();

  log.onSelect = (entry) => inspector.show(entry);
  log.onPick = () => game.togglePause(true);
  inspector.onEdit = (packet) => lab.load(packet);
  controls.onSelect = (serial) => { renderer.selected = serial; };
  session.listen({ lampsChanged: () => { renderer.selected = controls.selectedSerial; } });

  /* ---------------------------------------------------------------- */
  /* Heads-up display                                                  */
  /* ---------------------------------------------------------------- */

  const bars = h('div', { class: 'signal', role: 'img' });
  const nightLabel = h('div', { class: 'night' });
  const progress = h('div', { class: 'progress' }, h('i', null));
  const scoreOut = h('div', { class: 'score' });
  const comboOut = h('div', { class: 'combo' });
  const lossChip = h('span', { class: 'net' });
  const lagChip = h('span', { class: 'net' });
  const hint = h('p', { class: 'hint-banner', 'aria-live': 'polite' });
  const bossBar = h('div', { class: 'boss', hidden: true }, h('span', null, 'The Outage'), h('div', { class: 'boss-track' }, h('i', null)));
  const tip = h('p', { class: 'tip' });
  const castButton = button(h('span', null, 'Broadcast', h('kbd', null, 'B')), () => game.broadcast(), { class: 'dock-button cast', id: 'hud-broadcast', title: 'Every light strobes at once' });
  const pauseButton = button(h('span', null, 'Pause', h('kbd', null, 'P')), () => game.togglePause(), { class: 'dock-button', id: 'hud-pause' });
  const hud = h('div', { class: 'hud', hidden: true },
    h('div', { class: 'hud-top' },
      h('div', { class: 'hud-left' }, bars, h('div', null, nightLabel, progress)),
      h('div', { class: 'hud-right' }, h('div', { class: 'tally' }, scoreOut, comboOut), h('div', { class: 'nets' }, lossChip, lagChip)),
    ),
    bossBar,
  );
  const dock = h('div', { class: 'dock', hidden: true }, tip, castButton, pauseButton);
  const stinger = h('div', { class: 'stinger', 'aria-hidden': 'true' });
  const overlay = h('div', { class: 'overlay' });
  const ticker = h('div', { class: 'ticker', 'aria-label': 'The line of library code behind it' },
    h('span', { class: 'tag call' }, 'code'), h('code', null, 'waiting for the first call…'), h('span', { class: 'outcome' }));
  const arena = h('section', { class: 'arena' }, h('div', { class: 'arena-view' }, renderer.canvas, hud, hint, stinger, overlay), dock);

  // The banner shows what the game is asking for right now; failing that, the latest passing remark.
  let remark = '';
  let remarkUntil = 0;
  let bannerText = '';
  const say = (text: string, ms = 7000) => {
    remark = text;
    remarkUntil = performance.now() + ms;
  };
  const syncBanner = (now: number) => {
    const coach = game.running && !game.paused ? game.coach : undefined;
    const text = coach?.text ?? (now < remarkUntil ? remark : '');
    if (text === bannerText) return;
    bannerText = text;
    if (text) hint.textContent = words(text);
    hint.classList.toggle('show', text !== '');
    hint.classList.toggle('ask', coach !== undefined && coach.key !== 'note');
    castButton.classList.toggle('ask', coach?.key === 'broadcast');
  };

  /** A line of big type across the house for a moment: the night beginning, the night won. */
  const sting = (small: string, big: string) => {
    stinger.replaceChildren(h('span', null, small), h('strong', null, big));
    stinger.classList.remove('go');
    void stinger.offsetWidth; // restart the animation
    stinger.classList.add('go');
  };

  let shown = '';
  const syncHud = () => {
    const boss = game.boss;
    const state = [game.health, game.night, Math.round(game.progress * 100), game.score, game.combo, Math.round(lan.loss * 100), Math.round(lan.latencyMs),
      Math.round(game.charge * 100), game.paused, boss ? Math.round((boss.hp / boss.type.hp) * 200) : -1, game.running && session.lamps.length].join('|');
    if (state === shown) return;
    shown = state;

    clear(bars);
    for (let i = 0; i < game.maxHealth; i++) bars.append(h('i', { class: i < game.health ? 'on' : '' }));
    bars.setAttribute('aria-label', `Router: ${game.health} of ${game.maxHealth} bars left`);
    bars.classList.toggle('low', game.health <= 2);
    nightLabel.textContent = `Night ${game.night + 1} of ${NIGHTS.length} · ${game.current.title}`;
    const fill = progress.firstElementChild;
    if (fill instanceof HTMLElement) fill.style.width = `${Math.round(game.progress * 100)}%`;
    scoreOut.textContent = game.score.toLocaleString();
    comboOut.textContent = game.combo > 1 ? `×${game.combo}` : '';
    lossChip.textContent = `${Math.round(lan.loss * 100)}% loss`;
    lossChip.classList.toggle('bad', lan.loss > 0);
    lagChip.textContent = `${Math.round(lan.latencyMs)} ms`;
    lagChip.classList.toggle('bad', lan.latencyMs > 40);

    castButton.hidden = !game.broadcastUnlocked;
    castButton.disabled = game.charge < 1;
    castButton.style.setProperty('--charge', `${Math.round(game.charge * 100)}%`);
    castButton.classList.toggle('ready', game.charge >= 1);
    pauseButton.firstElementChild?.firstChild?.replaceWith(game.paused ? 'Resume' : 'Pause');
    tip.textContent = words(game.night >= 2
      ? 'Click a shade to turn the light over it the shade’s colour. Click a light whose ring is full for its own effect.'
      : 'Click a shade. The light over it turns the shade’s colour, and that burns it.');

    bossBar.hidden = !boss;
    const bossFill = bossBar.querySelector('i');
    if (boss && bossFill) bossFill.style.width = `${Math.max(0, (boss.hp / boss.type.hp) * 100)}%`;
  };

  /* ---------------------------------------------------------------- */
  /* Cards over the house                                              */
  /* ---------------------------------------------------------------- */

  const card = (kind: string, ...children: Child[]): void => {
    clear(overlay);
    overlay.className = `overlay show ${kind}`;
    overlay.append(h('div', { class: 'card-over' }, ...children));
    const primary = overlay.querySelector('.primary');
    if (primary instanceof HTMLElement) primary.focus({ preventScroll: true });
  };
  const hideCard = () => {
    clear(overlay);
    overlay.className = 'overlay';
  };

  const play = () => {
    sound.start();
    sound.click();
    setMode('game');
    game.startCampaign();
    // The first night needs no introduction: the game teaches it as it happens.
    game.startNight();
  };

  const showTitle = () => {
    card('title',
      h('h2', { class: 'wordmark' }, 'NIGHTWIRE'),
      h('p', { class: 'pitch' }, 'Shades are creeping toward your router. Burn them with the lights.'),
      h('ol', { class: 'howto' },
        h('li', null, h('b', null, words('Click a shade.'))),
        h('li', null, 'The light over it turns ', h('b', null, 'its colour.')),
        h('li', null, 'Its own colour ', h('b', null, 'burns it.')),
      ),
      h('div', { class: 'actions' },
        button('Play', play, { class: 'primary big', id: 'title-play' }),
        button('Just let me play with the lights', () => setMode('sandbox'), { class: 'ghost big', id: 'title-sandbox' }),
      ),
      h('p', { class: 'best' }, best > 0 ? `Best score ${best.toLocaleString()} · ` : '', words('Every click is a real LIFX LAN message. They are spelled out under the game.')),
    );
  };

  const showBriefing = () => {
    const night = game.current;
    const s = game.stats;
    card('briefing',
      h('p', { class: 'eyebrow' }, s.leaks === 0 ? 'Night cleared without a scratch' : `Night cleared · ${s.leaks} got through`),
      h('h2', null, `Night ${game.night + 1}: ${night.title}`),
      h('p', { class: 'brief' }, words(night.brief)),
      night.news.length > 0 && h('ul', { class: 'news' }, ...night.news.map((item) => h('li', null, item))),
      h('div', { class: 'actions' }, button('Start', () => { sound.click(); game.startNight(); }, { class: 'primary big', id: 'briefing-start' })),
      h('details', { class: 'hood-note' },
        h('summary', null, 'What this is in the protocol'),
        h('p', null, night.hood),
        h('pre', { class: 'code-block' }, night.code),
      ),
    );
  };

  const showEnd = (won: boolean) => {
    if (game.score > best) {
      best = game.score;
      writeBest(best);
    }
    const { sent, received, lost, bytes } = log.stats;
    card(won ? 'won' : 'lost',
      h('p', { class: 'eyebrow' }, won ? 'Dawn' : `Night ${game.night + 1} · ${game.current.title}`),
      h('h2', null, won ? 'The network held.' : 'Connection lost.'),
      h('p', null, won
        ? 'Every shade burned, the router is still blinking, and all of it was done with a few dozen message types over UDP.'
        : 'The shades reached the router. With it gone, nothing in the house can be told to do anything.'),
      h('p', { class: 'final' }, h('b', null, game.score.toLocaleString()), ' points', game.score >= best && game.score > 0 ? ' · best yet' : ` · best ${best.toLocaleString()}`),
      h('p', { class: 'debrief' }, `This session the library sent ${sent.toLocaleString()} packets and received ${received.toLocaleString()}; ${lost.toLocaleString()} were lost on the way. ${(bytes / 1024).toFixed(1)} kB crossed the network.`),
      h('div', { class: 'actions' },
        won
          ? button('Play again', play, { class: 'primary big', id: 'end-again' })
          : button(`Retry night ${game.night + 1}`, () => { sound.click(); game.retryNight(); }, { class: 'primary big', id: 'end-retry' }),
        !won && button('Start over', play, { class: 'ghost big', id: 'end-restart' }),
        button('Play with the lights', () => setMode('sandbox'), { class: 'ghost big', id: 'end-sandbox' }),
      ),
    );
  };

  const showPause = () => {
    card('paused',
      h('h2', null, 'Paused'),
      h('p', null, words('Click a shade and the light over it turns the shade’s colour. A shade burns only in its own colour.')),
      h('p', null, words('Scroll down to see every packet sent so far; click one to take it apart.')),
      h('div', { class: 'actions' },
        button('Resume', () => game.togglePause(false), { class: 'primary big', id: 'pause-resume' }),
        button('Quit to title', () => game.showTitle(), { class: 'ghost big', id: 'pause-quit' }),
      ),
    );
  };

  /* ---------------------------------------------------------------- */
  /* Modes                                                             */
  /* ---------------------------------------------------------------- */

  const sandboxOnly: HTMLElement[] = [];
  const modeGame = button('Game', () => { if (game.phase === 'sandbox') { setMode('game'); game.showTitle(); } }, { class: 'chip', id: 'mode-game' });
  const modeSandbox = button('Sandbox', () => setMode('sandbox'), { class: 'chip', id: 'mode-sandbox' });
  const soundButton = button('Sound on', () => {
    sound.start();
    sound.setMuted(!sound.muted);
    soundButton.textContent = sound.muted ? 'Sound off' : 'Sound on';
    soundButton.setAttribute('aria-pressed', String(!sound.muted));
  }, { class: 'chip', 'aria-pressed': 'true', id: 'sound-toggle' });
  const fullButton = button('Full screen', () => {
    // Not every host allows it; where it is refused the button simply does nothing.
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void arena.requestFullscreen().catch(() => {});
  }, { class: 'chip', id: 'fullscreen-toggle' });

  function setMode(mode: 'game' | 'sandbox'): void {
    const sandbox = mode === 'sandbox';
    for (const node of sandboxOnly) node.hidden = !sandbox;
    inspector.editable = sandbox;
    modeGame.setAttribute('aria-pressed', String(!sandbox));
    modeSandbox.setAttribute('aria-pressed', String(sandbox));
    renderer.canvas.classList.toggle('sandbox', sandbox);
    if (sandbox && game.phase !== 'sandbox') {
      sound.start();
      game.enterSandbox();
    }
  }

  const onPhase = () => {
    const { phase } = game;
    hud.hidden = !game.running;
    dock.hidden = !game.running;
    shown = '';
    if (phase === 'title') showTitle();
    else if (phase === 'briefing') showBriefing();
    else if (phase === 'won') showEnd(true);
    else if (phase === 'lost') showEnd(false);
    else if (game.running && game.paused) showPause();
    else hideCard();

    if (!game.running) say('', 0);
    if (phase === 'sandbox') say('No shades here. Every control below sends real messages; drag across the strip or the tiles to paint them.', 12000);

    sound.setMood(
      phase === 'title' ? 'title' : phase === 'wave' || phase === 'setup' ? 'night' : phase === 'sandbox' ? 'silent' : 'calm',
      game.current.heat,
    );
  };

  let lastPhase = '';
  game.listen((event: GameEvent) => {
    switch (event.kind) {
      case 'phase': {
        const key = `${game.phase}:${game.paused}`;
        if (game.phase === 'wave' && lastPhase.startsWith('setup')) {
          sound.nightStart();
          sting(`Night ${game.night + 1}`, game.current.title);
        }
        if (game.phase === 'clear') {
          sound.nightClear();
          sting(game.health === game.maxHealth ? 'Not a scratch' : 'The router holds', 'Night cleared');
        }
        if (game.phase === 'lost') sound.lose();
        if (game.phase === 'won') sound.win();
        lastPhase = key;
        onPhase();
        break;
      }
      case 'hint': say(event.text); break;
      case 'confirmed': break;
      case 'shot': sound.shot(event.hue); break;
      case 'kill': sound.kill(event.combo, event.enemy.kind === 'outage' || event.enemy.kind === 'brute'); break;
      case 'routerHit': sound.routerHit(); break;
      case 'retry': sound.timeout(); break;
      case 'denied': sound.denied(); break;
      case 'ability': sound.strobe(); break;
      case 'broadcast': sound.broadcast(); break;
      case 'scan': sound.scan(); break;
      case 'brownout': case 'shuffle': sound.powerCut(); break;
      default: break;
    }
  });
  session.listen({
    message: (message) => { if (message.header.type === Type.Acknowledgement && game.running) sound.ack(); },
  });
  let known = 0;
  session.listen({
    lampsChanged: () => {
      const ready = session.lamps.filter((lamp) => lamp.ready).length;
      if (ready > known && game.running) sound.discovered();
      known = ready;
    },
  });

  /* The most recent library call, always on screen. */
  let latest: Call | undefined;
  let tickerQueued = false;
  const showCall = (call: Call) => {
    latest = call;
    if (tickerQueued) return;
    tickerQueued = true;
    requestAnimationFrame(() => {
      tickerQueued = false;
      const current = latest;
      if (!current) return;
      const [, code, outcome] = ticker.children;
      if (code) code.textContent = current.code.replace(/\s+/g, ' ');
      if (outcome) {
        outcome.className = `outcome ${current.status}`;
        outcome.textContent = current.status === 'ok' ? `✓ ${Math.round(current.elapsedMs ?? 0)} ms`
          : current.status === 'error' ? `✗ ${current.error instanceof Error ? current.error.name : 'error'}`
            : current.status === 'pending' ? '…' : current.count > 1 ? `×${current.count}` : 'sent';
      }
    });
  };
  session.listen({ call: showCall, callUpdated: (call) => { if (call === latest) showCall(call); } });

  /* ---------------------------------------------------------------- */
  /* Input                                                             */
  /* ---------------------------------------------------------------- */

  const { canvas } = renderer;
  let painting = false;
  let lastPainted: string | undefined;

  const aim = (event: PointerEvent) => {
    const p = renderer.toWorld(event.clientX, event.clientY);
    renderer.pointer = p;
    const playing = game.running && !game.paused;
    let enemy = playing ? renderer.enemyAt(p) : undefined;
    let target = renderer.targetAt(p);
    if (target && playing && !game.introduced(target.serial)) target = undefined;
    if (enemy && target) {
      // Both under the pointer. A light only wants a click when it has something to offer (it is lost, or
      // its effect is charged); even then, whichever the pointer is nearer the middle of wins.
      const wants = game.status(target.serial) === 'unknown' || (game.abilitiesUnlocked && game.cooldown(target.serial) === 0);
      const nearer = Math.hypot(p.x - target.at.x, p.y - target.at.y) < Math.hypot(p.x - enemy.at.x, p.y - enemy.at.y);
      if (wants && nearer) enemy = undefined;
      else target = undefined;
    }
    renderer.hoverEnemy = enemy;
    renderer.hover = target;
    canvas.style.cursor = renderer.hoverEnemy || renderer.hover ? 'pointer' : '';
    return p;
  };

  canvas.addEventListener('pointermove', (event) => {
    const p = aim(event);
    if (painting && game.phase === 'sandbox') {
      const hit = renderer.fineAt(p);
      if (hit && hit.serial === controls.selectedSerial && hit.index !== undefined && `${hit.serial}:${hit.index}` !== lastPainted) {
        lastPainted = `${hit.serial}:${hit.index}`;
        controls.paint(hit.serial, hit.index);
      }
    }
  });
  canvas.addEventListener('pointerleave', () => { renderer.pointer = undefined; renderer.hover = undefined; renderer.hoverEnemy = undefined; painting = false; });
  canvas.addEventListener('pointerup', () => { painting = false; lastPainted = undefined; });
  canvas.addEventListener('pointercancel', () => { painting = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  canvas.addEventListener('pointerdown', (event) => {
    sound.start();
    const p = aim(event);

    if (game.phase === 'sandbox') {
      const hit = renderer.fineAt(p);
      if (!hit) return;
      if (hit.serial !== controls.selectedSerial) {
        controls.select(hit.serial);
        renderer.selected = hit.serial;
        return;
      }
      painting = true;
      canvas.setPointerCapture(event.pointerId);
      if (hit.index !== undefined) {
        lastPainted = `${hit.serial}:${hit.index}`;
        controls.paint(hit.serial, hit.index);
      }
      return;
    }
    if (!game.running || game.paused) return;
    if (renderer.hoverEnemy) game.zap(renderer.hoverEnemy);
    else if (renderer.hover) game.press(renderer.hover);
  });

  window.addEventListener('keydown', (event) => {
    const focus = document.activeElement;
    if (focus instanceof HTMLInputElement || focus instanceof HTMLTextAreaElement || focus instanceof HTMLSelectElement) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'm') { soundButton.click(); return; }
    if (!game.running) return;
    if (key === 'p' || key === 'escape') { game.togglePause(); event.preventDefault(); return; }
    if (game.paused) return;
    if (key === 'r') game.scan();
    else if (key === 'b') game.broadcast();
    else if (key === 'arrowleft' || key === 'arrowright') {
      // Without a pointer: step through the shades, nearest the router first.
      event.preventDefault();
      const order = [...game.enemies].sort((a, b) => Math.hypot(a.at.x - game.routerAt.x, a.at.y - game.routerAt.y) - Math.hypot(b.at.x - game.routerAt.x, b.at.y - game.routerAt.y));
      const at = renderer.hoverEnemy ? order.indexOf(renderer.hoverEnemy) : -1;
      renderer.hoverEnemy = order[(at + (key === 'arrowright' ? 1 : order.length - 1) + (at < 0 && key === 'arrowleft' ? 1 : 0)) % Math.max(1, order.length)];
    } else if (key === 'enter' || key === ' ') {
      event.preventDefault();
      if (renderer.hoverEnemy && game.enemies.includes(renderer.hoverEnemy)) game.zap(renderer.hoverEnemy);
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.togglePause(true); });

  /* ---------------------------------------------------------------- */
  /* Sandbox: network conditions                                       */
  /* ---------------------------------------------------------------- */

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
  latencyOut.textContent = `${lan.latencyMs} ms each way`;
  lossOut.textContent = '0% lost';
  const network = h('section', { class: 'card network' },
    h('header', { class: 'card-head' }, h('h2', null, 'Network')),
    h('div', { class: 'slider' }, h('label', { for: 'net-latency' }, 'Latency'), latency, latencyOut),
    h('div', { class: 'slider' }, h('label', { for: 'net-loss' }, 'Packet loss'), loss, lossOut),
    h('p', { class: 'hint' }, 'UDP promises nothing. Raise the loss and calls start rejecting with TimeoutError; at 100% nothing in the house can change.'),
  );

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
  log.root.append(counters);

  /* ---------------------------------------------------------------- */
  /* Page                                                              */
  /* ---------------------------------------------------------------- */

  sandboxOnly.push(controls.root, lab.root, network);
  mount.replaceChildren(
    h('header', { class: 'masthead' },
      h('div', null,
        h('h1', null, 'Nightwire'),
        h('p', { class: 'lede' }, 'A game played with real LIFX LAN messages, sent by the ', h('code', null, 'lifxlan'), ' library.'),
      ),
      h('div', { class: 'chips modes' }, modeGame, modeSandbox, fullButton, soundButton),
    ),
    arena,
    h('section', { class: 'said' },
      h('h2', null, 'What was just said on the network'),
      story.root,
      ticker,
    ),
    controls.root,
    h('div', { class: 'pair' }, lab.root, network),
    h('section', { class: 'hood' },
      h('h2', null, 'Under the hood'),
      h('p', { class: 'lede' },
        'A browser cannot open UDP sockets, so the lights and the network they sit on are simulated in this page. Everything that talks to them is the real library: ',
        'it finds them, encodes every request and decodes every reply. The lights only change when a packet reaches them. ',
        'Below is every call the page made and every packet that crossed the network. Click a row to take it apart, byte by byte.'),
      h('div', { class: 'pair' }, log.root, inspector.root),
    ),
    h('footer', { class: 'foot' },
      h('p', null, 'Source: ', h('a', { href: 'https://github.com/jmmoser/lifxlan', target: '_blank', rel: 'noopener' }, 'github.com/jmmoser/lifxlan'), '.'),
    ),
  );

  setMode('game');
  game.showTitle();
  // For poking at the game from the console: open the page with #debug.
  if (location.hash === '#debug') Object.assign(window, { nightwire: { game, renderer, session, lan, fleet } });

  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Keep the loop alive whatever happens inside a frame.
    requestAnimationFrame(frame);
    game.update(dt, now);
    renderer.draw(now);
    if (game.running) syncHud();
    syncBanner(now);
    let burning = 0;
    if (game.running && !game.paused) for (const enemy of game.enemies) burning += enemy.burn;
    sound.setBurn(burning);
  };
  requestAnimationFrame(frame);
}

start();
