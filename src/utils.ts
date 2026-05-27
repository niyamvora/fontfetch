import path from 'node:path';

export const FONT_EXT_RE = /\.(woff2|woff|ttf|otf|eot)(\?[^"')\s]*)?$/i;

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return await res.text();
}

export async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export function abs(u: string, base: string): string | null {
  try {
    return new URL(u, base).toString();
  } catch {
    return null;
  }
}

export function siteSlug(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '').replace(/[^a-zA-Z0-9.-]/g, '_');
}

export function safeFilename(url: string): string {
  const u = new URL(url);
  const base = path.basename(u.pathname) || 'font';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export const log = {
  info: (msg: string) => console.log(msg),
  warn: (msg: string) => console.warn(msg),
  err: (msg: string) => console.error(msg),
};
