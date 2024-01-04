No dependencies. Batteries not included.

Works with Node.js and Deno. Eagerly awaiting [datagram support in Bun](https://github.com/oven-sh/bun/issues/1630).

### Examples

#### Node.js:
```javascript
import dgram from 'node:dgram';
import { Client, Devices, GetServiceCommand } from 'lifxlan';

const socket = dgram.createSocket('udp4');

const devices = Devices({
  onRegistered(device) {
    // A device has been discovered
    console.log(device);
    socket.close();
  },
});

const client = Client({
  devices,
  onSend(message, port, address) {
    // The client has a message that can be sent out
    socket.send(message, port, address);
  },
});

socket.on('message', (message, remote) => {
  // Forward received messages to the client
  client.onReceived(message, remote.port, remote.address);
});

socket.once('listening', () => {
  socket.setBroadcast(true);
  // Discover devices on the network
  client.broadcast(GetServiceCommand());
});

socket.bind(50032);
```

#### Deno:
```javascript
import { Client, Devices, GetServiceCommand } from 'lifxlan';

const socket = Deno.listenDatagram({
  hostname: '0.0.0.0',
  port: 50032,
  transport: 'udp',
});

const devices = Devices({
  onRegistered(device) {
    console.log(device);
    socket.close();
  },
});

const client = Client({
  devices,
  onSend(message, port, hostname) {
    socket.send(message, { port, hostname });
  },
});

client.broadcast(GetServiceCommand());

for await (const [data, remote] of socket) {
  client.onReceived(data, remote.port, remote.hostname);
}
```

#### How to turn a light on:
```javascript
import dgram from 'node:dgram';
import { Client, Devices, GetServiceCommand, SetPowerCommand } from 'lifxlan';

const socket = dgram.createSocket('udp4');

const devices = Devices({
  onRegistered(device) {
    console.log(device);
    socket.close();
  },
});

const client = Client({
  devices,
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

socket.on('message', (message, remote) => {
  client.onReceived(message, remote.port, remote.address);
});

await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.once('listening', resolve);
  socket.bind(50032);
});

socket.setBroadcast(true);

// Start scanning for devices
client.broadcast(GetServiceCommand());
const scanInterval = setInterval(() => {
  client.broadcast(GetServiceCommand());
}, 1000);

const device = await devices.get('d07123456789');

// Stop scanning since device was found
clearInterval(scanInterval);

await client.sendOnlyAcknowledge(SetPowerCommand(true), device);

socket.close();
```

#### How to retry:
```javascript
for (let i = 0; i < 3; i++) {
  try {
    console.log(await client.send(GetColorCommand(), device));
    break;
  } catch (err) {
    const delay = Math.random() * Math.min(Math.pow(2, i) * 1000, 30 * 1000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
```

#### How to specify a custom timeout:
```javascript
const controller = new AbortController();

const timeout = setTimeout(() => {
  controller.abort();
}, 100);

try {
  console.log(await client.send(GetColorCommand(), device, controller.signal));
} finally {
  clearTimeout(timeout)
}
```

#### How to use without device discovery
```javascript
import dgram from 'node:dgram';
import { Client, Device, GetServiceCommand, SetPowerCommand } from 'lifxlan';

const socket = dgram.createSocket('udp4');

const client = Client({
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

socket.on('message', (message, remote) => {
  client.onReceived(message, remote.port, remote.address);
});

await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.once('listening', resolve);
  socket.bind(50032);
});

const device = Device({
  serialNumber: 'd07123456789',
  address: '192.168.1.50',
});

await client.sendOnlyAcknowledge(SetPowerCommand(true), device);

socket.close();
```

#### How to use one socket for broadcast messages and another socket for unicast messages:
```javascript
import dgram from 'node:dgram';
import { Client, Devices, GetServiceCommand } from 'lifxlan';

const broadcastSocket = dgram.createSocket('udp4');
const unicastSocket = dgram.createSocket('udp4');

const devices = Devices({
  onRegistered(device) {
    console.log(device);
    socket.close();
  },
});

const client = Client({
  devices,
  onSend(message, port, address, broadcast) {
    if (broadcast) {
      broadcastSocket.send(message, port, address);
    } else {
      unicastSocket.send(message, port, address);
    }
  },
  onDevice(device) {
    console.log(device);
    broadcastSocket.close();
    unicastSocket.close();
  },
});

broadcastSocket.on('message', (message, remote) => {
  client.onReceived(message, remote.port, remote.address);
});

broadcastSocket.once('listening', () => {
  broadcastSocket.setBroadcast(true);
  client.broadcast(GetServiceCommand());
});

broadcastSocket.bind(50032);

unicastSocket.on('message', (message, remote) => {
  client.onReceived(message, remote.port, remote.address);
});

unicastSocket.bind(50031);
```