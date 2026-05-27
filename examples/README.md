# Examples

Sample output folders so people can browse what `fontfetch` produces without running it.

## Rule

**Examples in this folder must use OFL / freely-redistributable fonts only** (Google Fonts, SIL OFL library, or your own self-authored fonts). Don't commit commercial foundry fonts here — even for "demo purposes". That makes this repo a DMCA target and undermines the project's positioning.

Good source URLs for examples:
- A Google-Fonts-using site (most marketing sites built with Tailwind defaults)
- The fontfetch docs site itself (once we have one)
- An OFL-only demo page we author

## Adding an example

1. `npm run build`
2. `node ./dist/cli.js https://<ofl-using-site> ./examples`
3. Verify every font in `files/` is OFL or otherwise free to redistribute
4. Commit
