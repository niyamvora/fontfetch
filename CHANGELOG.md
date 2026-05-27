# Changelog

All notable changes to fontfetch will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1] — 2026-05-27

### Added
- **Community font-pairing registry** at `pairings/` — JSON files describing fonts used by real websites, with free OFL alternatives for commercial fonts
- JSON Schema (`pairings/_schema.json`) with validation rules
- Issue template (`.github/ISSUE_TEMPLATE/font_pairing.yml`) for non-technical contributors — fill a form, drag a screenshot
- AI-agent prompt in `pairings/README.md` so anyone can use Claude/ChatGPT/Cursor to draft a pairing JSON
- CI workflow (`.github/workflows/validate-pairings.yml`) that validates new pairings against the schema on every PR
- Seed pairings: Stripe, Linear, Vercel
- Pairings data released under CC0 — public domain, reusable by any third-party tool

### Notes
- The CLI itself is unchanged in v0.1.1. This release ships repo infrastructure for the community registry.

## [0.1.0] — 2026-05-27

### Added
- Initial release.
- CLI: `fontfetch <url> [outDir]`
- Static `@font-face` parser: linked stylesheets, inline `<style>`, `<link rel="preload" as="font">`
- Per-site output folder with `files/`, `fonts.css` (local URLs), `fonts.json` manifest, and a human-readable `README.md`
- Collision-safe filenames across CDNs
- Node 18+, pure ESM, zero runtime dependencies
