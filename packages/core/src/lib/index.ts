/**
 * Cross-cutting utilities (fetch, URL helpers, structured logger). Imported
 * from every other module — kept dependency-free so the dependency graph
 * stays a clean DAG with `lib/` as a leaf.
 */
export * from './utils.js';
