export const PORT = 56700;
export const BROADCAST_ADDRESS = '255.255.255.255';
export const PRODUCTS_URL = 'https://raw.githubusercontent.com/LIFX/products/master/products.json';
export const NO_TARGET = new Uint8Array([0, 0, 0, 0, 0, 0]);

export const ServiceType = {
  UDP: 1,
  RESERVED2: 2,
  RESERVED3: 3,
  RESERVED4: 4,
  RESERVED5: 5,
} as const;

export type ServiceType = typeof ServiceType[keyof typeof ServiceType];

export const Direction = {
  RIGHT: 0,
  LEFT: 1,
} as const;

export type Direction = typeof Direction[keyof typeof Direction];