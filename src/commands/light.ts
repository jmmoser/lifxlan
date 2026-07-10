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

export function SetColor(hue: number, saturation: number, brightness: number, kelvin: number, duration: number) {
  return {
    type: Type.SetColor,
    payload: Encoding.encodeSetColor(hue, saturation, brightness, kelvin, duration),
    decode: Encoding.decodeLightState,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.LightState, 'ack-only'>;
}

export function SetWaveform(
  transient: boolean,
  hue: number,
  saturation: number,
  brightness: number,
  kelvin: number,
  period: number,
  cycles: number,
  skewRatio: number,
  waveform: Waveform,
) {
  return {
    type: Type.SetWaveform,
    payload: Encoding.encodeSetWaveform(
      transient,
      hue,
      saturation,
      brightness,
      kelvin,
      period,
      cycles,
      skewRatio,
      waveform,
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

export function SetLightPower(level: number | boolean, duration: number) {
  return {
    type: Type.SetLightPower,
    payload: Encoding.encodeSetLightPower(level, duration),
    decode: Encoding.decodeStateLightPower,
    defaultResponseMode: 'ack-only',
  } satisfies Command<number, 'ack-only'>;
}

export function SetWaveformOptional(
  transient: boolean,
  hue: number,
  saturation: number,
  brightness: number,
  kelvin: number,
  period: number,
  cycles: number,
  skewRatio: number,
  waveform: Waveform,
  setHue: boolean,
  setSaturation: boolean,
  setBrightness: boolean,
  setKelvin: boolean,
) {
  return {
    type: Type.SetWaveformOptional,
    payload: Encoding.encodeSetWaveformOptional(
      transient,
      hue,
      saturation,
      brightness,
      kelvin,
      period,
      cycles,
      skewRatio,
      waveform,
      setHue,
      setSaturation,
      setBrightness,
      setKelvin,
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
