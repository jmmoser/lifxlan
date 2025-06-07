export const PORT: 56700;
export const BROADCAST_ADDRESS: "255.255.255.255";
export const PRODUCTS_URL: "https://raw.githubusercontent.com/LIFX/products/master/products.json";
export const NO_TARGET: Uint8Array<ArrayBuffer>;
export type ServiceType = number;
export namespace ServiceType {
    let UDP: number;
    let RESERVED2: number;
    let RESERVED3: number;
    let RESERVED4: number;
    let RESERVED5: number;
}
export type Direction = number;
export namespace Direction {
    let RIGHT: number;
    let LEFT: number;
}
export type LightLastHevCycleResult = number;
export namespace LightLastHevCycleResult {
    let SUCCESS: number;
    let BUSY: number;
    let INTERRUPTED_BY_RESET: number;
    let INTERRUPTED_BY_HOMEKIT: number;
    let INTERRUPTED_BY_LAN: number;
    let INTERRUPTED_BY_CLOUD: number;
    let NONE: number;
}
export type MultiZoneApplicationRequest = number;
export namespace MultiZoneApplicationRequest {
    let NO_APPLY: number;
    let APPLY: number;
    let APPLY_ONLY: number;
}
export type MultiZoneEffectType = number;
export namespace MultiZoneEffectType {
    export let OFF: number;
    export let MOVE: number;
    export let RESERVED1: number;
    let RESERVED2_1: number;
    export { RESERVED2_1 as RESERVED2 };
}
export type MultiZoneExtendedApplicationRequest = number;
export namespace MultiZoneExtendedApplicationRequest {
    let NO_APPLY_1: number;
    export { NO_APPLY_1 as NO_APPLY };
    let APPLY_1: number;
    export { APPLY_1 as APPLY };
    let APPLY_ONLY_1: number;
    export { APPLY_ONLY_1 as APPLY_ONLY };
}
export type TileEffectType = number;
export namespace TileEffectType {
    let OFF_1: number;
    export { OFF_1 as OFF };
    let RESERVED1_1: number;
    export { RESERVED1_1 as RESERVED1 };
    export let MORPH: number;
    export let FLAME: number;
    let RESERVED2_2: number;
    export { RESERVED2_2 as RESERVED2 };
    export let SKY: number;
}
export type TileEffectSkyType = number;
export namespace TileEffectSkyType {
    let SUNRISE: number;
    let SUNSET: number;
    let CLOUDS: number;
}
export type Waveform = number;
export namespace Waveform {
    let SAW: number;
    let SINE: number;
    let HALF_SINE: number;
    let TRIANGLE: number;
    let PULSE: number;
}
export type Type = number;
export namespace Type {
    let GetService: number;
    let StateService: number;
    let GetHostFirmware: number;
    let StateHostFirmware: number;
    let GetWifiInfo: number;
    let StateWifiInfo: number;
    let GetWifiFirmware: number;
    let StateWifiFirmware: number;
    let GetPower: number;
    let SetPower: number;
    let StatePower: number;
    let GetLabel: number;
    let SetLabel: number;
    let StateLabel: number;
    let GetVersion: number;
    let StateVersion: number;
    let GetInfo: number;
    let StateInfo: number;
    let SetReboot: number;
    let Acknowledgement: number;
    let GetLocation: number;
    let SetLocation: number;
    let StateLocation: number;
    let GetGroup: number;
    let SetGroup: number;
    let StateGroup: number;
    let EchoRequest: number;
    let EchoResponse: number;
    let StateUnhandled: number;
    let GetColor: number;
    let SetColor: number;
    let SetWaveform: number;
    let LightState: number;
    let GetLightPower: number;
    let SetLightPower: number;
    let StateLightPower: number;
    let SetWaveformOptional: number;
    let GetInfrared: number;
    let StateInfrared: number;
    let SetInfrared: number;
    let GetHevCycle: number;
    let SetHevCycle: number;
    let StateHevCycle: number;
    let GetHevCycleConfiguration: number;
    let SetHevCycleConfiguration: number;
    let StateHevCycleConfiguration: number;
    let GetLastHevCycleResult: number;
    let StateLastHevCycleResult: number;
    let SetColorZones: number;
    let GetColorZones: number;
    let StateZone: number;
    let StateMultiZone: number;
    let GetMultiZoneEffect: number;
    let SetMultiZoneEffect: number;
    let StateMultiZoneEffect: number;
    let SetExtendedColorZones: number;
    let GetExtendedColorZones: number;
    let StateExtendedColorZones: number;
    let GetRPower: number;
    let SetRPower: number;
    let StateRPower: number;
    let GetDeviceChain: number;
    let StateDeviceChain: number;
    let SetUserPosition: number;
    let Get64: number;
    let State64: number;
    let Set64: number;
    let GetTileEffect: number;
    let SetTileEffect: number;
    let StateTileEffect: number;
    let SensorGetAmbientLight: number;
    let SensorStateAmbientLight: number;
}
