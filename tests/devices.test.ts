import { describe, test, spyOn, expect } from 'bun:test';
import assert from 'node:assert';
import { Devices, Device, type RegistrationMessage } from '../src/devices.js';
import { received } from './helpers.js';

describe('devices', () => {
  const sharedDevice = Device({
    serialNumber: 'abcdef123456',
    port: 1234,
    address: '1.2.3.4',
  });

  test('Device rejects targets that are not 6 or 8 bytes', () => {
    // A wrong-length target would silently derive a serial number that can
    // never match an inbound response, so it must fail fast instead.
    assert.throws(
      () => Device({ address: '1.2.3.4', target: new Uint8Array(20) }),
      (error: unknown) => Error.isError(error) && error.name === 'ValidationError',
    );
    assert.throws(
      () => Device({ address: '1.2.3.4', target: new Uint8Array(0) }),
      (error: unknown) => Error.isError(error) && error.name === 'ValidationError',
    );
  });

  test('Device derives the serial number from the first 6 bytes of an 8-byte target', () => {
    // The wire target field is 8 bytes: 6-byte serial + 2 reserved bytes.
    const device = Device({
      address: '1.2.3.4',
      target: new Uint8Array([0xd0, 0x73, 0xd5, 0x12, 0x34, 0x56, 0x00, 0x00]),
    });
    assert.equal(device.serialNumber, 'd073d5123456');
    assert.equal(device.target.length, 8);
  });

  test('onAdded is called when a device is registered', () => {
    const devicesOptions = {
      onAdded(device: Device) {
        expect(device).toEqual(sharedDevice);
      },
    };
    const onAdded = spyOn(devicesOptions, 'onAdded');
    const devices = Devices(devicesOptions);

    devices.register(sharedDevice.port, sharedDevice.address, received(sharedDevice.serialNumber));

    expect(onAdded).toHaveBeenCalledTimes(1);
  });

  test('register same device multiple times only one device is registered', () => {
    const devices = Devices();

    devices.register(sharedDevice.port, sharedDevice.address, received(sharedDevice.serialNumber));
    devices.register(sharedDevice.port, sharedDevice.address, received(sharedDevice.serialNumber));

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

    devices.register(sharedDevice.port, sharedDevice.address, received(sharedDevice.serialNumber));
    devices.register(sharedDevice.port, sharedDevice.address + '1', received(sharedDevice.serialNumber));

    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  test('get device resolves to the same device', async () => {
    const devices = Devices();

    const devicePromise = devices.get(sharedDevice.serialNumber);
    expect(Bun.peek(devicePromise)).toEqual(devicePromise);

    devices.register(sharedDevice.port, sharedDevice.address, received(sharedDevice.serialNumber));

    const device = await devicePromise;
    expect(device).toEqual(sharedDevice);

    const existingDevicePromise = devices.get(sharedDevice.serialNumber);
    expect(Bun.peek(existingDevicePromise)).toEqual(device);
  });

  test('get device with abort signal', async () => {
    const devices = Devices();

    const devicePromise = devices.get(sharedDevice.serialNumber, { signal: new AbortController().signal });
    expect(Bun.peek(devicePromise)).toEqual(devicePromise);

    devices.register(sharedDevice.port, sharedDevice.address, received(sharedDevice.serialNumber));

    const device = await devicePromise;
    expect(device).toEqual(sharedDevice);
  });

  test('get device aborts', async () => {
    const devices = Devices();

    // Rejects with the signal's reason (a DOMException named TimeoutError here).
    await assert.rejects(
      devices.get(sharedDevice.serialNumber, { signal: AbortSignal.timeout(0) }),
      (error) => error instanceof DOMException && error.name === 'TimeoutError',
    );
  });

  test('remove device calls onRemoved', () => {
    const devicesOptions = {
      onRemoved(device: Device) {
        expect(device.address).toEqual(sharedDevice.address);
      },
    };

    const onRemoved = spyOn(devicesOptions, 'onRemoved');

    const devices = Devices(devicesOptions);

    devices.register(sharedDevice.port, sharedDevice.address, received(sharedDevice.serialNumber));
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
    
    const promise1 = devices.get(sharedDevice.serialNumber, { signal: controller1.signal });
    const promise2 = devices.get(sharedDevice.serialNumber, { signal: controller2.signal });

    // Abort the first one
    controller1.abort();

    // Register the device
    devices.register(sharedDevice.port, sharedDevice.address, received(sharedDevice.serialNumber));

    // First should reject, second should resolve
    await expect(promise1).rejects.toThrow('aborted');
    const device = await promise2;
    expect(device).toEqual(sharedDevice);
  });

  test('get device timeout without signal', async () => {
    const devices = Devices({ defaultTimeoutMs: 10 });

    // Get device without registering it, should timeout
    const promise = devices.get('nonexistent');
    await expect(promise).rejects.toThrow('device discovery timed out');
  });

  test('get device times out even when a signal is provided', async () => {
    const devices = Devices({ defaultTimeoutMs: 10 });

    // The signal never aborts; the timeout must still settle the promise
    // instead of hanging forever.
    const promise = devices.get('nonexistent', { signal: new AbortController().signal });
    await expect(promise).rejects.toThrow('device discovery timed out');
  });

  test('get device per-call timeoutMs overrides the default', async () => {
    const devices = Devices({ defaultTimeoutMs: 60000 });

    const promise = devices.get('nonexistent', { timeoutMs: 10 });
    await expect(promise).rejects.toThrow('device discovery timed out after 10ms');
  });

  test('get device with pre-aborted signal rejects immediately', async () => {
    const devices = Devices({ defaultTimeoutMs: 0 });

    const reason = new Error('already cancelled');
    await assert.rejects(
      devices.get('nonexistent', { signal: AbortSignal.abort(reason) }),
      (error) => error === reason,
    );

    // The rejected lookup must not have left a resolver behind.
    devices.register(56700, '1.2.3.4', received('abcdef123456'));
  });

  test('get device with pre-aborted signal rejects even when the device is known', async () => {
    const devices = Devices({ defaultTimeoutMs: 0 });
    devices.register(sharedDevice.port, sharedDevice.address, received(sharedDevice.serialNumber));

    // Abort wins over the cache: the caller explicitly cancelled.
    const reason = new Error('already cancelled');
    await assert.rejects(
      devices.get(sharedDevice.serialNumber, { signal: AbortSignal.abort(reason) }),
      (error) => error === reason,
    );
  });

  test('get device rejects with the abort reason', async () => {
    const devices = Devices({ defaultTimeoutMs: 0 });

    const controller = new AbortController();
    const promise = devices.get('nonexistent', { signal: controller.signal });

    const reason = new Error('user cancelled');
    controller.abort(reason);

    await assert.rejects(promise, (error) => error === reason);
  });

  test('Devices.register tolerates a throwing onAdded callback', () => {
    const devices = Devices({
      onAdded() { throw new Error('user bug'); },
    });

    // Must not throw
    devices.register(56700, '1.2.3.4', received('abcdef123456'));
    expect(devices.registered.size).toBe(1);
  });

  test('Devices.register tolerates a throwing onChanged callback', () => {
    let added: Device | undefined;
    const devices = Devices({
      onAdded(d) { added = d; },
      onChanged() { throw new Error('user bug'); },
    });

    devices.register(56700, '1.2.3.4', received('abcdef123456'));
    expect(() => devices.register(56700, '5.6.7.8', received('abcdef123456'))).not.toThrow();
    expect(added).toBeDefined();
    expect(added!.address).toBe('5.6.7.8');
  });

  test('Device factory with default port and target', () => {
    const device = Device({
      address: '192.168.1.100',
      serialNumber: 'abcdef123456'
    });

    expect(device.port).toBe(56700); // Default PORT from constants
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
  });

  test('remove non-existent device returns false', () => {
    const devices = Devices();
    
    const removed = devices.remove('nonexistent');
    expect(removed).toBe(false);
  });

  test('remove() drops the resolver set so a later register does not satisfy the dropped promise', async () => {
    const devices = Devices({ defaultTimeoutMs: 60000 });

    const c = new AbortController();
    const p = devices.get('abcdef123456', { signal: c.signal });

    // remove() before registration: drop the pending resolver state.
    devices.remove('abcdef123456'); // returns false but should clear deviceResolvers entry

    // Registering now must NOT resolve the dropped promise; the caller's
    // abort/timeout is still the only thing that will settle it.
    devices.register(56700, '1.2.3.4', received('abcdef123456'));

    c.abort();
    await assert.rejects(p, /aborted/);
  });

  test('a stale waiter settling after remove() does not drop a newer waiter for the same serial', async () => {
    const devices = Devices({ defaultTimeoutMs: 60000 });

    // Waiter A's resolver lands in a set that remove() then orphans.
    const c1 = new AbortController();
    const p1 = devices.get('abcdef123456', { signal: c1.signal });
    devices.remove('abcdef123456');

    // Waiter B registers a fresh resolver set for the same serial.
    const p2 = devices.get('abcdef123456');

    // A settles late — it must not delete B's resolver set on its way out.
    c1.abort();
    await assert.rejects(p1, /aborted/);

    devices.register(56700, '192.168.1.1', received('abcdef123456'));
    const device = await p2;
    expect(device.serialNumber).toBe('abcdef123456');
  });

  test('aborted get does not block subsequent get for same serial number', async () => {
    const devices = Devices({ defaultTimeoutMs: 60000 });

    const c1 = new AbortController();
    const c2 = new AbortController();
    const p1 = devices.get('abcdef123456', { signal: c1.signal });
    const p2 = devices.get('abcdef123456', { signal: c2.signal });

    c1.abort();
    await assert.rejects(p1, /aborted/);

    // p2 must still resolve when the device registers — the c1 abort must
    // only have removed its own resolver, not p2's.
    devices.register(56700, '192.168.1.1', received('abcdef123456'));
    const device = await p2;
    expect(device.serialNumber).toBe('abcdef123456');
  });

  test('get device with AbortError', async () => {
    const devices = Devices();
    const controller = new AbortController();
    
    const promise = devices.get('test-device', { signal: controller.signal });
    controller.abort();
    
    expect(promise).rejects.toThrow('aborted');
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

  test('Device factory allows valid values', () => {
    const device = Device({
      address: '192.168.1.1',
      port: 56700,
      serialNumber: 'abcdef123456'
    });

    expect(device.address).toBe('192.168.1.1');
    expect(device.port).toBe(56700);
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

    devices.register(device1.port, device1.address, received(device1.serialNumber));
    devices.register(device2.port, device2.address, received(device2.serialNumber));

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

    devices.register(device1.port, device1.address, received(device1.serialNumber));

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

    devices.register(device1.port, device1.address, received(device1.serialNumber));
    devices.register(device2.port, device2.address, received(device2.serialNumber));

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

    devices.register(device1.port, device1.address, received(device1.serialNumber));
    devices.register(device2.port, device2.address, received(device2.serialNumber));

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

    devices.register(device1.port, device1.address, received(device1.serialNumber));
    devices.register(device2.port, device2.address, received(device2.serialNumber));

    const [...deviceArray] = devices;
    expect(deviceArray).toHaveLength(2);
    expect(deviceArray.some(d => d.serialNumber === 'deadbeef1234')).toBe(true);
    expect(deviceArray.some(d => d.serialNumber === 'cafebabe5678')).toBe(true);
  });
});
describe('devices subscribe', () => {
  test('subscriber callbacks fire alongside constructor callbacks', () => {
    const constructorEvents: string[] = [];
    const subscriberEvents: string[] = [];
    const devices = Devices({
      onAdded(device) { constructorEvents.push(`added:${device.serialNumber}`); },
      onChanged(device) { constructorEvents.push(`changed:${device.serialNumber}`); },
      onRemoved(device) { constructorEvents.push(`removed:${device.serialNumber}`); },
    });
    devices.subscribe({
      onAdded(device) { subscriberEvents.push(`added:${device.serialNumber}`); },
      onChanged(device) { subscriberEvents.push(`changed:${device.serialNumber}`); },
      onRemoved(device) { subscriberEvents.push(`removed:${device.serialNumber}`); },
    });

    devices.register(56700, '10.0.0.1', received('d073d5aa0001'));
    devices.register(56700, '10.0.0.2', received('d073d5aa0001'));
    devices.remove('d073d5aa0001');

    const expected = ['added:d073d5aa0001', 'changed:d073d5aa0001', 'removed:d073d5aa0001'];
    expect(constructorEvents).toEqual(expected);
    expect(subscriberEvents).toEqual(expected);
  });

  test('unsubscribe stops notifications and is idempotent', () => {
    const events: string[] = [];
    const devices = Devices();
    const unsubscribe = devices.subscribe({
      onAdded(device) { events.push(device.serialNumber); },
    });

    devices.register(56700, '10.0.0.1', received('d073d5aa0001'));
    unsubscribe();
    unsubscribe();
    devices.register(56700, '10.0.0.2', received('d073d5aa0002'));

    expect(events).toEqual(['d073d5aa0001']);
  });

  test('a throwing subscriber does not block other subscribers', () => {
    const events: string[] = [];
    const devices = Devices();
    devices.subscribe({
      onAdded() { throw new Error('subscriber bug'); },
    });
    devices.subscribe({
      onAdded(device) { events.push(device.serialNumber); },
    });

    devices.register(56700, '10.0.0.1', received('d073d5aa0001'));

    expect(events).toEqual(['d073d5aa0001']);
    expect(devices.registered.size).toBe(1);
  });

  test('subscribing the same function twice invokes it twice and removes independently', () => {
    const events: string[] = [];
    const devices = Devices();
    const handler = (device: Device) => { events.push(device.serialNumber); };
    const unsubscribeFirst = devices.subscribe({ onAdded: handler });
    devices.subscribe({ onAdded: handler });

    devices.register(56700, '10.0.0.1', received('d073d5aa0001'));
    expect(events).toEqual(['d073d5aa0001', 'd073d5aa0001']);

    unsubscribeFirst();
    devices.register(56700, '10.0.0.2', received('d073d5aa0002'));
    expect(events).toEqual(['d073d5aa0001', 'd073d5aa0001', 'd073d5aa0002']);
  });

  test('subscribing from within a handler does not fire for the in-progress event', () => {
    const events: string[] = [];
    const devices = Devices();
    devices.subscribe({
      onAdded() {
        devices.subscribe({ onAdded: (device) => events.push(`late:${device.serialNumber}`) });
      },
    });

    devices.register(56700, '10.0.0.1', received('d073d5aa0001'));
    expect(events).toEqual([]);

    devices.register(56700, '10.0.0.2', received('d073d5aa0002'));
    expect(events).toEqual(['late:d073d5aa0002']);
  });

  test('unsubscribing a not-yet-run handler from within a handler skips it for the in-progress event', () => {
    const events: string[] = [];
    const devices = Devices();
    let unsubscribeSecond = () => {};
    devices.subscribe({
      onAdded(device) {
        events.push(`first:${device.serialNumber}`);
        unsubscribeSecond(); // remove the second handler before it runs
      },
    });
    unsubscribeSecond = devices.subscribe({
      onAdded(device) { events.push(`second:${device.serialNumber}`); },
    });

    devices.register(56700, '10.0.0.1', received('d073d5aa0001'));
    // 'second' was unsubscribed during dispatch before running, so it is skipped.
    expect(events).toEqual(['first:d073d5aa0001']);
  });

  test('a handler that unsubscribes itself still completes the in-progress event but not the next', () => {
    const events: string[] = [];
    const devices = Devices();
    let unsubscribeSelf = () => {};
    unsubscribeSelf = devices.subscribe({
      onAdded(device) {
        events.push(device.serialNumber);
        unsubscribeSelf();
      },
    });

    devices.register(56700, '10.0.0.1', received('d073d5aa0001'));
    devices.register(56700, '10.0.0.2', received('d073d5aa0002'));
    expect(events).toEqual(['d073d5aa0001']);
  });

  test('distinct subscriptions are independent', () => {
    const a: string[] = [];
    const b: string[] = [];
    const devices = Devices();
    const unsubscribeA = devices.subscribe({ onAdded: (device) => a.push(device.serialNumber) });
    devices.subscribe({ onAdded: (device) => b.push(device.serialNumber) });

    devices.register(56700, '10.0.0.1', received('d073d5aa0001'));
    unsubscribeA();
    devices.register(56700, '10.0.0.2', received('d073d5aa0002'));

    expect(a).toEqual(['d073d5aa0001']);
    expect(b).toEqual(['d073d5aa0001', 'd073d5aa0002']);
  });

  describe('register(port, address, received)', () => {
    const target = new Uint8Array([0xd0, 0x73, 0xd5, 0xaa, 0x00, 0x01]);

    test('registers the device a receive() result came from', () => {
      const devices = Devices();

      const device = devices.register(56700, '10.0.0.7', received('d073d5aa0001'));

      expect(device?.serialNumber).toBe('d073d5aa0001');
      expect(device?.address).toBe('10.0.0.7');
      expect(device?.port).toBe(56700);
      expect(devices.registered.get('d073d5aa0001')).toBe(device);
    });

    test('derives the target from the received header', () => {
      const devices = Devices();
      const device = devices.register(56700, '10.0.0.7', received('d073d5aa0001'));
      expect(device?.target).toEqual(target);
    });

    test('a known device that moves address updates in place and emits onChanged', () => {
      const changed: string[] = [];
      const devices = Devices({ onChanged: (device) => changed.push(device.address) });

      devices.register(56700, '10.0.0.7', received('d073d5aa0001'));
      const moved = devices.register(56700, '10.0.0.9', received('d073d5aa0001'));

      expect(moved?.address).toBe('10.0.0.9');
      expect(devices.registered.size).toBe(1);
      expect(changed).toEqual(['10.0.0.9']);
    });

    test('accepts a minimal RegistrationMessage from a custom decode pipeline', () => {
      // register() reads only these two fields, so a custom decode pipeline
      // can drive the registry without fabricating a full ReceivedMessage.
      const devices = Devices();
      const message: RegistrationMessage = {
        serialNumber: 'd073d5aa0001',
        header: { target },
      };

      const device = devices.register(56700, '10.0.0.7', message);

      expect(device?.serialNumber).toBe('d073d5aa0001');
      expect(device?.target).toEqual(target);
      expect(devices.registered.get('d073d5aa0001')).toBe(device);
    });

    test('an undefined result (malformed packet) registers nothing', () => {
      const added: string[] = [];
      const devices = Devices({ onAdded: (device) => added.push(device.serialNumber) });

      const device = devices.register(56700, '10.0.0.7', undefined);

      expect(device).toBeUndefined();
      expect(devices.registered.size).toBe(0);
      expect(added).toEqual([]);
    });
  });
});
