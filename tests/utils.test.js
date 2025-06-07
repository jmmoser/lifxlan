import { describe, test } from 'bun:test';
import assert from 'node:assert';
import * as Utils from '../src/utils.js';

describe('utils', () => {
  test('NOOP function', () => {
    assert.equal(Utils.NOOP(42), undefined);
    assert.equal(Utils.NOOP('test'), undefined);
    assert.equal(Utils.NOOP(null), undefined);
  });

  test('PromiseWithResolvers creates resolvable promise', async () => {
    const { promise, resolve } = Utils.PromiseWithResolvers();
    
    setTimeout(() => resolve('success'), 0);
    
    const result = await promise;
    assert.equal(result, 'success');
  });

  test('PromiseWithResolvers creates rejectable promise', async () => {
    const { promise, reject } = Utils.PromiseWithResolvers();
    
    setTimeout(() => reject(new Error('test error')), 0);
    
    await assert.rejects(promise, /test error/);
  });

  test('hsbToRgb converts HSB to RGB - red', () => {
    const [r, g, b] = Utils.hsbToRgb(0, 65535, 65535);
    assert.equal(r, 255);
    assert.equal(g, 0);
    assert.equal(b, 0);
  });

  test('hsbToRgb converts HSB to RGB - green', () => {
    const [r, g, b] = Utils.hsbToRgb(21845, 65535, 65535); // 120 degrees
    assert.equal(r, 0);
    assert.equal(g, 255);
    assert.equal(b, 0);
  });

  test('hsbToRgb converts HSB to RGB - blue', () => {
    const [r, g, b] = Utils.hsbToRgb(43690, 65535, 65535); // 240 degrees
    assert.equal(r, 0);
    assert.equal(g, 0);
    assert.equal(b, 255);
  });

  test('hsbToRgb converts HSB to RGB - white', () => {
    const [r, g, b] = Utils.hsbToRgb(0, 0, 65535);
    assert.equal(r, 255);
    assert.equal(g, 255);
    assert.equal(b, 255);
  });

  test('hsbToRgb converts HSB to RGB - black', () => {
    const [r, g, b] = Utils.hsbToRgb(0, 0, 0);
    assert.equal(r, 0);
    assert.equal(g, 0);
    assert.equal(b, 0);
  });

  test('hsbToRgb converts HSB to RGB - mid brightness', () => {
    const [r, g, b] = Utils.hsbToRgb(0, 65535, 32768); // Half brightness red
    assert.equal(r, 128);
    assert.equal(g, 0);
    assert.equal(b, 0);
  });

  test('rgbToHsb converts RGB to HSB - red', () => {
    const [h, s, b] = Utils.rgbToHsb(255, 0, 0);
    assert.equal(h, 0);
    assert.equal(s, 65535);
    assert.equal(b, 65535);
  });

  test('rgbToHsb converts RGB to HSB - green', () => {
    const [h, s, b] = Utils.rgbToHsb(0, 255, 0);
    assert.equal(h, 21845); // 120 degrees
    assert.equal(s, 65535);
    assert.equal(b, 65535);
  });

  test('rgbToHsb converts RGB to HSB - blue', () => {
    const [h, s, b] = Utils.rgbToHsb(0, 0, 255);
    assert.equal(h, 43690); // 240 degrees
    assert.equal(s, 65535);
    assert.equal(b, 65535);
  });

  test('rgbToHsb converts RGB to HSB - white', () => {
    const [h, s, b] = Utils.rgbToHsb(255, 255, 255);
    assert.equal(h, 0);
    assert.equal(s, 0);
    assert.equal(b, 65535);
  });

  test('rgbToHsb converts RGB to HSB - black', () => {
    const [h, s, b] = Utils.rgbToHsb(0, 0, 0);
    assert.equal(h, 0);
    assert.equal(s, 0);
    assert.equal(b, 0);
  });

  test('rgbToHsb converts RGB to HSB - gray', () => {
    const [h, s, b] = Utils.rgbToHsb(128, 128, 128);
    assert.equal(h, 0);
    assert.equal(s, 0);
    assert.equal(b, 32896); // ~128/255 * 65535
  });

  test('getRssiStatus returns correct status for various RSSI values', () => {
    assert.equal(Utils.getRssiStatus(200), 'none');
    assert.equal(Utils.getRssiStatus(-90), 'very bad'); // < -80
    assert.equal(Utils.getRssiStatus(-81), 'very bad'); // < -80
    assert.equal(Utils.getRssiStatus(4), 'very bad');
    assert.equal(Utils.getRssiStatus(5), 'very bad');
    assert.equal(Utils.getRssiStatus(6), 'very bad');
    assert.equal(Utils.getRssiStatus(-80), 'somewhat bad'); // not < -80, so falls to next condition < -70
    assert.equal(Utils.getRssiStatus(-75), 'somewhat bad');
    assert.equal(Utils.getRssiStatus(-71), 'somewhat bad'); // < -70
    assert.equal(Utils.getRssiStatus(7), 'somewhat bad');
    assert.equal(Utils.getRssiStatus(11), 'somewhat bad');
    assert.equal(Utils.getRssiStatus(-70), 'alright'); // not < -70, so falls to next condition < -60
    assert.equal(Utils.getRssiStatus(-65), 'alright');
    assert.equal(Utils.getRssiStatus(-61), 'alright'); // < -60
    assert.equal(Utils.getRssiStatus(12), 'alright');
    assert.equal(Utils.getRssiStatus(16), 'alright');
    assert.equal(Utils.getRssiStatus(-60), 'good'); // not < -60, so falls to < 0
    assert.equal(Utils.getRssiStatus(-50), 'good');
    assert.equal(Utils.getRssiStatus(-10), 'good');
    assert.equal(Utils.getRssiStatus(-1), 'good'); // < 0
    assert.equal(Utils.getRssiStatus(17), 'good'); // > 16
    assert.equal(Utils.getRssiStatus(100), 'good'); // > 16
    // Test the final fallback
    assert.equal(Utils.getRssiStatus(0), 'none'); // not < 0 and not > 16
    assert.equal(Utils.getRssiStatus(1), 'none');
    assert.equal(Utils.getRssiStatus(2), 'none');
    assert.equal(Utils.getRssiStatus(3), 'none');
  });

  test('convertSignalToRssi converts signal to RSSI', () => {
    assert.equal(Utils.convertSignalToRssi(100), 20);
    assert.equal(Utils.convertSignalToRssi(10), 10);
    assert.equal(Utils.convertSignalToRssi(1), 0);
    assert.equal(Utils.convertSignalToRssi(0.1), -10);
    assert.equal(Utils.convertSignalToRssi(0.01), -20);
  });

  test('convertTargetToSerialNumber converts target bytes to serial number', () => {
    const target = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
    const serialNumber = Utils.convertTargetToSerialNumber(target);
    assert.equal(serialNumber, '010203040506');
  });

  test('convertTargetToSerialNumber handles single digit hex values', () => {
    const target = new Uint8Array([0x00, 0x01, 0x0a, 0x0f, 0x10, 0xff]);
    const serialNumber = Utils.convertTargetToSerialNumber(target);
    assert.equal(serialNumber, '00010a0f10ff');
  });

  test('convertSerialNumberToTarget converts serial number to target bytes', () => {
    const serialNumber = '010203040506';
    const target = Utils.convertSerialNumberToTarget(serialNumber);
    assert.deepEqual(target, new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]));
  });

  test('convertSerialNumberToTarget handles hex letters', () => {
    const serialNumber = 'abcdef123456';
    const target = Utils.convertSerialNumberToTarget(serialNumber);
    assert.deepEqual(target, new Uint8Array([0xab, 0xcd, 0xef, 0x12, 0x34, 0x56]));
  });

  test('convertSerialNumberToTarget throws error for invalid length', () => {
    assert.throws(() => Utils.convertSerialNumberToTarget('12345'), /Invalid serial number/);
    assert.throws(() => Utils.convertSerialNumberToTarget('1234567890123'), /Invalid serial number/);
    assert.throws(() => Utils.convertSerialNumberToTarget(''), /Invalid serial number/);
  });

  test('round trip conversion: target to serial number and back', () => {
    const originalTarget = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe]);
    const serialNumber = Utils.convertTargetToSerialNumber(originalTarget);
    const convertedTarget = Utils.convertSerialNumberToTarget(serialNumber);
    assert.deepEqual(convertedTarget, originalTarget);
  });

  test('round trip conversion: serial number to target and back', () => {
    const originalSerial = 'deadbeefcafe';
    const target = Utils.convertSerialNumberToTarget(originalSerial);
    const convertedSerial = Utils.convertTargetToSerialNumber(target);
    assert.equal(convertedSerial, originalSerial);
  });
});