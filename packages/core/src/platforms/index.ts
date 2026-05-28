/**
 * Third-party platform quirks. Each module isolates the host-specific
 * behaviour (e.g. Next.js subset-sibling probing) so the rest of the
 * pipeline stays vendor-neutral.
 */
export * from './nextjs.js';
