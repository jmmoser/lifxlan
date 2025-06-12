import { describe, expect, test } from 'bun:test';
import {
  LifxError,
  TimeoutError,
  UnhandledCommandError,
  MessageConflictError,
  SourceExhaustionError,
  DisposedClientError,
  AbortError,
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
    expect(error.deviceSerial).toBe('DEVICE123');
    expect(error instanceof LifxError).toBe(true);
  });

  test('UnhandledCommandError without device serial', () => {
    const error = new UnhandledCommandError(42);
    expect(error.message).toBe('Device unknown returned unhandled command type: 42');
    expect(error.deviceSerial).toBeUndefined();
  });

  test('MessageConflictError', () => {
    const error = new MessageConflictError('test-key', 123);
    expect(error.message).toBe('Message routing conflict for key: test-key');
    expect(error.key).toBe('test-key');
    expect(error.source).toBe(123);
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

  test('AbortError', () => {
    const error = new AbortError('device response');
    expect(error.message).toBe('device response was aborted');
    expect(error.operation).toBe('device response');
    expect(error instanceof LifxError).toBe(true);
  });

  test('AbortError with default operation', () => {
    const error = new AbortError();
    expect(error.message).toBe('operation was aborted');
    expect(error.operation).toBe('operation');
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