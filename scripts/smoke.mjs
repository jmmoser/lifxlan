/**
 * ESM smoke test for the built package. Runs on Node and Deno (no runtime
 * APIs beyond standard ECMAScript), exercising a loopback request/response
 * round trip through Router + Client against `dist/esm`.
 *
 * Build first: `bun run build`.
 */
import {
  Router,
  Client,
  Device,
  Devices,
  Type,
  GetPowerCommand,
} from '../dist/esm/index.js';
import { encode, decodeHeader } from '../dist/esm/encoding.js';
import { Products } from '../dist/esm/products.js';
import { discover } from '../dist/esm/discovery.js';

const router = Router({
  onSend(message) {
    const header = decodeHeader(message);
    const payload = new Uint8Array([0xFF, 0xFF]);
    router.receive(
      encode(header.tagged, header.source, header.target, false, false, header.sequence, Type.StatePower, payload),
    );
  },
});

const client = Client({ router });
const device = Device({ serialNumber: 'd073d5123456', address: '127.0.0.1' });

const power = await client.send(GetPowerCommand(), device);
if (power !== 0xFFFF) {
  throw new Error(`round trip returned ${power}, expected 65535`);
}

const products = Products([
  { vid: 1, name: 'LIFX', products: [{ pid: 32, name: 'LIFX Z', features: { multizone: true } }] },
]);
if (products.features(1, 32)?.multizone !== true) {
  throw new Error('products lookup failed');
}

// Discovery round trip: discover() broadcasts GetService through its own
// client; this loopback "network" answers with StateService and registers
// the device that answered, which the iterator then yields.
const discoveredDevices = Devices();
const discoveryRouter = Router({
  onSend(message) {
    const header = decodeHeader(message);
    if (header.type !== Type.GetService) return;
    const payload = new Uint8Array([1, 0x7C, 0xDD, 0x00, 0x00]); // service 1, port 56700
    const reply = encode(false, header.source, device.target, false, false, header.sequence, Type.StateService, payload);
    discoveredDevices.register(56700, '127.0.0.1', discoveryRouter.receive(reply));
  },
});

let discovered;
// break disposes the stream (clearing the interval), so this exits.
for await (const found of discover(discoveryRouter, discoveredDevices, { timeoutMs: 1000 })) {
  discovered = found;
  break;
}
if (discovered?.serialNumber !== 'd073d5123456') {
  throw new Error('discovery round trip failed');
}

client.dispose();
console.log('esm smoke ok');
