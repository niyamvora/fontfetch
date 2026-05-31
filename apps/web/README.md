# apps/web

Reserved for the **fontfetch.dev** Next.js webapp planned in v0.5.

This directory is intentionally empty. When the webapp work begins, scaffold it
in place:

```bash
cd apps/web
pnpm create next-app@latest . --ts --app --tailwind --eslint --src-dir --import-alias "@/*"
pnpm add @fontfetch/core@workspace:*
```

The webapp imports the shared pipeline from [`@fontfetch/core`](../../packages/core),
exposes `POST /api/pull` as a Route Handler, and streams progress events over
SSE. See [docs/roadmap.html](../../docs/roadmap.html#v05) for the public scope.
