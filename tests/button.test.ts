import { describe, test } from 'bun:test';
import assert from 'node:assert';
import * as Encoding from '../src/encoding.js';
import { ValidationError } from '../src/errors.js';
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

    // SetButton is index (1) + buttons_count (1) + 8 buttons of 101 bytes.
    assert.equal(payload.length, 810);
    assert.equal(payload[0], 1, 'index');
    assert.equal(payload[1], 2, 'buttons_count');

    // First button: actions_count then gesture/target_type little-endian.
    assert.equal(payload[2], 1, 'button 0 actions_count');
    assert.equal(payload[3]! | (payload[4]! << 8), ButtonGesture.PRESS);
    assert.equal(payload[5]! | (payload[6]! << 8), ButtonTargetType.POWER_TOGGLE_DEVICE);
    assert.deepEqual(payload.subarray(7, 13), target);
    assert.deepEqual(payload.subarray(13, 23), new Uint8Array(10), 'unused target bytes are zero');

    // Second button begins 101 bytes after the first.
    assert.equal(payload[103], 1, 'button 1 actions_count');
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

    const offsetRef = { current: 0 };
    const state = Encoding.decodeStateButton(statePayload, offsetRef);

    assert.equal(offsetRef.current, 811, 'decoder must consume the full wire size');
    assert.equal(state.count, 4);
    assert.equal(state.index, 0);
    assert.equal(state.buttons_count, 1);
    assert.equal(state.buttons.length, 8);

    const button = state.buttons[0]!;
    assert.equal(button.actions_count, 2);
    assert.equal(button.actions.length, 5);
    assert.equal(button.actions[0]!.gesture, ButtonGesture.PRESS);
    assert.equal(button.actions[0]!.target_type, ButtonTargetType.POWER_TOGGLE_RELAYS);
    assert.deepEqual(button.actions[0]!.target.subarray(0, 3), new Uint8Array([2, 0, 1]));
    assert.equal(button.actions[0]!.target.length, 16);
    assert.equal(button.actions[1]!.gesture, ButtonGesture.PRESS_PRESS);
    assert.equal(button.actions[1]!.target_type, ButtonTargetType.DEMO_EFFECT_CYCLE);
    assert.equal(state.buttons[7]!.actions_count, 0);
  });

  test('decodeStateButton rejects truncated payloads', () => {
    assert.throws(() => Encoding.decodeStateButton(new Uint8Array(810), { current: 0 }), ValidationError);
  });

  test('encodeSetButton clamps overflowing buttons and actions', () => {
    const tooManyActions = Array.from({ length: 9 }, () => ({
      gesture: ButtonGesture.PRESS,
      targetType: ButtonTargetType.POWER_TOGGLE_LOCAL_DEVICE,
    }));
    const tooManyButtons = Array.from({ length: 10 }, () => ({ actions: tooManyActions }));
    const payload = Encoding.encodeSetButton(0, tooManyButtons);

    assert.equal(payload.length, 810);
    assert.equal(payload[1], 8, 'buttons_count clamps to 8');
    assert.equal(payload[2], 5, 'actions_count clamps to 5');
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
