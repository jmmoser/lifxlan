Work in progress.

Example:
```javascript
import dgram from 'node:dgram';
import { Client } from 'lifxlan';

const socket = dgram.createSocket('udp4');

const lifx = Client({
  onSend(message, port, host, broadcast) {
    client.setBroadcast(broadcast);
    client.send(message, port, host);
  },
  onDevice(device) {
    if (device.label && device.groupLabel) {
      console.log(`Group: ${device.groupLabel}, Name: ${device.label}`);
      lifx.close();
      socket.close();
    }
  },
});

socket.on('message', (message, remote) => {
  lifx.onReceived(message, remote.port, remote.address);
});

socket.once('listening', () => {
  lifx.discover();
});

socket.bind(50032);
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
    if (device.label && device.groupLabel) {
      console.log(`Group: ${device.groupLabel}, Name: ${device.label}`);
      lifx.close();
      broadcastSocket.close();
      unicastSocket.close();
    }
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