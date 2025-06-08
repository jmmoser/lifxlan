export const MultiZoneApplicationRequest = {
  NO_APPLY: 0,
  APPLY: 1,
  APPLY_ONLY: 2,
} as const;

export type MultiZoneApplicationRequest = typeof MultiZoneApplicationRequest[keyof typeof MultiZoneApplicationRequest];

export const MultiZoneEffectType = {
  OFF: 0,
  MOVE: 1,
  RESERVED1: 2,
  RESERVED2: 3,
} as const;

export type MultiZoneEffectType = typeof MultiZoneEffectType[keyof typeof MultiZoneEffectType];

export const MultiZoneExtendedApplicationRequest = {
  NO_APPLY: 0,
  APPLY: 1,
  APPLY_ONLY: 2,
} as const;

export type MultiZoneExtendedApplicationRequest = typeof MultiZoneExtendedApplicationRequest[keyof typeof MultiZoneExtendedApplicationRequest];