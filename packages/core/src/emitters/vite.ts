import type { Emitter } from './types.js';
import { groupByFamily } from './util.js';

/**
 * Vite (and any plain-bundler) integration. The generated `fonts.css` already
 * does 95% of the work — this emitter produces a `vite.fonts.md` with
 * copy-pasteable import lines and family-name references so users don't have
 * to re-derive them from the manifest.
 */
export const viteEmitter: Emitter = (faces, ctx) => {
  const byFamily = groupByFamily(faces);
  if (byFamily.size === 0) return null;

  const lines: string[] = [
    '# Vite integration',
    '',
    'The generated `fonts.css` is already a drop-in `@font-face` stylesheet — no Vite-specific plugin needed.',
    '',
    '## Steps',
    '',
    '1. Copy this folder into your project, e.g. `src/assets/fonts/<site>/`',
    '2. Import the stylesheet from your entry file:',
    '',
    '   ```ts',
    '   // src/main.ts (or src/main.tsx, etc.)',
    `   import './assets/fonts/<site>/fonts.css';`,
    '   ```',
    '',
    '3. Reference the families in your CSS or Tailwind config:',
    '',
  ];

  for (const family of byFamily.keys()) {
    lines.push(`   - \`font-family: '${family}';\``);
  }
  lines.push('');

  lines.push('## Notes');
  lines.push('');
  lines.push('- Vite emits the font files as-is during build; they go through `vite-plugin-static-copy` or your asset pipeline automatically when imported via `url()` in the CSS.');
  lines.push(`- File paths in \`fonts.css\` are relative (\`./${ctx.filesDir}/...\`), so the import works from anywhere you place this folder.`);
  lines.push('');

  return { filename: 'vite.fonts.md', content: lines.join('\n') };
};
