/**
 * Does a microtask-coalescing `onSend` adapter let plain `send()` loops batch
 * themselves into one syscall — with no batch API at all?
 *
 *   naive:       per-packet onSend           → N send syscalls / iteration
 *   coalescing:  queue + queueMicrotask flush → 1 sendMany     / iteration
 *   explicit:    onSendMany + client.sendEach → 1 sendMany     / iteration
 *
 * All three issue N datagrams to N virtual devices (served by one emulated
 * light) and await N responses. Run with:
 *
 *   bun run benchmarks/coalescing-adapter.ts
 */

import { Router, type OutboundPacket } from '../src/router.js';
import { Client } from '../src/client.js';
import { Device } from '../src/devices.js';
import { encode, decodeHeader } from '../src/encoding.js';
import { Type } from '../src/constants/types.js';
import { GetColorCommand } from '../src/commands/index.js';

const HOST = '127.0.0.1';
const LIGHT_STATE_BYTES = 52;

const toU8 = (d: Uint8Array): Uint8Array => new Uint8Array(d.buffer, d.byteOffset, d.byteLength);

function replyFor(header: ReturnType<typeof decodeHeader>): Uint8Array | undefined {
  const reply = (type: number, payload?: Uint8Array) =>
    encode(header.tagged, header.source, header.target, false, false, header.sequence, type, payload);
  if (header.type === Type.GetColor) return reply(Type.LightState, new Uint8Array(LIGHT_STATE_BYTES));
  if (header.ack_required) return reply(Type.Acknowledgement);
  return undefined;
}

async function startLight() {
  return Bun.udpSocket({
    socket: {
      data(sock, data, port, addr) {
        let header;
        try {
          header = decodeHeader(toU8(data));
        } catch {
          return;
        }
        const reply = replyFor(header);
        if (reply) sock.send(reply, port, addr);
      },
    },
  });
}

/** Per-packet onSend — the no-batching baseline. */
async function startNaive() {
  const counters = { syscalls: 0 };
  let router: ReturnType<typeof Router>;
  const socket = await Bun.udpSocket({ socket: { data(_s, d) { router.receive(toU8(d)); } } });
  router = Router({
    onSend(message, port, address) {
      counters.syscalls += 1;
      socket.send(message, port, address);
    },
  });
  return { socket, client: Client({ router, defaultTimeoutMs: 2000 }), counters };
}

/** Microtask-coalescing onSend — the idea under test. No onSendMany, no API change. */
async function startCoalescing() {
  const counters = { syscalls: 0, packets: 0 };
  const queue: (Uint8Array | number | string)[] = [];
  let scheduled = false;
  let router: ReturnType<typeof Router>;
  const socket = await Bun.udpSocket({ socket: { data(_s, d) { router.receive(toU8(d)); } } });
  router = Router({
    onSend(message, port, address) {
      queue.push(message, port, address);
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(() => {
          scheduled = false;
          const batch = queue.slice(); // copy before clearing so an in-flush send can't mutate it
          queue.length = 0;
          counters.syscalls += 1;
          counters.packets += batch.length / 3;
          try {
            socket.sendMany(batch);
          } catch (err) {
            console.error('flush failed', err);
          }
        });
      }
    },
  });
  return { socket, client: Client({ router, defaultTimeoutMs: 2000 }), counters };
}

/** Explicit onSendMany + sendEach — the reference batch path. */
async function startExplicit() {
  const counters = { syscalls: 0 };
  let router: ReturnType<typeof Router>;
  const socket = await Bun.udpSocket({ socket: { data(_s, d) { router.receive(toU8(d)); } } });
  router = Router({
    onSend(message, port, address) {
      counters.syscalls += 1;
      socket.send(message, port, address);
    },
    onSendMany(packets: readonly OutboundPacket[]) {
      counters.syscalls += 1;
      const flat: (Uint8Array | number | string)[] = [];
      for (const p of packets) flat.push(p.message, p.port, p.address);
      socket.sendMany(flat);
    },
  });
  return { socket, client: Client({ router, defaultTimeoutMs: 2000 }), counters };
}

function makeDevices(count: number, port: number): Device[] {
  const devices: Device[] = [];
  for (let i = 0; i < count; i += 1) {
    devices.push(Device({ serialNumber: (i + 1).toString(16).padStart(12, '0'), address: HOST, port }));
  }
  return devices;
}

async function timeIt(iters: number, fn: () => Promise<unknown>): Promise<number> {
  for (let i = 0; i < Math.min(20, iters); i += 1) await fn();
  const start = performance.now();
  for (let i = 0; i < iters; i += 1) await fn();
  return performance.now() - start;
}

async function main() {
  const light = await startLight();
  const naive = await startNaive();
  const coalescing = await startCoalescing();
  const explicit = await startExplicit();

  const deviceCounts = [1, 8, 32, 64, 100];
  const iters = 2000;

  console.log(`LIFX light emulator on udp://${HOST}:${light.port}`);
  console.log(`Plain Promise.all(devices.map(d => client.send(GetColor, d))), ${iters} iters/cell.\n`);

  const header = ['devices', 'naive onSend', 'coalescing onSend', 'explicit sendEach', 'coalesce speedup', 'syscalls/iter'];
  const rows: string[][] = [];

  for (const n of deviceCounts) {
    const dNaive = makeDevices(n, light.port);
    const dCoalesce = makeDevices(n, light.port);
    const dExplicit = makeDevices(n, light.port);

    const before = naive.counters.syscalls;
    const tNaive = await timeIt(iters, () => Promise.all(dNaive.map((d) => naive.client.send(GetColorCommand(), d))));
    const naiveSyscalls = (naive.counters.syscalls - before) / iters;

    const cBefore = coalescing.counters.syscalls;
    const tCoalesce = await timeIt(iters, () => Promise.all(dCoalesce.map((d) => coalescing.client.send(GetColorCommand(), d))));
    const coalesceSyscalls = (coalescing.counters.syscalls - cBefore) / iters;

    const tExplicit = await timeIt(iters, () => explicit.client.sendEach(GetColorCommand(), dExplicit));

    rows.push([
      String(n),
      `${(tNaive / iters).toFixed(3)} ms`,
      `${(tCoalesce / iters).toFixed(3)} ms`,
      `${(tExplicit / iters).toFixed(3)} ms`,
      `${(tNaive / tCoalesce).toFixed(2)}x`,
      `${naiveSyscalls.toFixed(0)} → ${coalesceSyscalls.toFixed(0)}`,
    ]);
  }

  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const fmt = (cells: string[]) => cells.map((c, i) => c.padStart(widths[i]!)).join('  ');
  console.log(fmt(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(fmt(r));

  console.log(`\nThe coalescing adapter turns N per-iteration send() syscalls into 1 sendMany — no batch API used.`);

  naive.client.dispose();
  coalescing.client.dispose();
  explicit.client.dispose();
  naive.socket.close();
  coalescing.socket.close();
  explicit.socket.close();
  light.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
