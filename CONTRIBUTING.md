# Contributing to fontfetch

Thanks for taking a look. fontfetch is a small, focused CLI — the codebase is intentionally lean and easy to wrap your head around in one sitting.

## Dev loop

```bash
git clone https://github.com/niyamvora/fontfetch
cd fontfetch
npm install
npm run dev          # tsup --watch
node ./dist/cli.js https://example.com
```

## Project layout

```
src/
├── cli.ts      Entry point — arg parsing, help text, dispatch
├── pull.ts     Main download orchestration
├── parse.ts    HTML + @font-face parsing
├── emit.ts    Builds fonts.css / fonts.json / per-site README
├── utils.ts   fetch helpers, slugs, logging
└── types.ts   Shared interfaces (FontFace, FontSource, etc.)
```

## Scripts

| Command | What |
|---|---|
| `npm run build` | Build to `dist/` via tsup |
| `npm run dev` | Watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm start <url>` | Run the built CLI |

## Sending a PR

1. Fork and branch from `main`
2. Keep changes scoped — one concern per PR
3. If you're adding a feature from the roadmap, mention the version it targets in your PR description
4. New CLI flags need: implementation, README usage example, and CHANGELOG entry

## What we're looking for

The [roadmap in the README](./README.md#roadmap) is the priority list. High-impact contributions right now:

- **v0.2 Playwright mode** — biggest gap in the space; would unlock Adobe Typekit and SPA-rendered fonts
- **v0.3 framework emitters** — `next/font/local` config, Tailwind `fontFamily` config, Vite snippets
- **v0.4 license heuristic** — match font names against the Google Fonts catalog and known foundry CDNs

## What we'd rather not merge

- Tools to bypass DRM or auth on font services
- Anything framed as helping users avoid licensing commercial fonts
- Heavy dependencies in the install path (we keep `dependencies` near zero on purpose)

## Code style

- TypeScript strict mode
- ESM only
- No `default` exports
- Prefer named exports + small files
- No comments unless they explain a non-obvious *why*

## Reporting issues

Use the issue templates. Include: Node version, OS, the URL you tried, what you expected, what happened.
