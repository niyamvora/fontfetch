/**
 * WOFF2 input/output for the morph pipeline.
 *
 * opentype.js can't read or write WOFF2, so we bracket the (synchronous)
 * morph engine with wawoff2: decompress WOFF2 → TTF on the way in, optionally
 * compress TTF → WOFF2 on the way out. Both calls are async (the WASM codec
 * initialises lazily), which is why they live outside the sync `morph()` core
 * and the caller awaits them.
 *
 * wawoff2 is loaded with a dynamic `import()`, on purpose:
 *  - it's an emscripten CJS module whose glue references `__dirname`, so it
 *    must stay external (unbundled) and load as CommonJS at runtime; and
 *  - importing it eagerly would init the WASM on every CLI startup. Lazy load
 *    means only an actual WOFF2 operation pays that cost.
 */

/** The wawoff2 surface we use; the package ships no types (see wawoff2.d.ts). */
type Wawoff2 = { compress(i: Uint8Array): Promise<Uint8Array>; decompress(i: Uint8Array): Promise<Uint8Array> };

async function loadWawoff2(): Promise<Wawoff2> {
  const mod = (await import('wawoff2')) as unknown as { default?: Wawoff2 } & Wawoff2;
  return mod.default ?? mod;
}

/** True when the binary carries the `wOF2` WOFF2 signature. Pure; no WASM. */
export function isWoff2(data: Uint8Array): boolean {
  return (
    data.length >= 4 &&
    data[0] === 0x77 && // w
    data[1] === 0x4f && // O
    data[2] === 0x46 && // F
    data[3] === 0x32 // 2
  );
}

/** Decompress a WOFF2 binary to a TrueType/OpenType binary opentype.js can parse. */
export async function decompressWoff2(data: Uint8Array): Promise<Uint8Array> {
  const wawoff2 = await loadWawoff2();
  return new Uint8Array(await wawoff2.decompress(data));
}

/** Compress a TrueType/OpenType binary to WOFF2. */
export async function compressWoff2(data: Uint8Array): Promise<Uint8Array> {
  const wawoff2 = await loadWawoff2();
  return new Uint8Array(await wawoff2.compress(data));
}
