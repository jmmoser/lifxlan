import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';


export function GetColorCommand() {
  return {
    type: Type.GetColor,
    decode: Encoding.decodeLightState,
  };
}

/**
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} duration
 */
export function SetColorCommand(hue, saturation, brightness, kelvin, duration) {
  return {
    type: Type.SetColor,
    payload: Encoding.encodeSetColor(hue, saturation, brightness, kelvin, duration),
    decode: Encoding.decodeLightState,
  };
}

/**
 * @param {boolean} transient
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} period
 * @param {number} cycles
 * @param {number} skewRatio
 * @param {import('../constants.js').Waveform} waveform
 */
export function SetWaveformCommand(
  transient,
  hue,
  saturation,
  brightness,
  kelvin,
  period,
  cycles,
  skewRatio,
  waveform,
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
  };
}

export function GetLightPowerCommand() {
  return {
    type: Type.GetLightPower,
    decode: Encoding.decodeStateLightPower,
  };
}

/**
 * @param {number | boolean} level
 * @param {number} duration
 */
export function SetLightPowerCommand(level, duration) {
  return {
    type: Type.SetLightPower,
    payload: Encoding.encodeSetLightPower(level, duration),
    decode: Encoding.decodeStateLightPower,
  };
}

/**
 * @param {boolean} transient
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} period
 * @param {number} cycles
 * @param {number} skewRatio
 * @param {import('../constants.js').Waveform} waveform
 * @param {boolean} setHue
 * @param {boolean} setSaturation
 * @param {boolean} setBrightness
 * @param {boolean} setKelvin
 */
export function SetWaveformOptionalCommand(
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
  };
}

export function GetInfraredCommand() {
  return {
    type: Type.GetInfrared,
    decode: Encoding.decodeStateInfrared,
  };
}

/**
 * @param {number} brightness
 */
export function SetInfraredCommand(brightness) {
  return {
    type: Type.SetInfrared,
    payload: Encoding.encodeSetInfrared(brightness),
    decode: Encoding.decodeStateInfrared,
  };
}

export function GetHevCycleCommand() {
  return {
    type: Type.GetHevCycle,
    decode: Encoding.decodeStateHevCycle,
  };
}

/**
 * @param {boolean} enable
 * @param {number} durationSeconds
 */
export function SetHevCycleCommand(enable, durationSeconds) {
  return {
    type: Type.SetHevCycle,
    payload: Encoding.encodeSetHevCycle(enable, durationSeconds),
    decode: Encoding.decodeStateHevCycle,
  };
}

export function GetHevCycleConfigurationCommand() {
  return {
    type: Type.GetHevCycleConfiguration,
    decode: Encoding.decodeStateHevCycleConfiguration,
  };
}

/**
 * @param {boolean} indication
 * @param {number} durationSeconds
 */
export function SetHevCycleConfigurationCommand(indication, durationSeconds) {
  return {
    type: Type.SetHevCycleConfiguration,
    payload: Encoding.encodeSetHevCycleConfiguration(indication, durationSeconds),
    decode: Encoding.decodeStateHevCycleConfiguration,
  };
}

export function GetLastHevCycleResultCommand() {
  return {
    type: Type.GetLastHevCycleResult,
    decode: Encoding.decodeStateLastHevCycleResult,
  };
}