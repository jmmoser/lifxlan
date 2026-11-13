import { describe, expect, test } from 'bun:test';
import {
  LifxError,
  TimeoutError,
  UnhandledCommandError,
  SourceExhaustionError,
  SequenceExhaustionError,
  DisposedClientError,
  DecodeError,
  ValidationError,
} from '../src/errors.js';

describe('errors', () => {
  test('LifxError base class', () => {
    const error = new LifxError('test message', { key: 'value' });
    expect(error.message).toBe('test message');
    expect(error.name).toBe('LifxError');
    expect(error.context).toEqual({ key: 'value' });
    expect(error instanceof Error).toBe(true);
  });

  test('LifxError toJSON method', () => {
    const error = new LifxError('test message', { key: 'value' });
    const json = error.toJSON();
    expect(json.name).toBe('LifxError');
    expect(json.message).toBe('test message');
    expect(json.context).toEqual({ key: 'value' });
    expect(typeof json.stack).toBe('string');
  });

  test('TimeoutError', () => {
    const error = new TimeoutError(5000, 'send command');
    expect(error.message).toBe('send command timed out after 5000ms');
    expect(error.timeoutMs).toBe(5000);
    expect(error.operation).toBe('send command');
    expect(error instanceof LifxError).toBe(true);
  });

  test('TimeoutError with default operation', () => {
    const error = new TimeoutError(3000);
    expect(error.message).toBe('operation timed out after 3000ms');
    expect(error.operation).toBe('operation');
  });

  test('UnhandledCommandError', () => {
    const error = new UnhandledCommandError(42, 'DEVICE123');
    expect(error.message).toBe('Device DEVICE123 returned unhandled command type: 42');
    expect(error.commandType).toBe(42);
    expect(error.serialNumber).toBe('DEVICE123');
    expect(error instanceof LifxError).toBe(true);
  });

  test('UnhandledCommandError without device serial', () => {
    const error = new UnhandledCommandError(42);
    expect(error.message).toBe('Device unknown returned unhandled command type: 42');
    expect(error.serialNumber).toBeUndefined();
  });

  test('SequenceExhaustionError', () => {
    const error = new SequenceExhaustionError('abcdef123456');
    expect(error.message).toBe('All sequence numbers for device abcdef123456 are in flight. Wait for pending requests to settle or reduce concurrency.');
    expect(error.serialNumber).toBe('abcdef123456');
    expect(error instanceof LifxError).toBe(true);
  });

  test('SourceExhaustionError', () => {
    const error = new SourceExhaustionError();
    expect(error.message).toBe('No more source IDs available. Consider disposing unused clients.');
    expect(error instanceof LifxError).toBe(true);
  });

  test('DisposedClientError', () => {
    const error = new DisposedClientError(123);
    expect(error.message).toBe('Cannot use disposed client with source 123');
    expect(error.source).toBe(123);
    expect(error instanceof LifxError).toBe(true);
  });

  test('DecodeError', () => {
    const error = new DecodeError('expected a payload of at least 2 bytes, got 1', { expected: 2, available: 1 });
    expect(error.message).toBe('Malformed message: expected a payload of at least 2 bytes, got 1');
    expect(error.name).toBe('DecodeError');
    expect(error.reason).toBe('expected a payload of at least 2 bytes, got 1');
    expect(error.context).toEqual({ reason: 'expected a payload of at least 2 bytes, got 1', expected: 2, available: 1 });
    expect(error instanceof LifxError).toBe(true);
    // A malformed packet is not a caller error.
    expect(error instanceof ValidationError).toBe(false);
  });

  test('ValidationError', () => {
    const error = new ValidationError('timeout', 'invalid', 'must be a number');
    expect(error.message).toBe('Invalid timeout: invalid (must be a number)');
    expect(error.parameter).toBe('timeout');
    expect(error.value).toBe('invalid');
    expect(error.reason).toBe('must be a number');
    expect(error instanceof LifxError).toBe(true);
  });

  test('ValidationError without reason', () => {
    const error = new ValidationError('timeout', 'invalid');
    expect(error.message).toBe('Invalid timeout: invalid');
    expect(error.reason).toBeUndefined();
  });
});