// Ambient declaration for `fontkit`. Upstream ships an `index.d.ts` in
// dist/main but tsup's DTS bundler can't resolve it through pnpm's symlink
// tree. Until the inspect/subset code lands properly with @types/fontkit
// (or a typed fork), this minimal shim unblocks `tsup --dts` so the rest
// of @fontfetch/core can still publish its real types.
declare module "fontkit" {
  // Loose any-shaped Font object; this is intentional — the inspect.ts
  // surface will be re-typed when v1.1 ships properly.
  // biome-ignore lint/suspicious/noExplicitAny: deferred typing
  const fontkit: any;
  export default fontkit;
}
