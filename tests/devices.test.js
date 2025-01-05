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
});
