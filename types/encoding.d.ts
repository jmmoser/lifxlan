/**
 * @param {boolean} tagged
 * @param {number} source
 * @param {Uint8Array} target
 * @param {boolean} resRequired
 * @param {boolean} ackRequired
 * @param {number} sequence
 * @param {number} type
 * @param {Uint8Array} [payload]
 */
export function encode(tagged: boolean, source: number, target: Uint8Array, resRequired: boolean, ackRequired: boolean, sequence: number, type: number, payload?: Uint8Array): Uint8Array;
/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {string} uuid
 */
export function encodeUuidTo(bytes: Uint8Array, offset: number, uuid: string): void;
/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {string} value
 * @param {number} byteLength
 */
export function encodeStringTo(bytes: Uint8Array, offset: number, value: string, byteLength: number): void;
/**
 * @param {string} value
 * @param {number} byteLength
 */
export function encodeString(value: string, byteLength: number): Uint8Array;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateService(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    service: number;
    port: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
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
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateWifiInfo(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    signal: number;
    reserved6: Uint8Array;
    reserved7: Uint8Array;
    reserved8: Uint8Array;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateWifiFirmware(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    build: Date;
    reserved6: Uint8Array;
    version_minor: number;
    version_major: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStatePower(bytes: Uint8Array, offsetRef: {
    current: number;
}): number;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateLabel(bytes: Uint8Array, offsetRef: {
    current: number;
}): string;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateVersion(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    vendor: number;
    product: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateInfo(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    time: Date;
    uptime: Date;
    downtime: Date;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateLocation(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    location: Uint8Array;
    label: string;
    updated_at: Date;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 * @returns {{
 *   group: string;
 *   label: string;
 *   updated_at: bigint;
 * }}
 */
export function decodeStateGroup(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    group: string;
    label: string;
    updated_at: bigint;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeEchoResponse(bytes: Uint8Array, offsetRef: {
    current: number;
}): Uint8Array;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateUnhandled(bytes: Uint8Array, offsetRef: {
    current: number;
}): number;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
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
    reserved2: Uint8Array;
    reserved8: Uint8Array;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateLightPower(bytes: Uint8Array, offsetRef: {
    current: number;
}): number;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateInfrared(bytes: Uint8Array, offsetRef: {
    current: number;
}): number;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateHevCycle(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    duration_s: number;
    remaining_s: number;
    last_power: boolean;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateHevCycleConfiguration(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    indication: number;
    duration_s: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateLastHevCycleResult(bytes: Uint8Array, offsetRef: {
    current: number;
}): number;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateRPower(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    relay_index: number;
    level: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateDeviceChain(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    start_index: number;
    devices: {
        accel_meas_x: number;
        accel_meas_y: number;
        accel_meas_z: number;
        reserved6: Uint8Array;
        user_x: number;
        user_y: number;
        width: number;
        height: number;
        reserved7: Uint8Array;
        device_version_vendor: number;
        device_version_product: number;
        reserved8: Uint8Array;
        firmware_build: Date;
        reversed9: Uint8Array;
        firmware_version_minor: number;
        firmware_version_major: number;
        reserved10: Uint8Array;
    }[];
    tile_devices_count: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeState64(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    tile_index: number;
    reserved6: Uint8Array;
    x: number;
    y: number;
    width: number;
    colors: {
        hue: number;
        saturation: number;
        brightness: number;
        kelvin: number;
    }[];
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeHeader(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    bytes: Uint8Array;
    size: number;
    protocol: number;
    addressable: boolean;
    tagged: boolean;
    origin: number;
    source: number;
    target: Uint8Array;
    reserved1: Uint8Array;
    reserved2: Uint8Array;
    res_required: boolean;
    ack_required: boolean;
    reserved3: number;
    reserved4: Uint8Array;
    sequence: number;
    reserved5: Uint8Array;
    type: number;
};
export function getHeaderFlags(view: DataView, offset?: number): number;
export function getHeaderTagged(view: DataView, offset?: number): boolean;
export function getHeaderSource(view: DataView, offset?: number): number;
export function getHeaderTarget(bytes: Uint8Array, offset?: number): Uint8Array;
export function getHeaderSerialNumber(bytes: Uint8Array, offset?: number): string;
export function getHeaderType(view: DataView, offset?: number): number;
export function getHeaderSequence(view: DataView, offset?: number): number;
export function getPayload(bytes: Uint8Array, offset?: number): Uint8Array;
