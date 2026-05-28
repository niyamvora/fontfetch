/**
 * Heuristic signatures for license classification. Not legal advice.
 *
 * - OPEN_HOSTS: URL substring → high-confidence open/self-hostable signal
 * - COMMERCIAL_HOSTS: URL substring → high-confidence commercial-foundry signal
 * - KNOWN_OPEN_FAMILIES: family-name match → open (covers self-hosted Google Fonts catalog families)
 *
 * Keep additions conservative — a false "open" classification could mislead a
 * user into shipping a paid font. False "commercial" is the safer failure
 * mode (worst case: a slightly noisier LICENSE_REVIEW.md).
 */

export interface HostSignature {
  /** Substring matched against the font URL */
  host: string;
  /** Human-readable label shown in LICENSE_REVIEW.md */
  label: string;
}

export const OPEN_HOSTS: HostSignature[] = [
  { host: 'fonts.gstatic.com', label: 'Google Fonts CDN' },
  { host: 'fonts.googleapis.com', label: 'Google Fonts API' },
  { host: 'cdn.jsdelivr.net/npm/@fontsource/', label: 'Fontsource (mostly OFL)' },
  { host: 'rsms.me/inter', label: 'Inter — OFL (by Rasmus Andersson)' },
  { host: 'cdn.jsdelivr.net/gh/google/fonts', label: 'Google Fonts GitHub mirror' },
];

export const COMMERCIAL_HOSTS: HostSignature[] = [
  { host: 'use.typekit.net', label: 'Adobe Fonts (Typekit)' },
  { host: 'fonts.adobe.com', label: 'Adobe Fonts' },
  { host: 'p.typekit.net', label: 'Adobe Fonts (Typekit)' },
  { host: 'fast.fonts.net', label: 'Monotype (fonts.com)' },
  { host: 'cloud.typenetwork.com', label: 'Type Network' },
  { host: 'cloud.typography.com', label: 'Hoefler & Co (Cloud.typography)' },
  { host: 'use.fontawesome.com', label: 'Font Awesome (commercial tiers)' },
  { host: 'fontstand.com', label: 'Fontstand' },
];

/**
 * Common families released under SIL OFL / Apache (or otherwise free for
 * self-hosting). Used when the URL host isn't enough — many sites
 * self-host OFL fonts on their own CDN. Family-name match is case-insensitive
 * and trimmed.
 *
 * Source: top families from the Google Fonts catalog plus a handful of
 * well-known free fonts.
 */
export const KNOWN_OPEN_FAMILIES: string[] = [
  // Top sans
  'Inter',
  'Inter Display',
  'Inter Tight',
  'Roboto',
  'Roboto Condensed',
  'Roboto Flex',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Oswald',
  'Raleway',
  'Nunito',
  'Nunito Sans',
  'Ubuntu',
  'PT Sans',
  'Source Sans Pro',
  'Source Sans 3',
  'Mulish',
  'Karla',
  'Work Sans',
  'Quicksand',
  'DM Sans',
  'Manrope',
  'Outfit',
  'Space Grotesk',
  'Plus Jakarta Sans',
  'Public Sans',
  'Hind',
  'Cabin',
  'Atkinson Hyperlegible',
  // Geist (Vercel + Basement Studio, OFL)
  'Geist',
  'Geist Mono',
  'Geist Sans',
  // Mono
  'JetBrains Mono',
  'Fira Code',
  'Fira Mono',
  'Source Code Pro',
  'IBM Plex Mono',
  'Space Mono',
  'DM Mono',
  'Roboto Mono',
  // Serif
  'Playfair Display',
  'Merriweather',
  'Noto Serif',
  'Noto Sans',
  'EB Garamond',
  'Lora',
  'Bitter',
  'Cardo',
  'Cormorant',
  'Crimson Text',
  'PT Serif',
  'DM Serif Display',
  'DM Serif Text',
  // IBM Plex (Apache 2.0)
  'IBM Plex Sans',
  'IBM Plex Serif',
  // Fira (OFL)
  'Fira Sans',
  // Display / handwritten
  'Lobster',
  'Pacifico',
  'Sacramento',
  'Dancing Script',
  'Caveat',
  'Indie Flower',
  'Patrick Hand',
  'Comic Neue',
  'Architects Daughter',
];
