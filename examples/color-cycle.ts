/**
 * Party mode: sweep the hue of every discovered light for ten seconds.
 *
 * Animations are the textbook case for `client.unicast()` — fire-and-forget,
 * no acks, one packet per frame. A dropped frame doesn't matter because the
 * next one replaces it 100ms later.
 *
 * From a clone of this repo (after `bun run build`):
 *   bun examples/color-cycle.ts
 *   node examples/color-cycle.ts   (Node 22.18+ runs TypeScript directly)
 */
import { SetColorCommand } from 'lifxlan';
import { openLan } from 'lifxlan/node';
import { discover } from 'lifxlan/discovery';

const RUN_MS = 10_000;
const FRAME_MS = 100;
const HUE_CYCLE_MS = 3_600; // one full trip around the color wheel every 3.6s

const lan = await openLan();

console.log('Scanning for 3 seconds...');
for await (const device of discover(lan.router, lan.devices, { timeoutMs: 3000 })) {
  console.log(`found ${device.serialNumber}`);
}

console.log('Party mode for 10 seconds...');
const start = Date.now();
while (Date.now() - start < RUN_MS) {
  const elapsed = Date.now() - start;
  const hue = Math.round(((elapsed % HUE_CYCLE_MS) / HUE_CYCLE_MS) * 65535);
  for (const device of lan.devices) {
    lan.client.unicast(SetColorCommand(hue, 65535, 65535, 3500, FRAME_MS), device);
  }
  await new Promise((resolve) => setTimeout(resolve, FRAME_MS));
}

await lan.close();
