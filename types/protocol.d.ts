/**
 * @param {boolean} tagged
 * @param {number} source
 * @param {Uint8Array} target
 * @param {boolean} res_required
 * @param {boolean} ack_required
 * @param {number} sequence
 * @param {number} type
 * @param {Uint8Array} [payload]
 * @returns
 */
export function encode(tagged: boolean, source: number, target: Uint8Array, res_required: boolean, ack_required: boolean, sequence: number, type: number, payload?: Uint8Array): Uint8Array;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateService(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    service: {
        code: number;
    };
    port: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateHostFirmware(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    build: Date;
    reserved: Uint8Array;
    version_minor: number;
    version_major: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeLightState(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    hue: number;
    saturation: number;
    brightness: number;
    kelvin: number;
    power: number;
    label: string;
    reserved_2: Uint8Array;
    reserved_8: Uint8Array;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateVersion(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    vendor: number;
    product: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateLabel(bytes: Uint8Array, offsetRef: {
    current: number;
}): string;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateAccessPoint(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    iface: number;
    ssid: string;
    securityProtocol: number;
    strength: number;
    channel: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateUnhandled(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    type: {
        code: number;
        name: any;
    };
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateTime(bytes: Uint8Array, offsetRef: {
    current: number;
}): any;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateMeshInfo(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    signal: number;
    tx: number;
    rx: number;
    mcuTemperature: string;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateWifiInfo(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    signal: {
        rssi: number;
        status: string;
        raw: number;
    };
    reserved6: Uint8Array;
    reserved7: Uint8Array;
    reserved8: Uint8Array;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateInfrared(bytes: Uint8Array, offsetRef: {
    current: number;
}): number;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateLightPower(bytes: Uint8Array, offsetRef: {
    current: number;
}): number;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateMCURailVoltage(bytes: Uint8Array, offsetRef: {
    current: number;
}): number;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateGroup(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    group: any;
    label: string;
    updated_at: Uint8Array;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStatePower(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    power: number;
    on: boolean;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 * @param {boolean} [warnIfMoreBufferRemaining=true]
 */
export function decode(bytes: Uint8Array, offsetRef: {
    current: number;
}, warnIfMoreBufferRemaining?: boolean): {
    buffer: ArrayBuffer;
    size: number;
    protocol: number;
    addressable: boolean;
    tagged: boolean;
    origin: number;
    source: number;
    target: {
        bytes: Uint8Array;
        address: any;
    };
    reserved_target_2: Uint8Array;
    revered_site_mac_address: {
        bytes: Uint8Array;
        address: any;
    };
    res_required: boolean;
    ack_required: boolean;
    sequence: number;
    reserved_timestamp: {
        buffer: Uint8Array;
        decoded: any;
    };
    reserved_protocol_header_2: Uint8Array;
    type: {
        code: number;
        name: any;
    };
    payload: any;
};
export const PORT: 56700;
export const BROADCAST_ADDRESS: "255.255.255.255";
export type SERVICE_TYPE = number;
export namespace SERVICE_TYPE {
    let UDP: number;
    let RESERVED2: number;
    let RESERVED3: number;
    let RESERVED4: number;
    let RESERVED5: number;
}
export type TYPE = number;
export namespace TYPE {
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
    let Get64: number;
    let State64: number;
    let Set64: number;
    let GetTileEffect: number;
    let SetTileEffect: number;
    let StateTileEffect: number;
    let SensorGetAmbientLight: number;
    let SensorStateAmbientLight: number;
    let _SetSite: number;
    let _GetTime: number;
    let _SetTime: number;
    let _StateTime: number;
    let _GetMeshInfo: number;
    let _StateMeshInfo: number;
    let _GetTags: number;
    let _SetTags: number;
    let _StateTags: number;
    let _GetTagLabels: number;
    let _SetTagLabels: number;
    let _StateTagLabels: number;
    let _GetMCURailVoltage: number;
    let _StateMCURailVoltage: number;
    let _SetFactoryTestMode: number;
    let _DisableFactoryTestMode: number;
    let _StateFactoryTestMode: number;
    let _StateReboot: number;
    let _SetDimAbsolute: number;
    let _SetDimRelative: number;
    let _GetLightTemperature: number;
    let _StateLightTemperature: number;
    let _WANConnectPlain: number;
    let _WANConnectKey: number;
    let _WANStateConnect: number;
    let _WANSub: number;
    let _WANUnsub: number;
    let _WANStateSub: number;
    let _GetWifiState: number;
    let _SetWifiState: number;
    let _StateWifiState: number;
    let _GetAccessPoint: number;
    let _SetAccessPoint: number;
    let _StateAccessPoint: number;
}
export const NO_TARGET: Uint8Array;
export function isStateService(packet: RawPacket): packet is Packet<{
    service: {
        code: number;
    };
    port: number;
}>;
export function isStateLabel(packet: RawPacket): packet is Packet<string>;
export function isStateGroup(packet: RawPacket): packet is Packet<{
    group: any;
    label: string;
    updated_at: Uint8Array;
}>;
export function isLightState(packet: RawPacket): packet is Packet<{
    hue: number;
    saturation: number;
    brightness: number;
    kelvin: number;
    power: number;
    label: string;
    reserved_2: Uint8Array;
    reserved_8: Uint8Array;
}>;
export function isStatePower(packet: RawPacket): packet is Packet<{
    power: number;
    on: boolean;
}>;
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any;
export type RawPacket = ReturnType<typeof decode>;
export type Packet<T> = Omit<RawPacket, "payload"> & {
    payload: T;
};
