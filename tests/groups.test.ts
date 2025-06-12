import { describe, test, spyOn, expect } from 'bun:test';
import { Groups } from '../src/groups.js';
import { Device } from '../src/devices.js';
import assert from 'node:assert';

describe('groups', () => {
  const device1 = Device({
    serialNumber: 'abcdef123456',
    port: 56700,
    address: '192.168.1.100',
  });

  const device2 = Device({
    serialNumber: 'fedcba654321',
    port: 56700,
    address: '192.168.1.101',
  });

  const groupData = {
    group: '4e0352bf19944ff2b4251c4455479f33',
    label: 'Living Room',
    updatedAt: new Date('2023-01-01T00:00:00Z'),
  };

  test('register new group calls onAdded', () => {
    const groupsOptions = {
      onAdded(group: any) {
        expect(group.uuid).toEqual(groupData.group);
        expect(group.label).toEqual(groupData.label);
        expect(group.devices).toEqual([device1]);
      },
    };
    const onAdded = spyOn(groupsOptions, 'onAdded');
    const groups = Groups(groupsOptions);

    groups.register(device1, groupData);

    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(groups.registered.size).toBe(1);
  });

  test('register device to existing group calls onChanged', () => {
    const groupsOptions = {
      onAdded() {},
      onChanged(group: any) {
        expect(group.devices.length).toBe(2);
        expect(group.devices).toContain(device1);
        expect(group.devices).toContain(device2);
      },
    };
    const onChanged = spyOn(groupsOptions, 'onChanged');
    const groups = Groups(groupsOptions);

    groups.register(device1, groupData);
    groups.register(device2, groupData);

    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(groups.registered.size).toBe(1);
  });

  test('register same device to same group does not call onChanged', () => {
    const groupsOptions = {
      onAdded() {},
      onChanged() {},
    };
    const onChanged = spyOn(groupsOptions, 'onChanged');
    const groups = Groups(groupsOptions);

    groups.register(device1, groupData);
    groups.register(device1, groupData); // Same device again

    expect(onChanged).toHaveBeenCalledTimes(0);
    const group = groups.registered.get(groupData.group);
    assert.ok(group);
    expect(group.devices.length).toBe(1);
  });

  test('remove group calls onRemoved', () => {
    const groupsOptions = {
      onAdded() {},
      onRemoved(group: any) {
        expect(group.uuid).toEqual(groupData.group);
        expect(group.label).toEqual(groupData.label);
      },
    };
    const onRemoved = spyOn(groupsOptions, 'onRemoved');
    const groups = Groups(groupsOptions);

    groups.register(device1, groupData);
    expect(groups.registered.size).toBe(1);

    groups.remove(groupData.group);
    expect(groups.registered.size).toBe(0);
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  test('remove non-existent group does not call onRemoved', () => {
    const groupsOptions = {
      onRemoved() {},
    };
    const onRemoved = spyOn(groupsOptions, 'onRemoved');
    const groups = Groups(groupsOptions);

    groups.remove('non-existent-uuid');
    expect(onRemoved).toHaveBeenCalledTimes(0);
  });

  test('removeDevice from group with multiple devices calls onChanged', () => {
    let onChangedCalled = false;
    const groupsOptions = {
      onAdded() {},
      onChanged(group: any) {
        // This will be called after removeDevice
        if (onChangedCalled) {
          expect(group.devices.length).toBe(1);
          expect(group.devices).toContain(device1);
          expect(group.devices).not.toContain(device2);
        }
      },
    };
    const onChanged = spyOn(groupsOptions, 'onChanged');
    const groups = Groups(groupsOptions);

    groups.register(device1, groupData);
    groups.register(device2, groupData);
    const group = groups.registered.get(groupData.group);
    assert.ok(group);
    expect(group.devices.length).toBe(2);

    // Clear calls from registration, only track removeDevice call
    onChanged.mockClear();
    onChangedCalled = true;
    groups.removeDevice(device2);

    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(groups.registered.size).toBe(1);
    expect(group.devices.length).toBe(1);
  });

  test('removeDevice from group with single device removes group', () => {
    const groupsOptions = {
      onAdded() {},
      onRemoved(group: any) {
        expect(group.uuid).toEqual(groupData.group);
      },
    };
    const onRemoved = spyOn(groupsOptions, 'onRemoved');
    const groups = Groups(groupsOptions);

    groups.register(device1, groupData);
    expect(groups.registered.size).toBe(1);

    groups.removeDevice(device1);
    expect(groups.registered.size).toBe(0);
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  test('removeDevice that is not in any group does nothing', () => {
    const groupsOptions = {
      onChanged() {},
      onRemoved() {},
    };
    const onChanged = spyOn(groupsOptions, 'onChanged');
    const onRemoved = spyOn(groupsOptions, 'onRemoved');
    const groups = Groups(groupsOptions);

    groups.register(device1, groupData);
    groups.removeDevice(device2); // device2 is not in the group

    expect(onChanged).toHaveBeenCalledTimes(0);
    expect(onRemoved).toHaveBeenCalledTimes(0);
    expect(groups.registered.size).toBe(1);
  });

  test('Groups without options', () => {
    const groups = Groups();
    
    groups.register(device1, groupData);
    expect(groups.registered.size).toBe(1);
    
    groups.remove(groupData.group);
    expect(groups.registered.size).toBe(0);
  });

  test('Groups with undefined options', () => {
    const groups = Groups(undefined);
    
    groups.register(device1, groupData);
    expect(groups.registered.size).toBe(1);
    
    groups.removeDevice(device1);
    expect(groups.registered.size).toBe(0);
  });

  test('multiple groups with different devices', () => {
    const groupData2 = {
      group: 'different-uuid-here-1234567890',
      label: 'Kitchen',
      updatedAt: new Date('2023-01-02T00:00:00Z'),
    };

    const groups = Groups();

    groups.register(device1, groupData);
    groups.register(device2, groupData2);

    expect(groups.registered.size).toBe(2);
    const group1 = groups.registered.get(groupData.group);
    const group2 = groups.registered.get(groupData2.group);
    assert.ok(group1);
    assert.ok(group2);
    expect(group1.devices).toEqual([device1]);
    expect(group2.devices).toEqual([device2]);
  });

  test('device removal preserves group when multiple devices remain', () => {
    const device3 = Device({
      serialNumber: '111111111111',
      port: 56700,
      address: '192.168.1.102',
    });

    const groups = Groups();

    groups.register(device1, groupData);
    groups.register(device2, groupData);
    groups.register(device3, groupData);

    const group = groups.registered.get(groupData.group);
    assert.ok(group);

    expect(group.devices.length).toBe(3);

    groups.removeDevice(device2);

    expect(groups.registered.size).toBe(1);
    expect(group.devices.length).toBe(2);
    expect(group.devices).toContain(device1);
    expect(group.devices).toContain(device3);
    expect(group.devices).not.toContain(device2);
  });
});