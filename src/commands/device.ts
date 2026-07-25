import * as Encoding from '../encoding.js';
import { Type } from '../constants/index.js';
import type { Command } from './index.js';

export function GetService() {
  return {
    type: Type.GetService,
    decode: Encoding.decodeStateService,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateService, 'response'>;
}

export function GetHostFirmware() {
  return {
    type: Type.GetHostFirmware,
    decode: Encoding.decodeStateHostFirmware,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateHostFirmware, 'response'>;
}

export function GetWifiInfo() {
  return {
    type: Type.GetWifiInfo,
    decode: Encoding.decodeStateWifiInfo,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateWifiInfo, 'response'>;
}

export function GetWifiFirmware() {
  return {
    type: Type.GetWifiFirmware,
    decode: Encoding.decodeStateWifiFirmware,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateWifiFirmware, 'response'>;
}

export function GetPower() {
  return {
    type: Type.GetPower,
    decode: Encoding.decodeStatePower,
    defaultResponseMode: 'response',
  } satisfies Command<number, 'response'>;
}

export function SetPower(power: number | boolean) {
  return {
    type: Type.SetPower,
    payload: Encoding.encodeSetPower(power),
    decode: Encoding.decodeStatePower,
    defaultResponseMode: 'ack-only',
  } satisfies Command<number, 'ack-only'>;
}

export function GetLabel() {
  return {
    type: Type.GetLabel,
    decode: Encoding.decodeStateLabel,
    defaultResponseMode: 'response',
  } satisfies Command<string, 'response'>;
}

export function SetLabel(label: string) {
  return {
    type: Type.SetLabel,
    payload: Encoding.encodeString(label, 32),
    decode: Encoding.decodeStateLabel,
    defaultResponseMode: 'ack-only',
  } satisfies Command<string, 'ack-only'>;
}

export function GetVersion() {
  return {
    type: Type.GetVersion,
    decode: Encoding.decodeStateVersion,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateVersion, 'response'>;
}

export function GetInfo() {
  return {
    type: Type.GetInfo,
    decode: Encoding.decodeStateInfo,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateInfo, 'response'>;
}

// The declared Command<void, ...> return type (rather than `satisfies`) is
// what lets send() reject responseMode 'response'/'both' at compile time:
// with no decoder to infer from, only the annotation carries `void` to the
// call site.
export function SetReboot(): Command<void, 'ack-only'> {
  return {
    type: Type.SetReboot,
    defaultResponseMode: 'ack-only',
  };
}

export function GetLocation() {
  return {
    type: Type.GetLocation,
    decode: Encoding.decodeStateLocation,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateLocation, 'response'>;
}

/**
 * @param updatedAt When this location assignment was made — devices resolve
 * conflicting location labels by newest timestamp. Defaults to now, which is
 * right unless you are replaying a historical assignment.
 */
export function SetLocation(location: Uint8Array | string, label: string, updatedAt: Date = new Date()) {
  return {
    type: Type.SetLocation,
    payload: Encoding.encodeSetLocation(location, label, updatedAt),
    decode: Encoding.decodeStateLocation,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateLocation, 'ack-only'>;
}

export function GetGroup() {
  return {
    type: Type.GetGroup,
    decode: Encoding.decodeStateGroup,
    defaultResponseMode: 'response',
  } satisfies Command<Encoding.StateGroup, 'response'>;
}

/**
 * @param updatedAt When this group assignment was made — devices resolve
 * conflicting group labels by newest timestamp. Defaults to now, which is
 * right unless you are replaying a historical assignment.
 */
export function SetGroup(group: Uint8Array | string, label: string, updatedAt: Date = new Date()) {
  return {
    type: Type.SetGroup,
    payload: Encoding.encodeSetGroup(group, label, updatedAt),
    decode: Encoding.decodeStateGroup,
    defaultResponseMode: 'ack-only',
  } satisfies Command<Encoding.StateGroup, 'ack-only'>;
}

export function EchoRequest(echoing: Uint8Array) {
  return {
    type: Type.EchoRequest,
    payload: Encoding.encodeEchoRequest(echoing),
    decode: Encoding.decodeEchoResponse,
    defaultResponseMode: 'response',
  } satisfies Command<Uint8Array, 'response'>;
}
