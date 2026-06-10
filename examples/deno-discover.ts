/**
 * Discover LIFX devices on the local network using Deno's datagram API.
 *
 * Run:
 *   deno run --allow-net --unstable-net examples/deno-discover.ts
 */
import { Client, Devices, Router, GetServiceCommand } from 'npm:lifxlan';

const socket = Deno.listenDatagram({
  hostname: '0.0.0.0',
  port: 0,
  transport: 'udp',
});

const router = Router({
  onSend(message, port, hostname) {
    socket.send(message, { transport: 'udp', port, hostname });
  },
});

const devices = Devices({
  onAdded(device) {
    console.log(`${device.serialNumber}  ${device.address}:${device.port}`);
  },
});

const client = Client({ router });

console.log('Scanning for 5 seconds...');
client.broadcast(GetServiceCommand());
const scanInterval = setInterval(() => client.broadcast(GetServiceCommand()), 1000);

setTimeout(() => {
  clearInterval(scanInterval);
  socket.close();
}, 5000);

try {
  for await (const [message, remote] of socket) {
    if (remote.transport !== 'udp') continue;
    const result = router.receive(message);
    if (result) {
      devices.register(result.serialNumber, remote.port, remote.hostname, result.header.target);
    }
  }
} catch {
  // socket.close() interrupts the async iterator; that's our normal shutdown
}
