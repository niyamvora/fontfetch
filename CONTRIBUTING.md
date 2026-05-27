# Contributing to fontfetch

Thanks for taking a look. fontfetch is a pnpm-workspaces monorepo: the
published CLI is a thin wrapper around a shared core library that the v0.5
webapp will also consume.

## Dev loop

```bash
git clone https://github.com/niyamvora/fontfetch
cd fontfetch
corepack enable                          # picks up pnpm@9 from packageManager
pnpm install
pnpm run build
node ./packages/cli/dist/cli.js https://example.com
```

For iterative work:

```bash
pnpm run dev                             # tsup --watch on every package
pnpm --filter @fontfetch/core test       # run just the core tests
pnpm --filter fontfetch start -- https://example.com
```

## Repo layout

```
packages/
├── core/              @fontfetch/core — shared pipeline (parse, license,
│                      provenance, emitters, pull). Imported by the CLI,
│                      the webapp, and the worker.
└── cli/               `fontfetch` — the published npm package. Single
                       file, bundles core via tsup.

apps/
├── web/               Reserved for fontfetch.dev (v0.5)
└── worker/            Reserved for the Playwright headless service (v0.5.x)
```

See [docs/architecture.md](./docs/architecture.md) for the file-level breakdown
and pipeline diagram.

## Scripts (run from repo root)

| Command | What |
|---|---|
| `pnpm run build` | Build every package via tsup |
| `pnpm run dev` | Watch mode across packages |
| `pnpm run typecheck` | `tsc --noEmit` in every package |
| `pnpm run test` | Vitest in every package |
| `pnpm run clean` | Wipe per-package `dist/` |
| `pnpm run cli -- <url>` | Run the built CLI |

Per-package: `pnpm --filter <name> <script>` (e.g.
`pnpm --filter @fontfetch/core run typecheck`).

## Sending a PR

1. Fork and branch from `main` (or the active release branch — check the
   roadmap)
2. Keep changes scoped — one concern per PR
3. If you're adding a feature from the roadmap, mention the version it targets
   in your PR description
4. New CLI flags need: implementation in [packages/core](./packages/core),
   wiring in [packages/cli/src/cli.ts](./packages/cli/src/cli.ts), README
   usage example, and a CHANGELOG entry

## What we're looking for

The [roadmap](./docs/roadmap.md) is the priority list.

## What we'd rather not merge

- Tools to bypass DRM or auth on font services
- Anything framed as helping users avoid licensing commercial fonts
- Heavy dependencies in the install path (we keep `dependencies` near zero on
  purpose; the CLI bundle is one file)

## Code style

- TypeScript strict mode
- ESM only
- No `default` exports
- Prefer named exports + small files
- No comments unless they explain a non-obvious *why*
- Anything that should be reusable by the webapp goes in `@fontfetch/core` and
  is re-exported from
  [packages/core/src/index.ts](./packages/core/src/index.ts) — that file is the
  public surface

## Reporting issues

Use the issue templates. Include: Node version, OS, the URL you tried, what
you expected, what happened.
