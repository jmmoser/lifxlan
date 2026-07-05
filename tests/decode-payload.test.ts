import { describe, test, expect } from 'bun:test';
import { Type } from '../src/constants/index.js';
import { decodePayload, encodeSetGroup } from '../src/encoding.js';

describe('decodePayload', () => {
  test('decodes a payload and narrows on the type tag', () => {
    // SetGroup and StateGroup share a payload layout, so the encoder
    // produces valid StateGroup bytes.
    const updatedAt = new Date('2024-01-02T03:04:05.000Z');
    const bytes = encodeSetGroup('4e0352bf-1994-4ff2-b425-1c4455479f33', 'Kitchen', updatedAt);

    const message = decodePayload(Type.StateGroup, bytes);
    expect(message?.type).toBe(Type.StateGroup);
    if (message?.type === Type.StateGroup) {
      // The property accesses below are also the compile-time proof that the
      // discriminant narrows: they only type-check against StateGroup.
      expect(message.value.label).toBe('Kitchen');
      expect(message.value.group).toBe('4e0352bf19944ff2b4251c4455479f33');
      expect(message.value.updated_at.getTime()).toBe(updatedAt.getTime());
    }
  });

  test('decodes primitive-valued payloads', () => {
    const power = decodePayload(Type.StatePower, new Uint8Array([0xff, 0xff]));
    expect(power?.type).toBe(Type.StatePower);
    if (power?.type === Type.StatePower) {
      expect(power.value).toBe(65535);
    }

    // StateService: service u8 + port u32le (56700 = 0x0000DD7C).
    const service = decodePayload(Type.StateService, new Uint8Array([1, 0x7c, 0xdd, 0x00, 0x00]));
    expect(service?.type).toBe(Type.StateService);
    if (service?.type === Type.StateService) {
      expect(service.value.service).toBe(1);
      expect(service.value.port).toBe(56700);
    }
  });

  test('respects a caller-provided offsetRef', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0xff, 0xff]);
    const offsetRef = { current: 2 };
    const message = decodePayload(Type.StatePower, bytes, offsetRef);
    if (message?.type === Type.StatePower) {
      expect(message.value).toBe(65535);
    }
    expect(offsetRef.current).toBe(4);
  });

  test('returns undefined for requests, acknowledgements, and unknown types', () => {
    const bytes = new Uint8Array(64);
    expect(decodePayload(Type.GetService, bytes)).toBeUndefined();
    expect(decodePayload(Type.SetColor, bytes)).toBeUndefined();
    expect(decodePayload(Type.Acknowledgement, bytes)).toBeUndefined();
    expect(decodePayload(9999, bytes)).toBeUndefined();
  });

  test('propagates decoder errors for truncated payloads', () => {
    expect(() => decodePayload(Type.StateGroup, new Uint8Array(3))).toThrow();
  });
});
