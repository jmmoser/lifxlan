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
export function encodeUuidTo(bytes: any, offset: any, uuid: any): void;
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
 * @param {{ current: number }} offsetRef
 */
export function decodeStateService(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    service: number;
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
 */
export function decodeStateLabel(bytes: Uint8Array, offsetRef: {
    current: number;
}): string;
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
export function decodeStateInfo(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    time: Date;
    uptime: Date;
    downtime: Date;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
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
export function decodeEchoResponse(bytes: Uint8Array, offsetRef: {
    current: number;
}): Uint8Array;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateUnhandled(bytes: Uint8Array, offsetRef: {
    current: number;
}): number;
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
    power: {
        level: number;
        on: boolean;
    };
    label: string;
    reserved2: Uint8Array;
    reserved8: Uint8Array;
};
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
export function decodeStateInfrared(bytes: Uint8Array, offsetRef: {
    current: number;
}): number;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateHevCycle(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    durationSeconds: number;
    remainingSeconds: number;
    lastPower: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateHevCycleConfiguration(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    indication: number;
    durationSeconds: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateLastHevCycleResult(bytes: Uint8Array, offsetRef: {
    current: number;
}): number;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateRPower(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    relayIndex: number;
    level: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
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
 * @param {{ current: number }} offsetRef
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
    resRequired: boolean;
    ackRequired: boolean;
    reserved3: number;
    reserved4: Uint8Array;
    sequence: number;
    reserved5: Uint8Array;
    type: number;
};
