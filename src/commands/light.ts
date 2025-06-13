import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import type { Waveform } from '../constants/index.js';

export function GetColorCommand() {
  return {
    type: Type.GetColor,
    decode: Encoding.decodeLightState,
    defaultAcknowledgment: 'response' as const,
  };
}

export function SetColorCommand(hue: number, saturation: number, brightness: number, kelvin: number, duration: number) {
  return {
    type: Type.SetColor,
    payload: Encoding.encodeSetColor(hue, saturation, brightness, kelvin, duration),
    decode: Encoding.decodeLightState,
    defaultAcknowledgment: 'ack-only' as const,
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
    defaultAcknowledgment: 'ack-only' as const,
  };
}

export function GetLightPowerCommand() {
  return {
    type: Type.GetLightPower,
    decode: Encoding.decodeStateLightPower,
    defaultAcknowledgment: 'response' as const,
  };
}

export function SetLightPowerCommand(level: number | boolean, duration: number) {
  return {
    type: Type.SetLightPower,
    payload: Encoding.encodeSetLightPower(level, duration),
    decode: Encoding.decodeStateLightPower,
    defaultAcknowledgment: 'ack-only' as const,
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
    decode: Encoding.decodeStateLightPower,
    defaultAcknowledgment: 'ack-only' as const,
  };
}

export function GetInfraredCommand() {
  return {
    type: Type.GetInfrared,
    decode: Encoding.decodeStateInfrared,
    defaultAcknowledgment: 'response' as const,
  };
}

export function SetInfraredCommand(brightness: number) {
  return {
    type: Type.SetInfrared,
    payload: Encoding.encodeSetInfrared(brightness),
    decode: Encoding.decodeStateInfrared,
    defaultAcknowledgment: 'ack-only' as const,
  };
}

export function GetHevCycleCommand() {
  return {
    type: Type.GetHevCycle,
    decode: Encoding.decodeStateHevCycle,
    defaultAcknowledgment: 'response' as const,
  };
}

export function SetHevCycleCommand(enable: boolean, durationSeconds: number) {
  return {
    type: Type.SetHevCycle,
    payload: Encoding.encodeSetHevCycle(enable, durationSeconds),
    decode: Encoding.decodeStateHevCycle,
    defaultAcknowledgment: 'ack-only' as const,
  };
}

export function GetHevCycleConfigurationCommand() {
  return {
    type: Type.GetHevCycleConfiguration,
    decode: Encoding.decodeStateHevCycleConfiguration,
    defaultAcknowledgment: 'response' as const,
  };
}

export function SetHevCycleConfigurationCommand(indication: boolean, durationSeconds: number) {
  return {
    type: Type.SetHevCycleConfiguration,
    payload: Encoding.encodeSetHevCycleConfiguration(indication, durationSeconds),
    decode: Encoding.decodeStateHevCycleConfiguration,
    defaultAcknowledgment: 'ack-only' as const,
  };
}

export function GetLastHevCycleResultCommand() {
  return {
    type: Type.GetLastHevCycleResult,
    decode: Encoding.decodeStateLastHevCycleResult,
    defaultAcknowledgment: 'response' as const,
  };
}