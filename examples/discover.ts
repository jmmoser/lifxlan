/**
 * Discover LIFX devices on the local network and print each one as it appears.
 *
 * From a clone of this repo (after `bun run build`):
 *   bun examples/discover.ts
 *   node examples/discover.ts   (Node 22.18+ runs TypeScript directly)
 */
import { GetLabelCommand } from 'lifxlan';
import { openLan } from 'lifxlan/node';
import { discover } from 'lifxlan/discovery';

const lan = await openLan();

console.log('Scanning for 5 seconds...');
for await (const device of discover(lan.router, lan.devices, { timeoutMs: 5000 })) {
  const label = await lan.client.send(GetLabelCommand(), device);
  console.log(`${device.serialNumber}  ${device.address}:${device.port}  "${label}"`);
}

await lan.close();
