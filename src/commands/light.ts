import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import type { Waveform } from '../constants/index.js';
import type { Command } from './index.js';

export function GetColor() {
  return {
    type: Type.GetColor,
    decode: Encoding.decodeLightState,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.LightState, 'response'>;
}

export interface SetColorOptions {
  /** Hue as an unsigned 16-bit value (0-65535 maps to 0-360 degrees). */
  hue: number;
  /** Saturation as an unsigned 16-bit value (0-65535 maps to 0-100%). */
  saturation: number;
  /** Brightness as an unsigned 16-bit value (0-65535 maps to 0-100%). */
  brightness: number;
  /** Color temperature in Kelvin (relevant when saturation is low). */
  kelvin: number;
  /** Transition time in milliseconds. Defaults to 0 (immediate). */
  duration?: number;
}

export function SetColor(options: SetColorOptions) {
  return {
    type: Type.SetColor,
    payload: Encoding.encodeSetColor(
      options.hue,
      options.saturation,
      options.brightness,
      options.kelvin,
      options.duration ?? 0,
    ),
    decode: Encoding.decodeLightState,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.LightState, 'ack-only'>;
}

export interface SetWaveformOptions {
  /**
   * When true the light returns to its current color when the effect ends.
   * Defaults to false (the light stays on the effect's color).
   */
  transient?: boolean;
  /** Hue as an unsigned 16-bit value (0-65535 maps to 0-360 degrees). */
  hue: number;
  /** Saturation as an unsigned 16-bit value (0-65535 maps to 0-100%). */
  saturation: number;
  /** Brightness as an unsigned 16-bit value (0-65535 maps to 0-100%). */
  brightness: number;
  /** Color temperature in Kelvin (relevant when saturation is low). */
  kelvin: number;
  /** Length of one waveform cycle in milliseconds. */
  period: number;
  /** Number of cycles to run. May be fractional. */
  cycles: number;
  /**
   * How much the waveform is skewed toward the new color, as a signed 16-bit
   * value (-32768 to 32767). Defaults to 0 — an even split. Only meaningful
   * for PULSE waveforms.
   */
  skewRatio?: number;
  waveform: Waveform;
}

export function SetWaveform(options: SetWaveformOptions) {
  return {
    type: Type.SetWaveform,
    payload: Encoding.encodeSetWaveform(
      options.transient ?? false,
      options.hue,
      options.saturation,
      options.brightness,
      options.kelvin,
      options.period,
      options.cycles,
      options.skewRatio ?? 0,
      options.waveform,
    ),
    decode: Encoding.decodeLightState,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.LightState, 'ack-only'>;
}

export function GetLightPower() {
  return {
    type: Type.GetLightPower,
    decode: Encoding.decodeStateLightPower,
    defaultResponseMode: 'response',
  } satisfies Command<number, 'response'>;
}

/**
 * @param level A boolean (on/off) or an unsigned 16-bit power level.
 * @param duration Transition time in milliseconds. Defaults to 0 (immediate).
 */
export function SetLightPower(level: number | boolean, duration = 0) {
  return {
    type: Type.SetLightPower,
    payload: Encoding.encodeSetLightPower(level, duration),
    decode: Encoding.decodeStateLightPower,
    defaultResponseMode: 'ack-only',
  } satisfies Command<number, 'ack-only'>;
}

/**
 * Omit any HSBK component to leave it unchanged during the waveform — by
 * default a component is applied exactly when it is provided (see
 * setHue/setSaturation/setBrightness/setKelvin to override).
 */
export interface SetWaveformOptionalOptions {
  /**
   * When true the light returns to its current color when the effect ends.
   * Defaults to false (the light stays on the effect's color).
   */
  transient?: boolean;
  /** Hue as an unsigned 16-bit value (0-65535 maps to 0-360 degrees). Omit to leave unchanged. */
  hue?: number;
  /** Saturation as an unsigned 16-bit value (0-65535 maps to 0-100%). Omit to leave unchanged. */
  saturation?: number;
  /** Brightness as an unsigned 16-bit value (0-65535 maps to 0-100%). Omit to leave unchanged. */
  brightness?: number;
  /** Color temperature in Kelvin (relevant when saturation is low). Omit to leave unchanged. */
  kelvin?: number;
  /** Length of one waveform cycle in milliseconds. */
  period: number;
  /** Number of cycles to run. May be fractional. */
  cycles: number;
  /**
   * How much the waveform is skewed toward the new color, as a signed 16-bit
   * value (-32768 to 32767). Defaults to 0 — an even split. Only meaningful
   * for PULSE waveforms.
   */
  skewRatio?: number;
  waveform: Waveform;
  /**
   * Explicit overrides for which components the waveform applies. Each
   * defaults to whether the corresponding component was provided, which is
   * what you want unless you need to send a component value without applying
   * it.
   */
  setHue?: boolean;
  setSaturation?: boolean;
  setBrightness?: boolean;
  setKelvin?: boolean;
}

export function SetWaveformOptional(options: SetWaveformOptionalOptions) {
  return {
    type: Type.SetWaveformOptional,
    payload: Encoding.encodeSetWaveformOptional(
      options.transient ?? false,
      options.hue ?? 0,
      options.saturation ?? 0,
      options.brightness ?? 0,
      options.kelvin ?? 0,
      options.period,
      options.cycles,
      options.skewRatio ?? 0,
      options.waveform,
      options.setHue ?? options.hue !== undefined,
      options.setSaturation ?? options.saturation !== undefined,
      options.setBrightness ?? options.brightness !== undefined,
      options.setKelvin ?? options.kelvin !== undefined,
    ),
    decode: Encoding.decodeLightState,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.LightState, 'ack-only'>;
}

export function GetInfrared() {
  return {
    type: Type.GetInfrared,
    decode: Encoding.decodeStateInfrared,
    defaultResponseMode: 'response',
  } satisfies Command<number, 'response'>;
}

export function SetInfrared(brightness: number) {
  return {
    type: Type.SetInfrared,
    payload: Encoding.encodeSetInfrared(brightness),
    decode: Encoding.decodeStateInfrared,
    defaultResponseMode: 'ack-only',
  } satisfies Command<number, 'ack-only'>;
}

export function GetHevCycle() {
  return {
    type: Type.GetHevCycle,
    decode: Encoding.decodeStateHevCycle,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateHevCycle, 'response'>;
}

export function SetHevCycle(enable: boolean, durationSeconds: number) {
  return {
    type: Type.SetHevCycle,
    payload: Encoding.encodeSetHevCycle(enable, durationSeconds),
    decode: Encoding.decodeStateHevCycle,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateHevCycle, 'ack-only'>;
}

export function GetHevCycleConfiguration() {
  return {
    type: Type.GetHevCycleConfiguration,
    decode: Encoding.decodeStateHevCycleConfiguration,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateHevCycleConfiguration, 'response'>;
}

export function SetHevCycleConfiguration(indication: boolean, durationSeconds: number) {
  return {
    type: Type.SetHevCycleConfiguration,
    payload: Encoding.encodeSetHevCycleConfiguration(indication, durationSeconds),
    decode: Encoding.decodeStateHevCycleConfiguration,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateHevCycleConfiguration, 'ack-only'>;
}

export function GetLastHevCycleResult() {
  return {
    type: Type.GetLastHevCycleResult,
    decode: Encoding.decodeStateLastHevCycleResult,
    defaultResponseMode: 'response',
  } satisfies Command<number, 'response'>;
}
