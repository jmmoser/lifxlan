/**
 * Discover LIFX devices on the local network and print each one as it appears.
 *
 * From a clone of this repo (after `bun run build`):
 *   bun examples/discover.ts
 *   node examples/discover.ts   (Node 22.18+ runs TypeScript directly)
 */
import dgram from 'node:dgram';
import { Client, Devices, Router, GetServiceCommand, GetLabelCommand } from 'lifxlan';

const socket = dgram.createSocket('udp4');

const router = Router({
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

const devices = Devices({
  async onAdded(device) {
    const label = await client.send(GetLabelCommand(), device);
    console.log(`${device.serialNumber}  ${device.address}:${device.port}  "${label}"`);
  },
});

socket.on('message', (message, remote) => {
  devices.register(remote.port, remote.address, router.receive(message));
});

await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.once('listening', resolve);
  socket.bind();
});

socket.setBroadcast(true);

const client = Client({ router });

console.log('Scanning for 5 seconds...');
client.broadcast(GetServiceCommand());
const scanInterval = setInterval(() => client.broadcast(GetServiceCommand()), 1000);

setTimeout(() => {
  clearInterval(scanInterval);
  socket.close();
}, 5000);
