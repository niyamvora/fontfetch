import { defineConfig } from 'tsup';

/**
 * The published `fontfetch` npm package bundles `@fontfetch/core`,
 * `@fontfetch/morph`, and morph's `opentype.js` dependency into `dist/cli.js`
 * via `noExternal`, so npm consumers don't need any workspace machinery.
 *
 * `wawoff2` (the WOFF2 WASM codec) stays EXTERNAL — its emscripten glue
 * references `__dirname` and can't run inside an ESM bundle. It's a normal
 * runtime dependency that npm installs, dynamically imported only when a morph
 * actually touches WOFF2. Playwright is likewise external — an optional peer
 * dep loaded only in --headless mode.
 */
export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: false,
  sourcemap: true,
  shims: false,
  minify: false,
  external: ['playwright', 'wawoff2'],
  noExternal: ['@fontfetch/core', '@fontfetch/morph', 'opentype.js'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
