import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import { NOOP } from '../utils/index.js';
import type { Command } from './index.js';

export function GetServiceCommand(): Command<Encoding.StateService> {
  return {
    type: Type.GetService,
    decode: Encoding.decodeStateService,
  };
}

export function GetHostFirmwareCommand(): Command<Encoding.StateHostFirmware> {
  return {
    type: Type.GetHostFirmware,
    decode: Encoding.decodeStateHostFirmware,
  };
}

export function GetWifiInfoCommand(): Command<Encoding.StateWifiInfo> {
  return {
    type: Type.GetWifiInfo,
    decode: Encoding.decodeStateWifiInfo,
  };
}

export function GetWifiFirmwareCommand(): Command<Encoding.StateWifiFirmware> {
  return {
    type: Type.GetWifiFirmware,
    decode: Encoding.decodeStateWifiFirmware,
  };
}

export function GetPowerCommand(): Command<number> {
  return {
    type: Type.GetPower,
    decode: Encoding.decodeStatePower,
  };
}

export function SetPowerCommand(power: number | boolean): Command<number> {
  return {
    type: Type.SetPower,
    payload: Encoding.encodeSetPower(power),
    decode: Encoding.decodeStatePower,
  };
}

export function GetLabelCommand(): Command<string> {
  return {
    type: Type.GetLabel,
    decode: Encoding.decodeStateLabel,
  };
}

export function SetLabelCommand(label: string): Command<string> {
  return {
    type: Type.SetLabel,
    payload: Encoding.encodeString(label, 32),
    decode: Encoding.decodeStateLabel,
  };
}

export function GetVersionCommand(): Command<Encoding.StateVersion> {
  return {
    type: Type.GetVersion,
    decode: Encoding.decodeStateVersion,
  };
}

export function GetInfoCommand(): Command<Encoding.StateInfo> {
  return {
    type: Type.GetInfo,
    decode: Encoding.decodeStateInfo,
  };
}

export function SetRebootCommand(): Command<void> {
  return {
    type: Type.SetReboot,
    decode: NOOP,
  };
}

export function GetLocationCommand(): Command<Encoding.StateLocation> {
  return {
    type: Type.GetLocation,
    decode: Encoding.decodeStateLocation,
  };
}

export function SetLocationCommand(location: Uint8Array | string, label: string, updatedAt: Date): Command<Encoding.StateLocation> {
  return {
    type: Type.SetLocation,
    payload: Encoding.encodeSetLocation(location, label, updatedAt),
    decode: Encoding.decodeStateLocation,
  };
}

export function GetGroupCommand(): Command<Encoding.StateGroup> {
  return {
    type: Type.GetGroup,
    decode: Encoding.decodeStateGroup,
  };
}

export function SetGroupCommand(group: Uint8Array | string, label: string, updatedAt: Date): Command<Encoding.StateGroup> {
  return {
    type: Type.SetGroup,
    payload: Encoding.encodeSetGroup(group, label, updatedAt),
    decode: Encoding.decodeStateGroup,
  };
}

export function EchoRequestCommand(echoing: Uint8Array): Command<Uint8Array> {
  return {
    type: Type.EchoRequest,
    payload: Encoding.encodeEchoRequest(echoing),
    decode: Encoding.decodeEchoResponse,
  };
}