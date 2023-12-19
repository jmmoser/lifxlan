No dependencies. Bring your own socket.

Works with Node.js and Deno. Eagerly awaiting [datagram support in Bun](https://github.com/oven-sh/bun/issues/1630).

Node.js:
```javascript
import dgram from 'node:dgram';
import { Client } from 'lifxlan';

const socket = dgram.createSocket('udp4');

const lifx = Client({
  onSend(message, port, address) {
    socket.send(message, port, address);
  },
  onDevice(device) {
    console.log(device.serialNumber, device.address);
    lifx.close();
    socket.close();
  },
});

socket.on('message', (message, remote) => {
  lifx.onReceived(message, remote.port, remote.address);
});

socket.once('listening', () => {
  socket.setBroadcast(true);
  lifx.discover();
});

socket.bind(50032);
```

Deno:
```javascript
import { Client } from 'lifxlan';

const client = Deno.listenDatagram({
  hostname: '0.0.0.0',
  port: 50032,
  transport: 'udp',
});

const lifx = Client({
  onSend(message, port, hostname) {
    client.send(message, { port, hostname });
  },
  onDevice(device) {
    console.log(device.serialNumber, device.address);
    lifx.close();
    client.close();
  },
});

lifx.discover();

for await (const [data, remote] of client) {
  lifx.onReceived(data, remote.port, remote.hostname);
}
```

You can also use multiple sockets. For example, you could use one for unicast and the other for broadcast:
```javascript
import dgram from 'node:dgram';
import { Client } from 'lifxlan';

const broadcastSocket = dgram.createSocket('udp4');
const unicastSocket = dgram.createSocket('udp4');

const lifx = Client({
  onSend(message, port, address, broadcast) {
    if (broadcast) {
      broadcastSocket.send(message, port, address);
    } else {
      unicastSocket.send(message, port, address);
    }
  },
  onDevice(device) {
    console.log(device.serialNumber, device.address);
    lifx.close();
    broadcastSocket.close();
    unicastSocket.close();
  },
});

broadcastSocket.on('message', (message, remote) => {
  lifx.onReceived(message, remote.port, remote.address);
});

broadcastSocket.once('listening', () => {
  broadcastSocket.setBroadcast(true);
  lifx.discover();
});

broadcastSocket.bind(50032);

unicastSocket.on('message', (message, remote) => {
  lifx.onReceived(message, remote.port, remote.address);
});

unicastSocket.bind(50031);
```