export function GetServiceCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateService;
};
export function GetHostFirmwareCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateHostFirmware;
};
export function GetWifiInfoCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateWifiInfo;
};
export function GetWifiFirmwareCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateWifiFirmware;
};
export function GetPowerCommand(): {
    type: number;
    decode: typeof Encoding.decodeStatePower;
};
/**
 * @param {number | boolean} power
 */
export function SetPowerCommand(power: number | boolean): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStatePower;
};
export function GetLabelCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateLabel;
};
/**
 * @param {string} label
 */
export function SetLabelCommand(label: string): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateLabel;
};
export function GetVersionCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateVersion;
};
export function GetInfoCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateInfo;
};
export function SetRebootCommand(): {
    type: number;
    decode: (value: any) => void;
};
export function GetLocationCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateLocation;
};
/**
 * @param {Uint8Array | string} location
 * @param {string} label
 * @param {Date} updatedAt
 */
export function SetLocationCommand(location: Uint8Array | string, label: string, updatedAt: Date): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateLocation;
};
export function GetGroupCommand(): {
    type: number;
    decode: typeof Encoding.decodeStateGroup;
};
/**
 * @param {Uint8Array | string} group
 * @param {string} label
 * @param {Date} updatedAt
 */
export function SetGroupCommand(group: Uint8Array | string, label: string, updatedAt: Date): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeStateGroup;
};
/**
 * @param {Uint8Array} echoing
 */
export function EchoRequestCommand(echoing: Uint8Array): {
    type: number;
    payload: Uint8Array<ArrayBuffer>;
    decode: typeof Encoding.decodeEchoResponse;
};
import * as Encoding from '../encoding.js';
