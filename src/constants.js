export const PORT = 56700;
export const BROADCAST_ADDRESS = '255.255.255.255';
export const PRODUCTS_URL = 'https://raw.githubusercontent.com/LIFX/products/master/products.json';

/**
 * @readonly
 * @enum {number}
 */
export const SERVICE_TYPE = {
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
export const TYPE = {
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

  /** Undocumented */
  _SetSite: 1,
  _GetTime: 4,
  _SetTime: 5,
  _StateTime: 6,
  _GetMeshInfo: 12,
  _StateMeshInfo: 13,
  _GetTags: 26,
  _SetTags: 27,
  _StateTags: 28,
  _GetTagLabels: 29,
  _SetTagLabels: 30,
  _StateTagLabels: 31,
  _GetMCURailVoltage: 36,
  _StateMCURailVoltage: 37,
  _SetFactoryTestMode: 39,
  _DisableFactoryTestMode: 40,
  _StateFactoryTestMode: 41,
  _StateReboot: 43,
  _SetDimAbsolute: 104,
  _SetDimRelative: 105,
  _GetLightTemperature: 110,
  _StateLightTemperature: 111,
  _WANConnectPlain: 201,
  _WANConnectKey: 202,
  _WANStateConnect: 203,
  _WANSub: 204,
  _WANUnsub: 205,
  _WANStateSub: 206,
  _GetWifiState: 301,
  _SetWifiState: 302,
  _StateWifiState: 303,
  _GetAccessPoint: 304,
  _SetAccessPoint: 305,
  _StateAccessPoint: 306,
};

export const NO_TARGET = new Uint8Array([0, 0, 0, 0, 0, 0]);