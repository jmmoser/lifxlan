import type { Device } from './devices.js';
import type { StateGroup } from './encoding.js';

export interface Group {
  label: string;
  uuid: string;
  devices: Device[];
}

export interface GroupsOptions {
  onAdded?: (group: Group) => void;
  onChanged?: (group: Group) => void;
  onRemoved?: (group: Group) => void;
}

export interface GroupsInstance {
  readonly registered: Map<string, Group>;
  register(device: Device, group: StateGroup): void;
  remove(uuid: string): void;
  removeDevice(device: Device): void;
  [Symbol.iterator](): Iterator<Group>;
}

export function Groups(options: GroupsOptions = {}): GroupsInstance {
  const onAdded = options.onAdded;
  const onChanged = options.onChanged;
  const onRemoved = options.onRemoved;

  const knownGroups = new Map<string, Group>();

  function removeGroup(uuid: string) {
    const group = knownGroups.get(uuid);
    if (group) {
      knownGroups.delete(uuid);
      if (onRemoved) {
        onRemoved(group);
      }
    }
  }

  function indexOfDevice(group: Group, device: Device): number {
    for (let i = 0; i < group.devices.length; i += 1) {
      if (group.devices[i] === device) {
        return i;
      }
    }
    return -1;
  }

  return {
    register(device: Device, group: StateGroup) {
      const existingGroup = knownGroups.get(group.group);
      if (existingGroup) {
        if (indexOfDevice(existingGroup, device) < 0) {
          existingGroup.devices.push(device);
          if (onChanged) {
            onChanged(existingGroup);
          }
        }
      } else {
        const newGroup: Group = {
          label: group.label,
          uuid: group.group,
          devices: [device],
        };
        knownGroups.set(group.group, newGroup);
        if (onAdded) {
          onAdded(newGroup);
        }
      }
    },
    remove(uuid: string) {
      removeGroup(uuid);
    },
    removeDevice(device: Device) {
      knownGroups.forEach((group) => {
        const index = indexOfDevice(group, device);
        if (index >= 0) {
          group.devices[index] = group.devices[group.devices.length - 1]!;
          group.devices.pop();
          if (group.devices.length === 0) {
            removeGroup(group.uuid);
          } else if (onChanged) {
            onChanged(group);
          }
        }
      });
    },
    get registered() {
      return knownGroups;
    },
    [Symbol.iterator](): Iterator<Group> {
      return knownGroups.values();
    },
  };
}