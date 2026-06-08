/**
 * Batch vs. unbatched send benchmark over a real UDP round-trip.
 *
 * Spins up a tiny LIFX light emulator on a real Bun UDP socket, points a client
 * at N virtual devices (all served by that one socket), and compares:
 *
 *   - unbatched:  N separate `client.send(...)` calls  → N `onSend` syscalls
 *   - sendEach:   one `client.sendEach(cmd, devices)`  → 1 `socket.sendMany` syscall
 *   - sendBatch:  one `client.sendBatch(entries)`      → 1 `socket.sendMany` syscall
 *
 * All three issue N datagrams and await N responses; the only difference is how
 * many send syscalls the client makes to put them on the wire. Run with:
 *
 *   bun run benchmarks/batch-vs-unbatched.ts
 */

import { Router, type OutboundPacket } from '../src/router.js';
import { Client } from '../src/client.js';
import { Device } from '../src/devices.js';
import { encode, decodeHeader } from '../src/encoding.js';
import { Type } from '../src/constants/types.js';
import { GetColorCommand } from '../src/commands/index.js';

const LIGHT_STATE_BYTES = 52; // size of a LightState payload
const HOST = '127.0.0.1';

/** Build the State reply a real light would send for a given request type. */
function replyFor(header: ReturnType<typeof decodeHeader>): Uint8Array | undefined {
  // Echo the request's source + target + sequence so the client routes the
  // response back to the exact virtual device that sent it.
  const reply = (type: number, payload?: Uint8Array) =>
    encode(header.tagged, header.source, header.target, false, false, header.sequence, type, payload);

  if (header.type === Type.GetColor) {
    return reply(Type.LightState, new Uint8Array(LIGHT_STATE_BYTES));
  }
  if (header.type === Type.GetPower) {
    const payload = new Uint8Array(2);
    new DataView(payload.buffer).setUint16(0, 0xffff, true);
    return reply(Type.StatePower, payload);
  }
  if (header.ack_required) {
    return reply(Type.Acknowledgement);
  }
  return undefined;
}

/** A LIFX light emulator backed by a real Bun UDP socket. */
async function startLight() {
  const socket = await Bun.udpSocket({
    socket: {
      data(sock, data, port, addr) {
        // Bun hands us a Buffer view; normalize to a plain Uint8Array.
        const msg = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        let header;
        try {
          header = decodeHeader(msg);
        } catch {
          return; // ignore malformed datagrams
        }
        const reply = replyFor(header);
        if (reply) {
          sock.send(reply, port, addr);
        }
      },
    },
  });
  return socket;
}

async function startClient() {
  // Counters let us report the actual send-call shape, not just wall-clock.
  const counters = { onSend: 0, onSendMany: 0, packets: 0 };

  const socket = await Bun.udpSocket({
    socket: {
      data(_sock, data) {
        const msg = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        router.receive(msg);
      },
    },
  });

  const router = Router({
    onSend(message, port, address) {
      counters.onSend += 1;
      counters.packets += 1;
      socket.send(message, port, address);
    },
    onSendMany(packets: readonly OutboundPacket[]) {
      counters.onSendMany += 1;
      counters.packets += packets.length;
      const flat: (Uint8Array | number | string)[] = [];
      for (const p of packets) {
        flat.push(p.message, p.port, p.address);
      }
      socket.sendMany(flat);
    },
  });

  const client = Client({ router, defaultTimeoutMs: 2000 });
  return { socket, client, counters };
}

function makeDevices(count: number, port: number): Device[] {
  const devices: Device[] = [];
  for (let i = 0; i < count; i += 1) {
    // Distinct serials → distinct routing keys, all served by the one light.
    const serial = (i + 1).toString(16).padStart(12, '0');
    devices.push(Device({ serialNumber: serial, address: HOST, port }));
  }
  return devices;
}

async function timeIt(label: string, iters: number, fn: () => Promise<unknown>): Promise<number> {
  // Warm up so JIT / socket buffers settle before measuring.
  for (let i = 0; i < Math.min(20, iters); i += 1) await fn();
  const start = performance.now();
  for (let i = 0; i < iters; i += 1) await fn();
  const elapsed = performance.now() - start;
  void label;
  return elapsed;
}

async function main() {
  const light = await startLight();
  const { socket: clientSocket, client, counters } = await startClient();

  const deviceCounts = [1, 8, 32, 64, 100];
  const iters = 2000;

  console.log(`LIFX light emulator on udp://${HOST}:${light.port}`);
  console.log(`Each cell: ${iters} iterations, every iteration sends to N devices and awaits N responses.\n`);

  const header = ['devices', 'unbatched (send)', 'sendEach', 'sendBatch', 'speedup', 'syscalls/iter'];
  const rows: string[][] = [];

  for (const n of deviceCounts) {
    const devices = makeDevices(n, light.port);
    const batchEntries = devices.map((device) => ({ command: GetColorCommand(), device }));

    // Unbatched: N independent send() calls, awaited together.
    const before = counters.onSend;
    const unbatched = await timeIt('unbatched', iters, async () => {
      await Promise.all(devices.map((d) => client.send(GetColorCommand(), d)));
    });
    const onSendPerIter = (counters.onSend - before) / iters;

    // sendEach: one homogeneous fan-out → one sendMany.
    const sendEach = await timeIt('sendEach', iters, async () => {
      await client.sendEach(GetColorCommand(), devices);
    });

    // sendBatch: one heterogeneous-capable batch → one sendMany.
    const sendBatch = await timeIt('sendBatch', iters, async () => {
      await client.sendBatch(batchEntries);
    });

    const bestBatch = Math.min(sendEach, sendBatch);
    const speedup = unbatched / bestBatch;

    rows.push([
      String(n),
      `${(unbatched / iters).toFixed(3)} ms`,
      `${(sendEach / iters).toFixed(3)} ms`,
      `${(sendBatch / iters).toFixed(3)} ms`,
      `${speedup.toFixed(2)}x`,
      `${onSendPerIter.toFixed(0)} → 1`,
    ]);
  }

  // Print a simple aligned table.
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const fmt = (cells: string[]) => cells.map((c, i) => c.padStart(widths[i]!)).join('  ');
  console.log(fmt(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(fmt(r));

  console.log(`\nTotal send syscalls: ${counters.onSend} individual + ${counters.onSendMany} batched (${counters.packets} datagrams).`);
  console.log('Batched rows collapse N per-iteration send syscalls into 1.');

  // --- Fire-and-forget: isolate the send path (no round-trip latency) -------
  // This is where batching pays off most clearly — each row measures only the
  // cost of getting N datagrams onto the wire, with no responses awaited.
  console.log(`\nFire-and-forget send path (${iters} iterations, no responses awaited):\n`);

  const ffHeader = ['devices', 'unicast loop', 'unicastEach', 'unicastBatch', 'speedup'];
  const ffRows: string[][] = [];

  for (const n of deviceCounts) {
    const devices = makeDevices(n, light.port);
    const batchEntries = devices.map((device) => ({ command: GetColorCommand(), device }));

    const loop = await timeIt('unicast', iters, async () => {
      for (const d of devices) client.unicast(GetColorCommand(), d);
    });
    const each = await timeIt('unicastEach', iters, async () => {
      client.unicastEach(GetColorCommand(), devices);
    });
    const batch = await timeIt('unicastBatch', iters, async () => {
      client.unicastBatch(batchEntries);
    });

    const speedup = loop / Math.min(each, batch);
    ffRows.push([
      String(n),
      `${((loop / iters) * 1000).toFixed(1)} µs`,
      `${((each / iters) * 1000).toFixed(1)} µs`,
      `${((batch / iters) * 1000).toFixed(1)} µs`,
      `${speedup.toFixed(2)}x`,
    ]);
  }

  const ffWidths = ffHeader.map((h, i) => Math.max(h.length, ...ffRows.map((r) => r[i]!.length)));
  const ffFmt = (cells: string[]) => cells.map((c, i) => c.padStart(ffWidths[i]!)).join('  ');
  console.log(ffFmt(ffHeader));
  console.log(ffWidths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of ffRows) console.log(ffFmt(r));

  client.dispose();
  clientSocket.close();
  light.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
