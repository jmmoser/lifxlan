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
import dgram from 'node:dgram';
import { Client, Devices, Router, GetServiceCommand, SetColorCommand } from 'lifxlan';

const RUN_MS = 10_000;
const FRAME_MS = 100;
const HUE_CYCLE_MS = 3_600; // one full trip around the color wheel every 3.6s

const socket = dgram.createSocket('udp4');

const router = Router({
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

const devices = Devices();

socket.on('message', (message, remote) => {
  const result = router.receive(message);
  if (result) {
    devices.register(result.serialNumber, remote.port, remote.address, result.header.target);
  }
});

await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.once('listening', resolve);
  socket.bind();
});

socket.setBroadcast(true);

const client = Client({ router });

console.log('Scanning for 3 seconds...');
client.broadcast(GetServiceCommand());
const scanInterval = setInterval(() => client.broadcast(GetServiceCommand()), 1000);
await new Promise((resolve) => setTimeout(resolve, 3000));
clearInterval(scanInterval);

console.log('Party mode for 10 seconds...');
const start = Date.now();
while (Date.now() - start < RUN_MS) {
  const elapsed = Date.now() - start;
  const hue = Math.round(((elapsed % HUE_CYCLE_MS) / HUE_CYCLE_MS) * 65535);
  for (const device of devices) {
    client.unicast(SetColorCommand(hue, 65535, 65535, 3500, FRAME_MS), device);
  }
  await new Promise((resolve) => setTimeout(resolve, FRAME_MS));
}

socket.close();
