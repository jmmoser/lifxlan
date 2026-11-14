/**
 * Builds the browser demo into single self-contained HTML files:
 *
 *   demo/dist/index.html  a complete document — open it from disk or host it anywhere
 *   demo/dist/embed.html  the same page without <html>/<head>/<body>, for hosts
 *                         that wrap content in their own document
 *
 * Run with `bun run demo`. The library is bundled from ../src, so no
 * `bun run build` is needed first.
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = import.meta.dir;
const out = join(root, 'dist');

const bundle = await Bun.build({
  entrypoints: [join(root, 'src/main.ts')],
  target: 'browser',
  format: 'iife',
  // Identifiers stay: the library's errors take their `name` from the class.
  minify: { whitespace: true, syntax: true, identifiers: false },
});
if (!bundle.success) {
  for (const log of bundle.logs) console.error(log);
  process.exit(1);
}
const [artifact] = bundle.outputs;
if (!artifact) throw new Error('the bundler produced no output');
// A literal "</script" inside the bundle would end the inline script early.
const script = (await artifact.text()).replace(/<\/script/gi, '<\\/script');

const page = await Bun.file(join(root, 'page.html')).text();
const [head, body] = page.split('<!-- body -->');
if (head === undefined || body === undefined || !body.includes('<!-- script -->')) {
  throw new Error('page.html must contain the <!-- body --> and <!-- script --> markers');
}
const filledBody = body.replace('<!-- script -->', () => `<script>${script}</script>`);

await mkdir(out, { recursive: true });
await Bun.write(join(out, 'embed.html'), head + filledBody);
await Bun.write(join(out, 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head.trim()}
</head>
<body>
${filledBody.trim()}
</body>
</html>
`);

const size = (await Bun.file(join(out, 'index.html')).arrayBuffer()).byteLength;
console.log(`demo/dist/index.html  ${(size / 1024).toFixed(1)} kB`);
