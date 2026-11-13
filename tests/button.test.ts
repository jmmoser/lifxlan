import { describe, test } from 'bun:test';
import assert from 'node:assert';
import * as Encoding from '../src/wire.js';
import { DecodeError, ValidationError } from '../src/errors.js';
import { ButtonGesture, ButtonTargetType, Type } from '../src/constants/index.js';
import { GetButton, SetButton } from '../src/commands/index.js';

describe('button messages', () => {
  test('encodeSetButton layout', () => {
    const target = new Uint8Array([0xd0, 0x73, 0xd5, 0x01, 0x02, 0x03]);
    const payload = Encoding.encodeSetButton(1, [
      {
        actions: [
          { gesture: ButtonGesture.PRESS, targetType: ButtonTargetType.POWER_TOGGLE_DEVICE, target },
        ],
      },
      {
        actions: [
          { gesture: ButtonGesture.HOLD, targetType: ButtonTargetType.BRIGHTNESS_UP_LOCAL_DEVICE },
        ],
      },
    ]);

    // SetButton is index (1) + buttonsCount (1) + 8 buttons of 101 bytes.
    assert.equal(payload.length, 810);
    assert.equal(payload[0], 1, 'index');
    assert.equal(payload[1], 2, 'buttonsCount');

    // First button: actionsCount then gesture/targetType little-endian.
    assert.equal(payload[2], 1, 'button 0 actionsCount');
    assert.equal(payload[3]! | (payload[4]! << 8), ButtonGesture.PRESS);
    assert.equal(payload[5]! | (payload[6]! << 8), ButtonTargetType.POWER_TOGGLE_DEVICE);
    assert.deepEqual(payload.subarray(7, 13), target);
    assert.deepEqual(payload.subarray(13, 23), new Uint8Array(10), 'unused target bytes are zero');

    // Second button begins 101 bytes after the first.
    assert.equal(payload[103], 1, 'button 1 actionsCount');
    assert.equal(payload[104]! | (payload[105]! << 8), ButtonGesture.HOLD);
    assert.equal(payload[106]! | (payload[107]! << 8), ButtonTargetType.BRIGHTNESS_UP_LOCAL_DEVICE);
  });

  test('decodeStateButton round-trips an encoded payload', () => {
    // StateButton is count (1) + the SetButton layout shifted by one byte.
    const setPayload = Encoding.encodeSetButton(0, [
      {
        actions: [
          { gesture: ButtonGesture.PRESS, targetType: ButtonTargetType.POWER_TOGGLE_RELAYS, target: new Uint8Array([2, 0, 1]) },
          { gesture: ButtonGesture.PRESS_PRESS, targetType: ButtonTargetType.DEMO_EFFECT_CYCLE },
        ],
      },
    ]);
    const statePayload = new Uint8Array(811);
    statePayload[0] = 4; // count: total buttons on the device
    statePayload.set(setPayload, 1);

    const state = Encoding.decodeStateButton(statePayload);

    assert.equal(state.count, 4);
    assert.equal(state.index, 0);
    // Only the reported button, with only its reported actions — not the
    // fixed 8 x 5 slots the wire message carries.
    assert.equal(state.buttons.length, 1);

    const button = state.buttons[0]!;
    assert.equal(button.actions.length, 2);
    assert.equal(button.actions[0]!.gesture, ButtonGesture.PRESS);
    assert.equal(button.actions[0]!.targetType, ButtonTargetType.POWER_TOGGLE_RELAYS);
    assert.deepEqual(button.actions[0]!.target.subarray(0, 3), new Uint8Array([2, 0, 1]));
    assert.equal(button.actions[0]!.target.length, 16);
    assert.equal(button.actions[1]!.gesture, ButtonGesture.PRESS_PRESS);
    assert.equal(button.actions[1]!.targetType, ButtonTargetType.DEMO_EFFECT_CYCLE);
  });

  test('decodeStateButton returns plain objects without count fields', () => {
    const statePayload = new Uint8Array(811);
    statePayload[0] = 2;
    statePayload[2] = 1; // buttonsCount
    statePayload[3] = 1; // button 0 actionsCount
    const state = Encoding.decodeStateButton(statePayload);

    assert.deepStrictEqual(Object.keys(state), ['count', 'index', 'buttons']);
    assert.deepStrictEqual(Object.keys(state.buttons[0]!), ['actions']);
    assert.deepStrictEqual(Object.keys(state.buttons[0]!.actions[0]!), ['gesture', 'targetType', 'target']);
  });

  test('decodeStateButton decodes no buttons when none are reported', () => {
    const state = Encoding.decodeStateButton(new Uint8Array(811));
    assert.deepStrictEqual(state, { count: 0, index: 0, buttons: [] });
  });

  test('decodeStateButton decodes every slot of a full message', () => {
    const statePayload = new Uint8Array(811);
    statePayload[0] = 8;
    statePayload[2] = 8; // buttonsCount
    for (let i = 0; i < 8; i++) {
      const buttonOffset = 3 + i * 101;
      statePayload[buttonOffset] = 5; // actionsCount
      for (let j = 0; j < 5; j++) {
        // gesture low byte identifies the slot
        statePayload[buttonOffset + 1 + j * 20] = i * 5 + j + 1;
      }
    }
    const state = Encoding.decodeStateButton(statePayload);

    assert.equal(state.buttons.length, 8);
    for (let i = 0; i < 8; i++) {
      assert.equal(state.buttons[i]!.actions.length, 5);
      for (let j = 0; j < 5; j++) {
        assert.equal(state.buttons[i]!.actions[j]!.gesture, i * 5 + j + 1);
      }
    }
  });

  test('decodeStateButton clamps counts that exceed the wire capacity', () => {
    // A hostile or buggy device may report more than the message can carry;
    // the decoder must not read past the fixed slots.
    const statePayload = new Uint8Array(811);
    statePayload[2] = 200; // buttonsCount
    for (let i = 0; i < 8; i++) {
      statePayload[3 + i * 101] = 99; // actionsCount
    }
    const state = Encoding.decodeStateButton(statePayload);

    assert.equal(state.buttons.length, 8);
    for (const button of state.buttons) {
      assert.equal(button.actions.length, 5);
    }
  });

  test('decodeStateButton action targets are views into the payload', () => {
    const statePayload = new Uint8Array(811);
    statePayload[2] = 1;
    statePayload[3] = 1;
    statePayload[8] = 0xab; // first target byte of button 0, action 0
    const state = Encoding.decodeStateButton(statePayload);
    const { target } = state.buttons[0]!.actions[0]!;

    assert.equal(target[0], 0xab);
    assert.strictEqual(target.buffer, statePayload.buffer);
  });

  test('decodeStateButton rejects truncated payloads', () => {
    assert.throws(() => Encoding.decodeStateButton(new Uint8Array(810)), DecodeError);
  });

  test('encodeSetButton rejects more buttons or actions than the message carries', () => {
    const action = {
      gesture: ButtonGesture.PRESS,
      targetType: ButtonTargetType.POWER_TOGGLE_LOCAL_DEVICE,
    };
    const fiveActions = Array.from({ length: 5 }, () => action);
    const sixActions = Array.from({ length: 6 }, () => action);

    // The limits themselves are accepted.
    const full = Encoding.encodeSetButton(0, Array.from({ length: 8 }, () => ({ actions: fiveActions })));
    assert.equal(full.length, 810);
    assert.equal(full[1], 8, 'buttonsCount');
    assert.equal(full[2], 5, 'actionsCount');

    assert.throws(
      () => Encoding.encodeSetButton(0, Array.from({ length: 9 }, () => ({ actions: [] }))),
      (err: unknown) => err instanceof ValidationError && err.parameter === 'buttons' && err.value === 9,
    );
    assert.throws(
      () => Encoding.encodeSetButton(0, [{ actions: sixActions }]),
      (err: unknown) => err instanceof ValidationError && err.parameter === 'actions' && err.value === 6,
    );
  });

  test('encodeSetButton rejects an action target longer than 16 bytes', () => {
    const action = (target: Uint8Array) => ({
      gesture: ButtonGesture.PRESS,
      targetType: ButtonTargetType.SCENE,
      target,
    });

    const payload = Encoding.encodeSetButton(0, [{ actions: [action(new Uint8Array(16).fill(0xee))] }]);
    assert.deepEqual(payload.subarray(7, 23), new Uint8Array(16).fill(0xee));
    assert.equal(payload[23], 0, 'the next action slot is untouched');

    assert.throws(
      () => Encoding.encodeSetButton(0, [{ actions: [action(new Uint8Array(17))] }]),
      (err: unknown) => err instanceof ValidationError && err.parameter === 'target' && err.value === 17,
    );
  });

  test('encodeSetButton validates index, gesture, and targetType by wire width', () => {
    const buttons = (gesture: number, targetType: number) => [{ actions: [{ gesture, targetType }] }];

    for (const index of [-1, 256, 1.5, NaN]) {
      assert.throws(
        () => Encoding.encodeSetButton(index, []),
        (err: unknown) => err instanceof ValidationError && err.parameter === 'index',
        `index ${index}`,
      );
    }
    assert.doesNotThrow(() => Encoding.encodeSetButton(255, []));

    for (const value of [-1, 65536, NaN]) {
      assert.throws(
        () => Encoding.encodeSetButton(0, buttons(value, 0)),
        (err: unknown) => err instanceof ValidationError && err.parameter === 'gesture',
        `gesture ${value}`,
      );
      assert.throws(
        () => Encoding.encodeSetButton(0, buttons(0, value)),
        (err: unknown) => err instanceof ValidationError && err.parameter === 'targetType',
        `targetType ${value}`,
      );
    }
    const max = Encoding.encodeSetButton(0, buttons(65535, 65535));
    assert.deepEqual(max.subarray(3, 7), new Uint8Array([0xff, 0xff, 0xff, 0xff]));
  });

  test('commands carry the right packet types and defaults', () => {
    const get = GetButton();
    assert.equal(get.type, Type.GetButton);
    assert.equal(get.defaultResponseMode, 'response');

    const set = SetButton(0, [{ actions: [] }]);
    assert.equal(set.type, Type.SetButton);
    assert.equal(set.defaultResponseMode, 'ack-only');
    assert.equal(set.payload.length, 810);
  });
});
