import { describe, test, spyOn, expect } from 'bun:test';
import assert from 'node:assert';
import { Devices, Device } from '../src/devices.js';

describe('devices', () => {
  const sharedDevice = Device({
    serialNumber: 'abcdef123456',
    port: 1234,
    address: '1.2.3.4',
  });

  test('onAdded is called when a device is registered', () => {
    const devicesOptions = {
      onAdded(device: Device) {
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
      onChanged(device: Device) {
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

    await expect(devices.get(sharedDevice.serialNumber, AbortSignal.timeout(0))).rejects.toThrow('device lookup was aborted');
  });

  test('remove device calls onRemoved', () => {
    const devicesOptions = {
      onRemoved(device: Device) {
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
    await expect(promise1).rejects.toThrow('device lookup was aborted');
    const device = await promise2;
    expect(device).toEqual(sharedDevice);
  });

  test('get device timeout without signal', async () => {
    const devices = Devices({ defaultTimeoutMs: 10 });
    
    // Get device without registering it, should timeout
    const promise = devices.get('nonexistent');
    await expect(promise).rejects.toThrow('device discovery timed out');
  });

  test('Devices.register tolerates a throwing onAdded callback', () => {
    const devices = Devices({
      onAdded() { throw new Error('user bug'); },
    });

    // Must not throw
    devices.register('abcdef123456', 56700, '1.2.3.4');
    expect(devices.registered.size).toBe(1);
  });

  test('Devices.register tolerates a throwing onChanged callback', () => {
    let added: Device | undefined;
    const devices = Devices({
      onAdded(d) { added = d; },
      onChanged() { throw new Error('user bug'); },
    });

    devices.register('abcdef123456', 56700, '1.2.3.4');
    expect(() => devices.register('abcdef123456', 56700, '5.6.7.8')).not.toThrow();
    expect(added).toBeDefined();
    expect(added!.address).toBe('5.6.7.8');
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

  test('remove() drops the resolver set so a later register does not satisfy the dropped promise', async () => {
    const devices = Devices({ defaultTimeoutMs: 60000 });

    const c = new AbortController();
    const p = devices.get('abcdef123456', c.signal);

    // remove() before registration: drop the pending resolver state.
    devices.remove('abcdef123456'); // returns false but should clear deviceResolvers entry

    // Registering now must NOT resolve the dropped promise; the caller's
    // abort/timeout is still the only thing that will settle it.
    devices.register('abcdef123456', 56700, '1.2.3.4');

    c.abort();
    await assert.rejects(p, /aborted/);
  });

  test('aborted get does not block subsequent get for same serial number', async () => {
    const devices = Devices({ defaultTimeoutMs: 60000 });

    const c1 = new AbortController();
    const c2 = new AbortController();
    const p1 = devices.get('abcdef123456', c1.signal);
    const p2 = devices.get('abcdef123456', c2.signal);

    c1.abort();
    await assert.rejects(p1, /aborted/);

    // p2 must still resolve when the device registers — the c1 abort must
    // only have removed its own resolver, not p2's.
    devices.register('abcdef123456', 56700, '192.168.1.1');
    const device = await p2;
    expect(device.serialNumber).toBe('abcdef123456');
  });

  test('get device with AbortError', async () => {
    const devices = Devices();
    const controller = new AbortController();
    
    const promise = devices.get('test-device', controller.signal);
    controller.abort();
    
    expect(promise).rejects.toThrow('device lookup was aborted');
  });

  test('Device factory validates address is required', () => {
    expect(() => Device({ } as any)).toThrow('Invalid address: undefined (is required)');
    expect(() => Device({ address: '' } as any)).toThrow('Invalid address:  (is required)');
  });

  test('Device factory validates port range', () => {
    expect(() => Device({ 
      address: '192.168.1.1', 
      port: 0 
    })).toThrow('Invalid port: 0 (must be between 1 and 65535)');
    
    expect(() => Device({ 
      address: '192.168.1.1', 
      port: 65536 
    })).toThrow('Invalid port: 65536 (must be between 1 and 65535)');
    
    expect(() => Device({ 
      address: '192.168.1.1', 
      port: -1 
    })).toThrow('Invalid port: -1 (must be between 1 and 65535)');
  });

  test('Device factory validates sequence range', () => {
    expect(() => Device({ 
      address: '192.168.1.1', 
      sequence: -1 
    })).toThrow('Invalid sequence: -1 (must be between 0 and 254)');
    
    expect(() => Device({ 
      address: '192.168.1.1', 
      sequence: 255 
    })).toThrow('Invalid sequence: 255 (must be between 0 and 254)');
  });

  test('Device factory allows valid values', () => {
    const device = Device({
      address: '192.168.1.1',
      port: 56700,
      sequence: 100,
      serialNumber: 'abcdef123456'
    });

    expect(device.address).toBe('192.168.1.1');
    expect(device.port).toBe(56700);
    expect(device.sequence).toBe(100);
    expect(device.serialNumber).toBe('abcdef123456');
  });

  test('Devices can be iterated with for...of loop', () => {
    const devices = Devices();
    
    const device1 = Device({
      address: '192.168.1.1',
      serialNumber: 'deadbeef1234'
    });
    
    const device2 = Device({
      address: '192.168.1.2', 
      serialNumber: 'cafebabe5678'
    });

    devices.register(device1.serialNumber, device1.port, device1.address, device1.target);
    devices.register(device2.serialNumber, device2.port, device2.address, device2.target);

    const iteratedDevices: Device[] = [];
    for (const device of devices) {
      iteratedDevices.push(device);
    }

    expect(iteratedDevices).toHaveLength(2);
    expect(iteratedDevices.some(d => d.serialNumber === 'deadbeef1234')).toBe(true);
    expect(iteratedDevices.some(d => d.serialNumber === 'cafebabe5678')).toBe(true);
  });

  test('Devices iterator works with empty collection', () => {
    const devices = Devices();
    
    const iteratedDevices: Device[] = [];
    for (const device of devices) {
      iteratedDevices.push(device);
    }

    expect(iteratedDevices).toHaveLength(0);
  });

  test('Devices iterator reflects changes when devices are added', () => {
    const devices = Devices();
    
    let iteratedDevices: Device[] = [];
    for (const device of devices) {
      iteratedDevices.push(device);
    }
    expect(iteratedDevices).toHaveLength(0);

    const device1 = Device({
      address: '192.168.1.1',
      serialNumber: 'deadbeef1234'
    });

    devices.register(device1.serialNumber, device1.port, device1.address, device1.target);

    iteratedDevices = [];
    for (const device of devices) {
      iteratedDevices.push(device);
    }
    expect(iteratedDevices).toHaveLength(1);
    expect(iteratedDevices[0]!.serialNumber).toBe('deadbeef1234');
  });

  test('Devices iterator reflects changes when devices are removed', () => {
    const devices = Devices();
    
    const device1 = Device({
      address: '192.168.1.1',
      serialNumber: 'deadbeef1234'
    });
    
    const device2 = Device({
      address: '192.168.1.2',
      serialNumber: 'cafebabe5678'  
    });

    devices.register(device1.serialNumber, device1.port, device1.address, device1.target);
    devices.register(device2.serialNumber, device2.port, device2.address, device2.target);

    let iteratedDevices: Device[] = [];
    for (const device of devices) {
      iteratedDevices.push(device);
    }
    expect(iteratedDevices).toHaveLength(2);

    devices.remove('deadbeef1234');

    iteratedDevices = [];
    for (const device of devices) {
      iteratedDevices.push(device);
    }
    expect(iteratedDevices).toHaveLength(1);
    expect(iteratedDevices[0]!.serialNumber).toBe('cafebabe5678');
  });

  test('Devices iterator can be used with Array.from', () => {
    const devices = Devices();
    
    const device1 = Device({
      address: '192.168.1.1',
      serialNumber: 'deadbeef1234'
    });
    
    const device2 = Device({
      address: '192.168.1.2',
      serialNumber: 'cafebabe5678'
    });

    devices.register(device1.serialNumber, device1.port, device1.address, device1.target);
    devices.register(device2.serialNumber, device2.port, device2.address, device2.target);

    const deviceArray = Array.from(devices);
    expect(deviceArray).toHaveLength(2);
    expect(deviceArray.some(d => d.serialNumber === 'deadbeef1234')).toBe(true);
    expect(deviceArray.some(d => d.serialNumber === 'cafebabe5678')).toBe(true);
  });

  test('Devices iterator can be used with destructuring', () => {
    const devices = Devices();
    
    const device1 = Device({
      address: '192.168.1.1',
      serialNumber: 'deadbeef1234'
    });
    
    const device2 = Device({
      address: '192.168.1.2',
      serialNumber: 'cafebabe5678'
    });

    devices.register(device1.serialNumber, device1.port, device1.address, device1.target);
    devices.register(device2.serialNumber, device2.port, device2.address, device2.target);

    const [...deviceArray] = devices;
    expect(deviceArray).toHaveLength(2);
    expect(deviceArray.some(d => d.serialNumber === 'deadbeef1234')).toBe(true);
    expect(deviceArray.some(d => d.serialNumber === 'cafebabe5678')).toBe(true);
  });
});