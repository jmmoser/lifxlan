export const PORT = 56700;
export const BROADCAST_ADDRESS = '255.255.255.255';
export const PRODUCTS_URL = 'https://raw.githubusercontent.com/LIFX/products/master/products.json';
export const NO_TARGET = new Uint8Array([0, 0, 0, 0, 0, 0]);

/**
 * @readonly
 * @enum {number}
 */
export const ServiceType = {
  UDP: 1,
  RESERVED2: 2,
  RESERVED3: 3,
  RESERVED4: 4,
  RESERVED5: 5,
};

/**
 * @readonly
 * @enum {number}
 */
export const Direction = {
  RIGHT: 0,
  LEFT: 1,
};

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
export const MultiZoneApplicationRequest = {
  NO_APPLY: 0,
  APPLY: 1,
  APPLY_ONLY: 2,
};

/**
 * @readonly
 * @enum {number}
 */
export const MultiZoneEffectType = {
  OFF: 0,
  MOVE: 1,
  RESERVED1: 2,
  RESERVED2: 3,
};

/**
 * @readonly
 * @enum {number}
 */
export const MultiZoneExtendedApplicationRequest = {
  NO_APPLY: 0,
  APPLY: 1,
  APPLY_ONLY: 2,
};

/**
 * @readonly
 * @enum {number}
 */
export const TileEffectType = {
  OFF: 0,
  RESERVED1: 1,
  MORPH: 2,
  FLAME: 3,
  RESERVED2: 4,
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

/**
 * @readonly
 * @enum {number}
 */
export const Type = {
  GetService: 2,
  StateService: 3,
  GetHostFirmware: 14,
  StateHostFirmware: 15,
  GetWifiInfo: 16,
  StateWifiInfo: 17,
  GetWifiFirmware: 18,
  StateWifiFirmware: 19,
  GetPower: 20,
  SetPower: 21,
  StatePower: 22,
  GetLabel: 23,
  SetLabel: 24,
  StateLabel: 25,
  GetVersion: 32,
  StateVersion: 33,
  GetInfo: 34,
  StateInfo: 35,
  SetReboot: 38,
  Acknowledgement: 45,
  GetLocation: 48,
  SetLocation: 49,
  StateLocation: 50,
  GetGroup: 51,
  SetGroup: 52,
  StateGroup: 53,
  EchoRequest: 58,
  EchoResponse: 59,
  StateUnhandled: 223,

  /** Light */
  GetColor: 101,
  SetColor: 102,
  SetWaveform: 103,
  LightState: 107,
  GetLightPower: 116,
  SetLightPower: 117,
  StateLightPower: 118,
  SetWaveformOptional: 119,
  GetInfrared: 120,
  StateInfrared: 121,
  SetInfrared: 122,
  GetHevCycle: 142,
  SetHevCycle: 143,
  StateHevCycle: 144,
  GetHevCycleConfiguration: 145,
  SetHevCycleConfiguration: 146,
  StateHevCycleConfiguration: 147,
  GetLastHevCycleResult: 148,
  StateLastHevCycleResult: 149,

  /** MultiZone */
  SetColorZones: 501,
  GetColorZones: 502,
  StateZone: 503,
  StateMultiZone: 506,
  GetMultiZoneEffect: 507,
  SetMultiZoneEffect: 508,
  StateMultiZoneEffect: 509,
  SetExtendedColorZones: 510,
  GetExtendedColorZones: 511,
  StateExtendedColorZones: 512,

  /** Relay */
  GetRPower: 816,
  SetRPower: 817,
  StateRPower: 818,

  /** Tile */
  GetDeviceChain: 701,
  StateDeviceChain: 702,
  Get64: 707,
  State64: 711,
  Set64: 715,
  GetTileEffect: 718,
  SetTileEffect: 719,
  StateTileEffect: 720,
  SensorGetAmbientLight: 401,
  SensorStateAmbientLight: 402,
};
