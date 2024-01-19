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
export function Groups(options?: {
    onAdded?: (group: Group) => void;
    onChanged?: (group: Group) => void;
    onRemoved?: (group: Group) => void;
}): {
    /**
     * @param {import('./devices').Device} device
     * @param {ReturnType<typeof import('./encoding').decodeStateGroup>} group
     */
    register(device: import('./devices').Device, group: ReturnType<typeof import('./encoding').decodeStateGroup>): void;
    /**
     * @param {string} uuid
     */
    remove(uuid: string): void;
    /**
     * @param {import('./devices').Device} device
     */
    removeDevice(device: import('./devices').Device): void;
    readonly registered: Map<string, Group>;
};
export type Group = {
    label: string;
    uuid: string;
    devices: Set<import("./devices").Device>;
};
