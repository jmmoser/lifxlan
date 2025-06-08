/**
 * Creates a high-level client for communicating with LIFX devices.
 *
 * The Client provides methods for sending commands to devices with automatic
 * timeout handling, retry logic, and response correlation. It uses the Router
 * for message routing and supports both acknowledged and unacknowledged messaging patterns.
 *
 * @param {{
 *   router: ReturnType<typeof import('./router.js').Router>,
 *   defaultTimeoutMs?: number,
 *   source?: number,
 *   onMessage?: import('./router.js').MessageHandler
 * }} options Configuration options
 * @returns {object} A new client instance
 * @example
 * ```javascript
 * const client = Client({ router });
 * const response = await client.send(GetColorCommand(), device);
 * ```
 * @performance Optimized for high-throughput scenarios with minimal allocations
 */
export function Client(options: {
    router: ReturnType<typeof import("./router.js").Router>;
    defaultTimeoutMs?: number;
    source?: number;
    onMessage?: import("./router.js").MessageHandler;
}): object;
