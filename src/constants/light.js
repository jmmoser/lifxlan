/**
 * @readonly
 * @enum {number}
 */
export const LightLastHevCycleResult = {
  SUCCESS: 0,
  BUSY: 1,
  INTERRUPTED_BY_RESET: 2,
  INTERRUPTED_BY_HOMEKIT: 3,
  INTERRUPTED_BY_LAN: 4,
  INTERRUPTED_BY_CLOUD: 5,
  NONE: 255,
};

/**
 * @readonly
 * @enum {number}
 */
export const Waveform = {
  SAW: 0,
  SINE: 1,
  HALF_SINE: 2,
  TRIANGLE: 3,
  PULSE: 4,
};