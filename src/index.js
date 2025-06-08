// Core LIFX protocol implementation
export {
  PORT,
  BROADCAST_ADDRESS,
  PRODUCTS_URL,
  NO_TARGET,
  ServiceType,
  Direction,
  LightLastHevCycleResult,
  MultiZoneApplicationRequest,
  MultiZoneEffectType,
  MultiZoneExtendedApplicationRequest,
  TileEffectType,
  TileEffectSkyType,
  Waveform,
  Type,
} from './constants/index.js';

export {
  Router,
} from './router.js';

export {
  Client,
} from './client.js';

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
  GetRPowerCommand,
  SetRPowerCommand,
  GetDeviceChainCommand,
  Get64Command,
  GetColorZonesCommand,
  SetColorZonesCommand,
  GetMultiZoneEffectCommand,
  SetMultiZoneEffectCommand,
  GetExtendedColorZonesCommand,
  SetExtendedColorZonesCommand,
  SetUserPositionCommand,
  Set64Command,
  GetTileEffectCommand,
  SetTileEffectCommand,
  SensorGetAmbientLightCommand,
} from './commands/index.js';

export {
  encode,
  decodeHeader,
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
  decodeLightState,
  decodeStateLightPower,
  decodeStateInfrared,
  decodeStateHevCycle,
  decodeStateHevCycleConfiguration,
  decodeStateLastHevCycleResult,
  decodeStateRPower,
  decodeStateDeviceChain,
  decodeState64,
  decodeStateMultiZone,
  decodeStateMultiZoneEffect,
  decodeStateExtendedColorZones,
  decodeStateTileEffect,
  decodeSensorStateAmbientLight,
  encodeSetPower,
  encodeString,
  encodeSetLocation,
  encodeSetGroup,
  encodeEchoRequest,
  encodeSetColor,
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
} from './encoding.js';

export {
  Devices,
} from './devices.js';

export {
  Groups,
} from './groups.js';

// Core utility functions (always included)
export {
  NOOP,
  PromiseWithResolvers,
  getRssiStatus,
  convertSignalToRssi,
  convertTargetToSerialNumber,
  convertSerialNumberToTarget,
} from './utils/core.js';

// Optional utility functions (for tree-shaking)
export {
  hsbToRgb,
  rgbToHsb,
} from './utils/color.js';

// Enhanced features for extensibility and performance
export {
  LifxError,
  TimeoutError,
  UnhandledCommandError,
  MessageConflictError,
  SourceExhaustionError,
  DisposedClientError,
  ValidationError,
} from './errors.js';