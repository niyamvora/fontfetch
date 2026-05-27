# Architecture

fontfetch is intentionally small — under 500 lines of TypeScript across 6 files. This doc explains the shape so contributors can find their way in.

## Pipeline

```
URL
 │
 ▼
[fetchText]              ─── fetches the HTML
 │
 ▼
[parse: extract CSS]     ─── <link rel=stylesheet>, inline <style>, <link rel=preload as=font>
 │
 ▼
[fetchText × N]          ─── pulls every external stylesheet
 │
 ▼
[parse: @font-face]      ─── one descriptor per face: family, weight, style, src, unicode-range
 │
 ▼
[claim filenames]        ─── collision-safe local names, deduped by URL
 │
 ▼
[fetchBuffer × N]        ─── downloads font files
 │
 ▼
[emit]                   ─── writes fonts.css, fonts.json, README.md
```

## Files

| File | Lines | Role |
|---|---|---|
| `src/cli.ts` | ~50 | Arg parsing, help, dispatch |
| `src/pull.ts` | ~85 | Orchestrator — calls parse/fetch/emit |
| `src/parse.ts` | ~65 | HTML + @font-face regex parsing |
| `src/emit.ts` | ~75 | Builds fonts.css, fonts.json, per-site README |
| `src/utils.ts` | ~50 | fetch, slugs, logging, constants |
| `src/types.ts` | ~30 | FontFace, FontSource, PullOptions, PullResult |

## Design choices

**Regex parser, not a real CSS AST.** @font-face is a constrained subset of CSS, and the cost of pulling in postcss for one regex was not worth it. If we ever hit a case the regex can't handle, we revisit.

**Zero runtime deps.** Everything users install is `tsup` output. No `axios`, no `cheerio`. Node's built-in `fetch` (Node 18+) is enough.

**Per-site output folder.** Multiple runs against different sites don't collide. Filenames within `files/` are derived from the URL pathname, with host-prefix fallback if a basename collides across CDNs.

**One file per face, even for unicode-range subsets.** Sites like Google Fonts split a single family/weight across many files for different language ranges. We keep them all — the browser handles which one to load.

## Extension points

**Adding a new source of CSS** (e.g., shadow DOM, `<style>` inside `<iframe>`): add a function in `parse.ts` that returns a list of `{text, base}` and wire it into `cssSources` in `pull.ts`.

**Adding a framework emitter** (roadmap v0.3): create `src/emitters/<name>.ts` exporting a function that takes `FontFace[]` and returns a string. Wire it into a `--emit` flag in `cli.ts`.

**Adding headless mode** (roadmap v0.2): branch in `pull.ts` — if `--headless`, use Playwright to load the page, await `document.fonts.ready`, then dump from `document.fonts.values()` instead of the regex parser.
