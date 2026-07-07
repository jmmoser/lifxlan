/**
 * Deno-only smoke test for the built `lifxlan/deno` helper: a fake device on
 * a loopback UDP socket answers the packets openLan()'s wiring sends, so the
 * whole path — listen, send, read loop, decode, register — runs against
 * `dist` over a real socket. Nothing is broadcast; every packet is unicast
 * to 127.0.0.1.
 *
 * Build first: `bun run build`. Run:
 *   deno run --allow-net=127.0.0.1 --unstable-net scripts/smoke-deno.mjs
 */
import { Device, Type, GetPowerCommand } from '../dist/index.js';
import { encode, decodeHeader } from '../dist/encoding.js';
import { openLan } from '../dist/deno.js';

const SERIAL = 'd073d5123456';

const fake = Deno.listenDatagram({ hostname: '127.0.0.1', port: 0, transport: 'udp' });
const answering = (async () => {
  try {
    for await (const [message, remote] of fake) {
      const header = decodeHeader(message);
      if (header.type !== Type.GetPower) continue;
      const reply = encode(
        false, header.source, header.target, false, false, header.sequence,
        Type.StatePower, new Uint8Array([0xFF, 0xFF]),
      );
      await fake.send(reply, remote);
    }
  } catch {
    // fake.close() interrupts the iterator; that's our normal shutdown
  }
})();

const lan = await openLan({ address: '127.0.0.1' });

const device = Device({ serialNumber: SERIAL, address: '127.0.0.1', port: fake.addr.port });
const power = await lan.client.send(GetPowerCommand(), device);
if (power !== 0xFFFF) {
  throw new Error(`round trip returned ${power}, expected 65535`);
}
// The reply flowed through openLan()'s read loop, so the fake device must
// have landed in the registry.
if (lan.devices.registered.get(SERIAL)?.port !== fake.addr.port) {
  throw new Error('reply did not register the device');
}

await lan.close();
fake.close();
await answering;
console.log('deno smoke ok');
