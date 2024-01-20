/**
 * @typedef {{
 *   label: string;
 *   uuid: string;
 *   devices: import('./devices').Device[];
 * }} Group
 */

/**
 * @param {{
 *   onAdded?: (group: Group) => void;
 *   onChanged?: (group: Group) => void;
 *   onRemoved?: (group: Group) => void;
 * }} [options]
 */
export function Groups(options) {
  const onAdded = options?.onAdded;
  const onChanged = options?.onChanged;
  const onRemoved = options?.onRemoved;

  /**
   * @type {Map<string, Group>}
   */
  const knownGroups = new Map();

  /**
   * @param {string} group
   */
  function removeGroup(group) {
    const existing = knownGroups.get(group);
    if (existing) {
      knownGroups.delete(group);
      if (onRemoved) {
        onRemoved(existing);
      }
    }
  }

  /**
   * @param {Group} group
   * @param {import('./devices').Device} device
   */
  function deviceIndexOf(group, device) {
    for (let i = 0; i < group.devices.length; i += 1) {
      if (group.devices[i] === device) {
        return i;
      }
    }
    return -1;
  }

  return {
    /**
     * @param {import('./devices').Device} device
     * @param {ReturnType<typeof import('./encoding').decodeStateGroup>} group
     */
    register(device, group) {
      const existingGroup = knownGroups.get(group.group);
      if (existingGroup) {
        if (deviceIndexOf(existingGroup, device) < 0) {
          existingGroup.devices.push(device);
          if (onChanged) {
            onChanged(existingGroup);
          }
        }
      } else {
        const newGroup = /** @type {Group} */ ({
          label: group.label,
          uuid: group.group,
          devices: [device],
        });
        knownGroups.set(group.group, newGroup);
        if (onAdded) {
          onAdded(newGroup);
        }
      }
    },
    /**
     * @param {string} uuid
     */
    remove(uuid) {
      removeGroup(uuid);
    },
    /**
     * @param {import('./devices').Device} device
     */
    removeDevice(device) {
      knownGroups.forEach((group) => {
        const index = deviceIndexOf(group, device);
        if (index > -1) {
          group.devices[index] = group.devices[group.devices.length - 1];
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
  };
}

/**
 * @template T
 * @param {Group} group
 * @param {ReturnType<typeof import('./client').Client>} client
 * @param {import('./commands').Command<T>} command
 * @param {AbortSignal} [signal]
 */
export function SendGroup(group, client, command, signal) {
  return Promise.all(group.devices.map((device) => client.send(command, device, signal)));
}
