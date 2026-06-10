/**
 * The public API of the library. Every export here is deliberate: this list
 * is the semver surface. Helpers that are not listed (internal utilities,
 * scratch state, etc.) are implementation details and may change without a
 * major version bump.
 */

/** Protocol constants */
export {
  PORT,
  BROADCAST_ADDRESS,
  PRODUCTS_URL,
  NO_TARGET,
  ServiceType,
  Direction,
} from './constants/core.js';
export { Type } from './constants/types.js';
export { Waveform, LightLastHevCycleResult } from './constants/light.js';
export {
  MultiZoneApplicationRequest,
  MultiZoneEffectType,
  MultiZoneExtendedApplicationRequest,
} from './constants/multizone.js';
export { TileEffectType, TileEffectSkyType } from './constants/tile.js';

/** Core abstractions */
export { Router } from './router.js';
export type { RouterInstance, RouterOptions, MessageHandler } from './router.js';
export { Client } from './client.js';
export type { ClientInstance, ClientOptions, SendOptions, ResponseMode } from './client.js';
export { Device, Devices } from './devices.js';
export type { DeviceConfig, DevicesOptions, DevicesInstance, GetDeviceOptions } from './devices.js';
export { Groups } from './groups.js';
export type { Group, GroupsOptions, GroupsInstance } from './groups.js';

/** Errors */
export {
  LifxError,
  TimeoutError,
  UnhandledCommandError,
  MessageConflictError,
  SourceExhaustionError,
  DisposedClientError,
  AbortError,
  ValidationError,
} from './errors.js';

/** Commands */
export type { Command, Decoder } from './commands/index.js';
export {
  GetServiceCommand,
  GetHostFirmwareCommand,
  GetWifiInfoCommand,
  GetWifiFirmwareCommand,
  GetPowerCommand,
  SetPowerCommand,
  GetLabelCommand,
  SetLabelCommand,
  GetVersionCommand,
  GetInfoCommand,
  SetRebootCommand,
  GetLocationCommand,
  SetLocationCommand,
  GetGroupCommand,
  SetGroupCommand,
  EchoRequestCommand,
} from './commands/device.js';
export {
  GetColorCommand,
  SetColorCommand,
  SetWaveformCommand,
  GetLightPowerCommand,
  SetLightPowerCommand,
  SetWaveformOptionalCommand,
  GetInfraredCommand,
  SetInfraredCommand,
  GetHevCycleCommand,
  SetHevCycleCommand,
  GetHevCycleConfigurationCommand,
  SetHevCycleConfigurationCommand,
  GetLastHevCycleResultCommand,
} from './commands/light.js';
export {
  GetColorZonesCommand,
  SetColorZonesCommand,
  GetMultiZoneEffectCommand,
  SetMultiZoneEffectCommand,
  GetExtendedColorZonesCommand,
  SetExtendedColorZonesCommand,
} from './commands/multizone.js';
export type { ColorZoneResponse } from './commands/multizone.js';
export {
  GetDeviceChainCommand,
  Get64Command,
  SetUserPositionCommand,
  Set64Command,
  GetTileEffectCommand,
  SetTileEffectCommand,
} from './commands/tile.js';
export { GetRPowerCommand, SetRPowerCommand } from './commands/relay.js';
export { SensorGetAmbientLightCommand } from './commands/sensor.js';

/** Protocol encoding/decoding, for custom commands and custom routing */
export {
  encode,
  decodeHeader,
  getPayload,
  getHeaderSize,
  getHeaderFlags,
  getHeaderTagged,
  getHeaderSource,
  getHeaderTarget,
  getHeaderResponseFlags,
  getHeaderResponseRequired,
  getHeaderAcknowledgeRequired,
  getHeaderType,
  getHeaderSequence,
  encodeString,
  encodeStringTo,
  encodeUuidTo,
  encodeTimestampTo,
  encodeSetColor,
  encodeSetPower,
  encodeSetLocation,
  encodeSetGroup,
  encodeEchoRequest,
  encodeSetWaveform,
  encodeSetLightPower,
  encodeSetWaveformOptional,
  encodeSetInfrared,
  encodeSetHevCycle,
  encodeSetHevCycleConfiguration,
  encodeGetRPower,
  encodeSetRPower,
  encodeGet64,
  encodeGetColorZones,
  encodeSetColorZones,
  encodeSetMultiZoneEffect,
  encodeSetExtendedColorZones,
  encodeSetUserPosition,
  encodeSet64,
  encodeGetTileEffect,
  encodeSetTileEffect,
  decodeStateService,
  decodeStateHostFirmware,
  decodeStateWifiInfo,
  decodeStateWifiFirmware,
  decodeStatePower,
  decodeStateLabel,
  decodeStateVersion,
  decodeStateInfo,
  decodeStateLocation,
  decodeStateGroup,
  decodeEchoResponse,
  decodeStateUnhandled,
  decodeSetColor,
  decodeLightState,
  decodeStateLightPower,
  decodeStateInfrared,
  decodeStateHevCycle,
  decodeStateHevCycleConfiguration,
  decodeStateLastHevCycleResult,
  decodeStateRPower,
  decodeStateDeviceChain,
  decodeState64,
  decodeStateZone,
  decodeStateMultiZone,
  decodeStateMultiZoneEffect,
  decodeStateExtendedColorZones,
  decodeStateTileEffect,
  decodeSensorStateAmbientLight,
} from './encoding.js';
export type {
  Header,
  Color,
  OffsetRef,
  StateService,
  StateHostFirmware,
  StateWifiInfo,
  StateWifiFirmware,
  StateVersion,
  StateInfo,
  StateLocation,
  StateGroup,
  SetColor,
  LightState,
  StateHevCycle,
  StateHevCycleConfiguration,
  StateRPower,
  StateDeviceChain,
  DeviceChainDevice,
  State64,
  StateZone,
  StateMultiZone,
  StateMultiZoneEffect,
  StateExtendedColorZones,
  StateTileEffect,
  SensorStateAmbientLight,
} from './encoding.js';

/** Utilities */
export {
  convertTargetToSerialNumber,
  convertSerialNumberToTarget,
  getRssiStatus,
  convertSignalToRssi,
} from './utils/core.js';
export type { RssiStatus } from './utils/core.js';
export { hsbToRgb, rgbToHsb } from './utils/color.js';
