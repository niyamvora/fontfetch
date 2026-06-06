/**
 * Ambient types for `wawoff2` (the emscripten WOFF2 codec). The package ships
 * no type declarations; this is the slice we use. Both calls are async because
 * the underlying WASM module initialises lazily.
 */
declare module 'wawoff2' {
  export function compress(input: Uint8Array): Promise<Uint8Array>;
  export function decompress(input: Uint8Array): Promise<Uint8Array>;
  const wawoff2: { compress: typeof compress; decompress: typeof decompress };
  export default wawoff2;
}
