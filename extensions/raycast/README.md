# Raycast Extension — fontfetch

Three Raycast commands for the designer-dev crossover audience:

- **Extract Fonts from URL** — paste a URL, get every `@font-face` block + per-family file list. CSS copied to clipboard on success.
- **Audit URL** — run `fontfetch audit` with optional `--max-kb` and `--no-commercial` flags. Surfaces the verdict in a HUD.
- **Search Font Pairings** — search the community registry by family, tag, or site. Free OFL alternatives one keypress away.

## Develop locally

```bash
cd extensions/raycast
pnpm install
pnpm dev          # opens in Raycast in development mode
```

Requirements: macOS, [Raycast](https://www.raycast.com), Node 18+.

The "Extract" and "Audit" commands shell out to `npx fontfetch` — no API key needed; the CLI does the work.

The "Search Font Pairings" command consumes [`@fontfetch/registry`](../../packages/registry) directly. Type a family or tag to filter.

## Publish to Raycast Store

```bash
pnpm publish
```

Or submit to [raycast/extensions](https://github.com/raycast/extensions) when ready.

## License

[MIT](../../LICENSE) — © Niyam Vora
