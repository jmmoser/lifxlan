No dependencies. Bring your own socket.

Works with Node.js and Deno. Eagerly awaiting [datagram support in Bun](https://github.com/oven-sh/bun/issues/1630).

### Examples

#### Node.js:
```javascript
import dgram from 'node:dgram';
import { Client, Router, Devices, GetServiceCommand } from 'lifxlan';

const socket = dgram.createSocket('udp4');

// Router handles outgoing messages and forwards responses to clients
const router = Router({
  onSend(message, port, address) {
    // A message is ready to be sent
    socket.send(message, port, address);
  },
});

// Devices keeps track of devices discovered on the network
const devices = Devices({
  onAdded(device) {
    // A device has been discovered
    console.log(device);
  },
});

socket.on('message', (message, remote) => {
  // Forward received messages to the router
  const { header, serialNumber } = router.receive(message);
  // Forward the message to devices so it can keep track
  devices.register(serialNumber, remote.port, remote.address, header.target);
});

// Client handles communication with devices
const client = Client({ router });

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

const router = Router({
  onSend(message, port, hostname) {
    socket.send(message, { port, hostname });
  }
});

const devices = Devices({
  onAdded(device) {
    console.log(device);
  },
});

const client = Client({ router });

client.broadcast(GetServiceCommand());

setTimeout(() => {
  socket.close();
}, 1000);

for await (const [message, remote] of socket) {
  const { header, serialNumber } = router.receive(message);
  devices.register(serialNumber, remote.port, remote.hostname, header.target);
}
```

#### How to turn a light on:
```javascript
import dgram from 'node:dgram';
import { Client, Devices, Router, GetServiceCommand, SetPowerCommand } from 'lifxlan';

const socket = dgram.createSocket('udp4');

const router = Router({
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

const devices = Devices();

socket.on('message', (message, remote) => {
  const { header, serialNumber } = router.receive(message);
  devices.register(serialNumber, remote.port, remote.hostname, header.target);
});

await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.once('listening', resolve);
  socket.bind();
});

socket.setBroadcast(true);

const client = Client({ router });

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

const router = Router({
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

socket.on('message', (message, remote) => {
  router.receive(message);
});

await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.once('listening', resolve);
  socket.bind();
});

// Create the device directly
const device = Device({
  serialNumber: 'd07123456789',
  address: '192.168.1.50',
});

const client = Client({ router });

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

const router = Router({
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
});

const devices = Devices();

socket.on('message', (message, remote) => {
  const { header, serialNumber } = router.receive(message);
  devices.register(serialNumber, remote.port, remote.hostname, header.target);
});

await new Promise((resolve, reject) => {
  socket.once('error', reject);
  socket.once('listening', resolve);
  socket.bind();
});

socket.setBroadcast(true);

const client1 = Client({ router });

const client2 = Client({ router });

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

const router = Router({
  onSend(message, port, address, serialNumber) {
    if (!serialNumber) {
      broadcastSocket.send(message, port, address);
    } else {
      unicastSocket.send(message, port, address);
    }
  },
});

const devices = Devices();

/**
 * @param {Uint8Array} message
 * @param {{ port: number; address: string; }} remote
 */
function onMessage(message, remote) {
  const { header, serialNumber } = router.receive(message);
  devices.register(serialNumber, remote.port, remote.address, header.target);
}

broadcastSocket.on('message', onMessage);
unicastSocket.on('message', onMessage);

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

const client = Client({ router });

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