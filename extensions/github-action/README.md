# fontfetch-action

GitHub Action that audits a URL's `@font-face` declarations on every PR — bundle size, commercial-font alerts, and OFL alternatives from the [fontfetch pairings registry](../../pairings).

The action wraps the published [`fontfetch` CLI](https://www.npmjs.com/package/fontfetch). Future fontfetch releases compose forward without touching this code.

## Usage

```yaml
name: Font audit
on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write   # required when `comment: 'true'`
    steps:
      - uses: niyamvora/fontfetch-action@v1
        with:
          url: ${{ steps.preview.outputs.url }}
          max-kb: 200
          no-commercial: 'true'
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `url` | ✓ | — | URL to audit (preview deployment, staging, or live). |
| `max-kb` | | — | Fail the action when total font bundle exceeds this many KB. |
| `per-family-kb` | | — | Per-family budget map: `Inter:30,Geist:40`. |
| `no-commercial` | | `false` | Fail when any face is classified as commercial. |
| `comment` | | `true` | Post the audit summary as a PR comment. |
| `github-token` | | `${{ github.token }}` | Token for the PR comment. |
| `fontfetch-version` | | `latest` | fontfetch CLI version to run. |

## Outputs

| Output | Description |
|---|---|
| `passed` | `true` if every audit rule passed. |
| `total-kb` | Total bundle size in KB. |
| `families` | Comma-separated families detected. |
| `report-json` | Raw `AuditReport` JSON for downstream steps. |

## Example PR comment

```
### fontfetch audit — 🚨 Failed

URL: https://staging.acme.com

- Families: 4
- Faces: 12
- Files: 18
- Total: 312.4 KB
- License: 8 open / 2 commercial / 2 unknown

#### Violations
- **budget_exceeded** — Total font bundle is 312.4 KB, exceeds budget of 200 KB
- **commercial_present** — 2 commercial face(s) detected: Söhne, Söhne Mono
```

## How it works

1. The action runs `npx fontfetch audit <url> --json` with the inputs you supply.
2. Parses the structured `AuditReport` from stdout.
3. Sets outputs (`passed`, `total-kb`, `families`, `report-json`) so downstream steps can branch on them.
4. Posts a PR comment with the verdict (when running on a `pull_request` event and a token is available).
5. Exits non-zero when any audit rule fails.

## Development

```bash
cd extensions/github-action
pnpm install
pnpm build      # builds dist/index.js for the action runtime
```

The action runs as `node20`; the published artefact is `dist/index.js`.

## License

[MIT](../../LICENSE) — © Niyam Vora
