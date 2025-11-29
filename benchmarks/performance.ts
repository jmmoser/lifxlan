/**
 * Performance benchmark suite for lifxlan core operations.
 * Run with: bun run benchmarks/performance.js
 */

import { bench, group, run } from 'mitata';
import { encode, decodeHeader } from '../src/encoding.js';
import { Router } from '../src/router.js';
import { Client } from '../src/client.js';
import { Devices, Device } from '../src/devices.js';
import { GetColorCommand, SetColorCommand, GetServiceCommand, SetPowerCommand } from '../src/commands.js';
import { NO_TARGET } from '../src/constants/core.js';
import { convertSerialNumberToTarget, convertTargetToSerialNumber } from '../src/utils/index.js';
import { hsbToRgb, rgbToHsb } from '../src/utils/color.js';

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

await run();