import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  // Must stay false: `scripts/bake-pairings.mjs` runs before tsup and writes
  // dist/pairings.json (the raw-JSON `./pairings.json` export). A clean here
  // would wipe it, shipping a tarball whose `./pairings.json` subpath 404s.
  // tsup overwrites index.* every build; `pnpm run clean` does the rm -rf.
  clean: false,
  dts: true,
  sourcemap: true,
  shims: false,
  minify: false,
});
