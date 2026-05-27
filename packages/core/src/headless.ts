import type { CssSource } from './types.js';
import { UA } from './utils.js';

export interface HeadlessResult {
  cssSources: CssSource[];
  networkFontUrls: string[];
}

const INSTALL_HINT = `
Playwright is required for --headless mode. To install:

  npm install playwright
  npx playwright install chromium

Or skip --headless to use the static parser.
`.trim();

export async function fetchHeadless(url: string, timeoutMs = 30000): Promise<HeadlessResult> {
  let chromium: typeof import('playwright').chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error(INSTALL_HINT);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    const msg = (e as Error).message;
    if (/Executable doesn't exist|browserType\.launch/i.test(msg)) {
      throw new Error(
        `Playwright is installed but Chromium isn't. Run:\n  npx playwright install chromium\n\n(${msg})`,
      );
    }
    throw e;
  }

  try {
    const context = await browser.newContext({ userAgent: UA });
    const page = await context.newPage();

    const networkFontUrls = new Set<string>();
    page.on('response', (response) => {
      const u = response.url();
      const ct = (response.headers()['content-type'] || '').toLowerCase();
      const isFontByExt = /\.(woff2|woff|ttf|otf|eot)(\?|$)/i.test(u);
      const isFontByType = ct.startsWith('font/') || ct === 'application/font-woff' || ct === 'application/font-woff2';
      if ((isFontByExt || isFontByType) && response.status() < 400) {
        networkFontUrls.add(u);
      }
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });

    // Wait for the FontFaceSet to settle (resolves once all in-flight fonts are loaded).
    await page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready);

    // Dump every @font-face rule from every same-origin stylesheet. Cross-origin sheets
    // throw on .cssRules; the network listener covers those URLs as a backstop.
    const cssText = await page.evaluate(() => {
      const out: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules;
          if (!rules) continue;
          for (const rule of Array.from(rules)) {
            if (rule.type === CSSRule.FONT_FACE_RULE) {
              out.push(rule.cssText);
            }
          }
        } catch {
          // cross-origin stylesheet — skip
        }
      }
      return out.join('\n');
    });

    return {
      cssSources: cssText ? [{ text: cssText, base: url }] : [],
      networkFontUrls: [...networkFontUrls],
    };
  } finally {
    await browser.close();
  }
}
