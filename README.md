No dependencies. Batteries not included.

Works with Node.js and Deno. Eagerly awaiting [datagram support in Bun](https://github.com/oven-sh/bun/issues/1630).

### Examples

#### Node.js:
```javascript
import dgram from 'node:dgram';
import { Client, Router, Devices, GetServiceCommand } from 'lifxlan';

const socket = dgram.createSocket('udp4');

const client = Client({
  router: Router({
    onSend(message, port, address) {
      // A message is ready to be sent out
      socket.send(message, port, address);
    },
    devices: Devices({
      onRegistered(device) {
        // A device has been discovered
        console.log(device);
      },
    }),
  }),
});

socket.on('message', (message, remote) => {
  // Forward received messages to the client
  client.router.onReceived(message, remote.port, remote.address);
});

socket.once('listening', () => {
  socket.setBroadcast(true);
  // Discover devices on the network
  client.broadcast(GetServiceCommand());
});

socket.bind();

setTimeout(() => {
  socket.close();
}, 1000);
```

#### Deno:
```javascript
import { Client, Router, Devices, GetServiceCommand } from 'lifxlan';

const socket = Deno.listenDatagram({
  hostname: '0.0.0.0',
  port: 0,
  transport: 'udp',
});

const client = Client({
  router: Router({
    onSend(message, port, hostname) {
      socket.send(message, { port, hostname });
    },
    devices: Devices({
      onRegistered(device) {
        console.log(device);
      },
    }),
  }),
});

client.broadcast(GetServiceCommand());

setTimeout(() => {
  socket.close();
}, 1000);

for await (const [data, remote] of socket) {
  client.router.onReceived(data, remote.port, remote.hostname);
}
```

#### How to turn a light on:
```javascript
import dgram from 'node:dgram';
import { Client, Devices, Router, GetServiceCommand, SetPowerCommand } from 'lifxlan';

const socket = dgram.createSocket('udp4');

const devices = Devices();

const client = Client({
  router: Router({
    devices,
    onSend(message, port, address) {
      socket.send(message, port, address);
    },
  }),
});

socket.on('message', (message, remote) => {
  client.router.onReceived(message, remote.port, remote.address);
});

await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.once('listening', resolve);
  socket.bind();
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
import { Client, Device, Router, GetServiceCommand, SetPowerCommand } from 'lifxlan';

const socket = dgram.createSocket('udp4');

const client = Client({
  router: Router({
    onSend(message, port, address) {
      socket.send(message, port, address);
    },
  }),
});

socket.on('message', (message, remote) => {
  client.router.onReceived(message, remote.port, remote.address);
});

await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.once('listening', resolve);
  socket.bind();
});

const device = Device({
  serialNumber: 'd07123456789',
  address: '192.168.1.50',
});

await client.sendOnlyAcknowledge(SetPowerCommand(true), device);

socket.close();
```

#### How to create a custom command
```javascript
/**
 * @param {Uint8Array} bytes
 * @param {{ current: number; }} offsetRef
 */
function decodeCustom(bytes, offsetRef) {
  const val1 = bytes[offsetRef.current++];
  const val2 = bytes[offsetRef.current++];
  return {
    val1,
    val2,
  };
}

function CustomCommand() {
  return {
    type: 1234,
    decode: decodeCustom,
  };
}

const res = await client.send(CustomCommand(), device);

console.log(res.val1, res.val2);
```

#### How to use multiple clients
```javascript
import dgram from 'node:dgram';
import { Client, Devices, Router, GetServiceCommand, SetPowerCommand } from 'lifxlan';

const socket = dgram.createSocket('udp4');

const devices = Devices();

const router = Router({
  devices,
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

socket.on('message', (message, remote) => {
  router.onReceived(message, remote.port, remote.address);
});

const client1 = Client({
  router,
});

const client2 = Client({
  router,
});

await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.once('listening', resolve);
  socket.bind();
});

socket.setBroadcast(true);

client1.broadcast(GetServiceCommand());
const scanInterval = setInterval(() => {
  client1.broadcast(GetServiceCommand());
}, 1000);

const device = await devices.get('d07123456789');

clearInterval(scanInterval);

await client2.sendOnlyAcknowledge(SetPowerCommand(true), device);

socket.close();
```

#### How to use a lot of clients
```javascript
while (true) {
  const client = Client({ router });

  console.log(await client.send(GetPowerCommand(), device));

  // When creating a lot of clients, call dispose to avoid running out of source values
  client.dispose();
}
```

#### How to use one socket for broadcast messages and another socket for unicast messages:
```javascript
import dgram from 'node:dgram';
import { Client, Devices, GetServiceCommand } from 'lifxlan';

const broadcastSocket = dgram.createSocket('udp4');
const unicastSocket = dgram.createSocket('udp4');

const devices = Devices();

const client = Client({
  router: Router({
    devices,
    onSend(message, port, address, broadcast) {
      if (broadcast) {
        broadcastSocket.send(message, port, address);
      } else {
        unicastSocket.send(message, port, address);
      }
    },
  }),
});

broadcastSocket.on('message', (message, remote) => {
  client.router.onReceived(message, remote.port, remote.address);
});

unicastSocket.on('message', (message, remote) => {
  client.router.onReceived(message, remote.port, remote.address);
});

await Promise.all([
  new Promise((resolve, reject) => {
    broadcastSocket.once('error', reject);
    broadcastSocket.once('listening', resolve);
    broadcastSocket.bind();
  }),
  new Promise((resolve, reject) => {
    unicastSocket.once('error', reject);
    unicastSocket.once('listening', resolve);
    unicastSocket.bind();
  }),
]);

broadcastSocket.setBroadcast(true);

client.broadcast(GetServiceCommand());
const scanInterval = setInterval(() => {
  client.broadcast(GetServiceCommand());
}, 1000);

const device = await devices.get('d07123456789');

clearInterval(scanInterval);

await client.sendOnlyAcknowledge(SetPowerCommand(true), device);

broadcastSocket.close();
unicastSocket.close();
```