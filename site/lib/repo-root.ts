import path from 'node:path';

// site/ is always one level below the repo root, both locally and on Vercel
// (project root = site/, per spec §4.1), and skill content lives under
// catalog/ within that root. This is the single place that encodes that
// relationship — the generator script mirrors it independently since it
// runs before any TypeScript is compiled.
export const CATALOG_ROOT = path.resolve(process.cwd(), '..', 'catalog');
