/**
 * Exercises the `lifxlan/node` helper over real `node:dgram` loopback
 * sockets (bun implements node:dgram, so this runs in the normal suite): a
 * fake device on 127.0.0.1 answers the packets openLan()'s wiring sends. No
 * broadcasts are ever sent — every packet is unicast to a loopback port —
 * so nothing leaves the machine.
 */
import { describe, test } from 'bun:test';
import assert from 'node:assert';
import dgram from 'node:dgram';
import { openLan } from '../src/node.js';
import { Device, type Device as DeviceType } from '../src/devices.js';
import { Type } from '../src/constants/index.js';
import { encode, decodeHeader, type Header } from '../src/encoding.js';
import { GetPowerCommand } from '../src/commands/index.js';
import { DisposedClientError } from '../src/errors.js';
import { convertSerialNumberToTarget } from '../src/utils/index.js';

const SERIAL = 'd073d5123456';

function bind(socket: dgram.Socket): Promise<number> {
  return new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.once('listening', () => resolve(socket.address().port));
    socket.bind(0, '127.0.0.1');
  });
}

function closeSocket(socket: dgram.Socket): Promise<void> {
  return new Promise((resolve) => {
    try {
      socket.close(resolve);
    } catch {
      resolve();
    }
  });
}

/**
 * A loopback stand-in for a LIFX device: answers GetPower with
 * StatePower(0xFFFF), echoing source/sequence/target the way real firmware
 * does so the client's correlation finds the exchange.
 */
async function openFakeDevice(): Promise<{ socket: dgram.Socket; port: number }> {
  const socket = dgram.createSocket('udp4');
  socket.on('message', (message, remote) => {
    const header = decodeHeader(message);
    if (header.type !== Type.GetPower) return;
    const reply = encode(
      false,
      header.source,
      header.target,
      false,
      false,
      header.sequence,
      Type.StatePower,
      new Uint8Array([0xff, 0xff]),
    );
    socket.send(reply, remote.port, remote.address);
  });
  const port = await bind(socket);
  return { socket, port };
}

describe('openLan', () => {
  test('request/response round trip over loopback UDP', async () => {
    const fake = await openFakeDevice();
    const lan = await openLan({ address: '127.0.0.1' });
    try {
      const device = Device({ serialNumber: SERIAL, address: '127.0.0.1', port: fake.port });
      const power = await lan.client.send(GetPowerCommand(), device);
      assert.equal(power, 0xffff);
      // The reply flowed through the built-in wiring, so the fake device is
      // now also in the registry.
      assert.equal(lan.devices.registered.get(SERIAL)?.port, fake.port);
    } finally {
      await lan.close();
      await closeSocket(fake.socket);
    }
  });

  test('unsolicited packets register devices; onAdded and onMessage fire', async () => {
    const added: DeviceType[] = [];
    const tapped: Header[] = [];
    const fake = dgram.createSocket('udp4');
    const fakePort = await bind(fake);
    const lan = await openLan({
      address: '127.0.0.1',
      onAdded(device) {
        added.push(device);
      },
      onMessage(header) {
        tapped.push(header);
      },
    });
    try {
      const lanAddress = lan.socket.address();
      // Source 99 is nobody's client, mimicking a StateService that answers
      // some other requester's broadcast.
      const announce = encode(
        false,
        99,
        convertSerialNumberToTarget(SERIAL),
        false,
        false,
        0,
        Type.StateService,
        new Uint8Array([1, 0x7c, 0xdd, 0x00, 0x00]),
      );
      fake.send(announce, lanAddress.port, '127.0.0.1');

      const device = await lan.devices.get(SERIAL, { timeoutMs: 2000 });
      assert.equal(device.address, '127.0.0.1');
      assert.equal(device.port, fakePort);
      assert.equal(added.length, 1);
      assert.equal(added[0], device);
      assert.equal(tapped.length, 1);
      assert.equal(tapped[0]?.type, Type.StateService);
    } finally {
      await lan.close();
      await closeSocket(fake);
    }
  });

  test('close() rejects pending sends and is idempotent', async () => {
    const fake = dgram.createSocket('udp4');
    const silentPort = await bind(fake); // bound but never answers
    const lan = await openLan({ address: '127.0.0.1' });
    try {
      const device = Device({ serialNumber: SERIAL, address: '127.0.0.1', port: silentPort });
      const pending = lan.client.send(GetPowerCommand(), device, { timeoutMs: 10_000 });

      const first = lan.close();
      assert.equal(lan.close(), first); // every call returns the same promise
      await first;

      await assert.rejects(pending, DisposedClientError);
      assert.equal(typeof lan[Symbol.asyncDispose], 'function');
      await lan[Symbol.asyncDispose](); // still resolves after close()
    } finally {
      await closeSocket(fake);
    }
  });

  test('rejects when the port is already taken', async () => {
    const squatter = dgram.createSocket('udp4');
    const port = await bind(squatter);
    try {
      await assert.rejects(openLan({ port, address: '127.0.0.1' }));
    } finally {
      await closeSocket(squatter);
    }
  });

  test('defaultTimeoutMs is forwarded to the client', async () => {
    const fake = dgram.createSocket('udp4');
    const silentPort = await bind(fake);
    const lan = await openLan({ address: '127.0.0.1', defaultTimeoutMs: 50 });
    try {
      const device = Device({ serialNumber: SERIAL, address: '127.0.0.1', port: silentPort });
      const started = Date.now();
      await assert.rejects(lan.client.send(GetPowerCommand(), device));
      assert.ok(Date.now() - started < 3000, 'timed out via the 50ms override, not the 3s default');
    } finally {
      await lan.close();
      await closeSocket(fake);
    }
  });
});
