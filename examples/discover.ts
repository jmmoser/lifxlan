/**
 * Discover LIFX devices on the local network and print each one as it appears.
 *
 * From a clone of this repo (after `bun run build`):
 *   bun examples/discover.ts
 *   node examples/discover.ts   (Node 22.18+ runs TypeScript directly)
 */
import { GetLabel } from 'lifxlan';
import { openLan } from 'lifxlan/node';
import { discover } from 'lifxlan/discovery';

const { client, devices, router, close } = await openLan();

console.log('Scanning for 5 seconds...');
for await (const device of discover(router, devices, { timeoutMs: 5000 })) {
  const label = await client.send(GetLabel(), device);
  console.log(`${device.serialNumber}  ${device.address}:${device.port}  "${label}"`);
}

await close();
