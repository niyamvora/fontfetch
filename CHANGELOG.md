# Changelog

All notable changes to fontfetch will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-05-27

### Added
- Initial release.
- CLI: `fontfetch <url> [outDir]`
- Static `@font-face` parser: linked stylesheets, inline `<style>`, `<link rel="preload" as="font">`
- Per-site output folder with `files/`, `fonts.css` (local URLs), `fonts.json` manifest, and a human-readable `README.md`
- Collision-safe filenames across CDNs
- Node 18+, pure ESM, zero runtime dependencies
