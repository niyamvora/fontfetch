import { defineConfig } from 'tsup';

/**
 * The published `fontfetch` npm package is a single self-contained file: tsup
 * bundles `@fontfetch/core`, `@fontfetch/morph`, and morph's `opentype.js`
 * dependency into `dist/cli.js` via `noExternal`, so npm consumers don't need
 * any workspace machinery or extra installs. Playwright stays external — it's
 * an optional peer dep loaded dynamically only in --headless mode.
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
  external: ['playwright'],
  noExternal: ['@fontfetch/core', '@fontfetch/morph', 'opentype.js'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
