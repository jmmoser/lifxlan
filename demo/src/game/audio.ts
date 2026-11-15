/**
 * Sound, synthesised in the page with Web Audio: a small step sequencer for
 * the music, whose layers come in as a night heats up, and one-shot effects
 * pitched to the same scale so play stays in key.
 *
 * Browsers only allow audio after a click, so nothing exists until
 * `start()` is called from one.
 */

const midi = (note: number): number => 440 * 2 ** ((note - 69) / 12);

/** A minor: i – VI – III – VII. Root first, then the chord tones the arpeggio walks. */
const CHORDS: readonly (readonly number[])[] = [
  [45, 57, 60, 64, 69, 72],
  [41, 57, 60, 65, 69, 72],
  [48, 55, 60, 64, 67, 72],
  [43, 55, 59, 62, 67, 71],
];

/** One note of A minor pentatonic for each of the six colours. */
const SHOT_NOTES = [69, 72, 74, 76, 79, 81];

export type Mood = 'silent' | 'title' | 'calm' | 'night';

export class Sound {
  muted = false;

  private ctx: AudioContext | undefined;
  private master: GainNode | undefined;
  private music: GainNode | undefined;
  private effects: GainNode | undefined;
  private noiseBuffer: AudioBuffer | undefined;
  private mood: Mood = 'silent';
  private heat = 0.3;
  private step = 0;
  private nextStepAt = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastAck = 0;
  private sizzle: GainNode | undefined;

  /** Creates the audio graph. Call from a click or key press. */
  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return; // no audio here; the game is silent
    }
    this.ctx = ctx;
    const compressor = ctx.createDynamicsCompressor();
    compressor.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(compressor);
    this.music = ctx.createGain();
    this.music.gain.value = 0.42;
    this.music.connect(this.master);
    this.effects = ctx.createGain();
    this.effects.gain.value = 0.8;
    this.effects.connect(this.master);

    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;

    // A hiss that is always running, silent until something burns.
    const burning = ctx.createBufferSource();
    burning.buffer = buffer;
    burning.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 5200;
    band.Q.value = 0.7;
    this.sizzle = ctx.createGain();
    this.sizzle.gain.value = 0;
    burning.connect(band);
    band.connect(this.sizzle);
    this.sizzle.connect(this.effects);
    burning.start();

    this.nextStepAt = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.03);
  }

  /** How much is burning right now, 0..1: the level of the sizzle. */
  setBurn(level: number): void {
    if (this.sizzle && this.ctx) this.sizzle.gain.setTargetAtTime(Math.min(0.16, level * 0.07), this.ctx.currentTime, 0.06);
  }

  /** What the music should be doing, and how hard (0..1). */
  setMood(mood: Mood, heat = this.heat): void {
    this.mood = mood;
    this.heat = heat;
  }

  /* ---------------------------------------------------------------- */
  /* Voices                                                            */
  /* ---------------------------------------------------------------- */

  private tone(bus: GainNode | undefined, type: OscillatorType, frequency: number, at: number, length: number, gain: number, cutoff = 0, glideTo = 0): void {
    const { ctx } = this;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    if (glideTo > 0) osc.frequency.exponentialRampToValueAtTime(glideTo, at + length);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.02, length * 0.2));
    amp.gain.exponentialRampToValueAtTime(0.0001, at + length);
    if (cutoff > 0) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      osc.connect(filter);
      filter.connect(amp);
    } else {
      osc.connect(amp);
    }
    amp.connect(bus);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }

  private hiss(bus: GainNode | undefined, at: number, length: number, gain: number, kind: BiquadFilterType, frequency: number, sweepTo = 0): void {
    const { ctx, noiseBuffer } = this;
    if (!ctx || !bus || !noiseBuffer) return;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = kind;
    filter.frequency.setValueAtTime(frequency, at);
    if (sweepTo > 0) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + length);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, at);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(bus);
    source.start(at, Math.random() * 0.5);
    source.stop(at + length + 0.05);
  }

  /* ---------------------------------------------------------------- */
  /* Music                                                             */
  /* ---------------------------------------------------------------- */

  private schedule(): void {
    const { ctx } = this;
    if (!ctx) return;
    const heat = this.mood === 'night' ? this.heat : this.mood === 'title' ? 0.34 : 0.1;
    const bpm = this.mood === 'night' ? 96 + heat * 44 : 84;
    const stepLength = 60 / bpm / 4;
    // Schedule a little ahead of the clock so timing does not depend on this timer.
    while (this.nextStepAt < ctx.currentTime + 0.12) {
      if (this.mood !== 'silent') this.playStep(this.step, this.nextStepAt, stepLength, heat);
      this.nextStepAt += stepLength;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, at: number, length: number, heat: number): void {
    const bus = this.music;
    const chord = CHORDS[Math.floor(step / 16) % CHORDS.length] ?? CHORDS[0]!;
    const inBar = step % 16;
    const root = chord[0] ?? 45;

    if (inBar === 0) {
      // Pad: the chord, held for the bar.
      for (const note of chord.slice(1, 4)) {
        this.tone(bus, 'sawtooth', midi(note), at, length * 16, 0.05, 520 + heat * 700);
        this.tone(bus, 'sawtooth', midi(note) * 1.004, at, length * 16, 0.04, 520 + heat * 700);
      }
    }
    if (heat >= 0.2 && [0, 6, 8, 11, 14].includes(inBar)) {
      this.tone(bus, 'sawtooth', midi(root), at, length * 1.8, 0.2, 260 + heat * 240);
      this.tone(bus, 'sine', midi(root - 12), at, length * 1.8, 0.22);
    }
    const arpEvery = heat >= 0.8 ? 1 : 2;
    if (heat >= 0.3 && inBar % arpEvery === 0) {
      const tones = chord.slice(1);
      const order = [0, 2, 1, 3, 2, 4, 3, 1];
      const note = (tones[order[(step / arpEvery) % order.length] ?? 0] ?? 60) + (heat > 0.6 && step % 32 >= 16 ? 12 : 0);
      this.tone(bus, 'triangle', midi(note + 12), at, length * 1.6, 0.085 + heat * 0.05);
    }
    if (heat >= 0.5 && (inBar % 8 === 0 || (heat >= 0.85 && inBar % 4 === 0))) {
      this.tone(bus, 'sine', 150, at, 0.16, 0.5, 0, 42);
    }
    if (heat >= 0.7 && inBar % 8 === 4) {
      this.hiss(bus, at, 0.14, 0.2, 'bandpass', 1900);
      this.tone(bus, 'triangle', 190, at, 0.09, 0.12, 0, 120);
    }
    if (heat >= 0.6 && inBar % 2 === 1) {
      this.hiss(bus, at, 0.04, inBar % 4 === 3 ? 0.07 : 0.045, 'highpass', 7200);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Effects                                                           */
  /* ---------------------------------------------------------------- */

  private get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** A shot: one pluck, pitched by the colour sent. */
  shot(hue: number): void {
    const note = SHOT_NOTES[hue % SHOT_NOTES.length] ?? 69;
    this.tone(this.effects, 'square', midi(note), this.now, 0.11, 0.1, 2600);
    this.tone(this.effects, 'triangle', midi(note + 12), this.now, 0.16, 0.08);
  }

  load(hue: number): void {
    this.tone(this.effects, 'sine', midi((SHOT_NOTES[hue % SHOT_NOTES.length] ?? 69) + 12), this.now, 0.06, 0.05);
  }

  /** An Acknowledgement arriving: a tick, rationed so a burst does not buzz. */
  ack(): void {
    const { now } = this;
    if (now - this.lastAck < 0.05) return;
    this.lastAck = now;
    this.tone(this.effects, 'sine', 2400, now, 0.035, 0.035);
  }

  timeout(): void {
    this.tone(this.effects, 'sawtooth', 130, this.now, 0.22, 0.14, 700, 80);
  }

  denied(): void {
    this.tone(this.effects, 'square', 160, this.now, 0.08, 0.06, 900);
  }

  kill(combo: number, big: boolean): void {
    const { now } = this;
    const base = 76 + Math.min(8, combo - 1) * 2;
    this.tone(this.effects, 'triangle', midi(base), now, 0.09, 0.16);
    this.tone(this.effects, 'triangle', midi(base + 7), now + 0.06, 0.16, 0.16);
    this.hiss(this.effects, now, big ? 0.5 : 0.18, big ? 0.3 : 0.16, 'bandpass', 3000, 500);
    if (big) this.tone(this.effects, 'sine', 120, now, 0.5, 0.5, 0, 36);
  }

  strobe(): void {
    const { now } = this;
    this.hiss(this.effects, now, 0.5, 0.26, 'highpass', 600, 6000);
    this.tone(this.effects, 'sine', 220, now, 0.4, 0.3, 0, 55);
  }

  broadcast(): void {
    const { now } = this;
    this.hiss(this.effects, now, 1.1, 0.4, 'lowpass', 400, 9000);
    for (const [i, note] of [57, 64, 69, 76].entries()) this.tone(this.effects, 'sawtooth', midi(note), now + i * 0.04, 0.9, 0.12, 2400);
    this.tone(this.effects, 'sine', 90, now, 0.9, 0.6, 0, 32);
  }

  scan(): void {
    const { now } = this;
    this.tone(this.effects, 'sine', 660, now, 0.5, 0.12, 0, 1320);
    this.tone(this.effects, 'sine', 990, now + 0.12, 0.5, 0.06, 0, 1980);
  }

  discovered(): void {
    const { now } = this;
    for (const [i, note] of [72, 76, 79].entries()) this.tone(this.effects, 'triangle', midi(note), now + i * 0.07, 0.2, 0.12);
  }

  routerHit(): void {
    const { now } = this;
    this.tone(this.effects, 'sine', 160, now, 0.7, 0.8, 0, 30);
    this.hiss(this.effects, now, 0.45, 0.5, 'lowpass', 3000, 200);
    this.tone(this.effects, 'square', 62, now, 0.3, 0.12, 400);
  }

  powerCut(): void {
    const { now } = this;
    this.tone(this.effects, 'sawtooth', 300, now, 0.6, 0.2, 1200, 40);
    this.hiss(this.effects, now, 0.2, 0.2, 'highpass', 4000);
  }

  nightStart(): void {
    const { now } = this;
    this.hiss(this.effects, now, 1.2, 0.2, 'bandpass', 300, 5000);
    this.tone(this.effects, 'sawtooth', 55, now, 1.2, 0.3, 500, 110);
  }

  nightClear(): void {
    const { now } = this;
    for (const [i, note] of [69, 72, 76, 81].entries()) this.tone(this.effects, 'triangle', midi(note), now + i * 0.11, 0.5, 0.16);
  }

  lose(): void {
    const { now } = this;
    for (const [i, note] of [69, 65, 60, 53, 45].entries()) this.tone(this.effects, 'sawtooth', midi(note), now + i * 0.16, 0.7, 0.14, 900);
    this.hiss(this.effects, now, 1.6, 0.3, 'lowpass', 2000, 80);
  }

  win(): void {
    const { now } = this;
    for (const [i, note] of [57, 64, 69, 72, 76, 81, 84].entries()) this.tone(this.effects, 'triangle', midi(note), now + i * 0.12, 1.1, 0.16);
  }

  click(): void {
    this.tone(this.effects, 'sine', 880, this.now, 0.04, 0.06);
  }

  /** Stops the sequencer timer (for tests and teardown). */
  dispose(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    void this.ctx?.close();
  }
}
