/**
 * Toggle the power of every LIFX device on the network: discover for a few
 * seconds, then flip each device to the opposite of its current state.
 *
 * From a clone of this repo (after `bun run build`):
 *   bun examples/toggle-power.ts
 *   node examples/toggle-power.ts   (Node 22.18+ runs TypeScript directly)
 */
import dgram from 'node:dgram';
import { Client, Devices, Router, GetServiceCommand, GetPowerCommand, SetPowerCommand } from 'lifxlan';

const socket = dgram.createSocket('udp4');

const router = Router({
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

const devices = Devices();

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

console.log('Scanning for 3 seconds...');
client.broadcast(GetServiceCommand());
const scanInterval = setInterval(() => client.broadcast(GetServiceCommand()), 1000);
await new Promise((resolve) => setTimeout(resolve, 3000));
clearInterval(scanInterval);

for (const device of devices) {
  const level = await client.send(GetPowerCommand(), device);
  await client.send(SetPowerCommand(level === 0), device);
  console.log(`${device.serialNumber}: turned ${level === 0 ? 'on' : 'off'}`);
}

socket.close();
