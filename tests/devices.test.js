import { describe, test, spyOn, expect } from 'bun:test';
import { Devices, Device } from '../src/devices.js';

describe('devices', () => {
  const sharedDevice = Device({
    serialNumber: 'abcdef123456',
    port: 1234,
    address: '1.2.3.4',
  });

  test('onAdded is called when a device is registered', () => {
    const devicesOptions = {
      onAdded(device) {
        expect(device).toEqual(sharedDevice);
      },
    };
    const onAdded = spyOn(devicesOptions, 'onAdded');
    const devices = Devices(devicesOptions);

    devices.register(sharedDevice.serialNumber, sharedDevice.port, sharedDevice.address, sharedDevice.target);

    expect(onAdded).toHaveBeenCalledTimes(1);
  });

  test('register same device multiple times only one device is registered', () => {
    const devices = Devices();

    devices.register(sharedDevice.serialNumber, sharedDevice.port, sharedDevice.address, sharedDevice.target);
    devices.register(sharedDevice.serialNumber, sharedDevice.port, sharedDevice.address, sharedDevice.target);

    expect(devices.registered.size).toBe(1);
  });

  test('registered device changes address calls onChanged', () => {
    const devicesOptions = {
      onChanged(device) {
        expect(device.address).toEqual(sharedDevice.address + '1');
      },
    };
    const onChanged = spyOn(devicesOptions, 'onChanged');
    const devices = Devices(devicesOptions);

    devices.register(sharedDevice.serialNumber, sharedDevice.port, sharedDevice.address, sharedDevice.target);
    devices.register(sharedDevice.serialNumber, sharedDevice.port, sharedDevice.address + '1', sharedDevice.target);

    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  test('get device resolves to the same device', async () => {
    const devices = Devices();

    const devicePromise = devices.get(sharedDevice.serialNumber);
    expect(Bun.peek(devicePromise)).toEqual(devicePromise);

    devices.register(sharedDevice.serialNumber, sharedDevice.port, sharedDevice.address, sharedDevice.target);

    const device = await devicePromise;
    expect(device).toEqual(sharedDevice);

    const existingDevicePromise = devices.get(sharedDevice.serialNumber);
    expect(Bun.peek(existingDevicePromise)).toEqual(device);
  });

  test('get device with abort signal', async () => {
    const devices = Devices();

    const devicePromise = devices.get(sharedDevice.serialNumber, new AbortController().signal);
    expect(Bun.peek(devicePromise)).toEqual(devicePromise);

    devices.register(sharedDevice.serialNumber, sharedDevice.port, sharedDevice.address, sharedDevice.target);

    const device = await devicePromise;
    expect(device).toEqual(sharedDevice);
  });

  test('get device aborts', async () => {
    const devices = Devices();

    expect(devices.get(sharedDevice.serialNumber, AbortSignal.timeout(0))).rejects.toEqual(new Error('Abort'));
  });

  test('remove device calls onRemoved', () => {
    const devicesOptions = {
      onRemoved(device) {
        expect(device.address).toEqual(sharedDevice.address);
      },
    };

    const onRemoved = spyOn(devicesOptions, 'onRemoved');

    const devices = Devices(devicesOptions);

    devices.register(sharedDevice.serialNumber, sharedDevice.port, sharedDevice.address, sharedDevice.target);
    expect(devices.registered.size).toBe(1);

    devices.remove(sharedDevice.serialNumber);
    expect(devices.registered.size).toBe(0);

    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  test('multiple pending gets are handled when one is aborted', async () => {
    const devices = Devices();

    // Start multiple gets for the same device
    const controller1 = new AbortController();
    const controller2 = new AbortController();
    
    const promise1 = devices.get(sharedDevice.serialNumber, controller1.signal);
    const promise2 = devices.get(sharedDevice.serialNumber, controller2.signal);

    // Abort the first one
    controller1.abort();

    // Register the device
    devices.register(sharedDevice.serialNumber, sharedDevice.port, sharedDevice.address, sharedDevice.target);

    // First should reject, second should resolve
    await expect(promise1).rejects.toEqual(new Error('Abort'));
    const device = await promise2;
    expect(device).toEqual(sharedDevice);
  });

  test('get device timeout without signal', async () => {
    const devices = Devices({ defaultTimeoutMs: 10 });
    
    // Get device without registering it, should timeout
    const promise = devices.get('nonexistent');
    await expect(promise).rejects.toThrow('Timeout');
  });

  test('Device factory with default port and target', () => {
    const device = Device({
      address: '192.168.1.100',
      serialNumber: 'abcdef123456'
    });

    expect(device.port).toBe(56700); // Default PORT from constants
    expect(device.sequence).toBe(0);
    expect(device.target).toBeDefined();
    expect(device.address).toBe('192.168.1.100');
    expect(device.serialNumber).toBe('abcdef123456');
  });

  test('Device factory with custom port and target', () => {
    const customTarget = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const device = Device({
      address: '192.168.1.100',
      port: 12345,
      target: customTarget
    });

    expect(device.port).toBe(12345);
    expect(device.target).toBe(customTarget);
    expect(device.sequence).toBe(0);
  });

  test('remove non-existent device returns false', () => {
    const devices = Devices();
    
    const removed = devices.remove('nonexistent');
    expect(removed).toBe(false);
  });

  test('get device with AbortError', async () => {
    const devices = Devices();
    const controller = new AbortController();
    
    const promise = devices.get('test-device', controller.signal);
    controller.abort();
    
    expect(promise).rejects.toThrow('Abort');
  });
});
