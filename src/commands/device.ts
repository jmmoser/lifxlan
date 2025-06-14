import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import { NOOP } from '../utils/index.js';

export function GetServiceCommand() {
  return {
    type: Type.GetService,
    decode: Encoding.decodeStateService,
    defaultResponseMode: 'response' as const,
  };
}

export function GetHostFirmwareCommand() {
  return {
    type: Type.GetHostFirmware,
    decode: Encoding.decodeStateHostFirmware,
    defaultResponseMode: 'response' as const,
  };
}

export function GetWifiInfoCommand() {
  return {
    type: Type.GetWifiInfo,
    decode: Encoding.decodeStateWifiInfo,
    defaultResponseMode: 'response' as const,
  };
}

export function GetWifiFirmwareCommand() {
  return {
    type: Type.GetWifiFirmware,
    decode: Encoding.decodeStateWifiFirmware,
    defaultResponseMode: 'response' as const,
  };
}

export function GetPowerCommand() {
  return {
    type: Type.GetPower,
    decode: Encoding.decodeStatePower,
    defaultResponseMode: 'response' as const,
  };
}

export function SetPowerCommand(power: number | boolean) {
  return {
    type: Type.SetPower,
    payload: Encoding.encodeSetPower(power),
    decode: Encoding.decodeStatePower,
    defaultResponseMode: 'ack-only' as const,
  };
}

export function GetLabelCommand() {
  return {
    type: Type.GetLabel,
    decode: Encoding.decodeStateLabel,
    defaultResponseMode: 'response' as const,
  };
}

export function SetLabelCommand(label: string) {
  return {
    type: Type.SetLabel,
    payload: Encoding.encodeString(label, 32),
    decode: Encoding.decodeStateLabel,
    defaultResponseMode: 'ack-only' as const,
  };
}

export function GetVersionCommand() {
  return {
    type: Type.GetVersion,
    decode: Encoding.decodeStateVersion,
    defaultResponseMode: 'response' as const,
  };
}

export function GetInfoCommand() {
  return {
    type: Type.GetInfo,
    decode: Encoding.decodeStateInfo,
    defaultResponseMode: 'response' as const,
  };
}

export function SetRebootCommand() {
  return {
    type: Type.SetReboot,
    decode: NOOP,
    defaultResponseMode: 'none' as const,
  };
}

export function GetLocationCommand() {
  return {
    type: Type.GetLocation,
    decode: Encoding.decodeStateLocation,
    defaultResponseMode: 'response' as const,
  };
}

export function SetLocationCommand(location: Uint8Array | string, label: string, updatedAt: Date) {
  return {
    type: Type.SetLocation,
    payload: Encoding.encodeSetLocation(location, label, updatedAt),
    decode: Encoding.decodeStateLocation,
    defaultResponseMode: 'ack-only' as const,
  };
}

export function GetGroupCommand() {
  return {
    type: Type.GetGroup,
    decode: Encoding.decodeStateGroup,
    defaultResponseMode: 'response' as const,
  };
}

export function SetGroupCommand(group: Uint8Array | string, label: string, updatedAt: Date) {
  return {
    type: Type.SetGroup,
    payload: Encoding.encodeSetGroup(group, label, updatedAt),
    decode: Encoding.decodeStateGroup,
    defaultResponseMode: 'ack-only' as const,
  };
}

export function EchoRequestCommand(echoing: Uint8Array) {
  return {
    type: Type.EchoRequest,
    payload: Encoding.encodeEchoRequest(echoing),
    decode: Encoding.decodeEchoResponse,
    defaultResponseMode: 'response' as const,
  };
}