/**
 * The public API of the library. Every export here is deliberate: this list
 * is the semver surface. Helpers that are not listed (internal utilities,
 * scratch state, etc.) are implementation details and may change without a
 * major version bump.
 *
 * The wire-format encode/decode functions live in the 'lifxlan/encoding'
 * subpath entry point; the optional products.json registry lives in
 * 'lifxlan/products'; the optional discovery helper lives in
 * 'lifxlan/discovery'; the optional socket wiring lives in 'lifxlan/node'
 * (Node.js/Bun) and 'lifxlan/deno' (Deno). All are equally part of the
 * semver surface.
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
export { ButtonGesture, ButtonTargetType } from './constants/button.js';

/** Core abstractions */
export { Router } from './router.js';
export type { RouterInstance, ClientRouter, RouterOptions, MessageHandler, ReceivedMessage } from './router.js';
export { Client } from './client.js';
export type { ClientInstance, ClientOptions, SendOptions, ResponseMode } from './client.js';
export { Device, Devices } from './devices.js';
export type { DeviceConfig, DevicesOptions, DevicesInstance, GetDeviceOptions, DeviceEventHandlers, RegistrationMessage } from './devices.js';

/** Errors */
export {
  LifxError,
  TimeoutError,
  UnhandledCommandError,
  SourceExhaustionError,
  SequenceExhaustionError,
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
export { GetButtonCommand, SetButtonCommand } from './commands/button.js';
export { SensorGetAmbientLightCommand } from './commands/sensor.js';

/**
 * Decoded protocol message types. The encode/decode functions that produce
 * and consume these shapes live in the 'lifxlan/encoding' subpath entry
 * point, keeping the wire-format helpers out of the high-level surface.
 */
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
  StateButton,
  Button,
  ButtonAction,
  ButtonInput,
  ButtonActionInput,
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
