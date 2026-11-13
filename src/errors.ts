/**
 * Comprehensive error types for LIFX LAN protocol operations.
 */

/**
 * Base class for all LIFX protocol errors.
 *
 * Every subclass passes its structured data as `context`, so `context` (and
 * therefore `toJSON()`) always carries the same information as the subclass's
 * typed fields — useful for structured logging without instanceof checks.
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
    super(`${operation} timed out after ${timeoutMs}ms`, { timeoutMs, operation });
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }
}

/**
 * Thrown when a device returns an unhandled command response.
 */
export class UnhandledCommandError extends LifxError {
  public readonly commandType: number;
  public readonly serialNumber: string | undefined;

  constructor(commandType: number, serialNumber?: string) {
    super(`Device ${serialNumber || 'unknown'} returned unhandled command type: ${commandType}`, { commandType, serialNumber });
    this.commandType = commandType;
    this.serialNumber = serialNumber;
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
 * Rejected when all 255 sequence numbers for a device are tied up by
 * in-flight requests, so a new send() cannot be correlated with a response.
 */
export class SequenceExhaustionError extends LifxError {
  public readonly serialNumber: string;

  constructor(serialNumber: string) {
    super(`All sequence numbers for device ${serialNumber} are in flight. Wait for pending requests to settle or reduce concurrency.`, { serialNumber });
    this.serialNumber = serialNumber;
  }
}

/**
 * Thrown when attempting to use a disposed client.
 */
export class DisposedClientError extends LifxError {
  public readonly source: number;

  constructor(source: number) {
    super(`Cannot use disposed client with source ${source}`, { source });
    this.source = source;
  }
}

/**
 * Rejected by a pending `devices.waitFor()` when the registry's `remove()` is
 * called for the serial number it is waiting on: the caller explicitly
 * dropped the device, so the lookup can no longer be satisfied.
 */
export class DeviceRemovedError extends LifxError {
  public readonly serialNumber: string;

  constructor(serialNumber: string) {
    super(`Device ${serialNumber} was removed from the registry while a lookup was pending`, { serialNumber });
    this.serialNumber = serialNumber;
  }
}

/**
 * Thrown when an inbound message cannot be decoded: a datagram too short
 * for its header, a header whose size field is out of range, or a payload
 * shorter than its message type requires. This is about what arrived from
 * the network — anyone on the LAN can send a packet — never about the
 * caller's input, which is what {@link ValidationError} reports.
 */
export class DecodeError extends LifxError {
  public readonly reason: string;

  constructor(reason: string, context: Record<string, unknown> = {}) {
    super(`Malformed message: ${reason}`, { reason, ...context });
    this.reason = reason;
  }
}

/**
 * Thrown when the caller's input is invalid: an out-of-range field, a
 * malformed serial number, a bad option. Malformed packets from the network
 * are reported as {@link DecodeError} instead.
 */
export class ValidationError extends LifxError {
  public readonly parameter: string;
  public readonly value: unknown;
  public readonly reason: string | undefined;

  constructor(parameter: string, value: unknown, reason?: string) {
    super(`Invalid ${parameter}: ${value}${reason ? ` (${reason})` : ''}`, { parameter, value, reason });
    this.parameter = parameter;
    this.value = value;
    this.reason = reason;
  }
}
