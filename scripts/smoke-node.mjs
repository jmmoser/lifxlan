/**
 * Node-only smoke test for the built `lifxlan/node` helper: a fake device on
 * a loopback UDP socket answers the packets openLan()'s wiring sends, so the
 * whole path - bind, send, receive, decode, register - runs against `dist`
 * over a real socket. Nothing is broadcast; every packet is unicast to
 * 127.0.0.1. Not run on Deno: the helper is Node/Bun specific by design.
 *
 * Build first: `bun run build`.
 */
import dgram from 'node:dgram';
import { Device, Type, GetPower } from '../dist/index.js';
import { encode, decodeHeader } from '../dist/encoding.js';
import { openLan } from '../dist/node.js';

const SERIAL = 'd073d5123456';

const fake = dgram.createSocket('udp4');
fake.on('message', (message, remote) => {
  const header = decodeHeader(message);
  if (header.type !== Type.GetPower) return;
  const reply = encode(
    false, header.source, header.target, false, false, header.sequence,
    Type.StatePower, new Uint8Array([0xFF, 0xFF]),
  );
  fake.send(reply, remote.port, remote.address);
});
const fakePort = await new Promise((resolve, reject) => {
  fake.once('error', reject);
  fake.once('listening', () => resolve(fake.address().port));
  fake.bind(0, '127.0.0.1');
});

const lan = await openLan({ address: '127.0.0.1' });

const device = Device({ serialNumber: SERIAL, address: '127.0.0.1', port: fakePort });
const power = await lan.client.send(GetPower(), device);
if (power !== 0xFFFF) {
  throw new Error(`round trip returned ${power}, expected 65535`);
}
// The reply flowed through openLan()'s receive wiring, so the fake device
// must have landed in the registry.
if (lan.devices.registered.get(SERIAL)?.port !== fakePort) {
  throw new Error('reply did not register the device');
}

await lan.close();
await new Promise((resolve) => fake.close(resolve));
console.log('node smoke ok');
