# Examples

Runnable scripts showing the library in real use. Each file is self-contained — socket setup included — so you can copy any of them straight into your own project.

| Example | What it does |
| --- | --- |
| [`discover.ts`](discover.ts) | Find every LIFX device on your network and print its label |
| [`toggle-power.ts`](toggle-power.ts) | Toggle the power of every discovered device |
| [`color-cycle.ts`](color-cycle.ts) | Party mode: sweep the hue of every light using fire-and-forget sends |
| [`deno-discover.ts`](deno-discover.ts) | Device discovery using Deno's datagram API |

## Running from a clone of this repo

The examples import `lifxlan` by name, which Node and Bun resolve to this package's built output (package self-reference). Build once, then run:

```bash
bun install
bun run build

bun examples/discover.ts
# or with Node 22.18+ (runs TypeScript directly):
node examples/discover.ts
```

For the Deno example (imports `npm:lifxlan` from the registry):

```bash
deno run --allow-net --unstable-net examples/deno-discover.ts
```

## Running in your own project

```bash
npm install lifxlan
```

Copy any example into your project and run it — the imports work as-is.
