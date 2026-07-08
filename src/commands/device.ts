import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import { NOOP } from '../utils/index.js';

export function GetService() {
  return {
    type: Type.GetService,
    decode: Encoding.decodeStateService,
    defaultResponseMode: 'response' as const,
  };
}

export function GetHostFirmware() {
  return {
    type: Type.GetHostFirmware,
    decode: Encoding.decodeStateHostFirmware,
    defaultResponseMode: 'response' as const,
  };
}

export function GetWifiInfo() {
  return {
    type: Type.GetWifiInfo,
    decode: Encoding.decodeStateWifiInfo,
    defaultResponseMode: 'response' as const,
  };
}

export function GetWifiFirmware() {
  return {
    type: Type.GetWifiFirmware,
    decode: Encoding.decodeStateWifiFirmware,
    defaultResponseMode: 'response' as const,
  };
}

export function GetPower() {
  return {
    type: Type.GetPower,
    decode: Encoding.decodeStatePower,
    defaultResponseMode: 'response' as const,
  };
}

export function SetPower(power: number | boolean) {
  return {
    type: Type.SetPower,
    payload: Encoding.encodeSetPower(power),
    decode: Encoding.decodeStatePower,
    defaultResponseMode: 'ack-only' as const,
  };
}

export function GetLabel() {
  return {
    type: Type.GetLabel,
    decode: Encoding.decodeStateLabel,
    defaultResponseMode: 'response' as const,
  };
}

export function SetLabel(label: string) {
  return {
    type: Type.SetLabel,
    payload: Encoding.encodeString(label, 32),
    decode: Encoding.decodeStateLabel,
    defaultResponseMode: 'ack-only' as const,
  };
}

export function GetVersion() {
  return {
    type: Type.GetVersion,
    decode: Encoding.decodeStateVersion,
    defaultResponseMode: 'response' as const,
  };
}

export function GetInfo() {
  return {
    type: Type.GetInfo,
    decode: Encoding.decodeStateInfo,
    defaultResponseMode: 'response' as const,
  };
}

export function SetReboot() {
  return {
    type: Type.SetReboot,
    decode: NOOP,
    defaultResponseMode: 'ack-only' as const,
  };
}

export function GetLocation() {
  return {
    type: Type.GetLocation,
    decode: Encoding.decodeStateLocation,
    defaultResponseMode: 'response' as const,
  };
}

export function SetLocation(location: Uint8Array | string, label: string, updatedAt: Date) {
  return {
    type: Type.SetLocation,
    payload: Encoding.encodeSetLocation(location, label, updatedAt),
    decode: Encoding.decodeStateLocation,
    defaultResponseMode: 'ack-only' as const,
  };
}

export function GetGroup() {
  return {
    type: Type.GetGroup,
    decode: Encoding.decodeStateGroup,
    defaultResponseMode: 'response' as const,
  };
}

export function SetGroup(group: Uint8Array | string, label: string, updatedAt: Date) {
  return {
    type: Type.SetGroup,
    payload: Encoding.encodeSetGroup(group, label, updatedAt),
    decode: Encoding.decodeStateGroup,
    defaultResponseMode: 'ack-only' as const,
  };
}

export function EchoRequest(echoing: Uint8Array) {
  return {
    type: Type.EchoRequest,
    payload: Encoding.encodeEchoRequest(echoing),
    decode: Encoding.decodeEchoResponse,
    defaultResponseMode: 'response' as const,
  };
}