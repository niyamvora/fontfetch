# apps/worker

Reserved for the Playwright-backed headless worker referenced in the v0.5.x
plan. Vercel serverless cannot host Chromium, so headless pulls from the
webapp will be delegated to a small always-on service (Render / Fly.io /
Cloud Run) that exposes a single `POST /headless` endpoint.

This directory is intentionally empty. When the worker is scaffolded it will
re-use `fetchHeadless()` from [`@fontfetch/core`](../../packages/core)
(`headless` module) instead of reimplementing the Playwright orchestration.
