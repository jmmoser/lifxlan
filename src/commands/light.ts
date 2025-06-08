import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import type { Waveform } from '../constants/index.js';
import type { Command } from './index.js';

export function GetColorCommand(): Command<Encoding.LightState> {
  return {
    type: Type.GetColor,
    decode: Encoding.decodeLightState,
  };
}

export function SetColorCommand(hue: number, saturation: number, brightness: number, kelvin: number, duration: number): Command<Encoding.LightState> {
  return {
    type: Type.SetColor,
    payload: Encoding.encodeSetColor(hue, saturation, brightness, kelvin, duration),
    decode: Encoding.decodeLightState,
  };
}

export function SetWaveformCommand(
  transient: boolean,
  hue: number,
  saturation: number,
  brightness: number,
  kelvin: number,
  period: number,
  cycles: number,
  skewRatio: number,
  waveform: Waveform,
): Command<Encoding.LightState> {
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
  };
}

export function GetLightPowerCommand(): Command<number> {
  return {
    type: Type.GetLightPower,
    decode: Encoding.decodeStateLightPower,
  };
}

export function SetLightPowerCommand(level: number | boolean, duration: number): Command<number> {
  return {
    type: Type.SetLightPower,
    payload: Encoding.encodeSetLightPower(level, duration),
    decode: Encoding.decodeStateLightPower,
  };
}

export function SetWaveformOptionalCommand(
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
): Command<number> {
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
    decode: Encoding.decodeStateLightPower,
  };
}

export function GetInfraredCommand(): Command<number> {
  return {
    type: Type.GetInfrared,
    decode: Encoding.decodeStateInfrared,
  };
}

export function SetInfraredCommand(brightness: number): Command<number> {
  return {
    type: Type.SetInfrared,
    payload: Encoding.encodeSetInfrared(brightness),
    decode: Encoding.decodeStateInfrared,
  };
}

export function GetHevCycleCommand(): Command<Encoding.StateHevCycle> {
  return {
    type: Type.GetHevCycle,
    decode: Encoding.decodeStateHevCycle,
  };
}

export function SetHevCycleCommand(enable: boolean, durationSeconds: number): Command<Encoding.StateHevCycle> {
  return {
    type: Type.SetHevCycle,
    payload: Encoding.encodeSetHevCycle(enable, durationSeconds),
    decode: Encoding.decodeStateHevCycle,
  };
}

export function GetHevCycleConfigurationCommand(): Command<Encoding.StateHevCycleConfiguration> {
  return {
    type: Type.GetHevCycleConfiguration,
    decode: Encoding.decodeStateHevCycleConfiguration,
  };
}

export function SetHevCycleConfigurationCommand(indication: boolean, durationSeconds: number): Command<Encoding.StateHevCycleConfiguration> {
  return {
    type: Type.SetHevCycleConfiguration,
    payload: Encoding.encodeSetHevCycleConfiguration(indication, durationSeconds),
    decode: Encoding.decodeStateHevCycleConfiguration,
  };
}

export function GetLastHevCycleResultCommand(): Command<number> {
  return {
    type: Type.GetLastHevCycleResult,
    decode: Encoding.decodeStateLastHevCycleResult,
  };
}