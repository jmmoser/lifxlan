import * as Encoding from './encoding.js';
import { Type } from './constants.js';
import { NOOP } from './utils.js';

/**
 * @template OutputType
 * @typedef {(bytes: Uint8Array, offsetRef: { current: number; }) => OutputType} Decoder
 */

/**
 * @template OutputType
 * @typedef {{
 *   type: number;
 *   payload?: Uint8Array;
 *   decode: Decoder<OutputType>;
 * }} Command
 */

export function GetServiceCommand() {
  return {
    type: Type.GetService,
    decode: Encoding.decodeStateService,
  };
}

export function GetHostFirmwareCommand() {
  return {
    type: Type.GetHostFirmware,
    decode: Encoding.decodeStateHostFirmware,
  };
}

export function GetWifiInfoCommand() {
  return {
    type: Type.GetWifiInfo,
    decode: Encoding.decodeStateWifiInfo,
  };
}

export function GetWifiFirmwareCommand() {
  return {
    type: Type.GetWifiFirmware,
    decode: Encoding.decodeStateWifiFirmware,
  };
}

export function GetPowerCommand() {
  return {
    type: Type.GetPower,
    decode: Encoding.decodeStatePower,
  };
}

/**
 * @param {number | boolean} power
 */
export function SetPowerCommand(power) {
  return {
    type: Type.SetPower,
    payload: Encoding.encodeSetPower(power),
    decode: Encoding.decodeStatePower,
  };
}

export function GetLabelCommand() {
  return {
    type: Type.GetLabel,
    decode: Encoding.decodeStateLabel,
  };
}

/**
 * @param {string} label
 */
export function SetLabelCommand(label) {
  return {
    type: Type.SetLabel,
    payload: Encoding.encodeString(label, 32),
    decode: Encoding.decodeStateLabel,
  };
}

export function GetVersionCommand() {
  return {
    type: Type.GetVersion,
    decode: Encoding.decodeStateVersion,
  };
}

export function GetInfoCommand() {
  return {
    type: Type.GetInfo,
    decode: Encoding.decodeStateInfo,
  };
}

/**
 * @returns {Command<void>}
 */
export function SetRebootCommand() {
  return {
    type: Type.SetReboot,
    decode: NOOP,
  };
}

/**
 * @returns {Command<ReturnType<typeof Encoding.decodeStateLocation>>}
 */
export function GetLocationCommand() {
  return {
    type: Type.GetLocation,
    decode: Encoding.decodeStateLocation,
  };
}

/**
 * @param {Uint8Array | string} location
 * @param {string} label
 * @param {Date} updatedAt
 */
export function SetLocationCommand(location, label, updatedAt) {
  return {
    type: Type.SetLocation,
    payload: Encoding.encodeSetLocation(location, label, updatedAt),
    decode: Encoding.decodeStateLocation,
  };
}

export function GetGroupCommand() {
  return {
    type: Type.GetGroup,
    decode: Encoding.decodeStateGroup,
  };
}

/**
 * @param {Uint8Array | string} group
 * @param {string} label
 * @param {Date} updatedAt
 */
export function SetGroupCommand(group, label, updatedAt) {
  return {
    type: Type.SetGroup,
    payload: Encoding.encodeSetGroup(group, label, updatedAt),
    decode: Encoding.decodeStateGroup,
  };
}

/**
 * @param {Uint8Array} echoing
 * @returns {Command<ReturnType<typeof Encoding.decodeEchoResponse>>}
 */
export function EchoRequestCommand(echoing) {
  return {
    type: Type.EchoRequest,
    payload: Encoding.encodeEchoRequest(echoing),
    decode: Encoding.decodeEchoResponse,
  };
}

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
 * @param {import('./constants.js').Waveform} waveform
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
 * @param {import('./constants.js').Waveform} waveform
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
 * @returns {Command<ReturnType<typeof Encoding.decodeStateInfrared>>}
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

/**
 * @param {number} relayIndex
 * @returns {Command<ReturnType<typeof Encoding.decodeStateRPower>>}
 */
export function GetRPowerCommand(relayIndex) {
  return {
    type: Type.GetRPower,
    payload: Encoding.encodeGetRPower(relayIndex),
    decode: Encoding.decodeStateRPower,
  };
}

/**
 * @param {number} relayIndex
 * @param {number} level
 */
export function SetRPowerCommand(relayIndex, level) {
  return {
    type: Type.SetRPower,
    payload: Encoding.encodeSetRPower(relayIndex, level),
    decode: Encoding.decodeStateRPower,
  };
}

export function GetDeviceChainCommand() {
  return {
    type: Type.GetDeviceChain,
    decode: Encoding.decodeStateDeviceChain,
  };
}

/**
 * @param {number} tileIndex
 * @param {number} length
 * @param {number} x
 * @param {number} y
 * @param {number} width
 */
export function Get64Command(tileIndex, length, x, y, width) {
  return {
    type: Type.Get64,
    payload: Encoding.encodeGet64(tileIndex, length, x, y, width),
    decode: Encoding.decodeState64,
  };
}

/**
 * @param {number} startIndex
 * @param {number} endIndex
 */
export function GetColorZonesCommand(startIndex, endIndex) {
  return {
    type: Type.GetColorZones,
    payload: Encoding.encodeGetColorZones(startIndex, endIndex),
    decode: Encoding.decodeStateMultiZone,
  };
}

/**
 * @param {number} startIndex
 * @param {number} endIndex
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} duration
 * @param {import('./constants.js').MultiZoneApplicationRequest} apply
 */
export function SetColorZonesCommand(startIndex, endIndex, hue, saturation, brightness, kelvin, duration, apply) {
  return {
    type: Type.SetColorZones,
    payload: Encoding.encodeSetColorZones(startIndex, endIndex, hue, saturation, brightness, kelvin, duration, apply),
    decode: Encoding.decodeStateMultiZone,
  };
}

export function GetMultiZoneEffectCommand() {
  return {
    type: Type.GetMultiZoneEffect,
    decode: Encoding.decodeStateMultiZoneEffect,
  };
}

/**
 * @param {number} instanceid
 * @param {import('./constants.js').MultiZoneEffectType} effectType
 * @param {number} speed
 * @param {bigint} duration
 * @param {Uint8Array} parameters
 */
export function SetMultiZoneEffectCommand(instanceid, effectType, speed, duration, parameters) {
  return {
    type: Type.SetMultiZoneEffect,
    payload: Encoding.encodeSetMultiZoneEffect(instanceid, effectType, speed, duration, parameters),
    decode: Encoding.decodeStateMultiZoneEffect,
  };
}

export function GetExtendedColorZonesCommand() {
  return {
    type: Type.GetExtendedColorZones,
    decode: Encoding.decodeStateExtendedColorZones,
  };
}

/**
 * @param {number} duration
 * @param {import('./constants.js').MultiZoneExtendedApplicationRequest} apply
 * @param {number} zoneIndex
 * @param {number} colorsCount
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} colors
 */
export function SetExtendedColorZonesCommand(duration, apply, zoneIndex, colorsCount, colors) {
  return {
    type: Type.SetExtendedColorZones,
    payload: Encoding.encodeSetExtendedColorZones(duration, apply, zoneIndex, colorsCount, colors),
    decode: Encoding.decodeStateExtendedColorZones,
  };
}

/**
 * @param {number} tileIndex
 * @param {number} userX
 * @param {number} userY
 */
export function SetUserPositionCommand(tileIndex, userX, userY) {
  return {
    type: Type.SetUserPosition,
    payload: Encoding.encodeSetUserPosition(tileIndex, userX, userY),
    decode: NOOP,
  };
}

/**
 * @param {number} tileIndex
 * @param {number} length
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} duration
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} colors
 */
export function Set64Command(tileIndex, length, x, y, width, duration, colors) {
  return {
    type: Type.Set64,
    payload: Encoding.encodeSet64(tileIndex, length, x, y, width, duration, colors),
    decode: NOOP,
  };
}

export function GetTileEffectCommand() {
  return {
    type: Type.GetTileEffect,
    payload: Encoding.encodeGetTileEffect(),
    decode: Encoding.decodeStateTileEffect,
  };
}

/**
 * @param {number} instanceid
 * @param {import('./constants.js').TileEffectType} effectType
 * @param {number} speed
 * @param {bigint} duration
 * @param {import('./constants.js').TileEffectSkyType} skyType
 * @param {number} cloudSaturationMin
 * @param {number} paletteCount
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} palette
 */
export function SetTileEffectCommand(instanceid, effectType, speed, duration, skyType, cloudSaturationMin, paletteCount, palette) {
  return {
    type: Type.SetTileEffect,
    payload: Encoding.encodeSetTileEffect(instanceid, effectType, speed, duration, skyType, cloudSaturationMin, paletteCount, palette),
    decode: Encoding.decodeStateTileEffect,
  };
}

export function SensorGetAmbientLightCommand() {
  return {
    type: Type.SensorGetAmbientLight,
    decode: Encoding.decodeSensorStateAmbientLight,
  };
}
