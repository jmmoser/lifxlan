/**
 * Performance benchmark suite for lifxlan core operations.
 * Run with: bun run benchmarks/performance.js
 */

import { bench, group, run } from 'mitata';
import { encode, decodeHeader, decodeStateLabel } from '../src/encoding.js';
import { Router } from '../src/router.js';
import { Client } from '../src/client.js';
import { Devices, Device } from '../src/devices.js';
import { GetColorCommand, SetColorCommand, GetServiceCommand, SetPowerCommand, GetPowerCommand } from '../src/commands.js';
import { NO_TARGET } from '../src/constants/core.js';
import { convertSerialNumberToTarget, convertTargetToSerialNumber } from '../src/utils/index.js';
import { hsbToRgb, rgbToHsb } from '../src/utils/color.js';
import { Type } from '../src/constants/types.js';

group('Protocol Operations', () => {
  bench('Message Encoding (SetColor)', () => {
    encode(true, 12345, NO_TARGET, true, true, 42, 102, new Uint8Array(13));
  });

  const message = encode(true, 12345, NO_TARGET, true, true, 42, 102, new Uint8Array(13));

  bench('Header Decoding', () => {
    decodeHeader(message);
  });
});

group('Command Creation', () => {
  bench('GetColorCommand Creation', () => {
    GetColorCommand();
  });

  bench('SetColorCommand Creation', () => {
    SetColorCommand(32768, 65535, 32768, 3500, 1000);
  });
});

group('decodeStateLabel', () => {
  const bytes = new Uint8Array([0x53, 0x77, 0x69, 0x74, 0x63, 0x68, 0x00]);
  bench('decodeStateLabel', () => {
    decodeStateLabel(bytes, { current: 0 })
  });
})

group('Router Operations', () => {
  const router = Router({
    onSend() { /* no-op for benchmarking */ }
  });

  const handler = () => { };

  bench('Router Source Assignment', () => {
    const source = router.nextSource();
    router.register(source, handler);
    router.deregister(source, handler);
  });
});

group('Client Operations', () => {
  const router = Router({
    onSend() { /* no-op for benchmarking */ }
  });

  const client = Client({ router });

  bench('Client Broadcast Command', () => {
    const command = GetServiceCommand();
    // Benchmark just the command creation and encoding setup
    client.broadcast(command);
  });

  bench('Client Unicast Setup', () => {
    const device = Device({
      address: '192.168.1.100',
      serialNumber: 'd073d5123456'
    });
    
    const command = GetColorCommand();
    // Benchmark the message preparation (without network I/O)
    client.unicast(command, device);
  });
});

group('Device Management', () => {
  const devices = Devices();

  bench('Device Registration', () => {
    devices.register('d073d5123456', 56700, '192.168.1.100');
  });

  bench('Serial Number to Target Conversion', () => {
    convertSerialNumberToTarget('d073d5123456');
  });

  const target = new Uint8Array([0xd0, 0x73, 0xd5, 0x12, 0x34, 0x56]);

  bench('Target to Serial Number Conversion', () => {
    convertTargetToSerialNumber(target);
  });
});

group('Color Utilities', () => {
  bench('HSB to RGB Conversion', () => {
    hsbToRgb(21845, 65535, 32768);
  });

  bench('RGB to HSB Conversion', () => {
    rgbToHsb(255, 128, 0);
  });
});

group('Additional Commands', () => {
  bench('GetServiceCommand Creation', () => {
    GetServiceCommand();
  });

  bench('SetPowerCommand Creation', () => {
    SetPowerCommand(65535);
  });
});

group('Client', () => {
  const payload = new Uint8Array(2);
  new DataView(payload.buffer).setUint16(0, 65535, true);

  const client = Client({
    defaultTimeoutMs: 0,
    router: Router({
      onSend(messsage) {
        const header = decodeHeader(messsage);

        client.router.receive(
          encode(
            header.tagged,
            header.source,
            header.target,
            false,
            false,
            header.sequence,
            Type.StatePower,
            payload,
          ),
        );
      },
    }),
  });

  const device = Device({
    serialNumber: 'abcdef123456',
    port: 1234,
    address: '1.2.3.4',
  });
  
  const cmd = GetPowerCommand();

  // 128ns
  bench('encode', () => {
    encode(
      false,
      1,
      device.target,
      true,
      false,
      device.sequence,
      cmd.type,
      undefined,
    );
  });

  const message = encode(true, 12345, NO_TARGET, true, true, 42, 102, new Uint8Array(13));

  // 125ns
  bench('decodeHeader', () => {
    decodeHeader(message);
  });

  // 226ns
  bench('router receive', () => {
    client.router.receive(message);
  });

  // 1100ns
  bench('send', async () => {
    await client.send(cmd, device);
  });
  // }).gc('inner');
});

await run();