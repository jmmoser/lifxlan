/**
 * Comprehensive error types for LIFX LAN protocol operations.
 */
/**
 * Base class for all LIFX protocol errors.
 * @extends Error
 */
export class LifxError extends Error {
    /**
     * @param {string} message - Error description
     * @param {object} [context] - Additional error context
     */
    constructor(message: string, context?: object);
    context: object;
    toJSON(): {
        name: string;
        message: string;
        context: object;
        stack: string | undefined;
    };
}
/**
 * Thrown when a network operation times out.
 * @extends LifxError
 */
export class TimeoutError extends LifxError {
    /**
     * @param {number} timeoutMs
     * @param {string} [operation]
     */
    constructor(timeoutMs: number, operation?: string);
    timeoutMs: number;
    operation: string;
}
/**
 * Thrown when a device returns an unhandled command response.
 * @extends LifxError
 */
export class UnhandledCommandError extends LifxError {
    /**
     * @param {number} commandType
     * @param {string} [deviceSerial]
     */
    constructor(commandType: number, deviceSerial?: string);
    commandType: number;
    deviceSerial: string | undefined;
}
/**
 * Thrown when there's a conflict in message routing.
 * @extends LifxError
 */
export class MessageConflictError extends LifxError {
    /**
     * @param {string} key
     * @param {number} [source]
     */
    constructor(key: string, source?: number);
    key: string;
    source: number | undefined;
}
/**
 * Thrown when router runs out of available source IDs.
 * @extends LifxError
 */
export class SourceExhaustionError extends LifxError {
    constructor();
}
/**
 * Thrown when attempting to use a disposed client.
 * @extends LifxError
 */
export class DisposedClientError extends LifxError {
    /**
     * @param {number} source
     */
    constructor(source: number);
    source: number;
}
/**
 * Thrown when validation of input parameters fails.
 * @extends LifxError
 */
export class ValidationError extends LifxError {
    /**
     * @param {string} parameter
     * @param {any} value
     * @param {string} [reason]
     */
    constructor(parameter: string, value: any, reason?: string);
    parameter: string;
    value: any;
    reason: string | undefined;
}
