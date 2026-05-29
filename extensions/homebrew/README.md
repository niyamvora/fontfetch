# Homebrew tap for fontfetch

This directory holds the source-of-truth Formula for the [Homebrew](https://brew.sh) install path of fontfetch. The Formula is intentionally a one-file Ruby script — Homebrew taps are minimal by design.

## Install (for users, once the tap is published)

```bash
brew tap niyamvora/fontfetch
brew install fontfetch
```

## Publish (for maintainers)

The Formula in this directory is the canonical source. To make it installable via `brew`, it has to live in a repository named `homebrew-fontfetch` under the same GitHub account. One-time setup:

1. Create [`niyamvora/homebrew-fontfetch`](https://github.com/niyamvora) (empty repo, default branch `main`).
2. In that repo, create `Formula/fontfetch.rb` and copy this directory's `fontfetch.rb` into it.
3. Update `url` to point at the current npm tarball.
4. Update `sha256` by running:

   ```bash
   curl -sL https://registry.npmjs.org/fontfetch/-/fontfetch-1.4.0.tgz | shasum -a 256
   ```

5. Push.
6. Users install with `brew install niyamvora/fontfetch/fontfetch`.

## Bumping on every release

Once we get past ~500 stars, automate the bump. Workflow on the main fontfetch repo:

```yaml
# .github/workflows/bump-homebrew.yml — sketched, not committed yet
on:
  release:
    types: [published]
jobs:
  bump:
    uses: dawidd6/action-homebrew-bump-formula@v3
    with:
      token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
      tap: niyamvora/homebrew-fontfetch
      formula: fontfetch
```

Until then, manual bumps after each `npm publish` are fine.
