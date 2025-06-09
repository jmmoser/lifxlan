/**
 * Comprehensive error types for LIFX LAN protocol operations.
 */

/**
 * Base class for all LIFX protocol errors.
 */
export class LifxError extends Error {
  public readonly context: Record<string, unknown>;

  constructor(message: string, context: Record<string, unknown> = {}) {
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
 */
export class TimeoutError extends LifxError {
  public readonly timeoutMs: number;
  public readonly operation: string;

  constructor(timeoutMs: number, operation = 'operation') {
    super(`${operation} timed out after ${timeoutMs}ms`);
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }
}

/**
 * Thrown when a device returns an unhandled command response.
 */
export class UnhandledCommandError extends LifxError {
  public readonly commandType: number;
  public readonly deviceSerial: string | undefined;

  constructor(commandType: number, deviceSerial?: string) {
    super(`Device ${deviceSerial || 'unknown'} returned unhandled command type: ${commandType}`);
    this.commandType = commandType;
    this.deviceSerial = deviceSerial;
  }
}

/**
 * Thrown when there's a conflict in message routing.
 */
export class MessageConflictError extends LifxError {
  public readonly key: string;
  public readonly source: number | undefined;

  constructor(key: string, source?: number) {
    super(`Message routing conflict for key: ${key}`);
    this.key = key;
    this.source = source;
  }
}

/**
 * Thrown when router runs out of available source IDs.
 */
export class SourceExhaustionError extends LifxError {
  constructor() {
    super('No more source IDs available. Consider disposing unused clients.');
  }
}

/**
 * Thrown when attempting to use a disposed client.
 */
export class DisposedClientError extends LifxError {
  public readonly source: number;

  constructor(source: number) {
    super(`Cannot use disposed client with source ${source}`);
    this.source = source;
  }
}

/**
 * Thrown when an operation is aborted via AbortSignal.
 */
export class AbortError extends LifxError {
  public readonly operation: string;

  constructor(operation = 'operation') {
    super(`${operation} was aborted`);
    this.operation = operation;
  }
}

/**
 * Thrown when validation of input parameters fails.
 */
export class ValidationError extends LifxError {
  public readonly parameter: string;
  public readonly value: unknown;
  public readonly reason: string | undefined;

  constructor(parameter: string, value: unknown, reason?: string) {
    super(`Invalid ${parameter}: ${value}${reason ? ` (${reason})` : ''}`);
    this.parameter = parameter;
    this.value = value;
    this.reason = reason;
  }
}