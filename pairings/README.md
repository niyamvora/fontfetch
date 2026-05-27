# Font pairings registry

A community-curated list of font pairings used by real websites — with **free, open-source alternatives** for every commercial font.

This is the kind of thing typewolf.com and fonts-in-use.com do for inspiration. The difference here: **anyone can contribute**, the data is **machine-readable JSON**, and every entry tries to answer the actual question — *"OK but what can I actually ship instead?"*

## Browse

Every file in this folder (other than `_schema.json` and this README) is a single pairing. Open any one to see the shape:

- [`stripe-com.json`](./stripe-com.json)
- [`linear-app.json`](./linear-app.json)
- [`vercel-com.json`](./vercel-com.json)

## Three ways to contribute

### A. Fill out an issue form (easiest, no git knowledge needed)

[Open a "Submit a font pairing" issue](https://github.com/niyamvora/fontfetch/issues/new?template=font_pairing.yml). Fill the form, drag-and-drop a screenshot — done. A maintainer turns it into a JSON file.

### B. Ask an AI to do it for you

Copy this prompt into Claude, ChatGPT, Cursor, or any chat AI:

> Visit `<URL>` and identify the fonts the site uses. Open DevTools → Elements → Computed → `font-family` if you can.
>
> Output a single JSON object matching this schema:
>
> ```json
> {
>   "site": "Display name",
>   "url": "https://...",
>   "fonts": [
>     {
>       "family": "Font name",
>       "role": "headlines | body | code | ui",
>       "weights": [400, 500, 700],
>       "foundry": "If known",
>       "license": "open | commercial | unknown",
>       "free_alternatives": ["Inter", "Manrope"]
>     }
>   ],
>   "tags": ["sans-serif", "fintech"],
>   "notes": "Optional context",
>   "source": "How you identified the fonts"
> }
> ```
>
> Rules:
> - For each commercial font, suggest 1–3 **free** alternatives from Google Fonts that look similar.
> - If you're unsure of a foundry or license, set `"license": "unknown"` and skip the `foundry` field.
> - Be honest about uncertainty in the `notes` field.

Paste the AI's output into a new issue using the "Submit a font pairing" template. Done.

### C. Open a PR directly (for git-comfortable contributors)

1. Fork the repo
2. Create `pairings/<site-slug>.json` (slug = hostname with dots → dashes, e.g. `stripe-com.json`)
3. Validate locally: `npx ajv-cli@5 validate -s pairings/_schema.json -d "pairings/<your-file>.json" --strict=false`
4. Optional: drop a screenshot under `pairings/screenshots/<site-slug>.png` and reference its raw GitHub URL in the JSON
5. Open a PR — CI will validate the JSON automatically

## Screenshots

You don't need to commit images to the repo. The simplest path:

1. Take a screenshot
2. Drag-and-drop it into an issue or PR comment on GitHub
3. GitHub auto-uploads it and gives you a `https://user-images.githubusercontent.com/...` URL
4. Paste that URL into the `screenshot` field of your JSON

This keeps the repo lean and uses GitHub's CDN.

## Schema cheat sheet

| Field | Required | Notes |
|---|---|---|
| `site` | ✓ | Display name, e.g. "Stripe" |
| `url` | ✓ | Canonical URL |
| `submitter` | | GitHub handle, for credit |
| `screenshot` | | URL to image |
| `fonts[]` | ✓ | At least one entry |
| `fonts[].family` | ✓ | Font family name |
| `fonts[].role` | ✓ | "headlines" / "body" / "code" / "ui" / etc. |
| `fonts[].weights` | | Integer array, e.g. `[400, 500, 700]` |
| `fonts[].foundry` | | Designer/foundry name |
| `fonts[].license` | ✓ | `open` / `commercial` / `unknown` |
| `fonts[].free_alternatives` | | Family names from Google Fonts or OFL libraries |
| `tags` | | Lowercase hyphenated, e.g. `["sans-serif", "fintech"]` |
| `notes` | | Context, history, variants |
| `source` | | How you identified the fonts |

Full schema: [`_schema.json`](./_schema.json).

## What makes a good pairing entry

- **Honest license labels** — `commercial` when the foundry charges; `open` only for OFL/Apache/free-redistribution licenses
- **Real free alternatives** — actually similar in feel, not just "any sans-serif". Take 30 seconds to compare on Google Fonts
- **A source line** — "DevTools inspection" or "designer interview" or "checked CSS at https://..." — helps future maintainers verify
- **Notes that add context** — "they use a heavier weight than the default" or "switched from X to Y in 2024"

## What we don't want

- Pairings without `free_alternatives` for commercial fonts — that's the whole point of the registry
- Made-up data: if you're guessing, say so in `notes` and use `"license": "unknown"`
- Screenshots of paywalled or NSFW content
- Pairings for sites that don't exist or are clearly fake

## License

The pairings data in this folder is released under [CC0](https://creativecommons.org/publicdomain/zero/1.0/) — public domain, no attribution required. Reuse freely in your own tools.
