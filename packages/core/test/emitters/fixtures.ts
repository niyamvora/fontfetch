import type { FontFace } from '../../src/types.js';

/** A representative two-family fixture: a variable-name sans + a mono. */
export function makeFaces(): FontFace[] {
  return [
    {
      family: 'Inter',
      weight: '400',
      style: 'normal',
      display: 'swap',
      unicodeRange: null,
      sources: [{ url: 'https://example.com/Inter-Regular.woff2', format: 'woff2', localFile: 'Inter-Regular.woff2' }],
    },
    {
      family: 'Inter',
      weight: '700',
      style: 'normal',
      display: 'swap',
      unicodeRange: null,
      sources: [{ url: 'https://example.com/Inter-Bold.woff2', format: 'woff2', localFile: 'Inter-Bold.woff2' }],
    },
    {
      family: 'JetBrains Mono',
      weight: '400',
      style: 'normal',
      display: 'swap',
      unicodeRange: null,
      sources: [{ url: 'https://example.com/JetBrainsMono-Regular.woff2', format: 'woff2', localFile: 'JetBrainsMono-Regular.woff2' }],
    },
  ];
}
