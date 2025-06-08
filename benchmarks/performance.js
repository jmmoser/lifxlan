/**
 * Performance benchmark suite for lifxlan core operations.
 * Run with: bun run benchmarks/performance.js
 */

import { bench, group, run } from 'mitata';
import { encode, decodeHeader } from '../src/encoding.js';
import { Router } from '../src/router.js';
import { GetColorCommand, SetColorCommand } from '../src/commands.js';
import { NO_TARGET } from '../src/constants.js';

console.log('🚀 LIFXLAN Performance Benchmarks\n');

// Critical encoding operations
group('Protocol Operations', () => {
  bench('Message Encoding (SetColor)', () => {
    encode(true, 12345, NO_TARGET, true, true, 42, 102, new Uint8Array(13));
  });

  bench('Header Decoding', () => {
    const message = encode(true, 12345, NO_TARGET, true, true, 42, 102, new Uint8Array(13));
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

  bench('Router Source Assignment', () => {
    const source = router.nextSource();
    const handler = () => {};
    router.register(source, handler);
    router.deregister(source, handler);
  });
});

await run();

console.log('\n✅ Benchmark Complete');
console.log('🎯 Target: >50k ops/sec for critical path operations');