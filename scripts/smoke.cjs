/**
 * CommonJS smoke test for the built package. Exercises a loopback
 * request/response round trip through Router + Client against `dist/cjs`.
 *
 * Build first: `bun run build`.
 */
const {
  Router,
  Client,
  Device,
  Type,
  GetPowerCommand,
} = require('../dist/cjs/index.js');
const { encode, decodeHeader } = require('../dist/cjs/encoding.js');
const { Products } = require('../dist/cjs/products.js');

async function main() {
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

  client.dispose();
  console.log('cjs smoke ok');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
