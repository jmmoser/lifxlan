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
/**
 * @template T
 * @param {Group} group
 * @param {ReturnType<typeof import('./client').Client>} client
 * @param {import('./commands').Command<T>} command
 * @param {AbortSignal} [signal]
 */
export function SendGroup<T>(group: Group, client: ReturnType<typeof import('./client').Client>, command: import("./commands").Command<T>, signal?: AbortSignal): any;
export type Group = {
    label: string;
    uuid: string;
    devices: import('./devices').Device[];
};
