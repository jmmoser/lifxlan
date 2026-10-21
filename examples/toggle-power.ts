/**
 * Toggle the power of every LIFX device on the network: discover for a few
 * seconds, flipping each device to the opposite of its current state as it
 * is found.
 *
 * From a clone of this repo (after `bun run build`):
 *   bun examples/toggle-power.ts
 *   node examples/toggle-power.ts   (Node 22.18+ runs TypeScript directly)
 */
import { GetPower, SetPower } from 'lifxlan';
import { openLan } from 'lifxlan/node';
import { discover } from 'lifxlan/discovery';

const { client, devices, router, close } = await openLan();

console.log('Scanning for 3 seconds...');
try {
  for await (const device of discover(router, devices, { timeoutMs: 3000 })) {
    // One unreachable device (a lost packet, a TimeoutError) must not abort
    // the scan for the rest.
    try {
      const level = await client.send(GetPower(), device);
      await client.send(SetPower(level === 0), device);
      console.log(`${device.serialNumber}: turned ${level === 0 ? 'on' : 'off'}`);
    } catch (err) {
      console.error(`${device.serialNumber}: ${err instanceof Error ? err.message : err}`);
    }
  }
} finally {
  await close();
}
