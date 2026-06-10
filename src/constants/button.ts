/**
 * Button message enums for LIFX Switch devices, as defined by the official
 * protocol definition (https://github.com/LIFX/public-protocol).
 */

export const ButtonGesture = {
  PRESS: 1,
  HOLD: 2,
  PRESS_PRESS: 3,
  PRESS_HOLD: 4,
  HOLD_HOLD: 5,
  PRESS_RELEASE: 6,
  HOLD_RELEASE: 7,
  PRESS_TOUCH: 8,
  HOLD_TOUCH: 9,
  PRESS_TOUCH_REPEAT: 10,
  HOLD_TOUCH_REPEAT: 11,
  PRESS_FAST_REPEAT: 12,
} as const;

export type ButtonGesture = typeof ButtonGesture[keyof typeof ButtonGesture];

export const ButtonTargetType = {
  POWER_TOGGLE_RELAYS: 2,
  POWER_TOGGLE_DEVICE: 3,
  POWER_TOGGLE_LOCATION: 4,
  POWER_TOGGLE_GROUP: 5,
  SCENE: 6,
  POWER_TOGGLE_DEVICE_RELAYS: 7,
  BRIGHTNESS_DOWN_DEVICE: 8,
  BRIGHTNESS_DOWN_GROUP: 9,
  BRIGHTNESS_DOWN_LOCATION: 10,
  BRIGHTNESS_UP_DEVICE: 11,
  BRIGHTNESS_UP_GROUP: 12,
  BRIGHTNESS_UP_LOCATION: 13,
  DEMO_EFFECT_CYCLE: 14,
  DEMO_EFFECT_CYCLE_STOP: 15,
  DEMO_SUNRISE_SUNSET: 16,
  POWER_ON_DEVICE: 17,
  POWER_ON_LOCATION: 18,
  POWER_ON_GROUP: 19,
  POWER_ON_RELAYS: 20,
  POWER_OFF_DEVICE: 21,
  POWER_OFF_LOCATION: 22,
  POWER_OFF_GROUP: 23,
  POWER_OFF_RELAYS: 24,
  POWER_TOGGLE_LOCAL_DEVICE: 28,
  BRIGHTNESS_DOWN_LOCAL_DEVICE: 29,
  BRIGHTNESS_UP_LOCAL_DEVICE: 30,
} as const;

export type ButtonTargetType = typeof ButtonTargetType[keyof typeof ButtonTargetType];
