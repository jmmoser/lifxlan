export const PORT: 56700;
export const BROADCAST_ADDRESS: "255.255.255.255";
export const PRODUCTS_URL: "https://raw.githubusercontent.com/LIFX/products/master/products.json";
export const NO_TARGET: Uint8Array<ArrayBuffer>;
export type ServiceType = number;
export namespace ServiceType {
    let UDP: number;
    let RESERVED2: number;
    let RESERVED3: number;
    let RESERVED4: number;
    let RESERVED5: number;
}
export type Direction = number;
export namespace Direction {
    let RIGHT: number;
    let LEFT: number;
}
