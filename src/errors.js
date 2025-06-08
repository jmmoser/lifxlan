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
  constructor(message, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      stack: this.stack,
    };
  }
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
  constructor(timeoutMs, operation = 'operation') {
    super(`${operation} timed out after ${timeoutMs}ms`);
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }
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
  constructor(commandType, deviceSerial) {
    super(`Device ${deviceSerial || 'unknown'} returned unhandled command type: ${commandType}`);
    this.commandType = commandType;
    this.deviceSerial = deviceSerial;
  }
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
  constructor(key, source) {
    super(`Message routing conflict for key: ${key}`);
    this.key = key;
    this.source = source;
  }
}

/**
 * Thrown when router runs out of available source IDs.
 * @extends LifxError
 */
export class SourceExhaustionError extends LifxError {
  constructor() {
    super('No more source IDs available. Consider disposing unused clients.');
  }
}

/**
 * Thrown when attempting to use a disposed client.
 * @extends LifxError
 */
export class DisposedClientError extends LifxError {
  /**
   * @param {number} source
   */
  constructor(source) {
    super(`Cannot use disposed client with source ${source}`);
    this.source = source;
  }
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
  constructor(parameter, value, reason) {
    super(`Invalid ${parameter}: ${value}${reason ? ` (${reason})` : ''}`);
    this.parameter = parameter;
    this.value = value;
    this.reason = reason;
  }
}