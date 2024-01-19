/**
 * @typedef {{
 *   label: string;
 *   uuid: string;
 *   devices: Set<import('./devices').Device>;
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

  return {
    /**
     * @param {import('./devices').Device} device
     * @param {ReturnType<typeof import('./encoding').decodeStateGroup>} group
     */
    register(device, group) {
      const existingGroup = knownGroups.get(group.group);
      if (existingGroup && !existingGroup.devices.has(device)) {
        existingGroup.devices.add(device);
        if (onChanged) {
          onChanged(existingGroup);
        }
      } else {
        const newGroup = /** @type {Group} */ ({
          label: group.label,
          uuid: group.group,
          devices: new Set([device]),
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
        if (group.devices.has(device)) {
          group.devices.delete(device);
          if (group.devices.size === 0) {
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
