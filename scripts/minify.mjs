/**
 * Minifies the compiled JavaScript in `dist` in place.
 *
 * Each file is transformed individually (not bundled), so the per-file module
 * layout that `package.json`'s `./*` export map depends on is preserved, while
 * the verbose, comment-heavy `tsc` output is stripped down for publication.
 * `.d.ts` files are left untouched so type information and its doc comments
 * remain intact for consumers.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { transform } from 'esbuild';

const DIST = join(import.meta.dirname, '..', 'dist');

async function* jsFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* jsFiles(path);
    } else if (entry.name.endsWith('.js')) {
      yield path;
    }
  }
}

let before = 0;
let after = 0;

for await (const file of jsFiles(DIST)) {
  const source = await readFile(file, 'utf8');
  const { code } = await transform(source, {
    minify: true,
    target: 'es2022',
    // No `format` override: keep the ESM/CJS syntax tsc already emitted.
    legalComments: 'none',
  });
  before += source.length;
  after += code.length;
  await writeFile(file, code);
}

console.log(`minified dist JS: ${before} -> ${after} bytes`);
