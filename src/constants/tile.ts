export const TileEffectType = {
  OFF: 0,
  RESERVED1: 1,
  MORPH: 2,
  FLAME: 3,
  RESERVED2: 4,
  SKY: 5,
} as const;

export type TileEffectType = typeof TileEffectType[keyof typeof TileEffectType];

export const TileEffectSkyType = {
  SUNRISE: 0,
  SUNSET: 1,
  CLOUDS: 2,
} as const;

export type TileEffectSkyType = typeof TileEffectSkyType[keyof typeof TileEffectSkyType];