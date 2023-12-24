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
    version: string;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeLightState(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    hue: number;
    hue_level: number;
    saturation: number;
    saturation_level: number;
    brightness: number;
    brightness_level: number;
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
}): number;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateTime(bytes: Uint8Array, offsetRef: {
    current: number;
}): Date;
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
    updatedAt: Uint8Array;
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
export function decodeEchoResponse(bytes: Uint8Array, offsetRef: {
    current: number;
}): Uint8Array;
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number }} offsetRef
 */
export function decodeStateLocation(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    location: Uint8Array;
    label: string;
    updatedAt: Date;
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
    reservedTarget2: Uint8Array;
    reveredSiteMacAddress: Uint8Array;
    resRequired: boolean;
    ackRequired: boolean;
    sequence: number;
    reserved_timestamp: {
        bytes: Uint8Array;
        decoded: any;
    };
    reservedProtocolHeader2: Uint8Array;
    type: number;
};
