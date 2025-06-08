/**
 * Encodes a LIFX protocol message into a binary format.
 *
 * This is the core encoding function that creates properly formatted LIFX LAN protocol messages.
 * The encoding follows the official LIFX protocol specification with optimized binary operations.
 *
 * @param {boolean} tagged - Whether the message is tagged (affects routing)
 * @param {number} source - Source identifier for response correlation (0-4294967295)
 * @param {Uint8Array} target - 8-byte target device identifier
 * @param {boolean} resRequired - Whether a response is required
 * @param {boolean} ackRequired - Whether an acknowledgment is required
 * @param {number} sequence - Message sequence number (0-255)
 * @param {number} type - LIFX message type identifier
 * @param {Uint8Array} [payload] - Optional message payload
 * @returns {Uint8Array} Encoded message ready for transmission
 * @performance Critical encoding path - optimized for minimal allocations and maximum throughput
 * @internal
 */
export function encode(tagged: boolean, source: number, target: Uint8Array, resRequired: boolean, ackRequired: boolean, sequence: number, type: number, payload?: Uint8Array): Uint8Array;
/**
 * Encodes a UUID string directly into a byte array at the specified offset.
 *
 * Efficiently converts UUID format (e.g., "550e8400-e29b-41d4-a716-446655440000")
 * into 16 bytes at the target location. Optimized for minimal string allocations.
 *
 * @param {Uint8Array} bytes - Target byte array
 * @param {number} offset - Starting offset in the byte array
 * @param {string} uuid - UUID string with or without hyphens
 * @performance Optimized hex parsing with minimal string operations
 * @example
 * ```javascript
 * const bytes = new Uint8Array(20);
 * encodeUuidTo(bytes, 4, "550e8400-e29b-41d4-a716-446655440000");
 * ```
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
export function encodeString(value: string, byteLength: number): Uint8Array<ArrayBuffer>;
/**
 * @param {DataView} view
 * @param {number} offset
 * @param {Date} date
 */
export function encodeTimestampTo(view: DataView, offset: number, date: Date): void;
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
    reserved: Uint8Array<ArrayBufferLike>;
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
    reserved6: Uint8Array<ArrayBufferLike>;
    reserved7: Uint8Array<ArrayBufferLike>;
    reserved8: Uint8Array<ArrayBufferLike>;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateWifiFirmware(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    build: Date;
    reserved6: Uint8Array<ArrayBufferLike>;
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
    location: Uint8Array<ArrayBufferLike>;
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
}): Uint8Array<ArrayBufferLike>;
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
export function decodeSetColor(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    reserved: Uint8Array<ArrayBufferLike>;
    hue: number;
    saturation: number;
    brightness: number;
    kelvin: number;
    duration: number;
};
/**
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} duration
 */
export function encodeSetColor(hue: number, saturation: number, brightness: number, kelvin: number, duration: number): Uint8Array<ArrayBuffer>;
/**
 * @param {number | boolean} power
 */
export function encodeSetPower(power: number | boolean): Uint8Array<ArrayBuffer>;
/**
 * @param {Uint8Array | string} location
 * @param {string} label
 * @param {Date} updatedAt
 */
export function encodeSetLocation(location: Uint8Array | string, label: string, updatedAt: Date): Uint8Array<ArrayBuffer>;
/**
 * @param {Uint8Array | string} group
 * @param {string} label
 * @param {Date} updatedAt
 */
export function encodeSetGroup(group: Uint8Array | string, label: string, updatedAt: Date): Uint8Array<ArrayBuffer>;
/**
 * @param {Uint8Array} echoing
 */
export function encodeEchoRequest(echoing: Uint8Array): Uint8Array<ArrayBuffer>;
/**
 * @param {boolean} transient
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} period
 * @param {number} cycles
 * @param {number} skewRatio
 * @param {import('./constants.js').Waveform} waveform
 */
export function encodeSetWaveform(transient: boolean, hue: number, saturation: number, brightness: number, kelvin: number, period: number, cycles: number, skewRatio: number, waveform: import("./constants.js").Waveform): Uint8Array<ArrayBuffer>;
/**
 * @param {number | boolean} level
 * @param {number} duration
 */
export function encodeSetLightPower(level: number | boolean, duration: number): Uint8Array<ArrayBuffer>;
/**
 * @param {boolean} transient
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} period
 * @param {number} cycles
 * @param {number} skewRatio
 * @param {import('./constants.js').Waveform} waveform
 * @param {boolean} setHue
 * @param {boolean} setSaturation
 * @param {boolean} setBrightness
 * @param {boolean} setKelvin
 */
export function encodeSetWaveformOptional(transient: boolean, hue: number, saturation: number, brightness: number, kelvin: number, period: number, cycles: number, skewRatio: number, waveform: import("./constants.js").Waveform, setHue: boolean, setSaturation: boolean, setBrightness: boolean, setKelvin: boolean): Uint8Array<ArrayBuffer>;
/**
 * @param {number} brightness
 */
export function encodeSetInfrared(brightness: number): Uint8Array<ArrayBuffer>;
/**
 * @param {boolean} enable
 * @param {number} durationSeconds
 */
export function encodeSetHevCycle(enable: boolean, durationSeconds: number): Uint8Array<ArrayBuffer>;
/**
 * @param {boolean} indication
 * @param {number} durationSeconds
 */
export function encodeSetHevCycleConfiguration(indication: boolean, durationSeconds: number): Uint8Array<ArrayBuffer>;
/**
 * @param {number} relayIndex
 */
export function encodeGetRPower(relayIndex: number): Uint8Array<ArrayBuffer>;
/**
 * @param {number} relayIndex
 * @param {number} level
 */
export function encodeSetRPower(relayIndex: number, level: number): Uint8Array<ArrayBuffer>;
/**
 * @param {number} tileIndex
 * @param {number} length
 * @param {number} x
 * @param {number} y
 * @param {number} width
 */
export function encodeGet64(tileIndex: number, length: number, x: number, y: number, width: number): Uint8Array<ArrayBuffer>;
/**
 * @param {number} startIndex
 * @param {number} endIndex
 */
export function encodeGetColorZones(startIndex: number, endIndex: number): Uint8Array<ArrayBuffer>;
/**
 * @param {number} startIndex
 * @param {number} endIndex
 * @param {number} hue
 * @param {number} saturation
 * @param {number} brightness
 * @param {number} kelvin
 * @param {number} duration
 * @param {import('./constants.js').MultiZoneApplicationRequest} apply
 */
export function encodeSetColorZones(startIndex: number, endIndex: number, hue: number, saturation: number, brightness: number, kelvin: number, duration: number, apply: import("./constants.js").MultiZoneApplicationRequest): Uint8Array<ArrayBuffer>;
/**
 * @param {number} instanceid
 * @param {import('./constants.js').MultiZoneEffectType} effectType
 * @param {number} speed
 * @param {bigint} duration
 * @param {Uint8Array} parameters
 */
export function encodeSetMultiZoneEffect(instanceid: number, effectType: import("./constants.js").MultiZoneEffectType, speed: number, duration: bigint, parameters: Uint8Array): Uint8Array<ArrayBuffer>;
/**
 * @param {number} duration
 * @param {import('./constants.js').MultiZoneExtendedApplicationRequest} apply
 * @param {number} zoneIndex
 * @param {number} colorsCount
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} colors
 */
export function encodeSetExtendedColorZones(duration: number, apply: import("./constants.js").MultiZoneExtendedApplicationRequest, zoneIndex: number, colorsCount: number, colors: {
    hue: number;
    saturation: number;
    brightness: number;
    kelvin: number;
}[]): Uint8Array<ArrayBuffer>;
/**
 * @param {number} tileIndex
 * @param {number} userX
 * @param {number} userY
 */
export function encodeSetUserPosition(tileIndex: number, userX: number, userY: number): Uint8Array<ArrayBuffer>;
/**
 * @param {number} tileIndex
 * @param {number} length
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} duration
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} colors
 */
export function encodeSet64(tileIndex: number, length: number, x: number, y: number, width: number, duration: number, colors: {
    hue: number;
    saturation: number;
    brightness: number;
    kelvin: number;
}[]): Uint8Array<ArrayBuffer>;
/**
 */
export function encodeGetTileEffect(): Uint8Array<ArrayBuffer>;
/**
 * @param {number} instanceid
 * @param {import('./constants.js').TileEffectType} effectType
 * @param {number} speed
 * @param {bigint} duration
 * @param {import('./constants.js').TileEffectSkyType} skyType
 * @param {number} cloudSaturationMin
 * @param {number} paletteCount
 * @param {{hue: number, saturation: number, brightness: number, kelvin: number}[]} palette
 */
export function encodeSetTileEffect(instanceid: number, effectType: import("./constants.js").TileEffectType, speed: number, duration: bigint, skyType: import("./constants.js").TileEffectSkyType, cloudSaturationMin: number, paletteCount: number, palette: {
    hue: number;
    saturation: number;
    brightness: number;
    kelvin: number;
}[]): Uint8Array<ArrayBuffer>;
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
    reserved2: Uint8Array<ArrayBufferLike>;
    reserved8: Uint8Array<ArrayBufferLike>;
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
        reserved6: Uint8Array<ArrayBufferLike>;
        user_x: number;
        user_y: number;
        width: number;
        height: number;
        reserved7: Uint8Array<ArrayBufferLike>;
        device_version_vendor: number;
        device_version_product: number;
        reserved8: Uint8Array<ArrayBufferLike>;
        firmware_build: Date;
        reserved9: Uint8Array<ArrayBufferLike>;
        firmware_version_minor: number;
        firmware_version_major: number;
        reserved10: Uint8Array<ArrayBufferLike>;
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
    reserved6: Uint8Array<ArrayBufferLike>;
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
 * @param {number} [offset]
 */
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateZone(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    zones_count: number;
    zone_index: number;
    hue: number;
    saturation: number;
    brightness: number;
    kelvin: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateMultiZone(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    zones_count: number;
    zone_index: number;
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
export function decodeStateMultiZoneEffect(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    instanceid: number;
    type: number;
    reserved6: Uint8Array<ArrayBufferLike>;
    speed: number;
    duration: bigint;
    reserved7: Uint8Array<ArrayBufferLike>;
    reserved8: Uint8Array<ArrayBufferLike>;
    parameters: Uint8Array<ArrayBufferLike>;
};
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
export function decodeStateExtendedColorZones(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    zones_count: number;
    zone_index: number;
    colors_count: number;
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
export function decodeStateTileEffect(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    reserved0: number;
    instanceid: number;
    type: number;
    speed: number;
    duration: bigint;
    reserved1: Uint8Array<ArrayBufferLike>;
    reserved2: Uint8Array<ArrayBufferLike>;
    skyType: number;
    reserved3: Uint8Array<ArrayBufferLike>;
    cloudSaturationMin: number;
    reserved4: Uint8Array<ArrayBufferLike>;
    cloudSaturationMax: number;
    reserved5: Uint8Array<ArrayBufferLike>;
    palette_count: number;
    palette: {
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
export function decodeSensorStateAmbientLight(bytes: Uint8Array, offsetRef: {
    current: number;
}): {
    lux: number;
};
/**
 * @param {Uint8Array} bytes
 * @param {number} [offset]
 */
export function decodeHeader(bytes: Uint8Array, offset?: number): {
    bytes: Uint8Array<ArrayBufferLike>;
    size: number;
    protocol: number;
    addressable: boolean;
    tagged: boolean;
    origin: number;
    source: number;
    target: Uint8Array<ArrayBufferLike>;
    reserved1: Uint8Array<ArrayBufferLike>;
    reserved2: Uint8Array<ArrayBufferLike>;
    res_required: boolean;
    ack_required: boolean;
    reserved3: number;
    reserved4: Uint8Array<ArrayBufferLike>;
    sequence: number;
    reserved5: Uint8Array<ArrayBufferLike>;
    type: number;
};
export function getHeaderSize(view: DataView, offset?: number): number;
export function getHeaderFlags(view: DataView, offset?: number): number;
export function getHeaderTagged(view: DataView, offset?: number): boolean;
export function getHeaderSource(view: DataView, offset?: number): number;
export function getHeaderTarget(bytes: Uint8Array, offset?: number): Uint8Array<ArrayBufferLike>;
export function getHeaderResponseFlags(view: DataView, offset?: number): number;
export function getHeaderResponseRequired(responseFlags: number): boolean;
export function getHeaderAcknowledgeRequired(responseFlags: number): boolean;
export function getHeaderType(view: DataView, offset?: number): number;
export function getHeaderSequence(view: DataView, offset?: number): number;
export function getPayload(bytes: Uint8Array, offset?: number): Uint8Array<ArrayBufferLike>;
