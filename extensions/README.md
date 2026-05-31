# `extensions/`

Distribution channels for fontfetch. Each subdirectory ships independently and has its own install/publish lifecycle — they're kept in this monorepo so they evolve alongside the CLI but they are **not part of the pnpm workspace**.

| Subdirectory | What it is | Distribution path |
|---|---|---|
| [`github-action/`](./github-action/) | GitHub Action wrapping `fontfetch audit` for PR comments + non-zero CI exits | Moves to its own repo (`niyamvora/fontfetch-action`) on first release |
| [`homebrew/`](./homebrew/) | Homebrew Formula | Copies to `niyamvora/homebrew-fontfetch` repo when published |
| [`raycast/`](./raycast/) | Raycast extension with 3 commands (extract, audit, search pairings) | Submitted to `raycast/extensions` when published |

## Why a separate `extensions/` directory?

`packages/*` and `apps/*` are the pnpm workspace globs. Anything in those is built + tested by `pnpm -r build` and ships from the workspace. The three items in `extensions/` each have very different toolchains (Ruby for Homebrew, ncc-bundled Node for the Action, Raycast's own CLI for the extension) — keeping them out of the workspace lets each lifecycle run on its own pace without bloating the main CI.

When any of them are mature enough to publish, the typical move is to graduate them to their own repository. That decision is per-channel and lives in each subdirectory's README.

## How they relate to the rest of the repo

- The **GitHub Action** wraps the published `fontfetch` CLI via `npx`. It depends on shipped CLI versions; you don't need to rebuild it when you bump fontfetch.
- The **Homebrew Formula** points at the npm tarball. Bump `url` + `sha256` after each `npm publish`.
- The **Raycast extension**'s "Extract" and "Audit" commands shell out to `npx fontfetch`; its "Search Font Pairings" command consumes `@fontfetch/registry` directly from npm.

All three are downstream consumers of the canonical CLI + registry. The engine work happens in `packages/`; this directory is where it surfaces to users.
