# @fontfetch/registry

Typed access to the [fontfetch community font-pairings registry](https://github.com/niyamvora/fontfetch/tree/main/pairings).

For font pickers, design plugins, VS Code extensions, and any tool that wants to consume the open-source pairings + free-alternative recommendations with full TypeScript autocomplete.

## Install

```bash
npm install @fontfetch/registry
```

Zero runtime dependencies. Pure data.

## Usage

```ts
import {
  allPairings,
  findByFamily,
  freeAlternativesFor,
  findByTag,
  allTags,
  allFamilies,
  type Pairing,
} from '@fontfetch/registry';

allPairings();                          // every entry, typed Pairing[]
findByFamily('Söhne');                   // pairings that use Söhne
freeAlternativesFor('Söhne');            // ['Inter', ...] — ranked by citation count
findByTag('fintech');                    // pairings tagged 'fintech'
allTags();                               // every tag in the registry
allFamilies();                           // every family across all pairings
```

You can also import the raw JSON:

```ts
import pairings from '@fontfetch/registry/pairings.json';
```

## Why

The registry under [`pairings/`](https://github.com/niyamvora/fontfetch/tree/main/pairings) ships as community-submittable JSON files. This package bakes them into a typed npm consumable so downstream tools don't have to fetch from GitHub or maintain their own schema.

The data is the same; this package is the type-safe wrapper.

## Contributing

To add a pairing, submit it to the [fontfetch repository](https://github.com/niyamvora/fontfetch/tree/main/pairings) — `@fontfetch/registry` rebakes from the upstream registry on every release.

## License

[MIT](../../LICENSE) — © Niyam Vora
