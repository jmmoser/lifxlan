/**
 * Minifies the compiled JavaScript in `dist` in place.
 *
 * Each file is transformed individually (not bundled), preserving the
 * compiled module graph (and with it, tree-shakability), while the verbose,
 * comment-heavy `tsc` output is stripped down for publication.
 *
 * Uses the esbuild build API so the source maps emitted by `tsc` are read
 * (via their sourceMappingURL comments) and composed into the minified
 * output: published stack traces and debugger sessions resolve back to the
 * original TypeScript, whose content is embedded in the maps.
 * `.d.ts` files are left untouched so type information and its doc comments
 * remain intact for consumers.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';

const DIST = join(import.meta.dirname, '..', 'dist');

async function jsFiles(dir, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await jsFiles(path, found);
    } else if (entry.name.endsWith('.js')) {
      found.push(path);
    }
  }
  return found;
}

const entryPoints = await jsFiles(DIST);

await build({
  entryPoints,
  outdir: DIST,
  outbase: DIST,
  allowOverwrite: true,
  write: true,
  bundle: false,
  minify: true,
  target: 'es2022',
  // No `format` override: keep the ESM/CJS syntax tsc already emitted.
  legalComments: 'none',
  sourcemap: 'linked',
  sourcesContent: true,
});

console.log(`minified ${entryPoints.length} dist JS files (source maps preserved)`);
