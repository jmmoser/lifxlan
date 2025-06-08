/**
 * Performance benchmark suite for lifxlan core operations.
 * Run with: bun run benchmarks/performance.js
 */

import { performance } from 'perf_hooks';
import { encode, decodeHeader } from '../src/encoding.js';
import { Router } from '../src/router.js';
import { GetColorCommand, SetColorCommand } from '../src/commands.js';
import { NO_TARGET } from '../src/constants.js';

/**
 * @param {string} name
 * @param {() => void} fn
 * @param {number} iterations
 */
function benchmark(name, fn, iterations = 50000) {
  // Warmup
  for (let i = 0; i < Math.min(1000, iterations / 10); i++) {
    fn();
  }

  // Measure
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();

  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  const opsPerSec = 1000 / avgTime;

  console.log(`${name}:`);
  console.log(`  Total: ${totalTime.toFixed(2)}ms`);
  console.log(`  Average: ${(avgTime * 1000).toFixed(3)}µs`);
  console.log(`  Ops/sec: ${opsPerSec.toLocaleString()} ops/sec`);
  console.log();
}

console.log('🚀 LIFXLAN Performance Benchmarks\n');

// Critical encoding operations
benchmark('Message Encoding (SetColor)', () => {
  encode(true, 12345, NO_TARGET, true, true, 42, 102, new Uint8Array(13));
});

benchmark('Header Decoding', () => {
  const message = encode(true, 12345, NO_TARGET, true, true, 42, 102, new Uint8Array(13));
  decodeHeader(message);
});

benchmark('GetColorCommand Creation', () => {
  GetColorCommand();
});

benchmark('SetColorCommand Creation', () => {
  SetColorCommand(32768, 65535, 32768, 3500, 1000);
});

const router = Router({
  onSend() { /* no-op for benchmarking */ }
});

benchmark('Router Source Assignment', () => {
  const source = router.nextSource();
  const handler = () => {};
  router.register(source, handler);
  router.deregister(source, handler);
}, 10000);

console.log('✅ Benchmark Complete');
console.log('\n🎯 Target: >50k ops/sec for critical path operations');