export const LightLastHevCycleResult = {
  SUCCESS: 0,
  BUSY: 1,
  INTERRUPTED_BY_RESET: 2,
  INTERRUPTED_BY_HOMEKIT: 3,
  INTERRUPTED_BY_LAN: 4,
  INTERRUPTED_BY_CLOUD: 5,
  NONE: 255,
} as const;

export type LightLastHevCycleResult = typeof LightLastHevCycleResult[keyof typeof LightLastHevCycleResult];

export const Waveform = {
  SAW: 0,
  SINE: 1,
  HALF_SINE: 2,
  TRIANGLE: 3,
  PULSE: 4,
} as const;

export type Waveform = typeof Waveform[keyof typeof Waveform];